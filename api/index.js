import app from '../backend/src/server.js';
import { seedDatabase } from '../backend/src/db/seed.js';

let isInitialized = false;

export default async function handler(req, res) {
  if (!isInitialized) {
    try {
      await seedDatabase();
      isInitialized = true;
    } catch (err) {
      console.warn('[VERCEL] DB seed initialization warning:', err.message);
    }
  }
  return app(req, res);
}
