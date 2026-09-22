import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, settingsApi } from '../api/endpoints';

const AuthContext = createContext(null);

const FIXED_ADMIN_EMAIL = 'teammemotrix@gmail.com';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('memotrix_user');
      return (saved && saved !== 'undefined') ? { ...JSON.parse(saved), email: FIXED_ADMIN_EMAIL } : null;
    } catch (e) {
      console.error('Failed to parse memotrix_user from localStorage:', e);
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('memotrix_token') || null);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [templateSettings, setTemplateSettings] = useState(null);
  const [featureFlags, setFeatureFlags] = useState({ barcode_enabled: false, loyalty_enabled: false });
  const [sessionErrorMessage, setSessionErrorMessage] = useState(null);

  const logout = useCallback(async () => {
    try {
      if (token) await authApi.logout();
    } catch (e) {
      // ignore
    } finally {
      localStorage.removeItem('memotrix_token');
      localStorage.removeItem('memotrix_user');
      localStorage.removeItem('memotrix_last_activity');
      localStorage.removeItem('memotrix-billing-draft'); // Wipe sensitive draft data on logout
      setToken(null);
      setUser(null);
    }
  }, [token]);

  const refreshSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await settingsApi.getBusinessProfile();
      setBusinessProfile(res.data.businessProfile);
      setTemplateSettings(res.data.templateSettings);
      setFeatureFlags(res.data.featureFlags || { barcode_enabled: false, loyalty_enabled: false });
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      refreshSettings();
    }
  }, [token, refreshSettings]);

  useEffect(() => {
    const handleExpired = (e) => {
      const detail = e.detail || {};
      let msg = 'Session expired. Please log in.';
      if (typeof detail.error === 'string') {
        msg = detail.error;
      } else if (typeof detail.message === 'string') {
        msg = detail.message;
      } else if (typeof detail.error?.message === 'string') {
        msg = detail.error.message;
      } else if (typeof detail === 'string') {
        msg = detail;
      }
      setSessionErrorMessage(String(msg));
      logout();
    };
    window.addEventListener('memotrix_session_expired', handleExpired);
    return () => window.removeEventListener('memotrix_session_expired', handleExpired);
  }, [logout]);

  // Sync logout across tabs if user explicitly logs out in another tab
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'memotrix_token' && !e.newValue) {
        setToken(null);
        setUser(null);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = (tokenData, userData) => {
    const safeUserData = { ...userData, email: FIXED_ADMIN_EMAIL };
    localStorage.setItem('memotrix_token', tokenData);
    localStorage.setItem('memotrix_user', JSON.stringify(safeUserData));
    setToken(tokenData);
    setUser(safeUserData);
    setSessionErrorMessage(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        businessProfile,
        templateSettings,
        featureFlags,
        refreshSettings,
        login,
        logout,
        showInactivityWarning: false,
        resetInactivityTimer: () => {},
        sessionErrorMessage,
        setSessionErrorMessage
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
