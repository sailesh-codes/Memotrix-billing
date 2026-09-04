/**
 * Frontend Console Security & Data Privacy Utility
 * Prevents credential, token, and sensitive API data leakage into the browser console.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'oldpassword',
  'newpassword',
  'confirmpassword',
  'currentpassword',
  'token',
  'refreshtoken',
  'accesstoken',
  'sessiontoken',
  'authorization',
  'secret',
  'jwt',
  'bearer',
  'cookie',
  'cookies',
  'otp',
  'pass',
  'apikey',
  'api_key',
  'password_hash'
]);

function sanitizeValue(value, depth = 0) {
  if (depth > 6) return '[Max Depth]';
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    // Redact Bearer tokens in headers or URLs
    if (value.toLowerCase().includes('bearer ')) {
      return value.replace(/bearer\s+[A-Za-z0-9-_=.]+/gi, 'Bearer [REDACTED]');
    }
    // Redact JWT-like strings
    if (/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(value) && value.length > 30) {
      return '[REDACTED_JWT]';
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    // Avoid DOM nodes or circular references
    if (value instanceof HTMLElement || value instanceof Event) return value;

    const sanitized = {};
    for (const [k, v] of Object.entries(value)) {
      const lowerKey = k.toLowerCase().replace(/[-_]/g, '');
      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = sanitizeValue(v, depth + 1);
      }
    }
    return sanitized;
  }

  return value;
}

export function initConsoleSecurity() {
  const isProd = import.meta.env.PROD;
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  const originalWarn = console.warn;
  const originalError = console.error;

  if (isProd) {
    // In production, suppress verbose outputs completely
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
  } else {
    // In development, sanitize outputs to prevent sensitive credential logs
    console.log = (...args) => {
      originalLog(...args.map(arg => sanitizeValue(arg)));
    };
    console.info = (...args) => {
      originalInfo(...args.map(arg => sanitizeValue(arg)));
    };
    console.debug = (...args) => {
      originalDebug(...args.map(arg => sanitizeValue(arg)));
    };
  }

  // Always sanitize warn and error
  console.warn = (...args) => {
    originalWarn(...args.map(arg => sanitizeValue(arg)));
  };
  console.error = (...args) => {
    originalError(...args.map(arg => sanitizeValue(arg)));
  };
}

export default initConsoleSecurity;
