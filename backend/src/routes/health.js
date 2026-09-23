import express from 'express';
import db from '../db/db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  let dbStatus = 'healthy';
  try {
    await db.query('SELECT 1');
  } catch (err) {
    dbStatus = `unhealthy: ${err.message}`;
  }

  const isHealthy = dbStatus === 'healthy';
  const status = isHealthy ? 200 : 503;

  const isPersistent = db.isPg || !process.env.VERCEL;
  const isVercel = !!process.env.VERCEL;
  let persistenceWarning = null;
  if (isVercel && !db.isPg) {
    persistenceWarning = 'WARNING: Running on Vercel without DATABASE_URL! Vercel /tmp is ephemeral and data will not persist across cold starts. Attach a PostgreSQL database via DATABASE_URL.';
  }

  return res.status(status).json({
    status: isHealthy ? 'OK' : 'ERROR',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    databaseType: db.isPg ? 'postgresql' : 'sqlite',
    isPersistent,
    storageLocation: db.isPg ? 'PostgreSQL Remote DB' : (isVercel ? 'Vercel /tmp (ephemeral)' : 'Local Disk SQLite (persistent)'),
    persistenceWarning,
    memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024))
  });
});

export default router;
