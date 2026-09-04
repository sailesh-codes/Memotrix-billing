import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Package,
  Users,
  Boxes,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Product Billing', path: '/billing', icon: Receipt },
  { name: 'Invoices & Receipts', path: '/invoices', icon: FileText },
  { name: 'Products Catalog', path: '/products', icon: Package },
  { name: 'Customers List', path: '/customers', icon: Users },
  { name: 'Inventory Stock', path: '/inventory', icon: Boxes },
  { name: 'Analytics & Reports', path: '/reports', icon: BarChart3 },
  { name: 'System Settings', path: '/settings', icon: Settings }
];

export function Sidebar() {
  const { businessProfile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`no-print sticky top-16 h-[calc(100vh-4rem)] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800/80 transition-all duration-300 flex flex-col justify-between p-3.5 z-20 flex-shrink-0 ${
        collapsed ? 'w-20' : 'w-[280px]'
      }`}
    >
      <div className="space-y-4">
        {/* Sidebar Branding & Logo */}
        {!collapsed && (
          <div className="flex items-center space-x-3 px-2 pt-1 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="w-[48px] h-[48px] flex items-center justify-center flex-shrink-0">
              <img
                src={businessProfile?.logo_url || '/logo-default.png'}
                alt="Logo"
                className="max-w-[48px] max-h-[48px] object-contain drop-shadow-sm"
              />
            </div>
            <div className="overflow-hidden">
              <span className="font-black text-xs text-slate-900 dark:text-slate-100 tracking-tight truncate block">
                {businessProfile?.business_name || 'Memotrix'}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                Navigation
              </span>
            </div>
          </div>
        )}

        {/* Collapse Toggle Header */}
        <div className="flex items-center justify-between px-2">
          {!collapsed && (
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Navigation Menu
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition mx-auto"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Menu Links */}
        <nav className="space-y-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 dark:shadow-blue-900/40 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`
                }
              >
                <Icon className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Branding Box */}
      {!collapsed && (
        <div className="p-3.5 bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 rounded-2xl text-xs space-y-1">
          <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 font-extrabold text-[11px]">
            <Zap className="w-3.5 h-3.5" />
            <span>Memotrix Enterprise</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Single-Factor Business Portal</p>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
