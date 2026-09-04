import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { initConsoleSecurity } from './utils/security.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

// Initialize zero-leakage console security filter
initConsoleSecurity();

// Register Service Worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
