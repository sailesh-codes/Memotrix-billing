import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded before any other module executes (in development)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Validate critical environment variables
if (!process.env.MONGODB_URI) {
  console.error('[CONFIG WARNING] MONGODB_URI is not set. Add MONGODB_URI in Vercel Dashboard -> Settings -> Environment Variables.');
}

if (!process.env.JWT_SECRET) {
  console.error('[CONFIG WARNING] JWT_SECRET is not set. Add JWT_SECRET in Vercel Dashboard -> Settings -> Environment Variables.');
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  jwtSecret: process.env.JWT_SECRET || 'memotrix-super-secret-jwt-key-2026',
  mongodbUri: process.env.MONGODB_URI,
  mongodbDbName: process.env.MONGODB_DB_NAME || 'memotrix',
  encryptionKey: process.env.ENCRYPTION_KEY || 'memotrix_secret_key_32bytes_long!',
  backupEncryptionKey: process.env.BACKUP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || 'memotrix_secret_key_32bytes_long!',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  adminAlertEmail: process.env.ADMIN_ALERT_EMAIL || 'teammemotrix@gmail.com'
};

export default config;
