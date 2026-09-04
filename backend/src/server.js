import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import { fileURLToPath } from 'url';

import configureSecurity from './middleware/security.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { winstonLogger } from './middleware/logger.js';
import { seedDatabase } from './db/seed.js';
import { initScheduler } from './services/schedulerService.js';

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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' });
  console.log('[SENTRY] Initialized backend error tracking');
}

configureSecurity(app);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const publicDir = path.join(process.cwd(), 'public');
const assetsDir = path.join(__dirname, '..', 'assets');
const uploadsDir = path.join(publicDir, 'uploads');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(express.static(publicDir));
app.use('/assets', express.static(assetsDir));
app.use('/logo-default.png', express.static(path.join(assetsDir, 'logo-default.png')));

app.use('/api/', apiLimiter);

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/discount-rules', discountRuleRoutes);

app.get('/', (req, res) => {
  res.json({
    app: 'Memotrix Single Permanent Admin Bill Generator & Business Management API',
    adminEmail: 'teammemotrix@gmail.com',
    status: 'running',
    version: '2.1.0'
  });
});

app.use((err, req, res, next) => {
  winstonLogger.error('Unhandled Server Error:', err);
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

async function startServer() {
  try {
    await seedDatabase();
    initScheduler();

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

startServer();
