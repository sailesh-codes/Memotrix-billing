import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach JWT Token safely & handle FormData uploads
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('memotrix_token');
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  if (config.data instanceof FormData) {
    if (config.headers && typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type');
    } else if (config.headers) {
      delete config.headers['Content-Type'];
    }
  }
  return config;
}, (error) => Promise.reject(error));

// Response Interceptor: Catch 401 Session Invalidation / Expired
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const code = error.response.data?.code;
      if (code === 'SESSION_TERMINATED' || code === 'SESSION_TIMEOUT' || code === 'TOKEN_EXPIRED') {
        localStorage.removeItem('memotrix_token');
        localStorage.removeItem('memotrix_user');
        window.dispatchEvent(new CustomEvent('memotrix_session_expired', { detail: error.response.data }));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
