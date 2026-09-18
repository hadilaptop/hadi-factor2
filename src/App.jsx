import { useState, useEffect } from "react";
import { StatusBar, Style } from "@capacitor/status-bar"; // 👈 اضافه شد
import Dashboard from "./components/Dashboard";
import Customers from "./components/customers";
import Account from "./components/account";
import CustomerLedger from "./components/CustomerLedger";
import Invoice from "./components/invoice";
import Payment from "./components/payment";
import Settings from "./components/settings";
import BottomNav from "./components/BottomNav";
import { useAppStore } from "./store/useAppStore";
import "./styles/global.css";

export default function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [customerToEdit, setCustomerToEdit] = useState(null);
  const [selectedCustomerForLedger, setSelectedCustomerForLedger] = useState(null);
  const [invoiceCustomer, setInvoiceCustomer] = useState(null);
  const [invoiceToEdit, setInvoiceToEdit] = useState(null);
  const [invoiceInitialStep, setInvoiceInitialStep] = useState("form");
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [paymentToEdit, setPaymentToEdit] = useState(null);

  const isInitialized = useAppStore((state) => state.isInitialized);
  const initializeData = useAppStore((state) => state.initializeData);
  const customers = useAppStore((state) => state.customers);
  const saveCustomer = useAppStore((state) => state.saveCustomer);
  const deleteCustomer = useAppStore((state) => state.deleteCustomer);

  useEffect(() => {
    initializeData();

    // 👈 تنظیمات مربوط به همرنگ کردن نوار بالای گوشی
    const setupStatusBar = async () => {
      try {
        // تغییر رنگ بک‌گراند نوار وضعیت به رنگ آبی تیره سیستم شما
        // اگر کد رنگ دقیق هدر سیستم متفاوت است، آن را به جای کد زیر قرار دهید
        await StatusBar.setBackgroundColor({ color: '#133a5e' });
        
        // سفید کردن آیکون‌های باتری و ساعت تا روی پس‌زمینه تیره خوانا باشند
        await StatusBar.setStyle({ style: Style.Dark });
      } catch (error) {
        console.log('تنظیمات Status Bar روی مرورگر وب اعمال نمی‌شود و فقط مخصوص موبایل است.');
      }
    };

    setupStatusBar();
  }, [initializeData]);

  const handleNavigate = (page) => {
    if (page !== currentPage) {
      if (currentPage !== "settings" && currentPage !== "account") {
        sessionStorage.setItem(`${page}Referrer`, currentPage);
      }
    }
    setCurrentPage(page);
  };

  const handleSaveCustomer = async (customerData) => {
    const success = await saveCustomer(customerData);
    if (success) {
      setCustomerToEdit(null);
    }
    return success;
  };

  const handleEditCustomer = (customer) => {
    setCustomerToEdit(customer);
    handleNavigate("account");
  };

  const handleDeleteCustomer = async (id) => {
    await deleteCustomer(id);
  };

  const handleOpenCustomerLedger = (customer) => {
    setSelectedCustomerForLedger(customer);
    handleNavigate("customer-ledger");
  };

  const handleOpenInvoicePage = (customer, invoice = null, step = "form") => {
    setInvoiceCustomer(customer);
    setInvoiceToEdit(invoice);
    setInvoiceInitialStep(step);
    handleNavigate("invoice");
  };

  const handleOpenPaymentPage = (customer, payment = null) => {
    setPaymentCustomer(customer);
    setPaymentToEdit(payment);
    if (customer) {
      setSelectedCustomerForLedger(customer);
    }
    handleNavigate("payment");
  };

  return (
    <div className="app-root">
      {currentPage === "dashboard" && (
        <Dashboard
          onNavigate={handleNavigate}
          customerCount={customers.length}
          isInitialized={isInitialized}
          onOpenNewAccountPage={() => {
            setCustomerToEdit(null);
            handleNavigate("account");
          }}
        />
      )}
      {currentPage === "customers" && (
        <Customers
          onNavigate={handleNavigate}
          customers={customers}
          onDeleteCustomer={handleDeleteCustomer}
          onEditCustomer={handleEditCustomer}
          onSelectCustomerLedger={handleOpenCustomerLedger}
          onOpenNewAccountPage={() => {
            setCustomerToEdit(null);
            handleNavigate("account");
          }}
        />
      )}
      {currentPage === "account" && (
        <Account
          onNavigate={handleNavigate}
          onSave={handleSaveCustomer}
          customerToEdit={customerToEdit}
          existingCustomers={customers}
        />
      )}
      {currentPage === "customer-ledger" && (
        <CustomerLedger
          customer={selectedCustomerForLedger}
          onNavigate={handleNavigate}
          onOpenInvoice={handleOpenInvoicePage}
          onOpenPaymentPage={handleOpenPaymentPage}
        />
      )}
      {currentPage === "payment" && (
        <Payment
          key={paymentToEdit?.id || paymentCustomer?.id || "default"}
          onNavigate={handleNavigate}
          initialCustomer={paymentCustomer}
          paymentToEdit={paymentToEdit}
          customers={customers}
        />
      )}
      {currentPage === "invoice" && (
        <Invoice
          key={invoiceToEdit?.id || invoiceCustomer?.id || "default"}
          onNavigate={handleNavigate}
          initialCustomer={invoiceCustomer}
          invoiceToEdit={invoiceToEdit}
          initialStep={invoiceInitialStep}
          customers={customers}
        />
      )}
      {currentPage === "settings" && (
        <Settings onNavigate={handleNavigate} />
      )}
      
      {isInitialized && <BottomNav currentPage={currentPage} onNavigate={handleNavigate} onAddCustomer={() => {
        setCustomerToEdit(null);
        handleNavigate("account");
      }} />}
    </div>
  );
}