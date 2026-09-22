import api from './client';

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  changePassword: (data) => api.post('/auth/change-password', data),
  getAuditLogs: () => api.get('/auth/audit-logs')
};

export const productsApi = {
  getAll: (params) => api.get('/products', { params }),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data)
};

export const customersApi = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`)
};

export const billsApi = {
  getAll: (params) => api.get('/bills', { params }),
  getById: (id) => api.get(`/bills/${id}`),
  create: (data) => api.post('/bills', data),
  update: (id, data) => api.put(`/bills/${id}`, data),
  updateStatus: (id, data) => api.patch(`/bills/${id}/status`, data),
  regeneratePdf: (id) => api.post(`/bills/${id}/regenerate-pdf`),
  voidBill: (id, data) => api.post(`/bills/${id}/void`, data),
  getPdfUrl: (id) => `/bills/${id}/pdf`, // Axios baseURL is '/api', so this resolves to '/api/bills/:id/pdf'
  getDraft: () => api.get('/bills/draft/current'),
  saveDraft: (data) => api.post('/bills/draft/save', data),
  clearDraft: () => api.delete('/bills/draft/clear')
};

export const inventoryApi = {
  adjust: (data) => api.post('/inventory/adjust', data),
  getLogs: () => api.get('/inventory/logs')
};

export const reportsApi = {
  getDashboard: () => api.get('/reports/dashboard'),
  getTopSellers: () => api.get('/reports/top-sellers'),
  globalSearch: (query) => api.get('/reports/global-search', { params: { q: query } }),
  getGstr1: (params) => api.get('/reports/gstr1', { params }),
  getReconciliation: () => api.get('/reports/reconciliation'),
  getExportExcelUrl: (month = '') => `/reports/export/excel${month ? '?month=' + month : ''}`,
  getExportJsonUrl: (month = '') => `/reports/export/json${month ? '?month=' + month : ''}`,
  getExportCsvUrl: (month = '') => `/reports/export/csv${month ? '?month=' + month : ''}`
};

export const settingsApi = {
  getBusinessProfile: () => api.get('/settings/business-profile'),
  updateBusinessProfile: (data) => api.put('/settings/business-profile', data),
  updatePaymentProfile: (data) => api.put('/settings/payment-profile', data),
  getQrPreview: (params) => api.get('/settings/qr-preview', { params }),
  updateBillTemplate: (data) => api.put('/settings/bill-template', data),
  updateFeatureFlags: (data) => api.put('/settings/feature-flags', data),
  uploadLogo: (formData) => api.post('/settings/upload-logo', formData),
  getDataExportUrl: (format = 'json', month = '') => `/reports/export/${format}${month ? '?month=' + month : ''}`,
  triggerBackup: () => api.post('/settings/backup')
};

export const couponsApi = {
  getAll: () => api.get('/coupons'),
  validate: (data) => api.post('/coupons/validate', data),
  create: (data) => api.post('/coupons', data)
};
