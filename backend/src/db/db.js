import mongoose from 'mongoose';
import config from '../config.js';
import { parseAndExecuteQuery } from './mongoQueryEngine.js';

const DEFAULT_MONGODB_URI = 'mongodb+srv://teammemotrix_db_user:3gKfLfcFJG002ecp@cluster0.3mygesv.mongodb.net/memotrix?retryWrites=true&w=majority&appName=Cluster0';
const MONGODB_URI = process.env.MONGODB_URI || config.mongodbUri || DEFAULT_MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || config.mongodbDbName || 'memotrix';

let mongoConnection = null;
let mongoDb = null;
let isInitialized = false;
let reconnectInterval = null;

export const KNOWN_TABLES = [
  'tenants',
  'users',
  'billing_drafts',
  'password_reset_codes',
  'business_profile',
  'bill_template_settings',
  'feature_flags',
  'categories',
  'products',
  'customers',
  'coupons',
  'customer_discount_rules',
  'bills',
  'bill_items',
  'bill_payments',
  'inventory_adjustments',
  'bill_audit_logs',
  'login_audit_logs',
  'recurring_templates',
  'email_delivery_logs',
  'otp_verifications',
  'sms_delivery_logs',
  'password_history',
  'account_security_logs'
];

/**
 * Establish resilient connection directly to MongoDB Atlas
 */
export async function connectMongo(silent = false) {
  if (mongoConnection && mongoose.connection.readyState === 1) {
    mongoDb = mongoose.connection.db;
    return mongoConnection;
  }

  const activeUri = (process.env.MONGODB_URI || config.mongodbUri || DEFAULT_MONGODB_URI || '').trim() || DEFAULT_MONGODB_URI;
  const activeDbName = (process.env.MONGODB_DB_NAME || config.mongodbDbName || 'memotrix').trim() || 'memotrix';

  if (!silent) console.log(`[MongoDB] Connecting directly to MongoDB Atlas (${activeDbName})...`);
  try {
    mongoConnection = await mongoose.connect(activeUri, {
      dbName: activeDbName,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      w: 'majority'
    });

    mongoDb = mongoose.connection.db;

    console.log(`[MongoDB] Successfully connected directly to MongoDB Atlas! (Database: ${MONGODB_DB_NAME})`);

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected from MongoDB Atlas. Attempting reconnect...');
      startBackgroundReconnect();
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB] Reconnected to MongoDB Atlas.');
    });

    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }

    return mongoConnection;
  } catch (err) {
    if (!silent) {
      console.error('================================================================================');
      console.error('⚠️  [MongoDB Connection Warning] Could not connect to MongoDB Atlas.');
      console.error(`👉 Reason: ${err.message}`);
      console.error('👉 Ensure your IP is whitelisted (0.0.0.0/0) in MongoDB Atlas Network Access.');
      console.error('================================================================================');
    }
    startBackgroundReconnect();
    throw err;
  }
}

/**
 * Background auto-reconnect loop
 */
function startBackgroundReconnect() {
  if (process.env.VERCEL || reconnectInterval) return;
  reconnectInterval = setInterval(async () => {
    if (isMongoConnected()) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
      return;
    }
    try {
      await connectMongo(true);
      if (isMongoConnected()) {
        console.log('[MongoDB] Auto-reconnect to MongoDB Atlas SUCCEEDED!');
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
    } catch (e) {
      // Silently retry every 10 seconds
    }
  }, 10000);
}

/**
 * Get native MongoDB database instance
 */
export function getMongoDb() {
  return mongoDb || mongoose.connection?.db || null;
}

/**
 * Check if MongoDB is connected
 */
export function isMongoConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

/**
 * Get a specific collection directly from MongoDB
 */
export function collection(name) {
  const db = getMongoDb();
  if (!db) {
    throw new Error(`[MongoDB] Cannot access collection "${name}": MongoDB is not connected.`);
  }
  return db.collection(name);
}

/**
 * Execute query directly on MongoDB Atlas collections
 */
export async function query(sql, params = []) {
  if (!isInitialized || !isMongoConnected()) {
    await initDb();
  }

  const db = getMongoDb();
  if (!db) {
    throw new Error('[MongoDB] MongoDB Atlas connection is required to execute queries.');
  }

  return parseAndExecuteQuery(db, sql, params);
}

/**
 * Execute single query returning first document
 */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Initialize MongoDB database connection and ensure essential indexes
 */
export async function initDb() {
  if (isInitialized && isMongoConnected()) return;

  try {
    await connectMongo();
    const db = getMongoDb();

    // Create useful indexes in background for performance
    if (db) {
      db.collection('tenants').createIndex({ id: 1 }, { unique: true }).catch(() => {});
      db.collection('users').createIndex({ username: 1 }).catch(() => {});
      db.collection('users').createIndex({ email: 1 }).catch(() => {});
      db.collection('bills').createIndex({ tenant_id: 1, id: 1 }).catch(() => {});
      db.collection('bills').createIndex({ tenant_id: 1, bill_number: 1 }).catch(() => {});
      db.collection('products').createIndex({ tenant_id: 1, id: 1 }).catch(() => {});
      db.collection('products').createIndex({ tenant_id: 1, sku: 1 }).catch(() => {});
      db.collection('customers').createIndex({ tenant_id: 1, id: 1 }).catch(() => {});
    }

    isInitialized = true;
  } catch (mongoErr) {
    console.error('[MongoDB Init Error]', mongoErr.message);
    throw mongoErr;
  }
}

// Backward compatibility no-ops (SQLite is completely eliminated)
export async function syncTableToMongo() { return true; }
export async function loadTableFromMongo() { return 0; }

export default {
  query,
  queryOne,
  initDb,
  connectMongo,
  getMongoDb,
  isMongoConnected,
  collection,
  syncTableToMongo,
  loadTableFromMongo,
  mongoose,
  get isPg() { return false; },
  get isMongo() { return true; }
};
