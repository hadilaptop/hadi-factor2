import { useState, useEffect } from 'react';
import '../styles/settings.css';
import { Capacitor } from '@capacitor/core';
import { pickImageWithCapacitorPermission } from '../utils/capacitorPermissions';

function Settings({
  onNavigate
}) {
  // --- مدیریت State ها ---
  const [theme, setTheme] = useState(() => localStorage.getItem('invoiceTheme') || 'blue');
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('companyName') || '');
  const [companyAddress, setCompanyAddress] = useState(() => localStorage.getItem('companyAddress') || '');
  const [companyPhone, setCompanyPhone] = useState(() => localStorage.getItem('companyPhone') || '');
  const [economicCode, setEconomicCode] = useState(() => localStorage.getItem('companyEconomicCode') || localStorage.getItem('economicCode') || '');
  const [logoPreview, setLogoPreview] = useState(() => localStorage.getItem('companyLogo') || '');

  // استیت مربوط به انیمیشن خروج
  const [isClosingPage, setIsClosingPage] = useState(false);

  // انتخاب تم رنگی (تغییر وضعیت داخلی - بدون ذخیره لحظه‌ای در localStorage)
  const handleThemeChange = selectedTheme => {
    setTheme(selectedTheme);
  };

  // کلیک روی دکمه لوگو با چک کردن مجوز در زمان اجرا (Runtime Permissions)
  const handleLogoClick = async event => {
    if (Capacitor.isNativePlatform()) {
      event.preventDefault();
      const dataUrl = await pickImageWithCapacitorPermission(msg => alert(msg));
      if (dataUrl) {
        setLogoPreview(dataUrl);
      }
    }
  };

  // آپلود و پیش‌نمایش لوگو (مرورگر وب)
  const handleLogoChange = event => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- تابع برای تشخیص صفحه مبدا و بازگشت با تاخیر انیمیشن ---
  const handleClose = () => {
    setIsClosingPage(true);
    
    setTimeout(() => {
      const referrer = sessionStorage.getItem('settingsReferrer') || 'dashboard';
      sessionStorage.removeItem('settingsReferrer');
      onNavigate(referrer);
    }, 200); // صبر می‌کند تا انیمیشن خروج کل صفحه تمام شود
  };

  // ذخیره تنظیمات فقط با کلیک روی دکمه ذخیره
  const handleSave = () => {
    localStorage.setItem('invoiceTheme', theme);
    localStorage.setItem('companyName', companyName.trim());
    localStorage.setItem('companyAddress', companyAddress.trim());
    localStorage.setItem('companyPhone', companyPhone.trim());
    localStorage.setItem('companyEconomicCode', economicCode.trim());
    localStorage.setItem('companyLogo', logoPreview || '');

    // اعمال تم روی فاکتور در صورت وجود در DOM
    const invoiceView = document.getElementById('invoice-view');
    if (invoiceView) {
      invoiceView.setAttribute('data-theme', theme);
    }

    // پس از ذخیره، بازگشت به صفحه قبلی
    handleClose();
  };

  // بازنشانی فرم
  const handleReset = () => {
    setTheme('blue');
    setCompanyName('');
    setCompanyAddress('');
    setCompanyPhone('');
    setEconomicCode('');
    setLogoPreview('');
    localStorage.removeItem('invoiceTheme');
    localStorage.removeItem('companyName');
    localStorage.removeItem('companyAddress');
    localStorage.removeItem('companyPhone');
    localStorage.removeItem('companyEconomicCode');
    localStorage.removeItem('companyLogo');
  };

  // --- رندر کامپوننت ---
  return (
    <div id="settings-view" className={`settings-page-overlay ${isClosingPage ? 'is-closing-page' : ''}`}>
      <div className="settings-page-wrapper">

          {/* هدر صفحه */}
          <div className="settings-top-header">
              <h2 className="settings-title">⚙️ تنظیمات فاکتور</h2>
              <div className="settings-header-buttons">
                  
                  {/* اتصال دکمه بازگشت به تابع هوشمند */}
                  <button className="settings-back-btn" onClick={handleClose}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 10 4 15 9 20"></polyline>
                          <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
                      </svg>
                  </button>
              </div>
          </div>

          {/* بدنه اسکرول‌شونده و کارت فرم */}
          <div className="settings-page-content pb-safe-bottom">

              {/* کارت انتخاب تم */}
              <div className="settings-form-card">
                  <div className="settings-input-group">
                      <label>تم رنگی فاکتور:</label>
                      <div className="theme-selector">
                          {['gold', 'blue', 'red', 'green', 'teal'].map(t => (
                            <button key={t} className={`theme-btn ${t} ${theme === t ? 'active' : ''}`} title={t} onClick={() => handleThemeChange(t)}></button>
                          ))}
                      </div>
                  </div>
              </div>

              {/* کارت اطلاعات شرکت */}
              <div className="settings-form-card">
                  <div className="settings-input-group">
                      <label>نام شرکت:</label>
                      <input type="text" className="settings-input" placeholder="نام شرکت را وارد کنید" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                  </div>

                  <div className="settings-input-group">
                      <label>آدرس:</label>
                      <input type="text" className="settings-input" placeholder="آدرس شرکت را وارد کنید" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} />
                  </div>

                  <div className="settings-input-group">
                      <label>شماره تماس:</label>
                      <input type="text" className="settings-input" dir="ltr" placeholder="0912..." value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} />
                  </div>

                  <div className="settings-input-group">
                      <label>کد اقتصادی:</label>
                      <input type="text" className="settings-input" dir="ltr" placeholder=" 123... " value={economicCode} onChange={e => setEconomicCode(e.target.value)} />
                  </div>

                  <div className="settings-input-group logo-upload-group">
                      <label>لوگوی شرکت:</label>
                      <div className="logo-upload-wrapper">
                          <label htmlFor="settingLogoInput" className="settings-custom-file-upload" onClick={handleLogoClick}>
                              {!logoPreview && <span id="setting-upload-text-indicator">انتخاب لوگو</span>}
                              {logoPreview && <img id="setting-logo-preview-img" src={logoPreview} alt="Preview" className="settings-logo-preview-img" />}
                          </label>
                          <input type="file" id="settingLogoInput" className="settings-hidden-file-input" accept="image/*" onChange={handleLogoChange} />
                      </div>
                  </div>
              </div>

              {/* کارت دکمه‌ها */}
              <div className="settings-actions-card">
                  <button className="settings-btn-reset" onClick={handleReset}>🔄 بازنشانی</button>
                  <button className="settings-btn-save" onClick={handleSave}>ذخیره تنظیمات</button>
              </div>

          </div>
      </div>
  </div>
  );
}
export default Settings;