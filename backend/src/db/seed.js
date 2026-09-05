import '../config.js';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import db from './db.js';

export async function seedDatabase() {
  console.log('[SEED] Initializing Single Permanent Admin Database...');
  await db.initDb();

  // 1. Delete Super-Admin user if exists (Section 1 Consolidation)
  await db.query(`DELETE FROM users WHERE username = 'superadmin' OR email = 'superadmin@memotrix.com'`);

  // 2. Seed Default Tenant
  const existingTenant = await db.queryOne('SELECT * FROM tenants WHERE id = ?', ['tenant-memotrix-01']);
  if (!existingTenant) {
    await db.query(
      `INSERT INTO tenants (id, business_name, subdomain_or_slug, status)
       VALUES (?, ?, ?, ?)`,
      ['tenant-memotrix-01', 'Memotrix', 'memotrix', 'active']
    );
  }

  // 3. Seed Permanent Admin Account (username: teammemotrix@gmail.com)
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin1234';
  const defaultPassHash = bcrypt.hashSync(initialPassword, 12);
  const existingAdmin = await db.queryOne('SELECT * FROM users WHERE username = ? OR email = ? OR id = ?', ['teammemotrix@gmail.com', 'admin', 'user-admin-01']);

  if (!existingAdmin) {
    await db.query(
      `INSERT INTO users (id, tenant_id, username, email, password_hash, must_reset_password, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['user-admin-01', 'tenant-memotrix-01', 'teammemotrix@gmail.com', 'teammemotrix@gmail.com', defaultPassHash, false, 'admin']
    );
    console.log('[SEED] Admin user seeded (username: teammemotrix@gmail.com)');
  } else {
    // Preserve existing password hash unless explicitly requested to reset
    const shouldResetPassword = process.env.RESET_ADMIN_PASSWORD === 'true' || !existingAdmin.password_hash;
    const passHashToUse = shouldResetPassword ? defaultPassHash : existingAdmin.password_hash;

    await db.query(
      `UPDATE users SET username = 'teammemotrix@gmail.com', email = 'teammemotrix@gmail.com', password_hash = ?, role = 'admin', must_reset_password = false WHERE id = ?`,
      [passHashToUse, existingAdmin.id]
    );
    console.log('[SEED] Admin user verified (username: teammemotrix@gmail.com)');
  }

  // 4. Seed Business Profile
  const existingBp = await db.queryOne('SELECT * FROM business_profile WHERE tenant_id = ?', ['tenant-memotrix-01']);
  if (!existingBp) {
    await db.query(
      `INSERT INTO business_profile (id, tenant_id, business_name, tagline, phone, email, address, state_code, gstin, gst_enabled, upi_id, logo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'bp-001',
        'tenant-memotrix-01',
        'Memotrix',
        'Gifts & Custom Photo Frames',
        '6384241882',
        'teammemotrix@gmail.com',
        'Memotrix Studio, Salem, Tamil Nadu - 636001',
        '33',
        '33AAAAA0000A1Z5',
        false,
        'teammemotrix@gmail.com',
        '/logo-default.png'
      ]
    );
  } else {
    await db.query(`UPDATE business_profile SET email = 'teammemotrix@gmail.com' WHERE id = ?`, [existingBp.id]);
  }

  // 5. Seed Bill Template Settings
  const existingTpl = await db.queryOne('SELECT * FROM bill_template_settings WHERE tenant_id = ?', ['tenant-memotrix-01']);
  if (!existingTpl) {
    const terms = [
      '1.Products can only be returned or exchanged if they are damaged at the time of delivery.',
      '2.No compromise or negotiation will be accepted regarding the bill price. The price mentioned in the bill is final.',
      '3.Customers are requested to check the products at the time of purchase or delivery.',
      '4.We are not responsible for damages caused after delivery.',
      '5.Once the order is confirmed, cancellation may not be possible.',
      '6.Delivery time may vary depending on location and availability.'
    ].join('\n');

    await db.query(
      `INSERT INTO bill_template_settings (id, tenant_id, terms_and_conditions, executed_by_label, executed_by_value, footer_content, disclaimer_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['tpl-001', 'tenant-memotrix-01', terms, 'Executed by', 'Authorized Signatory', 'Acknowledgment', 'Memotrix']
    );
  }

  // 6. Seed Feature Flags
  const existingFlags = await db.queryOne('SELECT * FROM feature_flags WHERE tenant_id = ?', ['tenant-memotrix-01']);
  if (!existingFlags) {
    await db.query(
      `INSERT INTO feature_flags (id, tenant_id, barcode_enabled, loyalty_enabled)
       VALUES (?, ?, ?, ?)`,
      ['ff-001', 'tenant-memotrix-01', false, false]
    );
  }

  // 7. Seed Categories
  const catCount = await db.queryOne('SELECT COUNT(*) as count FROM categories WHERE tenant_id = ?', ['tenant-memotrix-01']);
  if (!catCount || parseInt(catCount.count) === 0) {
    await db.query(`INSERT INTO categories (id, tenant_id, name, description) VALUES (?, ?, ?, ?)`, ['cat-01', 'tenant-memotrix-01', 'Photo Frames', 'Wooden & Wall Frames']);
    await db.query(`INSERT INTO categories (id, tenant_id, name, description) VALUES (?, ?, ?, ?)`, ['cat-02', 'tenant-memotrix-01', 'Acrylic Frames', 'Acrylic Wall Frames']);
    await db.query(`INSERT INTO categories (id, tenant_id, name, description) VALUES (?, ?, ?, ?)`, ['cat-03', 'tenant-memotrix-01', 'Gifts & Polaroids', 'Custom Mini Polaroids']);
    await db.query(`INSERT INTO categories (id, tenant_id, name, description) VALUES (?, ?, ?, ?)`, ['cat-04', 'tenant-memotrix-01', 'Services & Shipping', 'Courier & Packing']);
  }

  // 8. Seed Products
  const prodCount = await db.queryOne('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?', ['tenant-memotrix-01']);
  if (!prodCount || parseInt(prodCount.count) === 0) {
    await db.query(
      `INSERT INTO products (id, tenant_id, sku, name, description, category_id, hsn_sac, cost_price, retail_price, wholesale_price, corporate_price, stock_quantity, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['prod-01', 'tenant-memotrix-01', 'FRAME-A3', 'A3 Frame', 'Premium Matte Finished A3 Photo Frame', 'cat-01', '4414', 450, 800, 700, 650, 25, 5]
    );
    await db.query(
      `INSERT INTO products (id, tenant_id, sku, name, description, category_id, hsn_sac, cost_price, retail_price, wholesale_price, corporate_price, stock_quantity, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['prod-02', 'tenant-memotrix-01', 'POL-STICKY', 'Sticky Polaroids', 'Set of 10 Custom Adhesive Mini Polaroids', 'cat-03', '4911', 150, 320, 280, 250, 100, 15]
    );
    await db.query(
      `INSERT INTO products (id, tenant_id, sku, name, description, category_id, hsn_sac, cost_price, retail_price, wholesale_price, corporate_price, stock_quantity, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['prod-03', 'tenant-memotrix-01', 'CHARG-DELIV', 'Courrier Charge with packing', 'Safe Express Courier & Bubble Packing', 'cat-04', '9968', 40, 80, 80, 80, 999, 10]
    );
    await db.query(
      `INSERT INTO products (id, tenant_id, sku, name, description, category_id, hsn_sac, cost_price, retail_price, wholesale_price, corporate_price, stock_quantity, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['prod-04', 'tenant-memotrix-01', 'ACRYLIC-12X18', '12x18 Acrylic Wall Frame', 'Clear 3mm Acrylic Frame with Standoff Mounts', 'cat-02', '3926', 800, 1499, 1300, 1200, 12, 3]
    );
  }

  // 9. Seed Customers
  const custCount = await db.queryOne('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?', ['tenant-memotrix-01']);
  if (!custCount || parseInt(custCount.count) === 0) {
    await db.query(
      `INSERT INTO customers (id, tenant_id, name, phone, email, address, state_code, customer_type, loyalty_points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['cust-01', 'tenant-memotrix-01', 'Kathir', '9876543210', 'kathir@example.com', 'Anna Nagar, Chennai, TN', '33', 'retail', 50]
    );
    await db.query(
      `INSERT INTO customers (id, tenant_id, name, phone, email, address, state_code, customer_type, loyalty_points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['cust-02', 'tenant-memotrix-01', 'Priya', '9123456789', 'priya@example.com', 'RS Puram, Coimbatore, TN', '33', 'retail', 20]
    );
  }

  // 10. Seed Reference Invoice
  const billCount = await db.queryOne('SELECT COUNT(*) as count FROM bills WHERE tenant_id = ?', ['tenant-memotrix-01']);
  if (!billCount || parseInt(billCount.count) === 0) {
    await db.query(
      `INSERT INTO bills (id, tenant_id, bill_number, customer_id, customer_name, customer_phone, bill_date, subtotal, discount_total, tax_total, grand_total, received_amount, balance_amount, payment_status, executed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'bill-ref-001',
        'tenant-memotrix-01',
        'MTX-2026-0001',
        'cust-01',
        'Kathir',
        '9876543210',
        '20-06-2026',
        1200.00,
        120.00,
        0.00,
        1080.00,
        0.00,
        1080.00,
        'unpaid',
        'VIYASH S'
      ]
    );

    await db.query(
      `INSERT INTO bill_items (id, bill_id, product_id, item_name, hsn_sac, quantity, unit_price, discount_amount, discount_percent, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['item-01', 'bill-ref-001', 'prod-01', 'A3 Frame', '', 1, 800.00, 100.00, 12.5, 700.00]
    );
    await db.query(
      `INSERT INTO bill_items (id, bill_id, product_id, item_name, hsn_sac, quantity, unit_price, discount_amount, discount_percent, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['item-02', 'bill-ref-001', 'prod-02', 'Sticky Polaroids', '', 1, 320.00, 20.00, 6.25, 300.00]
    );
    await db.query(
      `INSERT INTO bill_items (id, bill_id, product_id, item_name, hsn_sac, quantity, unit_price, discount_amount, discount_percent, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['item-03', 'bill-ref-001', 'prod-03', 'Courrier Charge with packing', '', 1, 80.00, 0.00, 0.0, 80.00]
    );
  }

  console.log('[SEED] Single Permanent Admin Seeding Complete!');
}

if (process.argv[1].endsWith('seed.js')) {
  seedDatabase().then(() => process.exit(0)).catch((err) => {
    console.error('[SEED] Seed failed:', err);
    process.exit(1);
  });
}
