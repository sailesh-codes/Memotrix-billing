import './config.js';
import express from 'express';
import path from 'path';
import fs from 'fs';
import * as Sentry from '@sentry/node';
import { fileURLToPath } from 'url';

import configureSecurity from './middleware/security.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { winstonLogger } from './middleware/logger.js';
import db from './db/db.js';
import { seedDatabase } from './db/seed.js';
import { initScheduler } from './services/schedulerService.js';
import { MEMOTRIX_DEFAULT_LOGO_BUFFER } from './services/logoService.js';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import customerRoutes from './routes/customers.js';
import billRoutes from './routes/bills.js';
import inventoryRoutes from './routes/inventory.js';
import reportRoutes from './routes/reports.js';
import settingRoutes from './routes/settings.js';
import couponRoutes from './routes/coupons.js';
import discountRuleRoutes from './routes/discountRules.js';
import healthRoutes from './routes/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' });
  console.log('[SENTRY] Initialized backend error tracking');
}

configureSecurity(app);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Lazy DB initialization to safely initialize schema and seed data on serverless cold start
let isDbReady = false;
let dbInitPromise = null;

export async function ensureDatabaseReady() {
  if (isDbReady) return;
  if (!dbInitPromise) {
    dbInitPromise = seedDatabase()
      .then(() => {
        isDbReady = true;
        console.log('[DB] Database seeded and ready');
      })
      .catch((err) => {
        console.error('[DB] Seeding failed:', err);
        dbInitPromise = null;
        throw err;
      });
  }
  return dbInitPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureDatabaseReady();
    next();
  } catch (err) {
    next(err);
  }
});

const isVercel = !!process.env.VERCEL;
const publicDir = path.join(__dirname, '..', 'public');
const assetsDir = path.join(__dirname, '..', 'assets');
const uploadsDir = isVercel ? path.join('/tmp', 'uploads') : path.join(publicDir, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e) {}
}

const staticOptions = { dotfiles: 'ignore', index: false };
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, staticOptions));
}
if (fs.existsSync(uploadsDir)) {
  app.use('/uploads', express.static(uploadsDir, staticOptions));
  app.use('/api/uploads', express.static(uploadsDir, staticOptions));
}

// Production / serverless fallback: stream base64 logo from database if physical file is missing from ephemeral disk
app.use(['/uploads/:filename', '/api/uploads/:filename'], async (req, res, next) => {
  try {
    const bp = await db.queryOne('SELECT logo_original_url, logo_url FROM business_profile LIMIT 1');
    const stored = bp?.logo_original_url || bp?.logo_url;
    if (stored && stored.startsWith('data:image/')) {
      const match = stored.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        const buf = Buffer.from(match[2], 'base64');
        if (buf.length >= 200) {
          res.setHeader('Content-Type', match[1]);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(buf);
        }
      }
    }
  } catch (e) {}
  next();
});

if (fs.existsSync(assetsDir)) {
  app.use('/assets', express.static(assetsDir, staticOptions));
}

// Guaranteed site logo endpoint: always serves the official Memotrix site logo
app.get(['/logo-default.png', '/api/logo-default.png'], (req, res) => {
  const candidates = [
    path.join(publicDir, 'logo-default.png'),
    path.join(assetsDir, 'logo-default.png'),
    path.join(path.dirname(__dirname), 'frontend', 'public', 'logo-default.png'),
    path.join(path.dirname(__dirname), 'frontend', 'dist', 'logo-default.png')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p) && !fs.statSync(p).isDirectory()) {
      return res.sendFile(path.resolve(p));
    }
  }
  res.setHeader('Content-Type', 'image/png');
  return res.send(MEMOTRIX_DEFAULT_LOGO_BUFFER);
});

app.use('/api/', apiLimiter);

// Support both /api/path and /path in case of Vercel service rewrite prefix stripping
const routeMappings = [
  ['health', healthRoutes],
  ['auth', authRoutes],
  ['products', productRoutes],
  ['customers', customerRoutes],
  ['bills', billRoutes],
  ['inventory', inventoryRoutes],
  ['reports', reportRoutes],
  ['settings', settingRoutes],
  ['coupons', couponRoutes],
  ['discount-rules', discountRuleRoutes]
];

routeMappings.forEach(([pathSegment, handler]) => {
  app.use(`/api/${pathSegment}`, handler);
  app.use(`/${pathSegment}`, handler);
});

app.get('/', (req, res) => {
  res.json({
    app: 'Memotrix Single Permanent Admin Bill Generator & Business Management API',
    adminEmail: 'teammemotrix@gmail.com',
    status: 'running',
    version: '2.1.0'
  });
});

app.use((err, req, res, next) => {
  winstonLogger.error('Unhandled Server Error:', { message: err.message, status: err.status });
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  const statusCode = err.status || err.statusCode || 500;
  const clientMessage = (statusCode < 500 && err.message)
    ? err.message
    : 'Internal Server Error';
  res.status(statusCode).json({ error: clientMessage });
});

export async function startServer() {
  try {
    await ensureDatabaseReady();
    if (!process.env.VERCEL) {
      initScheduler();
    }

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Memotrix Backend API running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

export default app;

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  startServer();
}
