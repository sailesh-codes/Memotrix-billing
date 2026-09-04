import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, Clock } from 'lucide-react';

export function InactivityWarningModal() {
  const { showInactivityWarning, resetInactivityTimer, logout } = useAuth();

  if (!showInactivityWarning) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-amber-200">
        <div className="flex items-center space-x-3 text-amber-600 mb-4">
          <AlertTriangle className="w-8 h-8" />
          <h3 className="text-lg font-bold text-gray-900">Session Timeout Warning</h3>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          You have been inactive for over 13 minutes. For security compliance, your admin session will automatically terminate in <strong>2 minutes</strong>.
        </p>

        <div className="flex space-x-3 justify-end">
          <button
            onClick={logout}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
          >
            Logout Now
          </button>
          <button
            onClick={resetInactivityTimer}
            className="flex items-center px-4 py-2 text-sm font-medium bg-brand-700 hover:bg-brand-800 text-white rounded-lg shadow-sm transition"
          >
            <Clock className="w-4 h-4 mr-2" />
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}

export default InactivityWarningModal;
