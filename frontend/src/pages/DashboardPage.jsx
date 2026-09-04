import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi, billsApi } from '../api/endpoints';
import { IndianRupee, FileText, Package, AlertTriangle, Clock, TrendingUp, ArrowRight, Plus, Users, ShoppingBag } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export function DashboardPage() {
  const [data, setData] = useState(null);
  const [recentBills, setRecentBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await reportsApi.getDashboard();
      setData(res.data);
      const billsRes = await billsApi.getAll();
      setRecentBills((billsRes.data.bills || []).slice(0, 6));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  const summary = data?.summary || { totalRevenue: 0, totalBills: 0, totalProducts: 0, lowStockCount: 0, totalCustomers: 0 };
  const monthlySales = data?.monthlySales || [];

  return (
    <div className="space-y-8">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              System Online
            </span>
            <span className="text-xs text-slate-400 font-medium">Memotrix Real-Time Billing</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-2 text-white">
            Welcome Back, <span className="bg-gradient-to-r from-blue-400 via-emerald-400 to-teal-300 bg-clip-text text-transparent">Team Memotrix</span> 👋
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Real-time sales revenue monitoring, live catalog analytics, and active customer billing records.
          </p>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/billing"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition duration-200 flex items-center space-x-2 text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Invoice</span>
          </Link>
          <Link
            to="/products"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition duration-200 flex items-center space-x-2 text-xs cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Manage Catalog</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Key Performance Indicators
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Live Real-time Sync</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 w-full">
          {/* Card 1: Total Revenue */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Revenue</span>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                ₹{summary.totalRevenue.toLocaleString()}
              </h3>
              <div className="flex items-center space-x-1 text-emerald-600 text-[11px] font-bold mt-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+12.4% vs last month</span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Invoices */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Invoices Issued</span>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {summary.totalBills}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Completed transaction receipts</p>
            </div>
          </div>

          {/* Card 3: Active Products */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Products Catalog</span>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {summary.totalProducts}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Items available in catalog</p>
            </div>
          </div>

          {/* Card 4: Low Stock Alerts */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Low Stock Alerts</span>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                {summary.lowStockCount}
              </h3>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1 font-semibold">Requires restocking attention</p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics & Activity Section (Full Width Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Interactive Revenue Chart */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                Revenue & Sales Trend
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Financial performance breakdown over time</p>
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full">
              Monthly Trend
            </span>
          </div>

          <div className="h-72 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySales}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="bill_date" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  formatter={(val) => [`₹${val}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center">
                <Clock className="w-4 h-4 mr-2 text-blue-600" />
                Recent Invoices
              </h3>
              <Link to="/invoices" className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center">
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>

            <div className="space-y-3">
              {recentBills.map(b => (
                <div key={b.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="font-bold text-xs font-mono text-blue-600 dark:text-blue-400">{b.bill_number}</span>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{b.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">₹{parseFloat(b.grand_total).toFixed(2)}</span>
                    <span className={`block text-[10px] font-bold uppercase ${
                      b.payment_status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {b.payment_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link to="/billing" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
              + Generate New Bill
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
