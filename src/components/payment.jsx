import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import JalaliDatePickerModal from "./JalaliDatePickerModal";
import { formatNumber, parseNumber, toPersianDigits, getCurrentPersianDate } from "../utils/invoiceHelpers";
import "../styles/account.css";
import "../styles/payment.css";
const PERSIAN_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export default function Payment({
  onNavigate,
  initialCustomer,
  paymentToEdit,
  customers = [],
  onPaymentSaved
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    if (initialCustomer?.id) return initialCustomer.id;
    if (paymentToEdit?.customerId) return paymentToEdit.customerId;
    if (customers.length > 0) return customers[0].id;
    return "";
  });
  const [paymentAmount, setPaymentAmount] = useState(() => paymentToEdit ? formatNumber(paymentToEdit.amount || 0) : "");
  const [paymentDate, setPaymentDate] = useState(() => paymentToEdit?.date || getCurrentPersianDate());
  const [paymentMethod, setPaymentMethod] = useState(() => paymentToEdit?.method || "نقدی");
  const [bankName, setBankName] = useState(() => paymentToEdit?.bankName || "");
  const [checkDate, setCheckDate] = useState(() => paymentToEdit?.checkDate || getCurrentPersianDate());
  const [checkNumber, setCheckNumber] = useState(() => paymentToEdit?.checkNumber || "");
  const [paymentNote, setPaymentNote] = useState(() => paymentToEdit?.note || "");
  const [paymentAttachment, setPaymentAttachment] = useState(() => paymentToEdit?.attachment || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertModal, setAlertModal] = useState({
    show: false,
    title: "",
    message: ""
  });
  const [isClosingAlert, setIsClosingAlert] = useState(false);
  const closeAlertModal = () => {
    setIsClosingAlert(true);
    setTimeout(() => {
      setIsClosingAlert(false);
      setAlertModal({
        show: false,
        title: "",
        message: ""
      });
    }, 200);
  };

  // حالت تقویم شمسی
  const [datePickerTarget, setDatePickerTarget] = useState(null); // 'payment' | 'check' | null

  const savePayment = useAppStore(state => state.savePayment);
  const activeCustomer = customers.find(c => String(c.id) === String(selectedCustomerId)) || initialCustomer;
  const handleBack = () => {
    if (initialCustomer) {
      onNavigate("customer-ledger");
    } else {
      onNavigate("customers");
    }
  };
  const handleAttachmentUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAlertModal({
        show: true,
        title: "خطای تصویر",
        message: "حجم تصویر نباید بیشتر از ۵ مگابایت باشد."
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPaymentAttachment(reader.result);
    };
    reader.readAsDataURL(file);
  };
  const handleOpenDatePicker = targetField => {
    setDatePickerTarget(targetField);
  };
  const getMaxDaysInMonth = (y, m) => {
    if (m <= 6) return 31;
    if (m <= 11) return 30;
    return 29; // اسفند
  };
  const handleSave = async e => {
    e.preventDefault();
    if (!selectedCustomerId && !initialCustomer) {
      setAlertModal({
        show: true,
        title: "خطای ورودی",
        message: "لطفاً ابتدا مشتری مورد نظر را انتخاب نمایید."
      });
      return;
    }
    const numericAmount = parseNumber(paymentAmount);
    if (!numericAmount || numericAmount <= 0) {
      setAlertModal({
        show: true,
        title: "مبلغ نامعتبر",
        message: "لطفاً مبلغ دریافتی معتبری وارد کنید."
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const targetCustId = initialCustomer?.id || selectedCustomerId;
      const paymentData = {
        customerId: Number(targetCustId),
        date: paymentDate.trim() || getCurrentPersianDate(),
        amount: numericAmount,
        method: paymentMethod,
        bankName: bankName.trim(),
        checkDate: paymentMethod === "چک" ? checkDate : "",
        checkNumber: paymentMethod === "چک" ? checkNumber.trim() : "",
        note: paymentNote.trim(),
        attachment: paymentAttachment || ""
      };
      if (paymentToEdit) {
        paymentData.id = paymentToEdit.originalId || paymentToEdit.id;
        paymentData.createdAt = paymentToEdit.rawDate || paymentToEdit.createdAt || new Date().toISOString();
      } else {
        paymentData.createdAt = new Date().toISOString();
      }
      await savePayment(paymentData);
      if (onPaymentSaved) {
        await onPaymentSaved();
      }
      handleBack();
    } catch (error) {
      console.error("خطا در ثبت دریافتی:", error);
      setAlertModal({
        show: true,
        title: "خطای سیستم",
        message: "خطا در ثبت یا ویرایش دریافتی در دیتابیس."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // گزینه‌های سال در تقویم (از ۱۳۹۸ تا ۱۴۱۰)
  const yearsList = [];
  for (let y = 1398; y <= 1410; y++) {
    yearsList.push(y);
  }
  return <div id="payment-view" className="account-overlay">
      <div className="account-wrapper">
        <div className="crm-top-header">
          <h2 id="paymentPageTitle" className="crm-title">
            {paymentToEdit ? "ویرایش دریافتی" : "ثبت دریافتی جدید"}
          </h2>

          <div className="crm-header-buttons">
            <button id="closePaymentBtn" className="crm-back-btn" onClick={handleBack} title="بازگشت">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 10 4 15 9 20"></polyline>
                <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="account-content pb-safe-bottom">
          <form onSubmit={handleSave} className="account-form-card payment-custom-card">
            <div className="account-input-group">
              {initialCustomer ? <div className="payment-customer-single-name">
                  {initialCustomer.name}
                </div> : <>
                  <label>نام مشتری :</label>
                  <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} required className="account-input">
                    <option value="" disabled>
                      یک مشتری انتخاب کنید...
                    </option>
                    {customers.map(c => <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${toPersianDigits(c.phone)})` : ""}
                      </option>)}
                  </select>
                </>}
            </div>

            <div className="account-input-group">
              <label>مبلغ دریافتی (ریال) :</label>
              <div className="payment-input-relative">
                <input type="text" value={paymentAmount} onChange={e => {
                const parsed = parseNumber(e.target.value);
                setPaymentAmount(parsed ? formatNumber(parsed) : "");
              }} placeholder="مثال: ۱,۵۰۰,۰۰۰" required className="account-input amount-highlight" />
                <span className="payment-currency-tag">ریال</span>
              </div>
            </div>

            <div className="account-input-group">
              <label>تاریخ دریافت :</label>
              <div className="payment-input-relative">
                <input type="text" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} placeholder="مثال: ۱۴۰۳/۰۵/۱۵" required className="account-input date-input-field" />
                <button type="button" className="payment-calendar-trigger-btn" onClick={() => handleOpenDatePicker("payment")} title="انتخاب از تقویم شمسی">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </button>
              </div>
            </div>

            <div className="account-input-group">
              <label>روش دریافت :</label>
              <div className="payment-methods-pills">
                {[{
                id: "نقدی",
                label: "نقدی",
                icon: "💵"
              }, {
                id: "کارت به کارت",
                label: "کارت به کارت",
                icon: "💳"
              }, {
                id: "واریز به حساب",
                label: "واریز به حساب",
                icon: "🏦"
              }, {
                id: "چک",
                label: "چک",
                icon: "📜"
              }, {
                id: "سایر",
                label: "سایر",
                icon: "⚙️"
              }].map(m => <button type="button" key={m.id} className={`payment-pill-btn ${paymentMethod === m.id ? "active" : ""}`} onClick={() => setPaymentMethod(m.id)}>
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>)}
              </div>
            </div>

            {paymentMethod === "چک" && <div className="payment-check-container">
                <div className="account-input-group">
                  <label>شماره چک / کد صیادی :</label>
                  <input type="text" value={checkNumber} onChange={e => setCheckNumber(e.target.value)} placeholder="شماره چک..." className="account-input" />
                </div>
                <div className="account-input-group">
                  <label>نام بانک صادرکننده :</label>
                  <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="مثال: بانک ملی، صادرات، ملت..." className="account-input" />
                </div>
                <div className="account-input-group">
                  <label>تاریخ سررسید چک :</label>
                  <div className="payment-input-relative">
                    <input type="text" value={checkDate} onChange={e => setCheckDate(e.target.value)} placeholder="مثال: ۱۴۰۳/۰۶/۲۰" className="account-input date-input-field" />
                    <button type="button" className="payment-calendar-trigger-btn" onClick={() => handleOpenDatePicker("check")} title="انتخاب از تقویم شمسی">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>}

            <div className="account-input-group">
              <label>توضیحات / بابت :</label>
              <textarea value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="توضیحات بابت این دریافت..." rows="3" className="account-input payment-textarea" />
            </div>

            <div className="account-input-group">
              <label>تصویر سند یا چک :</label>
              {paymentAttachment ? <div className="payment-preview-card">
                  <img src={paymentAttachment} alt="سند پیوست" />
                  <button type="button" className="payment-remove-attach-btn" onClick={() => setPaymentAttachment(null)}>
                    حذف تصویر
                  </button>
                </div> : <div className="payment-file-box-wrapper">
                  <div className="custom-file-upload payment-file-box">
                    <input type="file" accept="image/*" onChange={handleAttachmentUpload} id="paymentAttachmentFileInput" className="hidden-file-input" />
                    <label htmlFor="paymentAttachmentFileInput" className="payment-file-label">
                      <span id="upload-text-indicator">انتخاب فایل</span>
                    </label>
                  </div>
                </div>}
            </div>

            <div className="payment-submit-container">
              <button type="submit" className="account-btn-save payment-save-btn" disabled={isSubmitting}>
                {isSubmitting ? "درحال ذخیره..." : "ذخیره اطلاعات"}
              </button>
            </div>
          </form>
        </div>

        {/* تقویم شمسی اختصاصی */}
        <JalaliDatePickerModal isOpen={Boolean(datePickerTarget)} initialDate={datePickerTarget === "payment" ? paymentDate : checkDate} onSelectDate={formattedDate => {
        if (datePickerTarget === "payment") {
          setPaymentDate(formattedDate);
        } else if (datePickerTarget === "check") {
          setCheckDate(formattedDate);
        }
      }} onClose={() => setDatePickerTarget(null)} />

        {/* مودال هشدار */}
        {alertModal.show && <div className={`custom-alert-overlay ${isClosingAlert ? "is-closing" : ""}`} onClick={closeAlertModal}>
            <div className="custom-alert-box" onClick={e => e.stopPropagation()}>
              <div className="custom-alert-icon-bg">
                <svg viewBox="0 0 24 24" fill="none" stroke="#e02424" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h3 className="custom-alert-title">{alertModal.title}</h3>
              <p className="custom-alert-message">{alertModal.message}</p>
              <button type="button" className="custom-alert-btn" onClick={closeAlertModal}>
                متوجه شدم
              </button>
            </div>
          </div>}
      </div>
    </div>;
}