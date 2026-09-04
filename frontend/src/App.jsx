import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import InactivityWarningModal from './components/InactivityWarningModal';
import LoginForm from './components/auth/LoginForm';

import DashboardPage from './pages/DashboardPage';
import BillingPage from './pages/BillingPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceDetailsPage from './pages/InvoiceDetailsPage';
import ProductsPage from './pages/ProductsPage';
import CustomersPage from './pages/CustomersPage';
import InventoryPage from './pages/InventoryPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      <Navbar />
      <div className="flex flex-1 w-full">
        <Sidebar />
        <main className="flex-1 min-w-0 p-6 overflow-y-auto w-full">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailsPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <InactivityWarningModal />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <CartProvider>
              <ProtectedLayout />
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
