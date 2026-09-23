import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db/db.js';
import { generateToken, authenticate } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { logLoginAttempt } from '../middleware/logger.js';
import { logAccountSecurityEvent } from '../services/securityLogger.js';

const router = express.Router();

const FIXED_ADMIN_EMAIL = 'teammemotrix@gmail.com';
const DUMMY_HASH = '$2a$12$e8V/C53Fj6wWz97Ew.NfTezJ27F6D48gE/yO2VvJ.1J5E31DqFmve';

/**
 * POST /api/auth/login
 * Single-Factor Authentication (Username/Email + Password) with strict rate limiting & timing protection
 */
router.post('/login', loginLimiter, async (req, res) => {
  const reqId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const identifier = (req.body.username || req.body.email || req.body.identifier || '').trim();
  const password = req.body.password;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  console.log(`[AUTH] [${reqId}] Login request received`);

  if (!identifier || !password) {
    console.log(`[AUTH] [${reqId}] Validation error: Missing credentials`);
    return res.status(400).json({ error: 'Username or email and password are required.' });
  }

  try {
    console.log(`[AUTH] [${reqId}] Database lookup started`);
    const cleanId = identifier.trim().toLowerCase();
    let user = await db.queryOne(
      `SELECT * FROM users 
       WHERE LOWER(username) = ? 
          OR LOWER(email) = ? 
          OR (role = 'admin' AND (? IN ('admin', 'teammemotrix', 'teammemotrix@gmail.com', 'user-admin-01')))`,
      [cleanId, cleanId, cleanId]
    );

    // Auto-heal admin account if missing or on fresh production start
    if (!user && ['admin', 'teammemotrix', 'teammemotrix@gmail.com'].includes(cleanId)) {
      try {
        const { seedDatabase } = await import('../db/seed.js');
        await seedDatabase();
        user = await db.queryOne('SELECT * FROM users WHERE role = ? OR id = ?', ['admin', 'user-admin-01']);
      } catch (seedErr) {
        console.warn(`[AUTH] [${reqId}] Auto-heal admin error:`, seedErr.message);
      }
    }
    console.log(`[AUTH] [${reqId}] User lookup completed`);

    // Constant-time password check prevents username enumeration timing attacks
    console.log(`[AUTH] [${reqId}] Password verification started`);
    const targetHash = user?.password_hash || DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(password, targetHash);

    if (!user || !isPasswordValid) {
      console.log(`[AUTH] [${reqId}] Authentication failure: Invalid credentials`);
      await logLoginAttempt({ userId: user?.id || null, ipAddress, userAgent, status: 'failure_password' });
      await logAccountSecurityEvent({ 
        userId: user?.id || null, 
        eventType: 'LOGIN_FAILURE', 
        ipAddress, 
        userAgent, 
        metadata: { reason: user ? 'wrong_password' : 'user_not_found' } 
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    console.log(`[AUTH] [${reqId}] JWT generation started`);
    const newSessionToken = crypto.randomBytes(32).toString('hex');

    await db.query('UPDATE users SET active_session_token = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [newSessionToken, user.id]);

    const token = generateToken(user, newSessionToken);
    console.log(`[AUTH] [${reqId}] Login successful`);

    await logLoginAttempt({ userId: user.id, ipAddress, userAgent, status: 'success' });
    await logAccountSecurityEvent({ userId: user.id, eventType: 'LOGIN_SUCCESS', ipAddress, userAgent });

    return res.json({
      message: 'Authentication successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error(`[AUTH ERROR] [${reqId}] Login exception:`, err.message);
    return res.status(500).json({ error: 'Authentication service temporarily unavailable. Please try again.' });
  }
});

/**
 * POST /api/auth/change-password
 * Simple Change Password (Old Password, New Password, Confirm Password)
 */
router.post('/change-password', authenticate, async (req, res) => {
  const { oldPassword, currentPassword, newPassword, confirmPassword } = req.body;
  const actualOldPassword = oldPassword || currentPassword;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  if (!actualOldPassword || !actualOldPassword.trim()) {
    return res.status(400).json({ error: 'Current password is required.' });
  }

  if (!newPassword || !newPassword.trim()) {
    return res.status(400).json({ error: 'New password cannot be empty.' });
  }

  if (!confirmPassword || !confirmPassword.trim()) {
    return res.status(400).json({ error: 'Confirm password cannot be empty.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  try {
    const user = await db.queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 1. Verify old password
    const isOldValid = bcrypt.compareSync(actualOldPassword, user.password_hash);
    if (!isOldValid) {
      await logAccountSecurityEvent({
        userId: user.id,
        eventType: 'PASSWORD_CHANGE_FAILURE',
        ipAddress,
        userAgent,
        metadata: { reason: 'wrong_old_password' }
      });
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    // 2. Hash new password & update database
    const newHash = bcrypt.hashSync(newPassword, 12);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

    await logAccountSecurityEvent({
      userId: user.id,
      eventType: 'PASSWORD_CHANGE_SUCCESS',
      ipAddress,
      userAgent
    });

    return res.json({ message: 'Password updated successfully.' });

  } catch (err) {
    console.error('[AUTH] Change password error:', err);
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await db.queryOne('SELECT id, username, email, role, last_login_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.email = FIXED_ADMIN_EMAIL;
    return res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    await db.query('UPDATE users SET active_session_token = NULL WHERE id = ?', [req.user.id]);
    return res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

/**
 * GET /api/auth/audit-logs
 */
router.get('/audit-logs', authenticate, async (req, res) => {
  try {
    const logs = await db.query('SELECT * FROM account_security_logs ORDER BY created_at DESC LIMIT 100');
    return res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
