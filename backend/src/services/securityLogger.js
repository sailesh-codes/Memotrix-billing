import db from '../db/db.js';

/**
 * Log Account Security Events to account_security_logs Table
 * Event Types: 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'PASSWORD_CHANGE_SUCCESS', 'PASSWORD_CHANGE_FAILURE'
 */
export async function logAccountSecurityEvent({ userId, eventType, ipAddress, userAgent, metadata = null }) {
  try {
    const logId = `sec-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const metadataJson = metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null;

    await db.query(
      `INSERT INTO account_security_logs (id, user_id, event_type, ip_address, user_agent, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [logId, userId, eventType, ipAddress || '127.0.0.1', userAgent || 'Unknown', metadataJson]
    );
  } catch (err) {
    console.error('[securityLogger] Failed to write security log to DB:', err.message);
  }
}

export default {
  logAccountSecurityEvent
};
