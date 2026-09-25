import { useState, useEffect, useRef, useMemo } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import {
  saveFileWithCapacitorPermission,
  shareFileWithCapacitorPermission,
} from "../utils/capacitorPermissions";
import JalaliDatePickerModal from "./JalaliDatePickerModal";
import CustomSelect from "./CustomSelect";
import "../styles/invoice.css";
import {
  toPersianDigits,
  formatNumber,
  parseNumber,
  numberToPersianWords,
  getCurrentPersianDate,
  getCustomerCode,
  getAutoInvoiceNumber,
} from "../utils/invoiceHelpers";
import { useAppStore } from "../store/useAppStore";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import EditableField from "./EditableField";
const MAX_ROWS = 12;

const handleTransformInit = (ref) => {
  if (
    typeof window !== "undefined" &&
    ref.instance &&
    ref.instance.wrapperComponent
  ) {
    const wrapperW = ref.instance.wrapperComponent.offsetWidth;
    const cardW = 950;
    const padding = 500;

    let idealScale = 1;
    if (window.innerWidth < 1000) {
      idealScale = Math.max((wrapperW - 30) / cardW, 0.1);
    }

    const x = (wrapperW - cardW * idealScale) / 2 - padding * idealScale;
    const y = 32 - padding * idealScale;

    ref.setTransform(x, y, idealScale, 0);
  }
};

const zoomOptions = {
  wheel: { step: 0.1, smoothStep: 0.01 },
  pinch: { step: 5 },
  panning: { velocityDisabled: false },
  doubleClick: { mode: "reset", animationTime: 250 },
  wrapperStyle: { width: "100%", height: "100%" },
  contentStyle: {
    width: "max-content",
    height: "max-content",
    transformOrigin: "0 0",
  },
};

function Invoice({
  onNavigate,
  initialCustomer,
  customers = [],
  invoiceToEdit = null,
  initialStep = "form",
}) {
  const saveInvoice = useAppStore((state) => state.saveInvoice);
  const saveCustomer = useAppStore((state) => state.saveCustomer);
  const invoices = useAppStore((state) => state.invoices);
  const invoiceCardRef = useRef(null);
  const exportPopupRef = useRef(null);
  const [currentInvoice, setCurrentInvoice] = useState(invoiceToEdit);

  // --- Step state ('form' or 'preview') ---
  const [step, setStep] = useState(initialStep); // 'form' | 'preview'
  const [isClosingPage, setIsClosingPage] = useState(false); // استیت جدید برای انیمیشن خروج

  const transformComponentRef = useRef(null);
  const [toastText, setToastText] = useState("");
  const [toastShow, setToastShow] = useState(false);
  const [exportModal, setExportModal] = useState({ show: false, action: null });

  useEffect(() => {
    if (exportModal.show) {
      const handleOutsideClick = (e) => {
        if (
          exportPopupRef.current &&
          exportPopupRef.current.contains(e.target)
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setExportModal({ show: false, action: null });
      };

      document.addEventListener("click", handleOutsideClick, { capture: true });
      document.addEventListener("touchstart", handleOutsideClick, {
        capture: true,
        passive: false,
      });

      return () => {
        document.removeEventListener("click", handleOutsideClick, {
          capture: true,
        });
        document.removeEventListener("touchstart", handleOutsideClick, {
          capture: true,
        });
      };
    }
  }, [exportModal.show]);

  const toastTimerRef = useRef(null);
  const showToast = (msg = "ذخیره شد") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastText(msg);
    setToastShow(true);
    toastTimerRef.current = setTimeout(() => {
      setToastShow(false);
    }, 2500);
  };

  // --- States (وضعیت‌های فرم) ---
  const [theme, setTheme] = useState(
    () => localStorage.getItem("invoiceTheme") || "blue",
  );
  const [invoiceType, setInvoiceType] = useState(
    invoiceToEdit ? invoiceToEdit.type || "پیش فاکتور" : "پیش فاکتور",
  );
  const [invoiceDate, setInvoiceDate] = useState(
    invoiceToEdit
      ? invoiceToEdit.date || getCurrentPersianDate()
      : getCurrentPersianDate(),
  );

  // اطلاعات فروشنده (بارگیری از تنظیمات)
  const [sellerName] = useState(
    () => localStorage.getItem("companyName") || "نام شرکت خود را وارد کنید",
  );
  const [sellerAddress] = useState(
    () =>
      localStorage.getItem("companyAddress") || "آدرس شرکت خود را وارد کنید",
  );
  const [sellerPhone] = useState(
    () => localStorage.getItem("companyPhone") || "شماره تماس شرکت",
  );
  const [sellerEconomicCode] = useState(
    () => localStorage.getItem("companyEconomicCode") || "",
  );
  const [companyLogo] = useState(
    () => localStorage.getItem("companyLogo") || "",
  );

  const handleBack = () => {
    if (step === "preview" && initialStep === "form") {
      setStep("form");
      return;
    }

    // اجرای انیمیشن خروج
    setIsClosingPage(true);

    setTimeout(() => {
      const referrer = sessionStorage.getItem("invoiceReferrer");
      sessionStorage.removeItem("invoiceReferrer");
      if (referrer && referrer !== "invoice") {
        onNavigate(referrer);
      } else if (initialCustomer) {
        onNavigate("customer-ledger");
      } else {
        onNavigate("dashboard");
      }
    }, 200); // زمان انیمیشن خروج
  };

  const [selectedCustomerId, setSelectedCustomerId] = useState(
    invoiceToEdit && invoiceToEdit.customerId
      ? invoiceToEdit.customerId
      : initialCustomer
        ? initialCustomer.id
        : "",
  );
  const [buyerName, setBuyerName] = useState(
    initialCustomer ? initialCustomer.name : "",
  );
  const [buyerEconomicCode, setBuyerEconomicCode] = useState(
    initialCustomer && initialCustomer.economicCode
      ? initialCustomer.economicCode
      : "",
  );
  const [buyerAddress, setBuyerAddress] = useState(
    initialCustomer && initialCustomer.address ? initialCustomer.address : "",
  );
  const [buyerMobile, setBuyerMobile] = useState(
    initialCustomer && initialCustomer.phone ? initialCustomer.phone : "",
  );
  const [saveAsNewCustomer, setSaveAsNewCustomer] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // محاسبه اولیه شماره فاکتور
  const initialCustObj = customers.find(
    (c) => String(c.id) === String(selectedCustomerId),
  );
  const initialCustCode = getCustomerCode(initialCustObj, customers);
  const [invoiceNumber, setInvoiceNumber] = useState(() => {
    if (invoiceToEdit && invoiceToEdit.number) return invoiceToEdit.number;
    return getAutoInvoiceNumber(
      initialCustCode,
      invoiceType,
      invoices,
      selectedCustomerId,
    );
  });

  // تابع به‌روزرسانی شماره فاکتور خودکار
  const updateAutoInvoiceNumber = (custUserId, typeVal, invList = invoices) => {
    const currentCust = customers.find(
      (c) => String(c.id) === String(custUserId),
    );
    const custCode = getCustomerCode(currentCust, customers);
    const autoNum = getAutoInvoiceNumber(
      custCode,
      typeVal,
      invList,
      custUserId,
    );
    setInvoiceNumber(autoNum);
  };
  const PROFORMA_DEFAULT_NOTE =
    "به دلیل نوسانات بازار این پیش فاکتور تا زمان دریافت اسناد مالی قابل تغییر قیمت می‌باشد و فروشنده تضمینی در قبال مبلغ ندارد.";
  const INVOICE_DEFAULT_NOTE =
    "اقلام فاکتور تا زمان تسویه حساب کامل نزد خریدار به صورت امانت می باشد";
  const [noteText, setNoteText] = useState(() => {
    if (invoiceToEdit && invoiceToEdit.note !== undefined)
      return invoiceToEdit.note;
    const initialType = invoiceToEdit
      ? invoiceToEdit.type || "پیش فاکتور"
      : "پیش فاکتور";
    return initialType === "فاکتور فروش" || initialType === "فاکتور"
      ? INVOICE_DEFAULT_NOTE
      : PROFORMA_DEFAULT_NOTE;
  });
  const noteTextareaRef = useRef(null);
  useEffect(() => {
    if (noteTextareaRef.current) {
      noteTextareaRef.current.style.height = "auto";
      noteTextareaRef.current.style.height = `${Math.max(noteTextareaRef.current.scrollHeight, 95)}px`;
    }
  }, [noteText, step]);
  const [rows, setRows] = useState(() => {
    if (
      invoiceToEdit &&
      Array.isArray(invoiceToEdit.items) &&
      invoiceToEdit.items.length > 0
    ) {
      return invoiceToEdit.items.map((item, index) => {
        if (typeof item === "object" && item !== null) {
          return {
            id: Date.now() + index,
            desc: item.desc || "",
            quantity: item.quantity || "1",
            unitPrice: item.unitPrice || "",
          };
        }
        let desc = item;
        let qty = "1";
        if (typeof item === "string") {
          const match = item.match(/^\d+-\s*(.*?)\s*\(تعداد:\s*(.*?)\)$/);
          if (match) {
            desc = match[1];
            qty = match[2];
          }
        }
        return {
          id: Date.now() + index,
          desc,
          quantity: qty,
          unitPrice: "",
        };
      });
    }
    return [
      {
        id: Date.now(),
        desc: "",
        quantity: "",
        unitPrice: "",
      },
    ];
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [customAlert, setCustomAlert] = useState({
    show: false,
    message: "",
    type: "alert",
    onConfirm: null,
    onCancel: null,
  });

  const showAlert = (msg) => {
    return new Promise((resolve) => {
      setCustomAlert({
        show: true,
        message: msg,
        type: "alert",
        onConfirm: () => {
          setCustomAlert({
            show: false,
            message: "",
            type: "alert",
            onConfirm: null,
            onCancel: null,
          });
          resolve(true);
        },
        onCancel: () => {
          setCustomAlert({
            show: false,
            message: "",
            type: "alert",
            onConfirm: null,
            onCancel: null,
          });
          resolve(true);
        },
      });
    });
  };

  const showConfirm = (msg) => {
    return new Promise((resolve) => {
      setCustomAlert({
        show: true,
        message: msg,
        type: "confirm",
        onConfirm: () => {
          setCustomAlert({
            show: false,
            message: "",
            type: "alert",
            onConfirm: null,
            onCancel: null,
          });
          resolve(true);
        },
        onCancel: () => {
          setCustomAlert({
            show: false,
            message: "",
            type: "alert",
            onConfirm: null,
            onCancel: null,
          });
          resolve(false);
        },
      });
    });
  };

  // --- محاسبات اتوماتیک ---
  const grandTotal = rows.reduce((acc, row) => {
    const q =
      row.quantity === "" || row.quantity === undefined
        ? 1
        : parseNumber(row.quantity) || 0;
    const p =
      row.unitPrice === "" || row.unitPrice === undefined
        ? 0
        : parseNumber(row.unitPrice) || 0;
    return acc + q * p;
  }, 0);

  // --- مدیریت ردیف‌ها ---
  const addRow = () => {
    if (rows.length < MAX_ROWS) {
      setRows([
        ...rows,
        {
          id: Date.now() + Math.random(),
          desc: "",
          quantity: "",
          unitPrice: "",
        },
      ]);
    }
  };
  const removeRow = (index) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
    }
  };
  const updateRow = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  // هماهنگی انتخاب مشتری در فرم
  const handleCustomerSelect = (custId) => {
    setSelectedCustomerId(custId);
    updateAutoInvoiceNumber(custId, invoiceType);
    if (!custId) {
      setBuyerName("");
      setBuyerAddress("");
      setBuyerMobile("");
      setBuyerEconomicCode("");
      return;
    }
    const cust = customers.find((c) => String(c.id) === String(custId));
    if (cust) {
      setBuyerName(cust.name || "");
      setBuyerAddress(cust.address || "");
      setBuyerMobile(cust.phone || "");
      setBuyerEconomicCode(cust.economicCode || "");
    }
  };

  // --- تابع ثبت نهایی فاکتور و ذخیره مشتری جدید در صورت نیاز ---
  const handleSaveToDatabase = async () => {
    let targetCustomerId = selectedCustomerId;

    if (!targetCustomerId && buyerName.trim()) {
      const confirmMsg = `آیا می‌خواهید حساب جدید "${buyerName.trim()}" ثبت شود؟`;
      if (await showConfirm(confirmMsg)) {
        const existingCust = (customers || []).find(
          (c) =>
            c.name &&
            c.name.trim().toLowerCase() === buyerName.trim().toLowerCase(),
        );
        if (existingCust) {
          await showAlert(
            "مشتری با این نام از قبل وجود دارد. لطفاً از لیست انتخاب کنید یا نام دیگری وارد نمایید.",
          );
          return;
        }

        const extractedPhone = buyerMobile.replace(/[^\d۰-۹]/g, "");
        const extractedAddress = buyerAddress.replace(/^نشانی\s*:\s*/, "");

        const newCustData = {
          name: buyerName.trim(),
          phone: extractedPhone,
          address: extractedAddress,
          economicCode: buyerEconomicCode.trim(),
        };
        const savedOk = await saveCustomer(newCustData);
        if (savedOk) {
          const updatedCustList = useAppStore.getState().customers;
          const newlyAdded = updatedCustList.find(
            (c) =>
              c.name &&
              c.name.trim().toLowerCase() === buyerName.trim().toLowerCase(),
          );
          if (newlyAdded) {
            targetCustomerId = newlyAdded.id;
            setSelectedCustomerId(newlyAdded.id);
          }
        } else {
          await showAlert("خطا در ثبت مشتری جدید.");
          return;
        }
      } else {
        return; // Cancelled by user
      }
    }

    if (!targetCustomerId) {
      await showAlert(
        "یک حساب از لیست انتخاب کنید یا مشخصات مشتری جدید را تکمیل کنید.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const invoiceData = {
        customerId: targetCustomerId,
        customerName: buyerName,
        number: invoiceNumber,
        type: invoiceType,
        // 'فاکتور' یا 'پیش فاکتور'
        date: invoiceDate,
        amount: grandTotal,
        note: noteText,
        items: JSON.stringify(
          rows.map((r) => {
            return {
              desc: r.desc.trim() || "محصول جدید",
              quantity:
                r.quantity === "" || r.quantity === undefined
                  ? 1
                  : parseNumber(r.quantity),
              unitPrice:
                r.unitPrice === "" || r.unitPrice === undefined
                  ? 0
                  : parseNumber(r.unitPrice),
            };
          }),
        ),
        createdAt: currentInvoice
          ? currentInvoice.createdAt
          : new Date().toISOString(),
        ...(currentInvoice
          ? {
              id: currentInvoice.id,
            }
          : {}),
      };
      const isUpdate = !!currentInvoice;
      const savedInv = await saveInvoice(invoiceData);
      setCurrentInvoice(savedInv);
      const typeLabel =
        invoiceType === "فاکتور فروش" || invoiceType === "فاکتور"
          ? "فاکتور"
          : "پیش فاکتور";
      if (isUpdate) {
        setSaveSuccessMessage(`${typeLabel} بروزرسانی شد`);
      } else {
        setSaveSuccessMessage(`${typeLabel} در حساب مشتری ذخیره شد`);
      }
    } catch (err) {
      console.error("خطا در ذخیره فاکتور در دیتابیس:", err);
      showToast("خطا در ثبت فاکتور");
    } finally {
      setIsSaving(false);
    }
  };

  // --- تابع کمکی ساخت بوم (Canvas) با پشتیبانی کامل از موبایل و وب‌ویو ---
  const generateInvoiceCanvas = async () => {
    if (!invoiceCardRef.current) throw new Error("کارت فاکتور یافت نشد");
    const originalElement = invoiceCardRef.current;
    const targetWidth = 950;
    const cloneWrapper = document.createElement("div");
    cloneWrapper.id = "invoice-view";
    cloneWrapper.className = "invoice-view invoice-export-container";
    cloneWrapper.setAttribute("data-theme", theme || "blue");
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
    document.body.appendChild(cloneWrapper);
    const images = cloneWrapper.getElementsByTagName("img");
    await Promise.all(
      Array.from(images).map((img) => {
        try {
          img.crossOrigin = "anonymous";
        } catch (e) {
          console.warn("crossOrigin attribute error:", e);
        }
        if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }),
    );

    // تاخیر کوتاه جهت رندر کامل فونت‌ها و رنگ‌های تم
    await new Promise((resolve) => setTimeout(resolve, 80));
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
        scrollY: 0,
      });
    } catch (e1) {
      console.warn("خطا در رندر با مقیاس ۲، تلاش با مقیاس ۱.۵:", e1);
      canvas = await html2canvas(clonedElement, {
        scale: 1.5,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: targetWidth,
        windowWidth: targetWidth,
        scrollX: 0,
        scrollY: 0,
      });
    } finally {
      if (document.body.contains(cloneWrapper)) {
        document.body.removeChild(cloneWrapper);
      }
    }
    return canvas;
  };
  const performExport = async (format) => {
    const action = exportModal.action; // 'save' | 'share'
    setExportModal({ show: false, action: null });

    if (isSaving) return;
    setIsSaving(true);

    try {
      const canvas = await generateInvoiceCanvas();
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-");
      const fileName = `Invoice_${invoiceNumber}_${timestamp}.${format}`;

      let blob;
      let base64DataUrl;

      if (format === "pdf") {
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
        blob = pdf.output("blob");
        base64DataUrl = pdf.output("datauristring");
      } else {
        const imgData = canvas.toDataURL("image/png");
        base64DataUrl = imgData;
        blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
      }

      if (!blob) {
        showToast("خطا در ایجاد خروجی");
        setIsSaving(false);
        return;
      }

      const base64Clean = base64DataUrl.split(",")[1];
      const file = new File([blob], fileName, {
        type: format === "pdf" ? "application/pdf" : "image/png",
      });

      if (action === "save") {
        if (Capacitor.isNativePlatform()) {
          const saved = await saveFileWithCapacitorPermission(
            fileName,
            base64DataUrl,
            (msg) => showToast(msg),
          );
          if (saved) showToast("ذخیره شد در پوشه Documents");
        } else if (
          window.AndroidBridge?.saveImageToGallery &&
          format === "png"
        ) {
          window.AndroidBridge.saveImageToGallery(base64Clean);
          showToast("ذخیره شد");
        } else if (window.AndroidBridge?.saveImage && format === "png") {
          window.AndroidBridge.saveImage(base64Clean);
          showToast("ذخیره شد");
        } else if (window.Android?.saveImageToGallery && format === "png") {
          window.Android.saveImageToGallery(base64Clean);
          showToast("ذخیره شد");
        } else if (
          window.AndroidInterface?.saveImageToGallery &&
          format === "png"
        ) {
          window.AndroidInterface.saveImageToGallery(base64Clean);
          showToast("ذخیره شد");
        } else {
          // Download in browser
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = fileName;
          link.href = blobUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          showToast("ذخیره شد");
        }
      } else if (action === "share") {
        if (Capacitor.isNativePlatform()) {
          await shareFileWithCapacitorPermission(
            fileName,
            base64DataUrl,
            (msg) => showToast(msg),
          );
          setIsSaving(false);
          return;
        }

        let sharedViaWeb = false;
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${invoiceType} فروش`,
              text: `${invoiceType} شماره ${invoiceNumber} ارسال شده برای ${buyerName}`,
            });
            showToast("ارسال شد");
            sharedViaWeb = true;
          } catch (err) {
            console.log("اشتراک‌گذاری لغو شد یا خطایی رخ داد:", err);
            if (
              err.name === "AbortError" ||
              (err.message && err.message.toLowerCase().includes("abort"))
            ) {
              setIsSaving(false);
              return;
            }
          }
        }

        if (!sharedViaWeb) {
          if (format === "png") {
            const jpegDataUrl = canvas.toDataURL("image/jpeg", 1.0);
            const jpegClean = jpegDataUrl.split(",")[1];
            if (window.AndroidBridge?.shareImage) {
              window.AndroidBridge.shareImage(jpegClean);
              showToast("ارسال شد");
            } else if (window.Android?.shareImage) {
              window.Android.shareImage(jpegClean);
              showToast("ارسال شد");
            } else if (window.AndroidInterface?.shareImage) {
              window.AndroidInterface.shareImage(jpegClean);
              showToast("ارسال شد");
            } else {
              const blobUrl = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.download = fileName;
              link.href = blobUrl;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            }
          } else {
            // PDF Fallback (Android bridge normally doesn't have sharePdf but maybe shareFile, fallback to download)
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.download = fileName;
            link.href = blobUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          }
        }
      }
    } catch (error) {
      console.error("خطا در خروجی:", error);
      showToast("خطا در عملیات");
    } finally {
      setIsSaving(false);
    }
  };

  const saveAsImage = () => setExportModal({ show: true, action: "save" });
  const shareAsImage = () => setExportModal({ show: true, action: "share" });

  const handleAlertCloseAndNavigate = () => {
    setSaveSuccessMessage("");
  };

  return (
    <div
      id="invoice-view"
      className={`invoice-view pb-safe-bottom ${isClosingPage ? "is-closing-page" : ""}`}
      data-theme={theme}
    >
      {/* Header */}
      <div className="invoice-top-header">
        <h2 className="invoice-page-title">
          {step === "form"
            ? currentInvoice
              ? "ویرایش فاکتور"
              : "صدور فاکتور جدید"
            : "نمایش فاکتور"}
        </h2>
        <div className="invoice-header-buttons">
          <button className="invoice-btn" onClick={handleBack} title="بازگشت">
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

      {/* ===================== STEP 1: FORM ===================== */}
      {step === "form" && (
        <>
          <div className="invoice-form-container">
            {/* کادر ۱: مشخصات فاکتور */}
            <div className="invoice-form-card">
              <h3 className="invoice-form-section-title">مشخصات فاکتور</h3>
              <div className="invoice-form-grid-2">
                <div className="invoice-field-group">
                  <label className="invoice-field-label">نوع فاکتور</label>
                  <CustomSelect
                    value={invoiceType}
                    onChange={(newType) => {
                      setInvoiceType(newType);
                      updateAutoInvoiceNumber(selectedCustomerId, newType);
                      if (
                        noteText === PROFORMA_DEFAULT_NOTE ||
                        noteText === INVOICE_DEFAULT_NOTE ||
                        !noteText.trim()
                      ) {
                        setNoteText(
                          newType === "فاکتور فروش" || newType === "فاکتور"
                            ? INVOICE_DEFAULT_NOTE
                            : PROFORMA_DEFAULT_NOTE,
                        );
                      }
                    }}
                    options={[
                      {
                        value: "پیش فاکتور",
                        label: "پیش فاکتور",
                      },
                      {
                        value: "فاکتور فروش",
                        label: "فاکتور فروش",
                      },
                    ]}
                  />
                </div>

                <div className="invoice-form-grid-2-inner">
                  <div className="invoice-field-group">
                    <label className="invoice-field-label">شماره فاکتور</label>
                    <input
                      type="text"
                      dir="ltr"
                      style={{ textAlign: "right" }}
                      className="invoice-input-text"
                      value={invoiceNumber}
                      onChange={(e) =>
                        setInvoiceNumber(toPersianDigits(e.target.value))
                      }
                    />
                  </div>
                  <div className="invoice-field-group">
                    <label className="invoice-field-label">تاریخ فاکتور</label>
                    <div className="invoice-input-relative">
                      <input
                        type="text"
                        className="invoice-input-text date-input-field"
                        value={invoiceDate}
                        onChange={(e) =>
                          setInvoiceDate(toPersianDigits(e.target.value))
                        }
                      />
                      <button
                        type="button"
                        className="invoice-calendar-trigger-btn"
                        onClick={() => setIsDatePickerOpen(true)}
                        title="انتخاب تاریخ از تقویم"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          ></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* کادر ۲: اطلاعات خریدار */}
            <div className="invoice-form-card">
              <h3 className="invoice-form-section-title">اطلاعات خریدار</h3>

              <div className="invoice-field-group">
                <label className="invoice-field-label">
                  انتخاب مشتری از لیست
                </label>
                <CustomSelect
                  value={selectedCustomerId || ""}
                  onChange={(custId) => handleCustomerSelect(custId)}
                  options={[
                    {
                      value: "",
                      label: "-- مشتری جدید --",
                    },
                    ...customers.map((c) => ({
                      value: c.id,
                      label: `👤 ${c.name} - کد: ${toPersianDigits(getCustomerCode(c, customers))}`,
                    })),
                  ]}
                  placeholder="-- مشتری جدید --"
                />
              </div>

              <div className="invoice-form-grid-2">
                <div className="invoice-field-group">
                  <label className="invoice-field-label">
                    نام خریدار / شرکت *
                  </label>
                  <input
                    type="text"
                    className="invoice-input-text"
                    value={buyerName}
                    readOnly={!!selectedCustomerId}
                    style={
                      selectedCustomerId
                        ? { opacity: 0.7, cursor: "not-allowed" }
                        : {}
                    }
                    onChange={(e) => {
                      setBuyerName(e.target.value);
                    }}
                    placeholder=" شرکت...  "
                  />
                </div>

                <div className="invoice-field-group">
                  <label className="invoice-field-label">
                    کد اقتصادی خریدار
                  </label>
                  <input
                    type="text"
                    className="invoice-input-text"
                    value={buyerEconomicCode}
                    readOnly={!!selectedCustomerId}
                    style={
                      selectedCustomerId
                        ? { opacity: 0.7, cursor: "not-allowed" }
                        : {}
                    }
                    onChange={(e) =>
                      setBuyerEconomicCode(toPersianDigits(e.target.value))
                    }
                    placeholder=" ...123 "
                  />
                </div>
              </div>

              <div className="invoice-form-grid-2">
                <div className="invoice-field-group">
                  <label className="invoice-field-label">
                    شماره تماس خریدار
                  </label>
                  <input
                    type="text"
                    className="invoice-input-text"
                    value={toPersianDigits(buyerMobile)}
                    readOnly={!!selectedCustomerId}
                    style={
                      selectedCustomerId
                        ? { opacity: 0.7, cursor: "not-allowed" }
                        : {}
                    }
                    onChange={(e) => setBuyerMobile(e.target.value)}
                    placeholder=" ...0912 "
                  />
                </div>

                <div className="invoice-field-group">
                  <label className="invoice-field-label">نشانی خریدار</label>
                  <input
                    type="text"
                    className="invoice-input-text"
                    value={buyerAddress}
                    readOnly={!!selectedCustomerId}
                    style={
                      selectedCustomerId
                        ? { opacity: 0.7, cursor: "not-allowed" }
                        : {}
                    }
                    onChange={(e) => setBuyerAddress(e.target.value)}
                    placeholder="استان، شهر، خیابان..."
                  />
                </div>
              </div>
            </div>

            {/* کادر ۳: اقلام و کالاهای فاکتور */}
            <div className="invoice-form-card">
              <div className="invoice-form-section-header">
                <h3 className="invoice-form-section-title">
                  اقلام و کالاهای فاکتور
                </h3>
                <button
                  type="button"
                  className="invoice-add-row-btn"
                  onClick={addRow}
                  disabled={rows.length >= MAX_ROWS}
                >
                  ➕ افزودن سطر
                </button>
              </div>

              <div className="invoice-form-items-list">
                {rows.map((row, idx) => {
                  const qtyVal =
                    row.quantity === "" || row.quantity === undefined
                      ? 1
                      : parseNumber(row.quantity) || 1;
                  const priceVal =
                    row.unitPrice === "" || row.unitPrice === undefined
                      ? 0
                      : parseNumber(row.unitPrice) || 0;
                  return (
                    <div key={row.id} className="invoice-form-item-row">
                      <div className="item-row-top-bar">
                        <span className="item-row-badge">
                          سطر {toPersianDigits(idx + 1)}
                        </span>
                        {rows.length > 1 && (
                          <button
                            type="button"
                            className="item-row-delete-btn"
                            onClick={() => removeRow(idx)}
                            title="حذف این سطر"
                          >
                            🗑️ حذف
                          </button>
                        )}
                      </div>
                      <div className="item-row-fields">
                        <div className="item-field-desc">
                          <label className="item-label-sm">
                            شرح کالا / خدمات
                          </label>
                          <input
                            type="text"
                            className="invoice-input-text"
                            value={row.desc}
                            onChange={(e) =>
                              updateRow(idx, "desc", e.target.value)
                            }
                            placeholder="محصول جدید"
                          />
                        </div>
                        <div className="item-field-qty">
                          <label className="item-label-sm">تعداد</label>
                          <input
                            type="text"
                            className="invoice-input-text text-center"
                            value={
                              row.quantity === "" || row.quantity === undefined
                                ? ""
                                : toPersianDigits(row.quantity)
                            }
                            onChange={(e) =>
                              updateRow(
                                idx,
                                "quantity",
                                e.target.value === ""
                                  ? ""
                                  : parseNumber(e.target.value),
                              )
                            }
                            placeholder="۱"
                          />
                        </div>
                        <div className="item-field-price">
                          <label className="item-label-sm">
                            قیمت واحد (ریال)
                          </label>
                          <input
                            type="text"
                            className="invoice-input-text text-left"
                            value={
                              row.unitPrice === "" ||
                              row.unitPrice === 0 ||
                              row.unitPrice === undefined
                                ? ""
                                : formatNumber(row.unitPrice)
                            }
                            onChange={(e) =>
                              updateRow(
                                idx,
                                "unitPrice",
                                e.target.value === ""
                                  ? ""
                                  : parseNumber(e.target.value),
                              )
                            }
                            placeholder="۰"
                          />
                        </div>
                        <div className="item-field-total">
                          <label className="item-label-sm">جمع (ریال)</label>
                          <div className="item-total-val">
                            {formatNumber(qtyVal * priceVal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* جمع کل */}
              <div className="invoice-form-total-summary">
                <div className="summary-title">مبلغ کل فاکتور:</div>
                <div className="summary-amount">
                  {formatNumber(grandTotal)}{" "}
                  <span className="currency">ریال</span>
                </div>
              </div>
              <div className="invoice-form-words-summary">
                {numberToPersianWords(grandTotal)}
              </div>
            </div>

            {/* کادر ۴: توضیحات فاکتور */}
            <div className="invoice-form-card">
              <h3 className="invoice-form-section-title">توضیحات فاکتور</h3>
              <textarea
                ref={noteTextareaRef}
                className="invoice-input-textarea"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="توضیحات یا شرایط فاکتور را وارد کنید..."
              />
            </div>

            {/* دکمه پیش نمایش و ثبت */}
          </div>
          <div className="invoice-bottom-bar">
            <div className="invoice-bottom-actions-card">
              <button
                type="button"
                className="action-btn preview-btn"
                onClick={() => setStep("preview")}
                title="پیش نمایش"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button
                type="button"
                className="action-btn save-ledger-btn-circle"
                onClick={handleSaveToDatabase}
                disabled={isSaving}
                title="ذخیره در حساب مشتری"
              >
                {isSaving ? (
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="spinning-icon"
                  >
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line>
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ===================== STEP 2: PREVIEW ===================== */}
      {step === "preview" &&
        (() => {
          const isClient = typeof window !== "undefined";
          const screenW = isClient ? window.innerWidth : 1000;
          const initialScaleVal = Math.min((screenW - 32) / 950, 1);
          const minScaleVal = initialScaleVal * 0.8;
          const initialPosX = (screenW - 950 * initialScaleVal) / 2;
          return (
            <>
              <div className="main-container" dir="ltr">
                <TransformWrapper
                  ref={transformComponentRef}
                  initialScale={
                    typeof window !== "undefined" && window.innerWidth < 1000
                      ? Math.max((window.innerWidth - 30) / 950, 0.1)
                      : 1
                  }
                  initialPositionX={
                    typeof window !== "undefined" && window.innerWidth < 1000
                      ? 15
                      : 0
                  }
                  initialPositionY={32}
                  minScale={
                    typeof window !== "undefined" && window.innerWidth < 1000
                      ? Math.max((window.innerWidth - 30) / 1050, 0.1)
                      : 0.1
                  }
                  maxScale={4}
                  centerOnInit={false}
                  centerZoomedOut={false}
                  limitToBounds={true}
                  smooth={true}
                  wheel={zoomOptions.wheel}
                  pinch={zoomOptions.pinch}
                  panning={zoomOptions.panning}
                  doubleClick={zoomOptions.doubleClick}
                  wrapperStyle={zoomOptions.wrapperStyle}
                  onInit={handleTransformInit}
                >
                  <TransformComponent
                    wrapperClass="invoice-zoom-wrapper"
                    contentClass="invoice-zoom-content"
                    wrapperStyle={zoomOptions.wrapperStyle}
                    contentStyle={zoomOptions.contentStyle}
                  >
                    <div style={{ padding: "500px" }}>
                      <div
                        className="invoice-card"
                        id="reportCard"
                        ref={invoiceCardRef}
                        dir="rtl"
                      >
                        <div className="invoice-inner" id="invoice-content">
                          {/* Title Section */}
                          <div className="header-title">
                            <div className="header-title-center">
                              <h1>{invoiceType}</h1>
                              <div className="sub-brand">
                                {sellerName || "نام شرکت"}
                              </div>
                            </div>

                            {(companyLogo || sellerEconomicCode) && (
                              <div className="header-logo-economic-left">
                                {companyLogo && (
                                  <div className="invoice-header-logo-wrapper">
                                    <img
                                      src={companyLogo}
                                      alt="لوگوی شرکت"
                                      className="invoice-header-logo"
                                    />
                                  </div>
                                )}
                                {sellerEconomicCode && (
                                  <div className="seller-economic-code-badge">
                                    کد اقتصادی :{" "}
                                    {toPersianDigits(sellerEconomicCode)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Meta Data */}
                          <div className="invoice-meta">
                            <div className="meta-item">
                              <span className="meta-label">تاریخ فاکتور :</span>
                              <span className="editable-date-text">
                                {toPersianDigits(invoiceDate)}
                              </span>
                            </div>
                            <div className="meta-item">
                              <span className="meta-label">شماره فاکتور :</span>
                              <span
                                className="editable-invno-text"
                                dir="ltr"
                                style={{
                                  display: "inline-block",
                                  textAlign: "right",
                                }}
                              >
                                {toPersianDigits(invoiceNumber)}
                              </span>
                            </div>
                          </div>

                          {/* Parties */}
                          <div className="parties">
                            <div className="buyer1-box">
                              <h3>خریدار</h3>
                            </div>
                            <div className="buyer-box">
                              <div className="buyer-grid">
                                <div className="buyer-main-info">
                                  <h2>{buyerName}</h2>
                                  {buyerAddress && (
                                    <p className="buyer-info-text">
                                      آدرس : {buyerAddress}
                                    </p>
                                  )}
                                </div>
                                <div className="buyer-extra-info">
                                  {buyerEconomicCode && (
                                    <p className="buyer-info-text">
                                      کد اقتصادی :{" "}
                                      {toPersianDigits(buyerEconomicCode)}
                                    </p>
                                  )}
                                  {buyerMobile && (
                                    <p className="buyer-info-text">
                                      شماره تماس :{" "}
                                      {toPersianDigits(buyerMobile)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Table */}
                          <table className="items-table">
                            <thead>
                              <tr>
                                <th>ردیف</th>
                                <th>شرح کالا</th>
                                <th>تعداد</th>
                                <th>قیمت واحد (ریال)</th>
                                <th>جمع کل (ریال)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, idx) => {
                                const qtyVal =
                                  row.quantity === "" ||
                                  row.quantity === undefined
                                    ? 1
                                    : parseNumber(row.quantity) || 1;
                                const priceVal =
                                  row.unitPrice === "" ||
                                  row.unitPrice === undefined
                                    ? 0
                                    : parseNumber(row.unitPrice) || 0;
                                return (
                                  <tr key={row.id}>
                                    <td className="invoice-custom-element">
                                      {toPersianDigits(idx + 1)}
                                    </td>
                                    <td className="invoice-custom-element">
                                      {row.desc || "محصول جدید"}
                                    </td>
                                    <td className="invoice-custom-element">
                                      {toPersianDigits(qtyVal)}
                                    </td>
                                    <td className="invoice-custom-element">
                                      {formatNumber(priceVal)}
                                    </td>
                                    <td className="invoice-custom-element">
                                      {formatNumber(qtyVal * priceVal)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>

                          {/* Totals */}
                          <div className="total-final">
                            <strong>مبلغ نهایی فاکتور :</strong>
                            <span className="total-amount">
                              {formatNumber(grandTotal)}{" "}
                              <span className="invoice-custom-element">
                                ریال
                              </span>
                            </span>
                          </div>
                          <div className="amount-in-words">
                            {numberToPersianWords(grandTotal)}
                          </div>

                          {/* Notes */}
                          <div className="note-box">
                            <p>توضیحات :</p>
                            <div className="invoice-custom-element">
                              {noteText}
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="app-footer">
                            <div className="footer-divider"></div>
                            <span className="footer-app-name">
                              {sellerName || "نام شرکت"}
                            </span>
                            {sellerAddress && (
                              <div className="footer-address">
                                {sellerAddress}
                              </div>
                            )}
                            {sellerPhone && (
                              <div className="footer-phone">
                                {toPersianDigits(sellerPhone)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TransformComponent>
                </TransformWrapper>
              </div>

              {/* Bottom Actions */}
              <div className="invoice-bottom-bar">
                <div className="invoice-bottom-actions-card">
                  {exportModal.show && (
                    <>
                      <div
                        ref={exportPopupRef}
                        className="export-popup-menu"
                        style={{
                          left: exportModal.action === "share" ? "0" : "50%",
                          transform:
                            exportModal.action === "share"
                              ? "none"
                              : "translateX(-50%)",
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            performExport("png");
                          }}
                          className="export-popup-btn"
                        >
                          تصویر (PNG)
                        </button>
                        <div className="export-popup-divider"></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            performExport("pdf");
                          }}
                          className="export-popup-btn"
                        >
                          فایل (PDF)
                        </button>
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    className="action-btn save-ledger-btn-circle"
                    onClick={handleSaveToDatabase}
                    disabled={isSaving}
                    title="ثبت در حساب مشتری"
                  >
                    {isSaving ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="22"
                        height="22"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="spinning-icon"
                      >
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line
                          x1="16.24"
                          y1="16.24"
                          x2="19.07"
                          y2="19.07"
                        ></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line>
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        width="26"
                        height="26"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className="action-btn save-btn-circle"
                    onClick={saveAsImage}
                    disabled={isSaving}
                    title="ذخیره به عنوان تصویر"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="24"
                      height="24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="action-btn share-btn-circle"
                    onClick={shareAsImage}
                    disabled={isSaving}
                    title="اشتراک‌گذاری"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="24"
                      height="24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      {/* تقویم شمسی اختصاصی */}
      <JalaliDatePickerModal
        isOpen={isDatePickerOpen}
        initialDate={invoiceDate}
        onSelectDate={(formattedDate) => setInvoiceDate(formattedDate)}
        onClose={() => setIsDatePickerOpen(false)}
      />

      {/* اعلان متحرک (Toast) هنگام ذخیره‌سازی */}
      <div className={`invoice-toast-notification ${toastShow ? "show" : ""}`}>
        <span className="toast-icon">✅</span>
        <span className="toast-message">{toastText}</span>
      </div>

      {/* Custom Alert Modal */}
      {customAlert.show && (
        <div
          className="custom-alert-overlay"
          onClick={customAlert.onCancel}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn 0.3s ease",
          }}
        >
          <div
            className="custom-alert-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f4c75",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
              padding: "25px",
              width: "90%",
              maxWidth: "350px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              animation: "popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              color: "white",
              textAlign: "center",
            }}
          >
            <div
              className="custom-alert-icon"
              style={{
                width: "60px",
                height: "60px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {customAlert.type === "confirm" ? (
                <svg
                  viewBox="0 0 24 24"
                  width="30"
                  height="30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="30"
                  height="30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              )}
            </div>
            <div
              className="custom-alert-message"
              style={{
                fontSize: "1.05rem",
                fontWeight: "600",
                lineHeight: "1.6",
              }}
            >
              {customAlert.message}
            </div>
            <div
              className="custom-alert-actions"
              style={{
                display: "flex",
                gap: "10px",
                width: "100%",
                marginTop: "5px",
              }}
            >
              {customAlert.type === "confirm" ? (
                <>
                  <button
                    onClick={customAlert.onConfirm}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(180deg, #10b981, #059669)",
                      color: "white",
                      fontWeight: "700",
                      fontSize: "1rem",
                      cursor: "pointer",
                      boxShadow: "0 4px 10px rgba(16, 185, 129, 0.4)",
                    }}
                  >
                    بله
                  </button>
                  <button
                    onClick={customAlert.onCancel}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "10px",
                      border: "none",
                      background: "rgba(255,255,255,0.1)",
                      color: "white",
                      fontWeight: "700",
                      fontSize: "1rem",
                      cursor: "pointer",
                    }}
                  >
                    خیر
                  </button>
                </>
              ) : (
                <button
                  onClick={customAlert.onConfirm}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(180deg, #3282b8, #0f4c75)",
                    color: "white",
                    fontWeight: "700",
                    fontSize: "1rem",
                    cursor: "pointer",
                  }}
                >
                  تایید
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Alert Modal */}
      {!!saveSuccessMessage && (
        <div className="invoice-success-modal-overlay">
          <div className="invoice-success-modal">
            <div className="invoice-success-icon">
              <svg
                viewBox="0 0 24 24"
                width="60"
                height="60"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h3 className="invoice-success-title">{saveSuccessMessage}</h3>
            <button
              className="invoice-success-close-btn"
              onClick={handleAlertCloseAndNavigate}
            >
              تایید
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default Invoice;
