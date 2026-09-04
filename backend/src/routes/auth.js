import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db/db.js';
import { generateToken, authenticate } from '../middleware/auth.js';
import { logLoginAttempt } from '../middleware/logger.js';
import { logAccountSecurityEvent } from '../services/securityLogger.js';

const router = express.Router();

const FIXED_ADMIN_EMAIL = 'teammemotrix@gmail.com';

/**
 * POST /api/auth/login
 * Single-Factor Authentication (Username + Password)
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await db.queryOne('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);

    if (!user) {
      await logLoginAttempt({ userId: null, ipAddress, userAgent, status: 'failure_password' });
      await logAccountSecurityEvent({ userId: null, eventType: 'LOGIN_FAILURE', ipAddress, userAgent, metadata: { reason: 'user_not_found' } });
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
    if (!isPasswordValid) {
      await logLoginAttempt({ userId: user.id, ipAddress, userAgent, status: 'failure_password' });
      await logAccountSecurityEvent({ userId: user.id, eventType: 'LOGIN_FAILURE', ipAddress, userAgent, metadata: { reason: 'wrong_password' } });
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Check Single Active Session Enforcement
    const existingSession = user.active_session_token;
    const newSessionToken = crypto.randomBytes(32).toString('hex');

    if (existingSession) {
      console.log(`[AUTH] Terminating previous session for admin ${user.username}`);
    }

    await db.query('UPDATE users SET active_session_token = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [newSessionToken, user.id]);

    const token = generateToken(user, newSessionToken);

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
    console.error('[AUTH] Login error:', err);
    return res.status(500).json({ error: 'Internal server login error.' });
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
