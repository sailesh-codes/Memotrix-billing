import sqlite3 from 'sqlite3';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { schemaSql } from './schemaSql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isPg = false;
let pgPool = null;
let sqliteDb = null;

const defaultSqlitePath = process.env.VERCEL
  ? path.join('/tmp', 'memotrix.sqlite')
  : path.join(__dirname, 'memotrix.sqlite');
const dbPath = process.env.SQLITE_DB_PATH || defaultSqlitePath;

if (process.env.DATABASE_URL || process.env.PGHOST) {
  isPg = true;
  const { Pool } = pg;
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'memotrix',
    port: process.env.PGPORT || 5432,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
  });
  console.log('[DB] Connected via PostgreSQL pool');
} else {
  sqlite3.verbose();
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[DB] SQLite connection error:', err);
    } else {
      console.log(`[DB] Connected via SQLite at ${dbPath}`);
    }
  });
}

/**
 * Execute SQL Query with Parameters
 */
export async function query(sql, params = []) {
  if (isPg) {
    // Convert ? parameters to $1, $2 for Postgres if needed
    let pgSql = sql;
    let paramIndex = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${paramIndex++}`);
    }
    const res = await pgPool.query(pgSql, params);
    return res.rows;
  } else {
    return new Promise((resolve, reject) => {
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      if (isSelect) {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      } else {
        sqliteDb.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      }
    });
  }
}

/**
 * Execute Single SQL Query returning first row
 */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Initialize Schema from schema.sql
 */
export async function initDb() {
  let sql = schemaSql;
  if (!sql) {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      sql = fs.readFileSync(schemaPath, 'utf8');
    }
  }

  if (isPg) {
    await pgPool.query(sql);
  } else {
    await new Promise((resolve, reject) => {
      sqliteDb.exec(sql, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  // Run auto-migrations for existing databases gracefully
  const migrations = [
    `ALTER TABLE bills ADD COLUMN customer_email TEXT`,
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
      await query(m);
    } catch (e) {
      // Ignore duplicate column error if column already exists
    }
  }
}

export default {
  query,
  queryOne,
  initDb,
  isPg
};
