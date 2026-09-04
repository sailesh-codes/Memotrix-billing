import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AWS from 'aws-sdk';
import db from '../db/db.js';
import { sendBackupReport } from './emailService.js';

const BACKUP_DIR = process.env.BACKUP_LOCAL_DIR || path.join(process.cwd(), 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const BACKUP_KEY = process.env.BACKUP_ENCRYPTION_KEY || 'memotrix_backup_secret_key_32b!';
const KEY = crypto.scryptSync(BACKUP_KEY, 'memotrix_backup_salt', 32);

/**
 * Encrypt buffer with AES-256-GCM
 */
function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Perform Database Backup
 */
export async function performBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `memotrix_backup_${timestamp}.json.enc`;
  const filePath = path.join(BACKUP_DIR, fileName);

  try {
    // 1. Collect full DB snapshot
    const tables = ['users', 'business_profile', 'categories', 'products', 'customers', 'coupons', 'customer_discount_rules', 'bills', 'bill_items', 'bill_payments', 'inventory_adjustments', 'recurring_templates'];
    const snapshot = {};

    for (const table of tables) {
      snapshot[table] = await db.query(`SELECT * FROM ${table}`);
    }

    const rawJson = JSON.stringify(snapshot, null, 2);
    const encryptedBuf = encryptBuffer(Buffer.from(rawJson, 'utf8'));

    // 2. Save locally
    fs.writeFileSync(filePath, encryptedBuf);
    console.log(`[BACKUP] Saved local encrypted backup: ${filePath}`);

    // 3. Upload to Cloud (S3) if configured
    let cloudResult = 'Local only';
    if (process.env.BACKUP_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
      const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.BACKUP_S3_REGION || 'us-east-1'
      });

      await s3.upload({
        Bucket: process.env.BACKUP_S3_BUCKET,
        Key: `backups/${fileName}`,
        Body: encryptedBuf,
        ContentType: 'application/octet-stream'
      }).promise();

      cloudResult = `Uploaded to S3 bucket ${process.env.BACKUP_S3_BUCKET}`;
      console.log(`[BACKUP] S3 Upload complete: ${cloudResult}`);
    }

    // 4. Purge backups older than 90 days
    cleanupOldBackups(90);

    // 5. Notify admin via email
    await sendBackupReport({ status: 'success', fileName, details: cloudResult });

    return { success: true, fileName, filePath, cloudResult };
  } catch (err) {
    console.error('[BACKUP] Backup failed:', err);
    await sendBackupReport({ status: 'failure', fileName, details: err.message });
    throw err;
  }
}

/**
 * Delete backup files older than retentionDays
 */
export function cleanupOldBackups(retentionDays = 90) {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const cutoff = retentionDays * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > cutoff) {
        fs.unlinkSync(filePath);
        console.log(`[BACKUP] Purged 90+ day old backup: ${file}`);
      }
    });
  } catch (err) {
    console.error('[BACKUP] Retention cleanup error:', err.message);
  }
}

export default {
  performBackup,
  cleanupOldBackups
};
