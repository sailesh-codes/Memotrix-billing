import jwt from 'jsonwebtoken';
import db from '../db/db.js';
import config from '../config.js';

function getJwtSecret() {
  const secret = config.jwtSecret || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[AUTH FATAL] JWT_SECRET is required in production environment.');
    }
    return 'memotrix_dev_jwt_secret_key_2026!';
  }
  return secret;
}

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;

    db.queryOne('SELECT * FROM users WHERE id = ?', [decoded.id])
      .then(user => {
        if (!user) {
          return res.status(401).json({ error: 'User account no longer exists.' });
        }

        // Single session per admin account check
        if (user.active_session_token && user.active_session_token !== decoded.sessionToken) {
          return res.status(401).json({ 
            error: 'Session terminated: Another device logged into your admin account.',
            code: 'SESSION_TERMINATED'
          });
        }

        // 15-minute inactivity timeout check
        const lastActivity = decoded.lastActivity || Date.now();
        if (Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
          return res.status(401).json({ 
            error: 'Session timed out due to 15 minutes of inactivity.',
            code: 'SESSION_TIMEOUT'
          });
        }

        // Attach tenant_id & admin_level to request object
        req.user.tenantId = user.tenant_id;
        req.user.adminLevel = user.admin_level;

        next();
      })
      .catch(err => {
        console.error('[AUTH] Auth error:', err);
        res.status(500).json({ error: 'Internal authentication error' });
      });

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

export function requireSuperAdmin(req, res, next) {
  if (req.user && req.user.adminLevel === 'super_admin') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Super-Admin privileges required.' });
}

export function generateToken(user, sessionToken) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      adminLevel: user.admin_level,
      tenantId: user.tenant_id,
      sessionToken,
      lastActivity: Date.now()
    },
    getJwtSecret(),
    { expiresIn: '8h' }
  );
}

export default {
  authenticate,
  requireSuperAdmin,
  generateToken
};
