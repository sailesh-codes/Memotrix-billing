import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/endpoints';
import { Lock, User, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';

export function LoginForm() {
  const { login, sessionErrorMessage, businessProfile } = useAuth();
  const [username, setUsername] = useState(() => localStorage.getItem('memotrix_remembered_user') || 'teammemotrix@gmail.com');
  const [password, setPassword] = useState('Admin1234');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login({ username, password });
      if (rememberMe) {
        localStorage.setItem('memotrix_remembered_user', username);
      } else {
        localStorage.removeItem('memotrix_remembered_user');
      }
      login(res.data.token, res.data.user);
    } catch (err) {
      if (!err.response) {
        if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
          setError('Connection timed out. Please check your network and try again.');
        } else {
          setError('Unable to connect to the server. Please check your network connection.');
        }
        return;
      }

      const status = err.response.status;
      const data = err.response.data;
      const serverMsg = typeof data === 'string' ? data : (data?.error || data?.message);

      if (status === 400) {
        setError(serverMsg || 'Please provide both username/email and password.');
      } else if (status === 401) {
        setError(serverMsg || 'Invalid email or password.');
      } else if (status === 403) {
        setError(serverMsg || 'Access denied. Administrator privileges required.');
      } else if (status === 404) {
        setError('Authentication service not found.');
      } else if (status === 429) {
        setError('Too many login attempts. Please wait 15 minutes before trying again.');
      } else if (status >= 500) {
        setError('Authentication service temporarily unavailable. Please try again.');
      } else {
        setError(serverMsg || 'An unexpected error occurred during login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 transition-all duration-500">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 sm:p-10 max-w-md w-full border border-white/20 dark:border-slate-800 transform transition-all duration-300 space-y-6">
        
        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="w-[72px] h-[72px] mx-auto flex items-center justify-center">
            <img
              src={businessProfile?.logo_url || '/logo-default.png'}
              alt="Memotrix Logo"
              className="max-w-[72px] max-h-[72px] object-contain drop-shadow-md"
            />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Memotrix Admin</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Enterprise Product Billing & Management</p>
        </div>

        {sessionErrorMessage && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-2xl flex items-center">
            <AlertCircle className="w-4 h-4 mr-2.5 flex-shrink-0 text-rose-500" />
            <span>
              {typeof sessionErrorMessage === 'object'
                ? (sessionErrorMessage.message || sessionErrorMessage.error || JSON.stringify(sessionErrorMessage))
                : String(sessionErrorMessage)}
            </span>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs rounded-2xl flex items-start">
            <AlertCircle className="w-4 h-4 mr-2.5 mt-0.5 flex-shrink-0 text-amber-600" />
            <span>
              {typeof error === 'object'
                ? (error.message || error.error || JSON.stringify(error))
                : String(error)}
            </span>
          </div>
        )}

        {/* Clean Single-Factor Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Username / Email</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="teammemotrix@gmail.com (or admin)"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">Default: Admin1234</span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                spellCheck="false"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
              />
              <span>Remember session</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition duration-200 flex items-center justify-center space-x-2 active:scale-95"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>{loading ? 'Authenticating...' : 'Secure Admin Login'}</span>
          </button>
        </form>

        <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-4">
          Memotrix Enterprise SaaS Platform • Single-Factor Authentication
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
