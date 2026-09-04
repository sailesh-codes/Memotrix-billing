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

  return res.status(status).json({
    status: isHealthy ? 'OK' : 'ERROR',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024))
  });
});

export default router;
