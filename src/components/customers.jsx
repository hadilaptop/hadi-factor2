import { useState, useEffect, useMemo } from "react";
import "../styles/customers.css";
import { getCustomerCode, toPersianDigits } from "../utils/invoiceHelpers";

function Customers({
  onNavigate,
  customers = [],
  onDeleteCustomer,
  onEditCustomer,
  onSelectCustomerLedger,
  onOpenNewAccountPage
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isClosingPage, setIsClosingPage] = useState(false); // استیت مدیریت خروج صفحه

  // استیت‌های مدیریت منوی سه نقطه و مودال حذف
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [deleteModalData, setDeleteModalData] = useState(null);
  const [isClosingDeleteModal, setIsClosingDeleteModal] = useState(false);

  // بستن منو با کلیک در هر جای صفحه و جلوگیری از اعمال کلیک (خورده شدن کلیک اول)
  useEffect(() => {
    if (activeDropdown === null) return;
    const handleGlobalClick = e => {
      const isDropdownMenu = e.target.closest('.customer-dropdown-menu');
      const isDropdownTrigger = e.target.closest('.customers-item-actions');
      if (!isDropdownMenu && !isDropdownTrigger) {
        e.stopPropagation();
        e.preventDefault();
        setActiveDropdown(null);
      }
    };

    // استفاده از فاز capture برای اولویت داشتن بر رویدادهای کلیک صفحه
    window.addEventListener("click", handleGlobalClick, true);
    return () => {
      window.removeEventListener("click", handleGlobalClick, true);
    };
  }, [activeDropdown]);
  
  const filteredCustomers = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return customers;
    const query = searchQuery.trim().toLowerCase();
    return customers.filter(customer => {
      const nameMatch = customer.name && customer.name.toLowerCase().includes(query);
      const phoneMatch = customer.phone && customer.phone.toLowerCase().includes(query);
      return nameMatch || phoneMatch;
    });
  }, [customers, searchQuery]);
  
  const handleClose = () => {
    setIsClosingPage(true);
    setTimeout(() => {
      onNavigate("dashboard");
    }, 200); // 200 میلی‌ثانیه صبر می‌کند تا انیمیشن خروج تمام شود
  };
  
  const handleAddCustomer = () => {
    sessionStorage.setItem("accountReferrer", "customers");
    onOpenNewAccountPage();
  };

  // تابع باز و بسته کردن منوی سه نقطه
  const toggleDropdown = id => {
    if (activeDropdown !== null) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(id);
    }
  };

  // توابع مدیریت مودال حذف
  const openDeleteModal = customer => {
    setDeleteModalData(customer);
    setActiveDropdown(null); // بستن منوی دراپ‌داون
  };
  const handleEditCustomerClick = customer => {
    setActiveDropdown(null);
    onEditCustomer(customer);
  };
  const closeDeleteModal = () => {
    setIsClosingDeleteModal(true);
    setTimeout(() => {
      setIsClosingDeleteModal(false);
      setDeleteModalData(null);
    }, 200);
  };
  const confirmDelete = () => {
    if (onDeleteCustomer) {
      onDeleteCustomer(deleteModalData.id);
    }
    closeDeleteModal();
  };
  
  return (
    <div id="customers-view" className={`modal-overlay ${isClosingPage ? 'is-closing-page' : ''}`}>
      <div className="modal-content customers-modal-content">
        {/* ===== هدر ===== */}
        <div className="customers-top-header">
          <h2 className="customers-title">مدیریت مشتریان</h2>
          <div className="customers-header-buttons">
            <button id="closeCustomersBtn" className="customers-btn" onClick={handleClose} title="بازگشت">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 10 4 15 9 20"></polyline>
                <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* ===== بخش جستجو و لیست مشتریان ===== */}
        <div id="customers-list" className="customers-list pb-safe-bottom">
          <div className="customers-search-container">
            <div className="customers-search-wrapper">
              <span className="customers-search-icon">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
              <input id="customersSearchInput" className="customers-search-input" type="text" placeholder="جستجوی نام یا شماره مشتری..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              {searchQuery && <button type="button" className="customers-search-clear" onClick={() => setSearchQuery("")} title="پاک کردن جستجو">
                  ✕
                </button>}
            </div>
          </div>

          <div className="customers-table-container">
            <div className="customers-card-list">
              {filteredCustomers.length > 0 ? filteredCustomers.map(customer => <div key={customer.id || customer.name} className="customer-item-wrapper">
                    <div className="customers-list-item" onClick={() => onSelectCustomerLedger && onSelectCustomerLedger(customer)}>
                      <div className="customers-item-avatar">
                        {customer.avatar ? <img src={customer.avatar} alt={customer.name} className="customer-avatar-img" /> : <span>👤</span>}
                      </div>

                      <div className="customers-item-info">
                        <div className="customers-item-name">{customer.name}</div>
                        <div className="customers-item-code">
                          کد مشتری: {toPersianDigits(getCustomerCode(customer, customers))}
                        </div>
                      </div>

                      {/* دکمه سه نقطه */}
                      <div className={`customers-item-actions ${activeDropdown === customer.id ? "active" : ""}`} onClick={e => {
                  e.stopPropagation();
                  toggleDropdown(customer.id);
                }}>
                        <span className="customers-dots">⋮</span>
                      </div>
                    </div>

                    {/* منوی دراپ‌داون (خارج از customers-list-item) */}
                    {activeDropdown === customer.id && <div className="customer-dropdown-menu" onClick={e => e.stopPropagation()}>
                        <button className="customer-dropdown-item customer-dropdown-edit" onClick={e => {
                  e.stopPropagation();
                  setActiveDropdown(null);
                  handleEditCustomerClick(customer);
                }}>
                          <span className="customer-item-text">ویرایش مشخصات</span>
                          <span className="customer-dropdown-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </span>
                        </button>

                        <button className="customer-dropdown-item customer-dropdown-delete" onClick={e => {
                  e.stopPropagation();
                  setActiveDropdown(null);
                  openDeleteModal(customer);
                }}>
                          <span className="customer-item-text">حذف مشتری</span>
                          <span className="customer-dropdown-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </span>
                        </button>
                      </div>}
                  </div>) : <div className="customers-custom-element">
                  {searchQuery.trim() ? `مشتری با مشخصات «${searchQuery}» یافت نشد.` : "هنوز مشتری ثبت نشده است."}
                </div>}
              </div>
            </div>
          </div>

        {/* ===== مودال تایید حذف ===== */}
        {deleteModalData && <div className={`customer-modal-overlay ${isClosingDeleteModal ? "is-closing" : ""}`} onClick={closeDeleteModal}>
            <div className="customer-modal-box" onClick={e => e.stopPropagation()}>
              <div className="customer-modal-icon-bg">
                <svg className="customer-modal-svg" viewBox="0 0 24 24" fill="none" stroke="#ff5c5c" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </div>

              <h3 className="customer-modal-title">آیا از حذف مطمئن هستید؟</h3>
              <p className="customer-modal-text">
                تمام پرداختی‌ها و فاکتورهای مرتبط با این شخص نیز حذف خواهند شد و
                قابل بازگشت نیست.
              </p>

              <div className="customer-modal-actions">
                <button className="customer-modal-btn customer-btn-cancel" onClick={closeDeleteModal}>
                  انصراف
                </button>
                <button className="customer-modal-btn customer-btn-danger" onClick={confirmDelete}>
                  بله حذف شود
                </button>
              </div>
            </div>
          </div>}
      </div>
    </div>
  );
}
export default Customers;