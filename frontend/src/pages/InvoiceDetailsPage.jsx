import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { billsApi } from '../api/endpoints';
import { InvoiceView } from '../components/invoice/InvoiceView';
import { InvoiceErrorBoundary } from '../components/invoice/InvoiceErrorBoundary';
import { downloadAuthenticatedFile } from '../utils/download';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export function InvoiceDetailsPage() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      const res = await billsApi.getById(id);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    console.log('[ACTION] Download PDF clicked for invoice:', id);
    const url = billsApi.getPdfUrl(id);
    const filename = data?.bill?.bill_number ? `${data.bill.bill_number}.pdf` : `Invoice_${id}.pdf`;
    downloadAuthenticatedFile(url, filename);
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await billsApi.updateStatus(id, { status: newStatus });
      setData(prev => prev ? { ...prev, bill: { ...prev.bill, payment_status: newStatus } } : prev);
      showToast(`Payment status updated to ${newStatus.toUpperCase()}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  const handleRegeneratePdf = async () => {
    try {
      await billsApi.regeneratePdf(id);
      showToast(`PDF template regenerated successfully for #${data.bill.bill_number}!`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to regenerate PDF', 'error');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading invoice...</div>;
  if (!data || !data.bill) return <div className="p-8 text-center text-gray-500">Invoice not found.</div>;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <Link to="/invoices" className="inline-flex items-center text-xs text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Invoices History
        </Link>
      </div>

      <InvoiceErrorBoundary>
        <InvoiceView
          bill={data.bill}
          items={data.items}
          businessProfile={data.businessProfile}
          templateSettings={data.templateSettings}
          amountInWords={data.amountInWords}
          upiQrDataUri={data.upiQrDataUri}
          onPrint={handlePrint}
          onDownloadPdf={handleDownloadPdf}
          onRegeneratePdf={handleRegeneratePdf}
          onStatusChange={handleStatusChange}
        />
      </InvoiceErrorBoundary>
    </div>
  );
}

export default InvoiceDetailsPage;
