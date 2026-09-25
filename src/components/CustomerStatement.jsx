import React, { useState, useMemo, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import { saveFileWithCapacitorPermission, shareFileWithCapacitorPermission } from "../utils/capacitorPermissions";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
  formatNumber,
  toPersianDigits,
  getCurrentPersianDate,
} from "../utils/invoiceHelpers";
import "../styles/customer-statement.css";
import "../styles/invoice.css";
import "../styles/customer-ledger.css";
import { useAppStore } from "../store/useAppStore";
import JalaliDatePickerModal from "./JalaliDatePickerModal";

export default function CustomerStatement({ customer, onBack, onNavigate }) {
  const allPayments = useAppStore((state) => state.payments);
  const allInvoices = useAppStore((state) => state.invoices);
  const savePayment = useAppStore((state) => state.savePayment);
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [datePickerTarget, setDatePickerTarget] = useState(null);
  const [sortOrder, setSortOrder] = useState("desc");
  const [expandedItems, setExpandedItems] = useState({});
  const [showDateModal, setShowDateModal] = useState(false);

  const statementCardRef = useRef(null);
  const transformComponentRef = useRef(null);
  const exportPopupRef = useRef(null);
  const [exportModal, setExportModal] = useState({ show: false, action: null });
  const [isSaving, setIsSaving] = useState(false);
  const [toastText, setToastText] = useState("");
  const [toastShow, setToastShow] = useState(false);

  const showToast = (msg) => {
    setToastText(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 3000);
  };

  useEffect(() => {
    if (exportModal.show) {
      const handleOutsideClick = (e) => {
        if (exportPopupRef.current && exportPopupRef.current.contains(e.target)) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setExportModal({ show: false, action: null });
      };

      document.addEventListener('click', handleOutsideClick, { capture: true });
      document.addEventListener('touchstart', handleOutsideClick, { capture: true, passive: false });

      return () => {
        document.removeEventListener('click', handleOutsideClick, { capture: true });
        document.removeEventListener('touchstart', handleOutsideClick, { capture: true });
      };
    }
  }, [exportModal.show]);

  const generateStatementCanvas = async () => {
    if (!statementCardRef.current) throw new Error("کارت صورت‌حساب یافت نشد");
    try {
      transformComponentRef.current?.resetTransform?.(0);
    } catch (e) {
      console.warn("Transform reset error:", e);
    }
    const originalElement = statementCardRef.current;
    const targetWidth = 950;
    const cloneWrapper = document.createElement("div");
    cloneWrapper.id = "statement-view";
    cloneWrapper.className = "statement-export-container";
    
    const clonedElement = originalElement.cloneNode(true);
    clonedElement.style.transform = "none";
    clonedElement.style.zoom = "1";
    clonedElement.style.margin = "0 auto";
    clonedElement.style.padding = "24px";
    clonedElement.style.boxSizing = "border-box";
    clonedElement.style.width = `${targetWidth}px`;
    clonedElement.style.maxWidth = `${targetWidth}px`;
    clonedElement.style.boxShadow = "none";
    
    cloneWrapper.appendChild(clonedElement);
    cloneWrapper.style.position = "absolute";
    cloneWrapper.style.left = "-9999px";
    cloneWrapper.style.top = "-9999px";
    cloneWrapper.style.width = `${targetWidth}px`;
    cloneWrapper.style.background = "var(--app-bg)";
    
    document.body.appendChild(cloneWrapper);
    
    const images = cloneWrapper.getElementsByTagName("img");
    await Promise.all(Array.from(images).map(img => {
      if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));
    
    await new Promise(resolve => setTimeout(resolve, 80));
    
    let canvas;
    try {
      canvas = await html2canvas(clonedElement, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: targetWidth,
        windowWidth: targetWidth,
        scrollX: 0,
        scrollY: 0
      });
    } catch (e1) {
      console.warn("Error rendering scale 2, trying 1.5:", e1);
      canvas = await html2canvas(clonedElement, {
        scale: 1.5,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: targetWidth,
        windowWidth: targetWidth,
        scrollX: 0,
        scrollY: 0
      });
    } finally {
      if (document.body.contains(cloneWrapper)) {
        document.body.removeChild(cloneWrapper);
      }
    }
    return canvas;
  };

  const performExport = async (format) => {
    const action = exportModal.action;
    setExportModal({ show: false, action: null });
    
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      const canvas = await generateStatementCanvas();
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      const fileName = `Statement_${customer.id}_${timestamp}.${format}`;
      
      let blob;
      let base64DataUrl;
      
      if (format === 'pdf') {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        blob = pdf.output('blob');
        base64DataUrl = pdf.output('datauristring');
      } else {
        const imgData = canvas.toDataURL("image/png");
        base64DataUrl = imgData;
        blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      }

      if (!blob) {
        showToast("خطا در ایجاد خروجی");
        setIsSaving(false);
        return;
      }

      const base64Clean = base64DataUrl.split(",")[1];
      const file = new File([blob], fileName, { type: format === 'pdf' ? "application/pdf" : "image/png" });

      if (action === 'save') {
        if (Capacitor.isNativePlatform()) {
          const saved = await saveFileWithCapacitorPermission(fileName, base64DataUrl, msg => showToast(msg));
          if (saved) showToast("ذخیره شد در پوشه Documents");
        } else if (window.AndroidBridge?.saveImageToGallery && format === 'png') {
          window.AndroidBridge.saveImageToGallery(base64Clean);
          showToast("ذخیره شد");
        } else if (window.AndroidBridge?.saveImage && format === 'png') {
          window.AndroidBridge.saveImage(base64Clean);
          showToast("ذخیره شد");
        } else if (window.Android?.saveImageToGallery && format === 'png') {
          window.Android.saveImageToGallery(base64Clean);
          showToast("ذخیره شد");
        } else if (window.AndroidInterface?.saveImageToGallery && format === 'png') {
          window.AndroidInterface.saveImageToGallery(base64Clean);
          showToast("ذخیره شد");
        } else {
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = fileName;
          link.href = blobUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
          showToast("دانلود آغاز شد");
        }
      } else if (action === 'share') {
        if (Capacitor.isNativePlatform()) {
           await shareFileWithCapacitorPermission(fileName, base64DataUrl, msg => showToast(msg));
           setIsSaving(false);
           return;
        }

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: "صورت‌حساب",
              text: "صورت‌حساب مشتری",
              files: [file]
            });
            showToast("با موفقیت به اشتراک گذاشته شد");
          } catch (error) {
            console.error("Share error:", error);
            if (error.name !== "AbortError") {
              showToast("خطا در اشتراک‌گذاری");
            }
          }
        } else {
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = fileName;
          link.href = blobUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
          showToast("مرورگر شما از اشتراک‌گذاری فایل پشتیبانی نمی‌کند، فایل دانلود شد.");
        }
      }
    } catch (e) {
      console.error(e);
      showToast("خطا در پردازش تصویر صورت‌حساب");
    } finally {
      setIsSaving(false);
    }
  };

  const saveAsImage = () => setExportModal({ show: true, action: 'save' });
  const shareAsImage = () => setExportModal({ show: true, action: 'share' });


  const payments = useMemo(() => {
    if (!customer?.id) return [];
    return allPayments.filter(
      (p) => String(p.customerId) === String(customer.id),
    );
  }, [allPayments, customer]);

  const invoices = useMemo(() => {
    if (!customer?.id) return [];
    return allInvoices.filter(
      (inv) => String(inv.customerId) === String(customer.id),
    );
  }, [allInvoices, customer]);

  const { statementTransactions, startBalance, endBalance, isFiltered } =
    useMemo(() => {
      const pItems = payments.map((p) => ({
        id: `p-${p.id}`,
        originalId: p.id,
        kind: "payment",
        type: `دریافتی (${p.method || "نقدی"})`,
        method: p.method || "نقدی",
        date: p.date || "",
        rawDate: p.createdAt || p.date || "",
        amount: Number(p.amount || 0),
      }));
      
      const iItems = invoices
        .filter((inv) => inv.type !== "پیش فاکتور")
        .map((inv) => {
          let parsedItems = inv.items;
          if (typeof inv.items === "string") {
            try {
              parsedItems = JSON.parse(inv.items);
            } catch (e) {
              parsedItems = [];
            }
          }
          return {
            id: `i-${inv.id}`,
            originalId: inv.id,
            kind: "invoice",
            type: inv.type || "فاکتور",
            number: inv.number,
            date: inv.date || "",
            rawDate: inv.createdAt || inv.date || "",
            amount: Number(inv.amount || 0),
            items: parsedItems || [],
          };
        });
        
      const padDate = (d) => {
        if (!d) return "";
        let parts = d.split("/");
        if (parts.length === 3) {
          return (
            parts[0] +
            "/" +
            parts[1].padStart(2, "0") +
            "/" +
            parts[2].padStart(2, "0")
          );
        }
        return d;
      };
      
      const allChronological = [...pItems, ...iItems].sort((a, b) => {
        const aDate = padDate(a.date);
        const bDate = padDate(b.date);
        if (aDate && bDate && aDate !== bDate) {
          return aDate.localeCompare(bDate);
        }
        return (a.rawDate || "").localeCompare(b.rawDate || "");
      });
      
      const processedAll = allChronological.reduce((acc, item) => {
        const lastBalance = acc.length > 0 ? acc[acc.length - 1].balanceAfter : 0;
        let newBalance = lastBalance;
        if (item.kind === "invoice") {
          newBalance += item.amount;
        } else if (item.kind === "payment") {
          newBalance -= item.amount;
        }
        acc.push({
          ...item,
          balanceAfter: newBalance,
        });
        return acc;
      }, []);
      
      let filtered = processedAll;
      let sBalance = 0;
      const hasFilter = startDate || endDate;
      
      if (hasFilter) {
        if (startDate) {
          const beforeStart = processedAll.filter(
            (item) => item.date < startDate,
          );
          sBalance =
            beforeStart.length > 0
              ? beforeStart[beforeStart.length - 1].balanceAfter
              : 0;
        }
        filtered = processedAll.filter((item) => {
          if (startDate && item.date < startDate) return false;
          if (endDate && item.date > endDate) return false;
          return true;
        });
      } else {
        sBalance = 0;
      }
      
      const eBalance =
        filtered.length > 0
          ? filtered[filtered.length - 1].balanceAfter
          : sBalance;
          
      if (sortOrder === "desc") {
        filtered = [...filtered].reverse();
      }
      
      return {
        statementTransactions: filtered,
        startBalance: sBalance,
        endBalance: eBalance,
        isFiltered: hasFilter,
      };
    }, [payments, invoices, startDate, endDate, sortOrder]);

  const toggleExpand = (id) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const isAnyExpanded = Object.keys(expandedItems).length > 0;

  const toggleAllExpanded = () => {
    if (isAnyExpanded) {
      setExpandedItems({});
    } else {
      const all = {};
      statementTransactions.forEach((t) => {
        if (t.kind === "invoice") all[t.id] = true;
      });
      setExpandedItems(all);
    }
  };

  const expandAll = () => {
    const allIds = {};
    statementTransactions
      .filter((t) => t.kind === "invoice")
      .forEach((t) => {
        allIds[t.id] = true;
      });
    setExpandedItems(allIds);
  };

  const collapseAll = () => {
    setExpandedItems({});
  };

  const handleRegisterSettlement = async () => {
    if (window.confirm("آیا از ثبت تسویه حساب تا این تاریخ اطمینان دارید?")) {
      const currentBalance =
        statementTransactions.length > 0
          ? statementTransactions[statementTransactions.length - 1].balanceAfter
          : 0;
      if (currentBalance === 0) {
        alert("حساب در حال حاضر صفر است و نیازی به تسویه ندارد.");
        return;
      }
      const settlementPayment = {
        customerId: customer.id,
        date: getCurrentPersianDate(),
        amount: currentBalance,
        method: "تسویه حساب",
        note: "تسویه حساب سیستمی",
        createdAt: new Date().toISOString(),
      };
      await savePayment(settlementPayment);
    }
  };

  return (
    <div className="statement-page-wrapper">
      <div className="statement-page">
        <div className="ledger-top-header no-print">
          <div className="ledger-top-header-info">
            <h2 className="ledger-main-title">{customer?.name}</h2>
            <span className="ledger-subtitle">صورت حساب</span>
          </div>
          <div className="ledger-header-buttons">
            <button
              className="ledger-header-btn"
              onClick={onBack}
              title="بازگشت"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 10 4 15 9 20"></polyline>
                <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="statement-filter-bar">
          <div className="ledger-filter-bar no-print">
            <div className="ledger-tabs">
              <button
                className={`ledger-tab-btn filter-btn-inner ${startDate || endDate ? "active" : ""}`}
                onClick={() => {
                  setTempStartDate(startDate || getCurrentPersianDate());
                  setTempEndDate(endDate || getCurrentPersianDate());
                  setShowDateModal(true);
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                تاریخ
              </button>

              <button className="ledger-tab-btn expand-all-btn" onClick={toggleAllExpanded}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`expand-icon ${isAnyExpanded ? "expanded" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <button className="ledger-tab-btn settlement-btn" onClick={handleRegisterSettlement}>
                ثبت تسویه حساب
              </button>
            </div>
            <button
              className="ledger-sort-btn"
              onClick={() =>
                setSortOrder(sortOrder === "desc" ? "asc" : "desc")
              }
              title={
                sortOrder === "desc"
                  ? "مرتب‌سازی: جدید به قدیم"
                  : "مرتب‌سازی: قدیم به جدید"
              }
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m7 15 5 5 5-5" />
                <path d="m7 9 5-5 5 5" />
              </svg>
            </button>
          </div>
        </div>

        <div className="st-main-container" dir="ltr">
          <TransformWrapper
            initialScale={typeof window !== "undefined" && window.innerWidth < 1000 ? Math.max((window.innerWidth - 30) / 950, 0.1) : 1}
            initialPositionX={typeof window !== "undefined" && window.innerWidth < 1000 ? 15 : 0}
            initialPositionY={10} 
            minScale={typeof window !== "undefined" && window.innerWidth < 1000 ? Math.max((window.innerWidth - 30) / 1050, 0.1) : 0.1}
            maxScale={4}
            centerOnInit={false}
            centerZoomedOut={false}
            limitToBounds={true}
            smooth={true}
            wheel={{ step: 0.1, smoothStep: 0.01 }}
            pinch={{ step: 5 }}
            panning={{ velocityDisabled: false }}
            doubleClick={{ mode: "reset", animationTime: 250 }}
            wrapperStyle={{ width: "100%", height: "100%" }}
            onInit={(ref) => {
              if (typeof window !== "undefined" && ref.instance && ref.instance.wrapperComponent) {
                const wrapperW = ref.instance.wrapperComponent.offsetWidth;
                const cardW = 950;
                const padding = 500;
                
                let idealScale = 1;
                if (window.innerWidth < 1000) {
                   idealScale = Math.max((wrapperW - 30) / cardW, 0.1);
                }
                
                const x = (wrapperW - cardW * idealScale) / 2 - (padding * idealScale);
                const y = 10 - (padding * idealScale); 
                
                ref.setTransform(x, y, idealScale, 0);
              }
            }}
          >
            <TransformComponent ref={transformComponentRef} 
              wrapperClass="statement-zoom-wrapper" 
              contentClass="statement-zoom-content" 
              wrapperStyle={{ width: "100%", height: "100%" }} 
              contentStyle={{ width: "max-content", height: "max-content", transformOrigin: "0 0" }}
            >
              <div style={{ padding: "500px" }}>
                <div className="statement-card" id="statement-print-area" dir="rtl" ref={statementCardRef}>
                  <div className="statement-inner">
                    <div className="statement-customer-header">
                      صورت حساب {customer?.name}
                      {isFiltered && (
                        <div className="statement-customer-subheader">
                          {startDate && `از تاریخ: ${toPersianDigits(startDate)}`}
                          {startDate && endDate && " - "}
                          {endDate && `تا تاریخ: ${toPersianDigits(endDate)}`}
                        </div>
                      )}
                    </div>

                    <div className="statement-table-wrapper">
                      <div className="statement-table">
                        <div className="statement-table-header">
                          <div className="st-col st-date">تاریخ</div>
                          <div className="st-col st-desc">شرح</div>
                          <div className="st-col st-debt">بدهکار</div>
                          <div className="st-col st-credit">بستانکار</div>
                          <div className="st-col st-balance">مانده</div>
                        </div>

                        {isFiltered && startBalance !== 0 && (
                          <div className="statement-table-row start-balance-row">
                            <div className="st-col st-date">-</div>
                            <div className="st-col st-desc">مانده از قبل</div>
                            <div className="st-col st-debt"></div>
                            <div className="st-col st-credit"></div>
                            <div className={`st-col st-balance ${startBalance > 0 ? "text-debt" : startBalance < 0 ? "text-credit" : ""}`}>
                              {startBalance !== 0 ? toPersianDigits(formatNumber(Math.abs(startBalance))) : "0"}
                            </div>
                          </div>
                        )}

                        {statementTransactions.map((item) => (
                          <React.Fragment key={item.id}>
                            <div
                              className={`statement-table-row ${item.method === "تسویه حساب" ? "settlement-row" : ""} ${item.kind === "invoice" ? "invoice-row-clickable cursor-pointer" : "cursor-default"}`}
                              onClick={item.kind === "invoice" ? () => toggleExpand(item.id) : undefined}
                            >
                              <div className="st-col st-date">{toPersianDigits(item.date)}</div>
                              <div className="st-col st-desc">
                                {item.kind === "invoice" ? (
                                  <div className="st-invoice-desc">
                                    <span>فاکتور فروش شماره <span dir="ltr" style={{ display: "inline-block" }}>{toPersianDigits(item.number)}</span></span>
                                  </div>
                                ) : (
                                  <span className="text-credit">دریافتی ({item.method})</span>
                                )}
                              </div>
                              <div className="st-col st-debt">
                                {item.kind === "invoice" ? toPersianDigits(formatNumber(item.amount)) : ""}
                              </div>
                              <div className="st-col st-credit">
                                {item.kind === "payment" ? toPersianDigits(formatNumber(item.amount)) : ""}
                              </div>
                              <div className={`st-col st-balance ${item.balanceAfter > 0 ? "text-debt" : item.balanceAfter < 0 ? "text-credit" : ""}`}>
                                {item.balanceAfter !== 0 ? toPersianDigits(formatNumber(Math.abs(item.balanceAfter))) : "0"}
                              </div>
                            </div>

                            {item.kind === "invoice" && expandedItems[item.id] && item.items && item.items.length > 0 && (
                              <div className="st-invoice-items">
                                <div className="st-items-header">
                                  <div className="st-item-name">نام کالا</div>
                                  <div className="st-item-qty">تعداد</div>
                                  <div className="st-item-price">فی</div>
                                  <div className="st-item-total">جمع</div>
                                </div>
                                {item.items.map((it, idx) => (
                                  <div className="st-item-row" key={idx}>
                                    <div className="st-item-name">{toPersianDigits(it.desc)}</div>
                                    <div className="st-item-qty">{toPersianDigits(it.quantity)}</div>
                                    <div className="st-item-price">{toPersianDigits(formatNumber(it.unitPrice))}</div>
                                    <div className="st-item-total">{toPersianDigits(formatNumber(Number(it.quantity) * Number(it.unitPrice)))}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </React.Fragment>
                        ))}

                        <div className="statement-table-row final-balance-row">
                          <div className="st-col final-balance-label">مانده نهایی:</div>
                          <div className={`st-col st-balance final-balance-value ${endBalance > 0 ? "text-debt" : endBalance < 0 ? "text-credit" : ""}`}>
                            {endBalance !== 0 ? toPersianDigits(formatNumber(Math.abs(endBalance))) : "0"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TransformComponent>
          </TransformWrapper>
        </div>

        {/* Bottom Actions */}
        <div className="invoice-bottom-bar">
          <div className="invoice-bottom-actions-card" style={{ position: "relative", justifyContent: "center", gap: "15px" }}>
            {exportModal.show && (
              <>
                <div ref={exportPopupRef} style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 15px)',
                  left: exportModal.action === 'share' ? '0' : '50%',
                  transform: exportModal.action === 'share' ? 'none' : 'translateX(-50%)',
                  background: '#0f4c75',
                  borderRadius: '12px',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: '130px',
                  zIndex: 110,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontFamily: 'inherit'
                }}>
                  <button onClick={(e) => { e.stopPropagation(); performExport('png'); }} style={{
                    padding: '10px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'transparent',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontFamily: 'inherit'
                  }}>تصویر (PNG)</button>
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '0 8px' }}></div>
                  <button onClick={(e) => { e.stopPropagation(); performExport('pdf'); }} style={{
                    padding: '10px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'transparent',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontFamily: 'inherit'
                  }}>فایل (PDF)</button>
                </div>
              </>
            )}
            <button type="button" className="action-btn share-btn" style={{ background: 'linear-gradient(180deg, #3282b8, #0f4c75)', width: 40, height: 40, borderRadius: '50%', color: 'white', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(15, 76, 117, 0.4)', padding: 0 }} onClick={shareAsImage} disabled={isSaving} title="اشتراک‌گذاری">
              {isSaving && exportModal.action === 'share' ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spinning-icon"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              )}
            </button>
            <button type="button" className="action-btn save-btn" style={{ background: 'linear-gradient(180deg, #3282b8, #0f4c75)', width: 40, height: 40, borderRadius: '50%', color: 'white', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(15, 76, 117, 0.4)', padding: 0 }} onClick={saveAsImage} disabled={isSaving} title="ذخیره">
              {isSaving && exportModal.action === 'save' ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spinning-icon"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              )}
            </button>
          </div>
        </div>


        {showDateModal && (
          <div
            className="custom-alert-overlay no-print"
            onClick={() => setShowDateModal(false)}
          >
            <div
              className="custom-alert-box"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="alert-title">فیلتر تاریخ</h3>

              <div className="alert-group alert-group-15">
                <label className="alert-label">از تاریخ:</label>
                <div className="st-date-relative">
                  <input
                    type="text"
                    placeholder="انتخاب کنید..."
                    value={tempStartDate}
                    readOnly
                    className="statement-date-input"
                    onClick={() => setDatePickerTarget("start")}
                  />
                  <button
                    type="button"
                    className="st-calendar-trigger-btn"
                    onClick={() => setDatePickerTarget("start")}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="alert-group alert-group-25">
                <label className="alert-label">تا تاریخ:</label>
                <div className="st-date-relative">
                  <input
                    type="text"
                    placeholder="انتخاب کنید..."
                    value={tempEndDate}
                    readOnly
                    className="statement-date-input"
                    onClick={() => setDatePickerTarget("end")}
                  />
                  <button
                    type="button"
                    className="st-calendar-trigger-btn"
                    onClick={() => setDatePickerTarget("end")}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="alert-actions">
                <button
                  className="ledger-action-btn alert-btn alert-btn-primary"
                  onClick={() => {
                    setStartDate(tempStartDate);
                    setEndDate(tempEndDate);
                    setShowDateModal(false);
                  }}
                >
                  تایید
                </button>
                {(tempStartDate || tempEndDate) && (
                  <button
                    className="ledger-action-btn alert-btn-secondary"
                    onClick={() => {
                      setTempStartDate("");
                      setTempEndDate("");
                    }}
                  >
                    حذف فیلتر
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        
        <JalaliDatePickerModal
          isOpen={datePickerTarget !== null}
          initialDate={
            datePickerTarget === "start"
              ? tempStartDate
              : datePickerTarget === "end"
                ? tempEndDate
                : ""
          }
          onSelectDate={(formattedDate) => {
            if (datePickerTarget === "start") setTempStartDate(formattedDate);
            else if (datePickerTarget === "end") setTempEndDate(formattedDate);
            setDatePickerTarget(null);
          }}
          onClose={() => setDatePickerTarget(null)}
        />
      
      {/* Toast Notification */}
      {toastShow && (
        <div className="invoice-toast" style={{
          position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15, 76, 117, 0.95)', color: 'white', padding: '12px 24px',
          borderRadius: '30px', fontSize: '0.95rem', fontWeight: 'bold', zIndex: 9999,
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)',
          animation: 'fadeInUp 0.3s ease', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          {toastText}
        </div>
      )}
</div>


    </div>
  );
}