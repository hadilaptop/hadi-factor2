import { useState, useEffect, useMemo, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  formatNumber,
  parseNumber,
  toPersianDigits,
  getCurrentPersianDate,
  getCustomerCode,
} from "../utils/invoiceHelpers";
import "../styles/customer-ledger.css";
import moneyIcon from "../assets/money.png";
import CustomerStatement from "./CustomerStatement";
export default function CustomerLedger({
  customer,
  onNavigate,
  onOpenInvoice,
  onOpenPaymentPage,
}) {
  const allPayments = useAppStore((state) => state.payments);
  const allInvoices = useAppStore((state) => state.invoices);
  const allCustomers = useAppStore((state) => state.customers);
  const savePayment = useAppStore((state) => state.savePayment);
  const deletePayment = useAppStore((state) => state.deletePayment);
  const deleteInvoice = useAppStore((state) => state.deleteInvoice);
  const payments = useMemo(() => {
    if (!customer?.id) return [];
    return allPayments.filter(
      (p) => String(p.customerId) === String(customer.id),
    );
  }, [allPayments, customer]);
  const invoices = useMemo(() => {
    if (!customer?.id) return [];
    return allInvoices.filter(
      (i) => String(i.customerId) === String(customer.id),
    );
  }, [allInvoices, customer]);
  const [activeTab, setActiveTab] = useState("all");
  const [sortOrder, setSortOrder] = useState("desc");
  const [allFilters, setAllFilters] = useState({
    payments: true,
    invoices: true,
    proformas: true,
  });
  const [showAllFilterMenu, setShowAllFilterMenu] = useState(false);
  const allFilterMenuRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        allFilterMenuRef.current &&
        !allFilterMenuRef.current.contains(event.target) &&
        !event.target.closest(".ledger-all-filter-dropdown")
      ) {
        setShowAllFilterMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);
  const toggleAllFilter = (key, e) => {
    e.stopPropagation();
    setAllFilters((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };
  const [expandedItems, setExpandedItems] = useState({});
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [showStatement, setShowStatement] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentDate, setPaymentDate] = useState(getCurrentPersianDate());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("نقدی");
  const [checkDate, setCheckDate] = useState(getCurrentPersianDate());
  const [checkNumber, setCheckNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentAttachment, setPaymentAttachment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [isClosingAddPaymentModal, setIsClosingAddPaymentModal] =
    useState(false);
  const [isClosingImageModal, setIsClosingImageModal] = useState(false);
  const [isClosingDeleteConfirmModal, setIsClosingDeleteConfirmModal] =
    useState(false);
  const closeAddPaymentModal = () => {
    setIsClosingAddPaymentModal(true);
    setTimeout(() => {
      setIsClosingAddPaymentModal(false);
      setShowAddPaymentModal(false);
    }, 200);
  };
  const closeImageModal = () => {
    setIsClosingImageModal(true);
    setTimeout(() => {
      setIsClosingImageModal(false);
      setSelectedImage(null);
    }, 200);
  };
  const closeDeleteConfirmModal = () => {
    setIsClosingDeleteConfirmModal(true);
    setTimeout(() => {
      setIsClosingDeleteConfirmModal(false);
      setDeleteConfirmItem(null);
    }, 200);
  };
  useEffect(() => {
    if (openMenuId === null) return;
    const handleGlobalClick = (e) => {
      const isMenu = e.target.closest(".ledger-action-menu");
      const isTrigger = e.target.closest(".ledger-menu-trigger");
      if (!isMenu && !isTrigger) {
        e.stopPropagation();
        e.preventDefault();
        setOpenMenuId(null);
      }
    };
    window.addEventListener("click", handleGlobalClick, true);
    return () => window.removeEventListener("click", handleGlobalClick, true);
  }, [openMenuId]);
  const prepareTransactions = () => {
    const pItems = (payments || []).map((p) => ({
      id: `p-${p.id}`,
      originalId: p.id,
      kind: "payment",
      type: `دریافتی (${p.method || "نقدی"})`,
      method: p.method || "نقدی",
      date: p.date || "",
      rawDate: p.createdAt || p.date || "",
      amount: Number(p.amount || 0),
      note: p.note || "",
      checkDate: p.checkDate,
      checkNumber: p.checkNumber,
      bankName: p.bankName,
      attachment: p.attachment,
      isFinalized: true,
    }));
    const iItems = (invoices || []).map((inv) => ({
      id: `i-${inv.id}`,
      originalId: inv.id,
      kind: "invoice",
      type: inv.type || "فاکتور",
      number: inv.number,
      date: inv.date || "",
      rawDate: inv.createdAt || inv.date || "",
      amount: Number(inv.amount || 0),
      note: inv.note || "",
      items: inv.items,
      isFinalized: inv.type !== "پیش فاکتور",
    }));
    const allChronological = [...pItems, ...iItems].sort((a, b) => {
      if (a.date && b.date && a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return (a.rawDate || "").localeCompare(b.rawDate || "");
    });
    let runningBalance = 0;
    const processedAll = allChronological.map((item) => {
      if (item.kind === "invoice") {
        if (item.type === "فاکتور") {
          runningBalance += item.amount;
        }
      } else if (item.kind === "payment") {
        runningBalance -= item.amount;
      }
      return {
        ...item,
        balanceAfter: runningBalance,
      };
    });
    if (sortOrder === "desc") {
      return [...processedAll].reverse();
    }
    return processedAll;
  };
  const transactions = prepareTransactions();
  const totalInvoices = (invoices || [])
    .filter((inv) => inv.type === "فاکتور")
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalPayments = (payments || []).reduce(
    (acc, curr) => acc + Number(curr.amount || 0),
    0,
  );
  const filteredTransactions = transactions.filter((item) => {
    if (activeTab === "all") {
      if (item.kind === "payment" && !allFilters.payments) return false;
      if (
        item.kind === "invoice" &&
        item.type !== "پیش فاکتور" &&
        !allFilters.invoices
      )
        return false;
      if (
        item.kind === "invoice" &&
        item.type === "پیش فاکتور" &&
        !allFilters.proformas
      )
        return false;
      return true;
    }
    if (activeTab === "payments") return item.kind === "payment";
    if (activeTab === "invoices")
      return item.kind === "invoice" && item.type !== "پیش فاکتور";
    if (activeTab === "proformas")
      return item.kind === "invoice" && item.type === "پیش فاکتور";
    return true;
  });
  const handleOpenNewPayment = () => {
    if (onOpenPaymentPage) {
      onOpenPaymentPage(customer, null);
    } else {
      setEditingPayment(null);
      setPaymentAmount("");
      setPaymentDate(getCurrentPersianDate());
      setPaymentMethod("نقدی");
      setBankName("");
      setCheckDate(getCurrentPersianDate());
      setCheckNumber("");
      setPaymentNote("");
      setPaymentAttachment(null);
      setShowAddPaymentModal(true);
    }
  };
  const handleOpenEditPayment = (item) => {
    if (onOpenPaymentPage) {
      onOpenPaymentPage(customer, item);
    } else {
      setEditingPayment(item);
      setPaymentAmount(formatNumber(item.amount || 0));
      setPaymentDate(item.date || getCurrentPersianDate());
      setPaymentMethod(item.method || "نقدی");
      setBankName(item.bankName || "");
      setCheckDate(item.checkDate || getCurrentPersianDate());
      setCheckNumber(item.checkNumber || "");
      setPaymentNote(item.note || "");
      setPaymentAttachment(item.attachment || null);
      setShowAddPaymentModal(true);
    }
  };
  const toggleExpand = (itemId) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };
  const handleAttachmentUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("حجم تصویر نباید بیشتر از ۵ مگابایت باشد.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPaymentAttachment(reader.result);
    };
    reader.readAsDataURL(file);
  };
  const handleSavePayment = async (e) => {
    e.preventDefault();
    const numericAmount = parseNumber(paymentAmount);
    if (!numericAmount || numericAmount <= 0) {
      alert("لطفاً مبلغ دریافتی معتبری وارد کنید.");
      return;
    }
    setIsSubmitting(true);
    try {
      const paymentData = {
        customerId: customer.id,
        date: paymentDate.trim() || getCurrentPersianDate(),
        amount: numericAmount,
        method: paymentMethod,
        bankName: bankName.trim(),
        checkDate: paymentMethod === "چک" ? checkDate : "",
        checkNumber: paymentMethod === "چک" ? checkNumber.trim() : "",
        note: paymentNote.trim(),
        attachment: paymentAttachment || "",
      };
      if (editingPayment) {
        paymentData.id = editingPayment.originalId;
        paymentData.createdAt =
          editingPayment.rawDate || new Date().toISOString();
      } else {
        paymentData.createdAt = new Date().toISOString();
      }
      await savePayment(paymentData);
      setEditingPayment(null);
      setPaymentAmount("");
      setPaymentNote("");
      setCheckNumber("");
      setBankName("");
      setPaymentAttachment(null);
      closeAddPaymentModal();
    } catch (error) {
      console.error("خطا در ذخیره دریافتی:", error);
      alert("خطا در ثبت یا ویرایش دریافتی در دیتابیس.");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      if (deleteConfirmItem.kind === "payment") {
        await deletePayment(deleteConfirmItem.originalId);
      } else if (deleteConfirmItem.kind === "invoice") {
        await deleteInvoice(deleteConfirmItem.originalId);
      }
      closeDeleteConfirmModal();
    } catch (err) {
      console.error("خطا در حذف آیتم:", err);
      alert("خطا در حذف آیتم.");
      closeDeleteConfirmModal();
    }
  };
  if (!customer) {
    return (
      <div className="ledger-modal-wrapper">
        <div className="ledger-wrapper">
          <div className="ledger-top-header">
            <h2 className="ledger-main-title">گردش حساب مشتری</h2>
            <div className="ledger-header-buttons">
              <button
                className="ledger-header-btn"
                onClick={() => onNavigate("customers")}
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
          <div className="ledger-container">
            <h3 className="ledger-not-found-msg">مشتری مورد نظر یافت نشد.</h3>
          </div>
        </div>
      </div>
    );
  }
  if (showStatement) {
    return (
      <CustomerStatement
        customer={customer}
        onBack={() => setShowStatement(false)}
        onNavigate={onNavigate}
      />
    );
  }
  return (
    <div id="customer-ledger-view" className="ledger-modal-wrapper">
      <div className="ledger-wrapper">
        {/* ===== هدر ===== */}
        <div className="ledger-top-header">
          <div className="ledger-top-header-info">
            <h2 className="ledger-main-title">{customer.name}</h2>
            <span className="ledger-top-header-subtitle">
              کد مشتری:{" "}
              {toPersianDigits(getCustomerCode(customer, allCustomers))}
            </span>
          </div>
          <div className="ledger-header-buttons">
            <button
              id="headerAddPaymentBtn"
              className="ledger-header-btn ledger-header-add-payment-btn"
              onClick={handleOpenNewPayment}
              title="ثبت دریافتی جدید"
            >
              <img
                src={moneyIcon}
                alt="ثبت دریافتی"
                className="custom-money-icon"
              />
            </button>

            {onOpenInvoice && (
              <button
                id="headerCreateInvoiceBtn"
                className="ledger-header-btn ledger-header-create-invoice-btn"
                onClick={() => onOpenInvoice(customer)}
                title="صدور فاکتور جدید"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </button>
            )}

            <button
              id="closeLedgerBtn"
              className="ledger-header-btn"
              onClick={() => onNavigate("customers")}
              title="بازگشت به لیست مشتریان"
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

        {/* ===== بدنه اصلی گردش حساب ===== */}
        <div className="ledger-container">
          <div className="ledger-filter-bar">
            <div className="ledger-tabs">
              <div ref={allFilterMenuRef} className="ledger-tab-btn-group">
                <button
                  className={`ledger-tab-btn ${activeTab === "all" ? "active" : ""}`}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab("all");
                  }}
                >
                  همه
                </button>
                <button
                  className="ledger-filter-btn"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAllFilterMenu((prev) => !prev);
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`filter-arrow-icon ${showAllFilterMenu ? "is-rotated" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>

              <button
                className={`ledger-tab-btn ${activeTab === "payments" ? "active" : ""}`}
                onClick={() => setActiveTab("payments")}
              >
                دریافتی
              </button>
              <button
                className={`ledger-tab-btn ${activeTab === "invoices" ? "active" : ""}`}
                onClick={() => setActiveTab("invoices")}
              >
                فاکتور فروش
              </button>
              <button
                className={`ledger-tab-btn ${activeTab === "proformas" ? "active" : ""}`}
                onClick={() => setActiveTab("proformas")}
              >
                پیش فاکتور
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

            {showAllFilterMenu && (
              <div className="ledger-all-filter-dropdown">
                <div
                  className={`ledger-all-filter-option ${allFilters.payments ? "is-selected" : ""}`}
                  onClick={(e) => toggleAllFilter("payments", e)}
                >
                  <span className="option-label">دریافتی</span>
                  {allFilters.payments && (
                    <span className="option-checkmark">✓</span>
                  )}
                </div>
                <div
                  className={`ledger-all-filter-option ${allFilters.invoices ? "is-selected" : ""}`}
                  onClick={(e) => toggleAllFilter("invoices", e)}
                >
                  <span className="option-label">فاکتور فروش</span>
                  {allFilters.invoices && (
                    <span className="option-checkmark">✓</span>
                  )}
                </div>
                <div
                  className={`ledger-all-filter-option ${allFilters.proformas ? "is-selected" : ""}`}
                  onClick={(e) => toggleAllFilter("proformas", e)}
                >
                  <span className="option-label">پیش فاکتور</span>
                  {allFilters.proformas && (
                    <span className="option-checkmark">✓</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="ledger-list-container">
            {filteredTransactions.length === 0 ? (
              <div className="ledger-empty-msg">
                {activeTab === "all"
                  ? "هیچ تراکنشی برای این مشتری ثبت نشده است."
                  : activeTab === "payments"
                    ? "هیچ دریافتی برای این مشتری ثبت نشده است."
                    : activeTab === "invoices"
                      ? "هیچ فاکتور فروشی ثبت نشده است."
                      : "هیچ پیش‌فاکتوری ثبت نشده است."}
              </div>
            ) : (
              <div className="ledger-items-grid">
                {filteredTransactions.map((item) => {
                  const isInvoice = item.kind === "invoice";
                  const isProforma = isInvoice && item.type === "پیش فاکتور";
                  const isPayment = item.kind === "payment";
                  const isExpanded = !!expandedItems[item.id];
                  const isMenuOpen = openMenuId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`ledger-item-card ${isProforma ? "card-proforma" : isInvoice ? "card-invoice" : "card-payment"} ${isExpanded ? "is-expanded" : ""}`}
                    >
                      <div
                        className="ledger-card-main-row"
                        onClick={() => toggleExpand(item.id)}
                      >
                        <div className="ledger-card-content-area">
                          <div className="ledger-card-info-group">
                            <div className="ledger-card-date-col">
                              <span className="ledger-card-date">
                                {toPersianDigits(item.date)}
                              </span>
                              {isInvoice && item.number && (
                                <span
                                  className={`ledger-card-invoice-number ${isProforma ? "badge-proforma" : "badge-invoice"}`}
                                  dir="ltr"
                                  style={{ display: "inline-block" }}
                                >
                                  {toPersianDigits(item.number)}
                                </span>
                              )}
                            </div>

                            <div className="ledger-card-type-col">
                              <div className="item-badge-wrap">
                                <span
                                  className={`item-type-badge ${isProforma ? "badge-proforma" : isInvoice ? "badge-invoice" : "badge-payment"}`}
                                >
                                  {isProforma
                                    ? "📋 پیش‌ فاکتور"
                                    : isInvoice
                                      ? "📄 فاکتور فروش"
                                      : ` ${item.method || "نقدی"}`}
                                </span>

                                {isProforma && (
                                  <span className="non-binding-tag">
                                    غیر مالی
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          className="ledger-card-actions-col"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="ledger-accordion-arrow"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(item.id);
                            }}
                          >
                            <svg
                              className={`arrow-icon ${isExpanded ? "expanded" : ""}`}
                              viewBox="0 0 24 24"
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>

                          <div className="ledger-menu-wrapper">
                            <button
                              type="button"
                              className="ledger-menu-trigger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(isMenuOpen ? null : item.id);
                              }}
                            >
                              <span className="ledger-dots">⋮</span>
                            </button>

                            {isMenuOpen && (
                              <div
                                className="ledger-action-menu"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isPayment ? (
                                  <button
                                    type="button"
                                    className="ledger-action-item ledger-action-edit"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuId(null);
                                      const originalPayment = (
                                        payments || []
                                      ).find(
                                        (p) =>
                                          String(p.id) ===
                                          String(item.originalId),
                                      );
                                      handleOpenEditPayment(
                                        originalPayment || item,
                                      );
                                    }}
                                  >
                                    <span className="ledger-action-text">
                                      ویرایش دریافتی
                                    </span>
                                    <span className="ledger-action-icon">
                                      <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                      </svg>
                                    </span>
                                  </button>
                                ) : onOpenInvoice ? (
                                  <>
                                    <button
                                      type="button"
                                      className="ledger-action-item ledger-action-view"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(null);
                                        onOpenInvoice(
                                          customer,
                                          item,
                                          "preview",
                                        );
                                      }}
                                    >
                                      <span className="ledger-action-text">
                                        نمایش فاکتور
                                      </span>
                                      <span className="ledger-action-icon">
                                        <svg
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                          <circle
                                            cx="12"
                                            cy="12"
                                            r="3"
                                          ></circle>
                                        </svg>
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className="ledger-action-item ledger-action-edit"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(null);
                                        const originalInvoice = (
                                          invoices || []
                                        ).find(
                                          (i) =>
                                            String(i.id) ===
                                            String(item.originalId),
                                        );
                                        onOpenInvoice(
                                          customer,
                                          originalInvoice || item,
                                          "form",
                                        );
                                      }}
                                    >
                                      <span className="ledger-action-text">
                                        ویرایش فاکتور
                                      </span>
                                      <span className="ledger-action-icon">
                                        <svg
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                      </span>
                                    </button>
                                  </>
                                ) : null}

                                <button
                                  type="button"
                                  className="ledger-action-item ledger-action-delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    setDeleteConfirmItem(item);
                                  }}
                                >
                                  <span className="ledger-action-text">
                                    حذف
                                  </span>
                                  <span className="ledger-action-icon">
                                    <svg
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="3 6 5 6 21 6"></polyline>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                      <line
                                        x1="10"
                                        y1="11"
                                        x2="10"
                                        y2="17"
                                      ></line>
                                      <line
                                        x1="14"
                                        y1="11"
                                        x2="14"
                                        y2="17"
                                      ></line>
                                    </svg>
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="ledger-card-expandable-body">
                        <div className="expandable-body-inner">
                          {isPayment && (
                            <div className="check-details-box payment-details-box">
                              <div className="payment-amount-line">
                                <span>
                                  {" "}
                                  <strong>مبلغ دریافتی:</strong>
                                </span>
                                <span className="payment-amount-val">
                                  {toPersianDigits(
                                    formatNumber(item.amount || 0),
                                  )}{" "}
                                  ریال
                                </span>
                              </div>
                              {(item.method === "چک" ||
                                item.bankName ||
                                item.checkNumber ||
                                item.checkDate) && (
                                <div className="check-sub-details">
                                  {item.bankName && (
                                    <div>
                                      🏦 <strong>بانک:</strong> {item.bankName}
                                    </div>
                                  )}
                                  {item.checkNumber && (
                                    <div>
                                      🔢 <strong>شماره چک:</strong>{" "}
                                      {toPersianDigits(item.checkNumber)}
                                    </div>
                                  )}
                                  {item.checkDate && (
                                    <div>
                                      📆 <strong>تاریخ سررسید:</strong>{" "}
                                      {toPersianDigits(item.checkDate)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {isInvoice && (
                            <div className="ledger-mini-invoice">
                              <div className="mini-invoice-header">
                                <span className="col-desc">شرح کالا</span>
                                <span className="col-qty">تعداد</span>
                                <span className="col-price">مبلغ (ریال)</span>
                              </div>
                              <div className="mini-invoice-body">
                                {Array.isArray(item.items) &&
                                item.items.length > 0 ? (
                                  item.items.map((it, idx) => {
                                    let desc = it;
                                    let qty = "1";
                                    let price = 0;
                                    if (typeof it === "object" && it !== null) {
                                      desc = it.desc;
                                      qty = it.quantity;
                                      price = it.unitPrice || 0;
                                    } else if (typeof it === "string") {
                                      const match = it.match(
                                        /^\d+-\s*(.*?)\s*\(تعداد:\s*(.*?)\)$/,
                                      );
                                      if (match) {
                                        desc = match[1];
                                        qty = match[2];
                                      }
                                    }
                                    return (
                                      <div
                                        key={idx}
                                        className="mini-invoice-row"
                                      >
                                        <span className="col-desc">{desc}</span>
                                        <span className="col-qty">
                                          {toPersianDigits(qty)}
                                        </span>
                                        <span className="col-price">
                                          {price > 0
                                            ? toPersianDigits(
                                                formatNumber(price),
                                              )
                                            : "-"}
                                        </span>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="mini-invoice-row">
                                    <span className="col-desc">
                                      {typeof item.items === "string"
                                        ? item.items
                                        : "بدون قلم"}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="mini-invoice-footer">
                                <strong>جمع کل:</strong>
                                <span>
                                  {toPersianDigits(
                                    formatNumber(item.amount || 0),
                                  )}{" "}
                                  ریال
                                </span>
                              </div>
                            </div>
                          )}

                          {!isInvoice && item.note && (
                            <div className="item-detail-row note-row">
                              <strong>📝 توضیحات:</strong>{" "}
                              {toPersianDigits(item.note)}
                            </div>
                          )}

                          {!isInvoice && item.attachment && (
                            <div className="attachment-thumbnail-wrapper">
                              <div
                                className="attachment-thumbnail-box"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setSelectedImage(item.attachment);
                                }}
                              >
                                <img
                                  src={item.attachment}
                                  alt="پیوست سند"
                                  className="attachment-thumb-img"
                                />
                                <div className="thumb-zoom-overlay">
                                  <svg
                                    viewBox="0 0 24 24"
                                    width="20"
                                    height="20"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line
                                      x1="21"
                                      y1="21"
                                      x2="16.65"
                                      y2="16.65"
                                    ></line>
                                    <line x1="11" y1="8" x2="11" y2="14"></line>
                                    <line x1="8" y1="11" x2="14" y2="11"></line>
                                  </svg>
                                </div>
                              </div>
                            </div>
                          )}

                          {!item.note &&
                            !item.attachment &&
                            !isInvoice &&
                            item.method !== "چک" && (
                              <div className="item-detail-row text-muted">
                                توضیحات یا پیوستی ثبت نشده است.
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ===== مودال ثبت دریافتی جدید ===== */}
        {showAddPaymentModal && (
          <div
            className={`ledger-alert-overlay ${isClosingAddPaymentModal ? "is-closing" : ""}`}
            onClick={closeAddPaymentModal}
          >
            <div
              className="ledger-payment-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ledger-modal-header">
                <h3 className="ledger-modal-title">
                  {editingPayment
                    ? `ویرایش دریافتی از ${customer.name}`
                    : `ثبت دریافتی جدید از ${customer.name}`}
                </h3>
                <button
                  type="button"
                  className="modal-close-icon"
                  onClick={closeAddPaymentModal}
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleSavePayment}
                className="ledger-payment-form"
              >
                <div className="form-group">
                  <label>مبلغ دریافتی (ریال) *</label>
                  <input
                    type="text"
                    value={paymentAmount}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value);
                      setPaymentAmount(parsed ? formatNumber(parsed) : "");
                    }}
                    placeholder="مثال: ۱,۵۰۰,۰۰۰"
                    required
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>تاریخ دریافت *</label>
                  <input
                    type="text"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    placeholder="مثال: ۱۴۰۳/۰۵/۱۵"
                    required
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>روش دریافت</label>
                  <div className="payment-methods-grid">
                    {[
                      "نقدی",
                      "کارت به کارت",
                      "واریز به حساب",
                      "چک",
                      "سایر",
                    ].map((m) => (
                      <button
                        type="button"
                        key={m}
                        className={`method-pill ${paymentMethod === m ? "active" : ""}`}
                        onClick={() => setPaymentMethod(m)}
                      >
                        {m === "نقدی" && "💵 "} {m === "کارت به کارت" && "💳 "}{" "}
                        {m === "واریز به حساب" && "🏦 "} {m === "چک" && "📜 "}{" "}
                        {m === "سایر" && "⚙️ "} {m}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === "چک" && (
                  <div className="check-form-section">
                    <div className="form-group">
                      <label>شماره چک</label>
                      <input
                        type="text"
                        value={checkNumber}
                        onChange={(e) => setCheckNumber(e.target.value)}
                        placeholder="شماره چک یا کد صیادی..."
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>نام بانک</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="مثال: بانک ملی، صادرات..."
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>تاریخ سررسید چک</label>
                      <input
                        type="text"
                        value={checkDate}
                        onChange={(e) => setCheckDate(e.target.value)}
                        placeholder="مثال: ۱۴۰۳/۰۶/۲۰"
                        className="form-input"
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>توضیحات / بابت</label>
                  <textarea
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="توضیحات بابت این پرداخت..."
                    rows="2"
                    className="form-input textarea"
                  />
                </div>

                <div className="form-group">
                  <label>پیوست تصویر سند</label>
                  {paymentAttachment ? (
                    <div className="attachment-preview-box">
                      <img src={paymentAttachment} alt="سند دریافتی" />
                      <button
                        type="button"
                        className="remove-att-btn"
                        onClick={() => setPaymentAttachment(null)}
                      >
                        🗑️ حذف تصویر
                      </button>
                    </div>
                  ) : (
                    <div className="file-upload-dropzone">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAttachmentUpload}
                        id="paymentAttachmentInput"
                        className="hidden-file-input"
                      />
                      <label
                        htmlFor="paymentAttachmentInput"
                        className="file-upload-label"
                      >
                        📷 انتخاب عکس فیش یا تصویر چک
                      </label>
                    </div>
                  )}
                </div>

                <div className="ledger-modal-actions">
                  <button
                    type="button"
                    className="ledger-modal-btn ledger-btn-cancel"
                    onClick={closeAddPaymentModal}
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="ledger-modal-btn ledger-btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "درحال ذخیره..."
                      : editingPayment
                        ? "ذخیره تغییرات"
                        : "ثبت دریافتی"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== مودال نمایش تصویر پیوست ===== */}
        {selectedImage && (
          <div
            className={`ledger-alert-overlay ${isClosingImageModal ? "is-closing" : ""}`}
            onClick={closeImageModal}
          >
            <div className="lightbox-box" onClick={(e) => e.stopPropagation()}>
              <button className="lightbox-close-btn" onClick={closeImageModal}>
                ✕
              </button>
              <img src={selectedImage} alt="تصویر سند" />
            </div>
          </div>
        )}

        {/* ===== مودال تایید حذف ===== */}
        {deleteConfirmItem && (
          <div
            className={`ledger-alert-overlay ${isClosingDeleteConfirmModal ? "is-closing" : ""}`}
            onClick={closeDeleteConfirmModal}
          >
            <div
              className="ledger-alert-box"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ledger-alert-icon-bg">
                <svg
                  className="ledger-alert-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ff5c5c"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </div>
              <h3 className="ledger-alert-title">تایید حذف تراکنش</h3>
              <p className="ledger-alert-text">
                آیا از حذف این تراکنش مطمئن هستید؟ این عمل قابل بازگشت نیست.
              </p>
              <div className="ledger-alert-actions">
                <button
                  className="ledger-alert-btn ledger-btn-cancel"
                  onClick={closeDeleteConfirmModal}
                >
                  انصراف
                </button>
                <button
                  className="ledger-alert-btn ledger-btn-danger"
                  onClick={handleConfirmDelete}
                >
                  بله، حذف شود
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ===== نوار پایین دکمه صورت حساب (مکان صحیح) ===== */}
        <div className="ledger-bottom-bar">
          <div className="ledger-bottom-actions-card">
            <button
              className="ledger-statement-btn-circle"
              onClick={() => setShowStatement(true)}
              title="صورت حساب"
            >
             <svg
                viewBox="0 0 24 24"
                width="26"
                height="26"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* ستون‌های عمودی توپر (کوتاه‌تر شده برای ایجاد فاصله) */}
                <rect
                  x="4"
                  y="16"
                  width="4"
                  height="4"
                  fill="currentColor"
                  stroke="none"
                  rx="1"
                />
                <rect
                  x="10"
                  y="12"
                  width="4"
                  height="8"
                  fill="currentColor"
                  stroke="none"
                  rx="1"
                />
                <rect
                  x="16"
                  y="8"
                  width="4"
                  height="12"
                  fill="currentColor"
                  stroke="none"
                  rx="1"
                />

                {/* خط روند و فلش صعودی (در همان جای قبلی) */}
                <path d="M3 11 L9 5 L13 8 L20 1" />
                <polyline points="15 1 20 1 20 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
