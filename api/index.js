import app, { ensureDatabaseReady } from '../backend/src/server.js';

export default async function handler(req, res) {
  try {
    await ensureDatabaseReady();
  } catch (err) {
    console.error('[VERCEL SERVERLESS DB ERROR]:', err.message);
  }

  if (req.url && req.url.startsWith('/api/index.js')) {
    req.url = req.url.replace('/api/index.js', '') || '/';
  }

  return app(req, res);
}
