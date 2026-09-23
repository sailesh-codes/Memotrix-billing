import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { billsApi } from '../api/endpoints';

const CartContext = createContext(null);

const DRAFT_LOCAL_KEY = 'memotrix-billing-draft';

const DEFAULT_DRAFT = {
  selectedCustomer: null,
  newCustomerName: '',
  newCustomerPhone: '',
  newCustomerEmail: '',
  newCustomerAddress: '',
  newCustomerGstin: '',
  lineItems: [],
  paymentMethod: 'cash',
  payments: [],
  receivedAmount: '',
  dueDate: '',
  notes: '',
  executedBy: '',
  couponApplied: null,
  lastSavedAt: null
};

// Safe load from localStorage
function loadLocalDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.lineItems)) {
      return null;
    }
    // Expire draft older than 24 hours
    if (parsed.lastSavedAt) {
      const elapsedHours = (Date.now() - new Date(parsed.lastSavedAt).getTime()) / (1000 * 60 * 60);
      if (elapsedHours > 24) return null;
    }
    return parsed;
  } catch (e) {
    console.error('[DRAFT] Local parse error:', e);
    return null;
  }
}

export function CartProvider({ children }) {
  const [draft, setDraft] = useState(() => {
    const local = loadLocalDraft();
    return local ? { ...DEFAULT_DRAFT, ...local } : DEFAULT_DRAFT;
  });

  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved' | 'restored'
  const [restoredBannerInfo, setRestoredBannerInfo] = useState(null);

  // Check on mount if a draft was restored
  useEffect(() => {
    const local = loadLocalDraft();
    if (local && (local.lineItems.length > 0 || local.newCustomerName || local.selectedCustomer)) {
      const name = local.selectedCustomer?.name || local.newCustomerName || 'Customer';
      setRestoredBannerInfo({
        name,
        time: local.lastSavedAt ? new Date(local.lastSavedAt).toLocaleTimeString() : 'recently'
      });
      setSaveStatus('restored');
    }
  }, []);

  // Update draft helper + immediate localStorage save
  const updateDraft = useCallback((updater) => {
    setSaveStatus('saving');
    setDraft(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      const nextWithTime = { ...next, lastSavedAt: new Date().toISOString() };
      
      try {
        localStorage.setItem(DRAFT_LOCAL_KEY, JSON.stringify(nextWithTime));
      } catch (e) {
        console.error('[DRAFT] localStorage write error:', e);
      }

      setTimeout(() => setSaveStatus('saved'), 600);
      return nextWithTime;
    });
  }, []);

  // Periodic server-side sync (every 20s)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (draft.lineItems.length > 0 || draft.newCustomerName || draft.selectedCustomer) {
        try {
          await billsApi.saveDraft(draft);
        } catch (err) {
          // ignore background sync errors
        }
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [draft]);


  // Sync across multiple tabs via storage event
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === DRAFT_LOCAL_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setDraft(parsed);
          setSaveStatus('saved');
        } catch (err) {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Clear draft upon invoice generation or logout
  const clearDraft = useCallback(async () => {
    localStorage.removeItem(DRAFT_LOCAL_KEY);
    setDraft(DEFAULT_DRAFT);
    setRestoredBannerInfo(null);
    setSaveStatus('saved');
    try {
      await billsApi.clearDraft();
    } catch (e) {
      // ignore
    }
  }, []);

  const discardDraft = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  return (
    <CartContext.Provider
      value={{
        draft,
        updateDraft,
        saveStatus,
        restoredBannerInfo,
        setRestoredBannerInfo,
        clearDraft,
        discardDraft
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
