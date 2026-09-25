import mongoose from 'mongoose';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { schemaSql } from './schemaSql.js';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || config.mongodbUri;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || config.mongodbDbName || 'memotrix';

let mongoConnection = null;
let mongoDb = null;
let memDb = null;
let isInitialized = false;

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
 * Establish connection to MongoDB Atlas using Mongoose
 */
export async function connectMongo() {
  if (mongoConnection && mongoose.connection.readyState === 1) {
    return mongoConnection;
  }

  if (!MONGODB_URI) {
    const errMsg = '[DB FATAL] MONGODB_URI is not set. Please provide it in your .env file.';
    console.error(errMsg);
    throw new Error(errMsg);
  }

  console.log('[MongoDB] Connecting to MongoDB Atlas...');
  try {
    mongoConnection = await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 15000,
      retryWrites: true,
      w: 'majority'
    });

    mongoDb = mongoose.connection.db;

    console.log(`[MongoDB] Successfully connected to MongoDB Atlas! (Database: ${MONGODB_DB_NAME})`);

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected from MongoDB Atlas. Attempting reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB] Reconnected to MongoDB Atlas.');
    });

    return mongoConnection;
  } catch (err) {
    console.error('[MongoDB] Failed to connect to MongoDB Atlas:', err.message);
    throw err;
  }
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
 * Low-level execution on in-memory execution engine
 */
function execMemSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!memDb) {
      return reject(new Error('In-memory database engine not initialized'));
    }
    const trimmed = sql.trim().toUpperCase();
    const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA');
    if (isSelect) {
      memDb.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    } else {
      memDb.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    }
  });
}

/**
 * Synchronize all rows of an in-memory table to its corresponding MongoDB collection
 */
export async function syncTableToMongo(tableName) {
  const db = getMongoDb();
  if (!db) return;

  try {
    const rows = await execMemSql(`SELECT * FROM ${tableName}`);
    const col = db.collection(tableName);

    // Replace collection documents with latest rows
    await col.deleteMany({});
    if (rows && rows.length > 0) {
      await col.insertMany(rows);
    }
  } catch (err) {
    console.error(`[MongoDB] Error syncing table "${tableName}" to MongoDB Atlas:`, err.message);
  }
}

/**
 * Load documents from a MongoDB collection into the in-memory engine table
 */
export async function loadTableFromMongo(tableName) {
  const db = getMongoDb();
  if (!db) return 0;

  try {
    const col = db.collection(tableName);
    const docs = await col.find({}).toArray();

    if (docs && docs.length > 0) {
      await execMemSql(`DELETE FROM ${tableName}`);
      for (const doc of docs) {
        const clean = { ...doc };
        delete clean._id;
        const keys = Object.keys(clean);
        if (keys.length === 0) continue;
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map((k) => clean[k]);
        await execMemSql(
          `INSERT OR REPLACE INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
      return docs.length;
    }
    return 0;
  } catch (err) {
    console.warn(`[MongoDB] Warning reading collection "${tableName}":`, err.message);
    return 0;
  }
}

/**
 * Detect which tables are affected by a mutation SQL query
 */
function detectAffectedTables(sql) {
  const affected = new Set();
  for (const table of KNOWN_TABLES) {
    const regex = new RegExp(`\\b${table}\\b`, 'i');
    if (regex.test(sql)) {
      affected.add(table);
    }
  }
  return Array.from(affected);
}

/**
 * Execute SQL Query with Parameters, syncing mutations to MongoDB Atlas
 */
export async function query(sql, params = []) {
  if (!isInitialized) {
    await initDb();
  }

  const res = await execMemSql(sql, params);

  // If query modifies data, sync affected table(s) to MongoDB Atlas
  const isMutation = /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql);
  if (isMutation) {
    const tables = detectAffectedTables(sql);
    for (const t of tables) {
      syncTableToMongo(t).catch((err) => {
        console.error(`[MongoDB] Background sync failed for ${t}:`, err.message);
      });
    }
  }

  return res;
}

/**
 * Execute Single SQL Query returning first row
 */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Initialize Schema and synchronize with MongoDB Atlas
 */
export async function initDb() {
  if (isInitialized) return;

  // 1. Establish MongoDB connection
  await connectMongo();

  // 2. Initialize in-memory execution engine
  if (!memDb) {
    memDb = new sqlite3.Database(':memory:');
  }

  // 3. Load schema DDL
  let sql = schemaSql;
  if (!sql) {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      sql = fs.readFileSync(schemaPath, 'utf8');
    }
  }

  await new Promise((resolve, reject) => {
    memDb.exec(sql, (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });

  // 4. Run auto-migrations gracefully for schema additions
  const migrations = [
    `ALTER TABLE bills ADD COLUMN customer_email TEXT`,
    `ALTER TABLE bills ADD COLUMN customer_address TEXT`,
    `ALTER TABLE bills ADD COLUMN customer_gstin TEXT`,
    `ALTER TABLE bills ADD COLUMN pdf_path TEXT`,
    `ALTER TABLE bills ADD COLUMN pdf_generated_at TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN must_reset_password BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE users ADD COLUMN phone_number TEXT`,
    `ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE users ADD COLUMN phone_locked BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE users ADD COLUMN failed_login_count INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN locked_until TIMESTAMP`,
    `ALTER TABLE business_profile ADD COLUMN website TEXT`,
    `ALTER TABLE business_profile ADD COLUMN payee_name TEXT`,
    `ALTER TABLE business_profile ADD COLUMN merchant_name TEXT`,
    `ALTER TABLE business_profile ADD COLUMN currency TEXT DEFAULT 'INR'`,
    `ALTER TABLE business_profile ADD COLUMN default_transaction_note TEXT`,
    `ALTER TABLE business_profile ADD COLUMN show_qr_code BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE business_profile ADD COLUMN show_upi_text BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE bills ADD COLUMN invoice_type TEXT DEFAULT 'tax_invoice'`,
    `ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'General'`,
    `ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0`,
    `ALTER TABLE products ADD COLUMN image_url TEXT`,
    `ALTER TABLE products ADD COLUMN barcode TEXT`,
    `ALTER TABLE customers ADD COLUMN notes TEXT`,
    `ALTER TABLE customers ADD COLUMN total_spent REAL DEFAULT 0`,
    `ALTER TABLE customers ADD COLUMN outstanding_balance REAL DEFAULT 0`,
    `ALTER TABLE business_profile ADD COLUMN logo_original_url TEXT`,
    `ALTER TABLE business_profile ADD COLUMN logo_zoom REAL DEFAULT 1.0`,
    `ALTER TABLE business_profile ADD COLUMN logo_x REAL DEFAULT 0.0`,
    `ALTER TABLE business_profile ADD COLUMN logo_y REAL DEFAULT 0.0`
  ];
  for (const m of migrations) {
    try {
      await execMemSql(m);
    } catch (e) {
      // Ignore if column already exists
    }
  }

  // 5. Populate in-memory engine from existing MongoDB Atlas collections
  let totalLoaded = 0;
  for (const table of KNOWN_TABLES) {
    const count = await loadTableFromMongo(table);
    totalLoaded += count;
  }

  if (totalLoaded > 0) {
    console.log(`[MongoDB] Loaded ${totalLoaded} existing documents from MongoDB Atlas into memory.`);
  } else {
    console.log('[MongoDB] Collections empty or initialized fresh on MongoDB Atlas.');
  }

  isInitialized = true;
}

export default {
  query,
  queryOne,
  initDb,
  connectMongo,
  getMongoDb,
  isMongoConnected,
  syncTableToMongo,
  loadTableFromMongo,
  mongoose,
  get isPg() { return false; },
  get isMongo() { return true; }
};
