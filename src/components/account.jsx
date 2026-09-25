import { useState, useEffect } from "react";
import "../styles/account.css";
import { getCustomerCode, toPersianDigits } from "../utils/invoiceHelpers";

function Account({
  onNavigate,
  onSave,
  customerToEdit,
  existingCustomers = [],
}) {
  const [customerName, setCustomerName] = useState(customerToEdit?.name || "");
  const [address, setAddress] = useState(customerToEdit?.address || "");
  const [phone, setPhone] = useState(customerToEdit?.phone || "");
  const [economicCode, setEconomicCode] = useState(
    customerToEdit?.economicCode || "",
  );
  const [profilePreview, setProfilePreview] = useState(
    customerToEdit?.avatar || "",
  );
  const [prevCustomerToEdit, setPrevCustomerToEdit] = useState(customerToEdit);

  // استیت‌های مربوط به انیمیشن‌ها
  const [isClosingPage, setIsClosingPage] = useState(false);
  const [alertModal, setAlertModal] = useState({
    show: false,
    title: "",
    message: "",
  });
  const [isClosingAlert, setIsClosingAlert] = useState(false);

  const closeAlertModal = () => {
    setIsClosingAlert(true);
    setTimeout(() => {
      setAlertModal({
        show: false,
        title: "",
        message: "",
      });
      setIsClosingAlert(false);
    }, 200);
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (customerToEdit !== prevCustomerToEdit) {
      if (customerToEdit) {
        setCustomerName(customerToEdit.name || "");
        setAddress(customerToEdit.address || "");
        setPhone(customerToEdit.phone || "");
        setEconomicCode(customerToEdit.economicCode || "");
        setProfilePreview(customerToEdit.avatar || "");
      } else {
        setCustomerName("");
        setAddress("");
        setPhone("");
        setEconomicCode("");
        setProfilePreview("");
      }
    }
  }, [customerToEdit, prevCustomerToEdit]);

  const handleClose = () => {
    setIsClosingPage(true);

    setTimeout(() => {
      const referrer = sessionStorage.getItem("accountReferrer") || "dashboard";
      sessionStorage.removeItem("accountReferrer");
      onNavigate(referrer);
    }, 200); // صبر می‌کند تا انیمیشن خروج کل صفحه تمام شود
  };

  const handleProfilePicChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setProfilePreview("");
    }
  };

  const handleSave = async () => {
    const trimmedName = customerName.trim();
    if (!trimmedName) {
      setAlertModal({
        show: true,
        title: "خطای ورودی",
        message: "لطفاً نام مشتری را وارد نمایید.",
      });
      return;
    }
    const isDuplicate = existingCustomers.some((c) => {
      if (customerToEdit && String(c.id) === String(customerToEdit.id)) {
        return false;
      }
      return (
        c.name && c.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
    });
    if (isDuplicate) {
      setAlertModal({
        show: true,
        title: "نام تکراری",
        message: `مشتری با نام «${trimmedName}» قبلاً ثبت شده است. امکان ذخیره نام تکراری وجود ندارد.`,
      });
      return;
    }
    const customerData = {
      id: customerToEdit ? customerToEdit.id : null,
      name: trimmedName,
      address: address,
      phone: phone,
      economicCode: economicCode,
      avatar: profilePreview,
    };
    const success = await onSave(customerData);
    if (success !== false) {
      onNavigate("customers");
    }
  };

  return (
    <div
      id="account-view"
      className={`account-overlay ${isClosingPage ? "is-closing-page" : ""}`}
    >
      <div className="account-wrapper">
        {/* هدر صفحه */}
        <div className="crm-top-header">
          <div className="crm-header-info">
            <h2 id="accountPageTitle" className="crm-title">
              {customerToEdit ? "ویرایش حساب" : "ثبت حساب جدید"}
            </h2>
            {customerToEdit && (
              <span className="account-subtitle">
                کد مشتری:{" "}
                {toPersianDigits(
                  getCustomerCode(customerToEdit, existingCustomers),
                )}
              </span>
            )}
          </div>
          <div className="crm-header-buttons">
            <button
              id="closeAccountBtn"
              className="crm-back-btn"
              onClick={handleClose}
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

        {/* محتوای فرم */}
        <div id="account-content" className="account-content pb-safe-bottom">
          <form
            className="account-form-card"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className="account-input-group">
              <label>نام مشتری / شرکت :</label>
              <input
                type="text"
                id="custNameInput"
                className="account-input"
                placeholder=" شرکت... "
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="account-input-group">
              <label>آدرس :</label>
              <input
                type="text"
                id="custAddressInput"
                className="account-input"
                placeholder="استان، شهر، خیابان..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="account-input-group">
              <label>شماره تماس :</label>
              <input
                type="text"
                id="custPhoneInput"
                className="account-input"
                dir="ltr"
                placeholder="0912..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="account-input-group">
              <label>کد اقتصادی :</label>
              <input
                type="text"
                id="custEconomicCodeInput"
                className="account-input"
                dir="ltr"
                placeholder="0"
                value={economicCode}
                onChange={(e) => setEconomicCode(e.target.value)}
              />
            </div>

            {/* بخش آپلود عکس پروفایل */}
            <div className="account-input-group profile-upload-group">
              <label>عکس پروفایل :</label>
              <div className="profile-upload-wrapper">
                {profilePreview ? (
                  /* حالت نمایش عکس انتخاب شده همراه با دکمه حذف قرمز */
                  <div className="account-attachment-preview-box">
                    <img
                      id="profile-preview-img"
                      src={profilePreview}
                      alt="Preview"
                    />
                    <button
                      type="button"
                      className="account-remove-att-btn"
                      onClick={() => setProfilePreview(null)}
                    >
                      حذف تصویر
                    </button>
                  </div>
                ) : (
                  /* حالت اولیه (دکمه انتخاب فایل) */
                  <>
                    <label
                      htmlFor="custProfilePicInput"
                      className="custom-file-upload"
                    >
                      <span id="upload-text-indicator">انتخاب فایل</span>
                    </label>
                    <input
                      type="file"
                      id="custProfilePicInput"
                      className="hidden-file-input"
                      accept="image/*"
                      onChange={handleProfilePicChange}
                    />
                  </>
                )}
              </div>
            </div>

            {/* دکمه اکشن */}
            <div className="account-modal-actions">
              <button
                type="submit"
                id="saveCustomerBtn"
                className="account-btn-save"
                onMouseDown={(e) => e.preventDefault()}
              >
                {customerToEdit ? "ویرایش اطلاعات" : "ذخیره اطلاعات"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* مودال هشدار خروجی/تکراری بودن نام */}
      {alertModal.show && (
        <div
          className={`custom-alert-overlay ${isClosingAlert ? "is-closing" : ""}`}
          onClick={closeAlertModal}
        >
          <div
            className="account-alert-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="custom-alert-icon-bg">
              <svg
                viewBox="0 0 24 24"
                width="48"
                height="48"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 className="custom-alert-title">{alertModal.title}</h3>
            <p className="account-custom-element">{alertModal.message}</p>
            <div className="custom-alert-actions">
              <button className="custom-alert-btn" onClick={closeAlertModal}>
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Account;
