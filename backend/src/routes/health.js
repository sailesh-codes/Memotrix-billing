import express from 'express';
import db from '../db/db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  let dbStatus = 'healthy';
  let mongoPing = false;

  try {
    const mongoDb = db.getMongoDb();
    if (mongoDb) {
      await mongoDb.command({ ping: 1 });
      mongoPing = true;
    }
    await db.query('SELECT 1');
  } catch (err) {
    dbStatus = `unhealthy: ${err.message}`;
  }

  const isHealthy = dbStatus === 'healthy' && (mongoPing || db.isMongoConnected());
  const status = isHealthy ? 200 : 503;

  return res.status(status).json({
    status: isHealthy ? 'OK' : 'ERROR',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    databaseType: 'mongodb',
    mongodbConnected: db.isMongoConnected(),
    storageLocation: 'MongoDB Atlas Remote Cluster (Cluster0)',
    memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024))
  });
});

export default router;
