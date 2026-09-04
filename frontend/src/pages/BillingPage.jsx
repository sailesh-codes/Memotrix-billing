import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductBillingForm } from '../components/invoice/ProductBillingForm';

export function BillingPage() {
  const navigate = useNavigate();

  const handleInvoiceCreated = (billId) => {
    navigate(`/invoices/${billId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Billing & Receipt Creation</h1>
        <p className="text-sm text-gray-500">Generate non-quantity product/service billing receipts for Memotrix clients</p>
      </div>

      <ProductBillingForm onInvoiceCreated={handleInvoiceCreated} />
    </div>
  );
}

export default BillingPage;
