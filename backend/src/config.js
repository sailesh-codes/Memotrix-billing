import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded before any other module executes (in development)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Validate required environment variables
if (!process.env.MONGODB_URI) {
  const errMsg = '[FATAL CONFIG] MONGODB_URI must be configured in your .env file.';
  console.error(errMsg);
  if (isProduction) throw new Error(errMsg);
}

if (!process.env.JWT_SECRET) {
  const errMsg = '[FATAL CONFIG] JWT_SECRET must be configured in your .env file.';
  console.error(errMsg);
  if (isProduction) throw new Error(errMsg);
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  jwtSecret: process.env.JWT_SECRET,
  mongodbUri: process.env.MONGODB_URI,
  mongodbDbName: process.env.MONGODB_DB_NAME || 'memotrix',
  encryptionKey: process.env.ENCRYPTION_KEY,
  backupEncryptionKey: process.env.BACKUP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  adminAlertEmail: process.env.ADMIN_ALERT_EMAIL || 'teammemotrix@gmail.com'
};

export default config;
