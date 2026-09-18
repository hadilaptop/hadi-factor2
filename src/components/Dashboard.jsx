import { useState, useEffect } from "react";
import "../styles/dashboard.css";

function Dashboard({ onNavigate, customerCount = 0, isInitialized = false, onOpenNewAccountPage }) {
  const [currentDate] = useState(() => {
    const today = new Date();
    const weekday = new Intl.DateTimeFormat("fa-IR", {
      weekday: "long",
    }).format(today);
    const day = new Intl.DateTimeFormat("fa-IR", { day: "numeric" }).format(
      today,
    );
    const month = new Intl.DateTimeFormat("fa-IR", { month: "long" }).format(
      today,
    );
    const year = new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(
      today,
    );
    return `${weekday}، ${day} ${month} ${year}`;
  });

  const displayCustomerCount = Number(customerCount || 0).toLocaleString("fa-IR");

  // هندلر دکمه حساب جدید
  const handleNewAccountClick = () => {
    sessionStorage.setItem("accountReferrer", "dashboard");
    onOpenNewAccountPage();
  };

  return (
    <div id="dashboard-view" className="dashboard-app-container">
      <div className="dash-header">
        <div className="dash-header-top">
          <div className="dash-date">{currentDate}</div>
        </div>
        <div className="dash-header-title">سیستم مدیریت فاکتور و حسابداری</div>
      </div>

      <div id="dash-content" className="dash-content">
        <div className="dash-grid">
          {/* کارت فاکتور جدید */}
          <div
            className="dash-card card-invoice"
            onClick={() => onNavigate("invoice")}
          >
            <div className="card-header">
              <span className="card-icon">📈</span>
              <span className="card-title">فاکتور جدید</span>
            </div>
            <div className="card-body">
              <div className="card-count">صدور سریع فاکتور</div>
              <div className="card-desc">صدور پیش‌فاکتور و فاکتور فروش</div>
            </div>
          </div>

          {/* کارت مدیریت حساب‌ها */}
          <div
            className="dash-card card-crm"
            onClick={() => onNavigate("customers")}
          >
            <div className="card-header">
              <span className="card-icon">👥</span>
              <span className="card-title">مدیریت حساب‌ها</span>
            </div>
            <div className="card-body">
              <div className="card-count">
                {!isInitialized ? (
                  "در حال به‌روزرسانی..."
                ) : (
                  <>
                    تعداد <span>{displayCustomerCount}</span> مشتری
                  </>
                )}
              </div>
              <div className="card-desc">مشاهده صورتحساب و پرداختی‌ها</div>
            </div>
          </div>

          {/* کارت حساب جدید */}
          <div
            className="dash-card card-account"
            onClick={handleNewAccountClick}
          >
            <div className="card-header">
              <span className="card-icon">👤</span>
              <span className="card-title">حساب جدید</span>
            </div>
            <div className="card-body">
              <div className="card-count">ثبت مشتری جدید</div>
              <div className="card-desc">افزودن اطلاعات برای صدور فاکتور</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
