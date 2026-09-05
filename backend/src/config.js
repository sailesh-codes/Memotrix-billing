import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded before any other module executes (in development)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Fail fast in production if required critical variables are missing
if (isProduction && !process.env.JWT_SECRET) {
  const errMsg = '[FATAL CONFIG] JWT_SECRET must be configured in production environment.';
  console.error(errMsg);
  throw new Error(errMsg);
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  jwtSecret: process.env.JWT_SECRET || (isProduction ? undefined : 'memotrix_dev_jwt_secret_key_2026!'),
  databaseUrl: process.env.DATABASE_URL,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  adminAlertEmail: process.env.ADMIN_ALERT_EMAIL || 'teammemotrix@gmail.com'
};

export default config;
