-- Memotrix Database Schema with Billing Drafts Table

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY,
  business_name VARCHAR(128) NOT NULL,
  subdomain_or_slug VARCHAR(64) UNIQUE,
  status VARCHAR(32) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(128) UNIQUE NOT NULL DEFAULT 'teammemotrix@gmail.com',
  phone_number TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_locked BOOLEAN DEFAULT FALSE,
  password_hash TEXT NOT NULL,
  totp_secret TEXT,
  totp_enabled BOOLEAN DEFAULT FALSE,
  must_reset_password BOOLEAN DEFAULT TRUE,
  failed_login_count INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  role VARCHAR(32) DEFAULT 'admin',
  active_session_token TEXT,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS billing_drafts (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  user_id VARCHAR(64) NOT NULL,
  draft_json TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  code VARCHAR(16) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS business_profile (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  business_name VARCHAR(128) NOT NULL,
  tagline VARCHAR(256),
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(128) NOT NULL DEFAULT 'teammemotrix@gmail.com',
  address TEXT NOT NULL,
  state_code VARCHAR(10) DEFAULT '33',
  gstin VARCHAR(32),
  gst_enabled BOOLEAN DEFAULT FALSE,
  upi_id VARCHAR(64) DEFAULT 'viyasviyas82@okicici',
  payee_name VARCHAR(128) DEFAULT 'Memotrix',
  merchant_name VARCHAR(128) DEFAULT '',
  currency VARCHAR(16) DEFAULT 'INR',
  default_transaction_note TEXT DEFAULT '',
  show_qr_code BOOLEAN DEFAULT TRUE,
  show_upi_text BOOLEAN DEFAULT TRUE,
  website TEXT DEFAULT '',
  logo_url TEXT,
  logo_original_url TEXT,
  logo_zoom REAL DEFAULT 1.0,
  logo_x REAL DEFAULT 0.0,
  logo_y REAL DEFAULT 0.0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS bill_template_settings (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) UNIQUE NOT NULL DEFAULT 'tenant-memotrix-01',
  terms_and_conditions TEXT,
  executed_by_label VARCHAR(64) DEFAULT 'Executed by',
  executed_by_value VARCHAR(128) DEFAULT 'VIYASH S',
  footer_content TEXT,
  disclaimer_text TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) UNIQUE NOT NULL DEFAULT 'tenant-memotrix-01',
  barcode_enabled BOOLEAN DEFAULT FALSE,
  loyalty_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  name VARCHAR(64) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  sku VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  category VARCHAR(64) DEFAULT 'General',
  category_id VARCHAR(64),
  hsn_sac VARCHAR(32) DEFAULT '',
  cost_price REAL DEFAULT 0,
  retail_price REAL NOT NULL,
  wholesale_price REAL DEFAULT 0,
  corporate_price REAL DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  image_url TEXT,
  image_urls TEXT DEFAULT '[]',
  barcode TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  name VARCHAR(128) NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  state_code VARCHAR(10) DEFAULT '33',
  gstin TEXT,
  customer_type VARCHAR(32) DEFAULT 'retail',
  loyalty_points INTEGER DEFAULT 0,
  notes TEXT,
  total_spent REAL DEFAULT 0,
  outstanding_balance REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS coupons (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  code VARCHAR(32) NOT NULL,
  discount_type VARCHAR(16) NOT NULL,
  value REAL NOT NULL,
  min_order_amount REAL DEFAULT 0,
  usage_limit INTEGER DEFAULT 100,
  times_used INTEGER DEFAULT 0,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS customer_discount_rules (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  customer_id VARCHAR(64) NOT NULL,
  discount_type VARCHAR(16) NOT NULL,
  value REAL NOT NULL,
  applies_to VARCHAR(16) DEFAULT 'all',
  category_id VARCHAR(64),
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  created_by_admin_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS bills (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  bill_number VARCHAR(64) NOT NULL,
  customer_id VARCHAR(64),
  customer_name VARCHAR(128) NOT NULL,
  customer_phone VARCHAR(32),
  customer_email TEXT,
  pdf_path TEXT,
  pdf_generated_at TIMESTAMP,
  bill_date VARCHAR(32) NOT NULL,
  due_date VARCHAR(32),
  subtotal REAL NOT NULL,
  discount_total REAL DEFAULT 0,
  tax_total REAL DEFAULT 0,
  grand_total REAL NOT NULL,
  received_amount REAL DEFAULT 0,
  balance_amount REAL DEFAULT 0,
  payment_status VARCHAR(32) DEFAULT 'paid',
  notes TEXT,
  executed_by VARCHAR(64) DEFAULT 'VIYASH S',
  coupon_code VARCHAR(32),
  invoice_type VARCHAR(32) DEFAULT 'tax_invoice',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS bill_items (
  id VARCHAR(64) PRIMARY KEY,
  bill_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64),
  item_name VARCHAR(128) NOT NULL,
  hsn_sac VARCHAR(32) DEFAULT '',
  quantity INTEGER DEFAULT 1,
  unit_price REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  discount_percent REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  cgst_rate REAL DEFAULT 0,
  cgst_amount REAL DEFAULT 0,
  sgst_rate REAL DEFAULT 0,
  sgst_amount REAL DEFAULT 0,
  igst_rate REAL DEFAULT 0,
  igst_amount REAL DEFAULT 0,
  line_total REAL NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bill_payments (
  id VARCHAR(64) PRIMARY KEY,
  bill_id VARCHAR(64) NOT NULL,
  payment_method VARCHAR(32) NOT NULL,
  amount REAL NOT NULL,
  transaction_reference TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  product_id VARCHAR(64) NOT NULL,
  change_qty INTEGER NOT NULL,
  reason_code VARCHAR(64) NOT NULL,
  notes TEXT,
  adjustment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  admin_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS bill_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  bill_id VARCHAR(64) NOT NULL,
  action VARCHAR(32) NOT NULL,
  changes_json TEXT,
  reason TEXT,
  admin_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS login_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  user_id VARCHAR(64),
  ip_address VARCHAR(64),
  user_agent TEXT,
  geo_location VARCHAR(128),
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recurring_templates (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  customer_id VARCHAR(64) NOT NULL,
  template_name VARCHAR(128) NOT NULL,
  frequency VARCHAR(32) NOT NULL,
  next_run_date VARCHAR(32) NOT NULL,
  items_json TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL,
  message_id VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS otp_verifications (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  user_id VARCHAR(64) NOT NULL,
  channel VARCHAR(32) NOT NULL,
  code_hash TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sms_delivery_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  recipient_phone TEXT NOT NULL,
  masked_phone TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  twilio_sid VARCHAR(128),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS password_history (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  user_id VARCHAR(64) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS account_security_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-memotrix-01',
  user_id VARCHAR(64),
  event_type VARCHAR(64) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
