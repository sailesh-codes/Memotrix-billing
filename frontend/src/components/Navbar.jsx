import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { reportsApi } from '../api/endpoints';
import { Search, Bell, Sun, Moon, Laptop, LogOut, User, ChevronRight, Clock, ShieldCheck, FileText, Package, Users as UsersIcon, X } from 'lucide-react';

export function Navbar() {
  const { user, logout, businessProfile, showInactivityWarning, resetInactivityTimer } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef(null);

  // Path to Breadcrumb formatting
  const getBreadcrumbs = () => {
    const path = location.pathname.substring(1);
    if (!path) return 'Dashboard';
    const firstSegment = path.split('/')[0];
    return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
  };

  const getThemeIcon = () => {
    if (theme === 'light') return <Sun className="w-4 h-4 text-amber-500" />;
    if (theme === 'dark') return <Moon className="w-4 h-4 text-blue-400" />;
    return <Laptop className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />;
  };

  const getThemeTitle = () => {
    if (theme === 'light') return 'Theme: Light Mode (Click for Dark)';
    if (theme === 'dark') return 'Theme: Dark Mode (Click for System)';
    return 'Theme: System Default (Click for Light)';
  };

  // Live Global Search Effect
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults(null);
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await reportsApi.globalSearch(searchQuery.trim());
        setSearchResults(res.data);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener for search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#1E293B]/90 backdrop-blur-xl border-b border-slate-200 dark:border-[#475569] no-print transition-colors duration-200">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Breadcrumbs & Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-[36px] h-[36px] flex items-center justify-center">
            <img
              src={businessProfile?.logo_url || '/logo-default.png'}
              alt="Memotrix Logo"
              className="max-w-[36px] max-h-[36px] object-contain drop-shadow-sm"
            />
          </div>
          <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {businessProfile?.business_name || 'Memotrix'}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold border border-blue-200/50 dark:border-blue-800/50">
              {getBreadcrumbs()}
            </span>
          </div>
        </div>

        {/* Center: Live Global Search Bar */}
        <div ref={searchRef} className="hidden md:flex flex-1 max-w-md mx-8 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults) setShowSearchDropdown(true);
            }}
            placeholder="Search invoices, products, customers..."
            className="w-full pl-10 pr-8 py-2 bg-slate-100/80 dark:bg-slate-800/80 border border-transparent focus:border-blue-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowSearchDropdown(false);
              }}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Interactive Global Search Dropdown */}
          {showSearchDropdown && searchResults && (
            <div className="absolute top-12 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto p-3 space-y-3">
              
              {/* Invoices Results */}
              {searchResults.invoices && searchResults.invoices.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center">
                    <FileText className="w-3 h-3 mr-1.5 text-blue-600" /> Invoices & Receipts
                  </div>
                  <div className="space-y-1 mt-1">
                    {searchResults.invoices.map(inv => (
                      <div
                        key={inv.id}
                        onClick={() => {
                          setShowSearchDropdown(false);
                          setSearchQuery('');
                          navigate(`/invoices/${inv.id}`);
                        }}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl cursor-pointer flex justify-between items-center transition text-xs"
                      >
                        <div>
                          <span className="font-bold text-blue-600 dark:text-blue-400 font-mono block">{inv.bill_number}</span>
                          <span className="text-slate-700 dark:text-slate-300 font-semibold">{inv.customer_name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-900 dark:text-slate-100 block">₹{parseFloat(inv.grand_total).toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400">{inv.bill_date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Products Results */}
              {searchResults.products && searchResults.products.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center">
                    <Package className="w-3 h-3 mr-1.5 text-emerald-600" /> Catalog Products
                  </div>
                  <div className="space-y-1 mt-1">
                    {searchResults.products.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setShowSearchDropdown(false);
                          setSearchQuery('');
                          navigate('/products');
                        }}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl cursor-pointer flex justify-between items-center transition text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">{p.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">SKU: {p.sku} | Stock: {p.stock_quantity}</span>
                        </div>
                        <span className="font-black text-emerald-600 dark:text-emerald-400">₹{p.retail_price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customers Results */}
              {searchResults.customers && searchResults.customers.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center">
                    <UsersIcon className="w-3 h-3 mr-1.5 text-purple-600" /> Customer Profiles
                  </div>
                  <div className="space-y-1 mt-1">
                    {searchResults.customers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setShowSearchDropdown(false);
                          setSearchQuery('');
                          navigate('/customers');
                        }}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl cursor-pointer flex justify-between items-center transition text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">{c.name}</span>
                          <span className="text-[10px] text-slate-400">{c.phone || c.email}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!searchResults.invoices?.length && !searchResults.products?.length && !searchResults.customers?.length) && (
                <div className="p-4 text-center text-xs text-slate-400">
                  No matching invoices, products, or customers found.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Controls & Admin Profile */}
        <div className="flex items-center space-x-2.5">
          {showInactivityWarning && (
            <button
              onClick={resetInactivityTimer}
              className="flex items-center text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/60 px-3 py-1.5 rounded-xl hover:bg-amber-100 transition animate-pulse"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              Extend Session
            </button>
          )}

          {/* Theme Toggle Button (Light / Dark / System) */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center cursor-pointer"
            title={getThemeTitle()}
          >
            {getThemeIcon()}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full animate-ping" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 text-xs z-50">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Notifications</span>
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">1 New</span>
                </div>
                <div className="space-y-2">
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-start space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">Session Authenticated</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Logged in as admin account.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Admin Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-slate-200/60 dark:border-slate-800"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                M
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 hidden sm:inline">{user?.username || 'Team Memotrix'}</span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 text-xs z-50 space-y-1">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl mb-1">
                  <p className="font-bold text-slate-900 dark:text-slate-100">{user?.username || 'Team Memotrix'}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">teammemotrix@gmail.com</p>
                </div>
                <Link
                  to="/settings"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <User className="w-4 h-4 mr-2 text-slate-400" />
                  Account Settings
                </Link>
                <button
                  onClick={() => { setShowProfileMenu(false); logout(); }}
                  className="w-full flex items-center px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition font-semibold"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout Session
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}

export default Navbar;
