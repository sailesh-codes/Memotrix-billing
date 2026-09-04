import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { billsApi } from '../api/endpoints';
import { downloadAuthenticatedFile } from '../utils/download';
import { Eye, Download, XCircle, Search, RefreshCw } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export function InvoicesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [bills, setBills] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [voidModalBill, setVoidModalBill] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    try {
      const res = await billsApi.getAll();
      setBills(res.data.bills || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeInvoice = (bill) => {
    navigate(`/invoices/${bill.id}`);
  };

  const handleDownloadInvoice = (bill, e) => {
    e.stopPropagation();
    const url = billsApi.getPdfUrl(bill.id);
    downloadAuthenticatedFile(url, `${bill.bill_number}.pdf`);
  };

  const handleVoidSubmit = async (e) => {
    e.preventDefault();
    setVoidError('');
    try {
      await billsApi.voidBill(voidModalBill.id, { adminPassword, reason: voidReason });
      setVoidModalBill(null);
      setAdminPassword('');
      setVoidReason('');
      fetchBills();
    } catch (err) {
      setVoidError(err.response?.data?.error || 'Failed to void bill');
    }
  };

  const handleStatusChange = async (bill, newStatus) => {
    try {
      await billsApi.updateStatus(bill.id, { status: newStatus });
      setBills(prev => prev.map(b => b.id === bill.id ? { ...b, payment_status: newStatus } : b));
      showToast(`Invoice #${bill.bill_number} status updated to ${newStatus.toUpperCase()}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  const handleRegeneratePdf = async (bill, e) => {
    e.stopPropagation();
    try {
      await billsApi.regeneratePdf(bill.id);
      showToast(`PDF regenerated and cached successfully for #${bill.bill_number}!`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to regenerate PDF', 'error');
    }
  };

  const filtered = bills.filter(b =>
    b.bill_number.toLowerCase().includes(search.toLowerCase()) ||
    b.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices & Receipts History</h1>
          <p className="text-sm text-gray-500">Manage, download PDF, print, edit (within 24h), and audit tax invoices</p>
        </div>
        <Link
          to="/billing"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition"
        >
          + Create Invoice
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by invoice number or customer name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading invoices...</div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-100 text-gray-600 font-bold uppercase border-b">
              <tr>
                <th className="p-3">Bill #</th>
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-center">Status (Editable)</th>
                <th className="p-3 text-center">Executed By</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="p-3 font-mono font-bold text-blue-700">{b.bill_number}</td>
                  <td className="p-3 text-gray-600">{b.bill_date}</td>
                  <td className="p-3 font-semibold text-gray-900">
                    {b.customer_name}
                    {b.customer_email && <span className="block text-[10px] text-gray-400">{b.customer_email}</span>}
                  </td>
                  <td className="p-3 text-right font-extrabold text-gray-900">₹{parseFloat(b.grand_total).toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <select
                      value={b.payment_status || 'pending'}
                      onChange={(e) => handleStatusChange(b, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border outline-none cursor-pointer transition ${
                        b.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        b.payment_status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        b.payment_status === 'overdue' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                        b.payment_status === 'void' ? 'bg-gray-100 text-gray-800 border-gray-300' : 'bg-blue-100 text-blue-800 border-blue-300'
                      }`}
                    >
                      <option value="paid">PAID</option>
                      <option value="pending">PENDING</option>
                      <option value="overdue">OVERDUE</option>
                      <option value="void">VOID</option>
                    </select>
                  </td>
                  <td className="p-3 text-center text-gray-600 font-semibold">{b.executed_by || 'Authorized Signatory'}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handleAnalyzeInvoice(b)}
                        className="p-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md flex items-center space-x-1"
                        title="Analyze / View Invoice Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDownloadInvoice(b, e)}
                        className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md flex items-center space-x-1"
                        title="Download PDF Invoice (Cached)"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleRegeneratePdf(b, e)}
                        className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md flex items-center space-x-1"
                        title="Regenerate PDF Template Cache"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      {b.payment_status !== 'void' && (
                        <button
                          onClick={() => setVoidModalBill(b)}
                          className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md"
                          title="Void Bill (Requires Admin Password)"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {voidModalBill && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-red-600 mb-2">Void Invoice #{voidModalBill.bill_number}</h3>
            <p className="text-xs text-gray-600 mb-4">
              Voiding this invoice will restore all stock items and mark the status as VOID. Action requires admin password re-entry and a reason.
            </p>

            {voidError && <p className="text-xs text-red-600 mb-3">{voidError}</p>}

            <form onSubmit={handleVoidSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Voiding *</label>
                <textarea
                  required
                  rows="2"
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  placeholder="Reason..."
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm Admin Password *</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="Admin Password"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex space-x-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setVoidModalBill(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoicesPage;
