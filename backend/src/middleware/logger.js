import winston from 'winston';
import db from '../db/db.js';

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'jwt', 'bearer', 'cookie'];

const maskSensitiveData = winston.format((info) => {
  const mask = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_FIELDS.some(f => lower.includes(f))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        mask(obj[key]);
      }
    }
    return obj;
  };

  return mask(info);
});

export const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    maskSensitiveData(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export async function logLoginAttempt({ userId, ipAddress, userAgent, geoLocation, status }) {
  try {
    const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await db.query(
      `INSERT INTO login_audit_logs (id, user_id, ip_address, user_agent, geo_location, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId || 'unknown', ipAddress || '127.0.0.1', userAgent || 'Unknown', geoLocation || 'Unknown', status]
    );
  } catch (err) {
    winstonLogger.error('Failed to insert login audit log:', err.message);
  }
}

export default {
  winstonLogger,
  logLoginAttempt
};
