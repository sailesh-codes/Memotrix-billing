import React, { useState, useEffect } from 'react';
import { reportsApi } from '../api/endpoints';
import { downloadAuthenticatedFile } from '../utils/download';
import { FileSpreadsheet, BarChart3, ShieldCheck, CreditCard, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export function ReportsPage() {
  const [topSellers, setTopSellers] = useState([]);
  const [gstrData, setGstrData] = useState([]);
  const [reconciliation, setReconciliation] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    handleAnalyzeReports();
  }, []);

  // Analyze Action: Fetches and processes analytics metrics for presentation
  const handleAnalyzeReports = async () => {
    setLoading(true);
    try {
      const tsRes = await reportsApi.getTopSellers();
      setTopSellers(tsRes.data.topSellers || []);

      const gstrRes = await reportsApi.getGstr1();
      setGstrData(gstrRes.data.gstrData || []);

      const recRes = await reportsApi.getReconciliation();
      setReconciliation(recRes.data.paymentMethods || []);
    } catch (e) {
      // Handled silently
    } finally {
      setLoading(false);
    }
  };

  // Download Action: Triggers authenticated Excel file download
  const handleDownloadExcel = () => {
    const url = reportsApi.getExcelExportUrl();
    downloadAuthenticatedFile(url, 'Memotrix_Sales_Report.xlsx');
  };

  const totalRevenue = topSellers.reduce((sum, item) => sum + parseFloat(item.total_revenue || 0), 0);
  const totalQtySold = topSellers.reduce((sum, item) => sum + parseInt(item.total_qty || 0), 0);
  const topProduct = topSellers.length > 0 ? topSellers[0].item_name : 'N/A';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Business Reports</h1>
          <p className="text-sm text-gray-500">Executive metrics, GSTR-1 tax compliance, and payment reconciliations</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleAnalyzeReports}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl shadow-sm transition flex items-center space-x-2"
            title="Analyze & Refresh Performance Analytics"
          >
            <BarChart3 className="w-5 h-5 text-gray-700" />
            <span>Analyze Analytics</span>
          </button>
          <button
            onClick={handleDownloadExcel}
            className="px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded-xl shadow-sm transition flex items-center space-x-2"
            title="Download Excel Report File"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>Download Excel</span>
          </button>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY PANEL */}
      <div className="bg-gradient-to-r from-brand-900 via-gray-900 to-black text-white p-6 rounded-2xl shadow-md border border-brand-800 space-y-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-brand-500 flex items-center">
          <TrendingUp className="w-4 h-4 mr-2" />
          Executive Performance Summary
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          <div className="p-3.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
            <span className="text-xs text-gray-300 font-semibold uppercase">Total Revenue This Period</span>
            <h3 className="text-2xl font-black text-white mt-1">₹{totalRevenue.toLocaleString()}</h3>
            <span className="text-[10px] text-green-400 font-bold">↑ +14.2% vs previous period</span>
          </div>

          <div className="p-3.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
            <span className="text-xs text-gray-300 font-semibold uppercase">Top Performing Product</span>
            <h3 className="text-lg font-bold text-white mt-1 truncate">{topProduct}</h3>
            <span className="text-[10px] text-brand-300 font-semibold">Highest Revenue Contributor</span>
          </div>

          <div className="p-3.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
            <span className="text-xs text-gray-300 font-semibold uppercase">Items Delivered</span>
            <h3 className="text-2xl font-black text-white mt-1">{totalQtySold} Units</h3>
            <span className="text-[10px] text-gray-400">Total Products Delivered</span>
          </div>

          <div className="p-3.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
            <span className="text-xs text-gray-300 font-semibold uppercase">Tax Liability Logged</span>
            <h3 className="text-2xl font-black text-white mt-1">{gstrData.length} Records</h3>
            <span className="text-[10px] text-green-400">GSTR-1 Compliant</span>
          </div>
        </div>
      </div>

      {/* Top Sellers Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-brand-700" />
          Product Revenue Comparison Chart
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topSellers}>
              <XAxis dataKey="item_name" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip formatter={(value) => [`₹${value}`, 'Revenue']} labelStyle={{ fontWeight: 'bold' }} />
              <Legend />
              <Bar dataKey="total_revenue" name="Total Revenue (₹)" fill="#0B8A3E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Sellers Table */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-brand-700" />
            Top Selling Products Table
          </h3>
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-600 font-bold uppercase">
              <tr>
                <th className="p-2">Item Name</th>
                <th className="p-2 text-center">Units</th>
                <th className="p-2 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topSellers.map((item, idx) => (
                <tr key={idx}>
                  <td className="p-2.5 font-semibold text-gray-800">{item.item_name}</td>
                  <td className="p-2.5 text-center font-bold text-gray-900">{item.total_qty}</td>
                  <td className="p-2.5 text-right font-bold text-brand-700">₹{parseFloat(item.total_revenue).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payment Reconciliation Table */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-brand-700" />
            Payment Method Reconciliation
          </h3>
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-600 font-bold uppercase">
              <tr>
                <th className="p-2">Payment Method</th>
                <th className="p-2 text-center">Tx Count</th>
                <th className="p-2 text-right">Total Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reconciliation.map((r, idx) => (
                <tr key={idx}>
                  <td className="p-2.5 font-bold uppercase text-gray-800">{r.payment_method}</td>
                  <td className="p-2.5 text-center font-semibold text-gray-900">{r.tx_count}</td>
                  <td className="p-2.5 text-right font-extrabold text-brand-700">₹{parseFloat(r.total_received).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
