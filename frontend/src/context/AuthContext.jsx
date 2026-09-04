import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, settingsApi } from '../api/endpoints';

const AuthContext = createContext(null);

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;
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
  
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [sessionErrorMessage, setSessionErrorMessage] = useState(null);

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
      setSessionErrorMessage(detail.error || 'Session expired. Please log in.');
      logout();
    };
    window.addEventListener('memotrix_session_expired', handleExpired);
    return () => window.removeEventListener('memotrix_session_expired', handleExpired);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    setLastActivity(Date.now());
    if (showInactivityWarning) setShowInactivityWarning(false);
  }, [showInactivityWarning]);

  useEffect(() => {
    if (!token) return;

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleUserActivity = () => resetInactivityTimer();

    events.forEach(ev => window.addEventListener(ev, handleUserActivity));

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        setSessionErrorMessage('Logged out due to 15 minutes of inactivity.');
        logout();
      } else if (elapsed >= (INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS)) {
        setShowInactivityWarning(true);
      }
    }, 10000);

    return () => {
      events.forEach(ev => window.removeEventListener(ev, handleUserActivity));
      clearInterval(interval);
    };
  }, [token, lastActivity, resetInactivityTimer]);

  const login = (tokenData, userData) => {
    const safeUserData = { ...userData, email: FIXED_ADMIN_EMAIL };
    localStorage.setItem('memotrix_token', tokenData);
    localStorage.setItem('memotrix_user', JSON.stringify(safeUserData));
    setToken(tokenData);
    setUser(safeUserData);
    setSessionErrorMessage(null);
    setLastActivity(Date.now());
    setShowInactivityWarning(false);
  };

  const logout = async () => {
    try {
      if (token) await authApi.logout();
    } catch (e) {
      // ignore
    } finally {
      localStorage.removeItem('memotrix_token');
      localStorage.removeItem('memotrix_user');
      localStorage.removeItem('memotrix-billing-draft'); // Wipe sensitive draft data on logout
      setToken(null);
      setUser(null);
      setShowInactivityWarning(false);
    }
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
        showInactivityWarning,
        resetInactivityTimer,
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
