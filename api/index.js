import app, { ensureDatabaseReady } from '../backend/src/server.js';

export default async function handler(req, res) {
  try {
    await ensureDatabaseReady();
  } catch (err) {
    console.error('[VERCEL SERVERLESS DB ERROR]:', err.message);
  }

  // Restore the original request URL if rewritten by Vercel
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-now-route-matches'];
  if (matchedPath && !matchedPath.includes('index.js')) {
    req.url = matchedPath;
  } else if (req.url && req.url.startsWith('/api/index.js')) {
    req.url = req.url.replace('/api/index.js', '') || '/';
  }

  return app(req, res);
}
