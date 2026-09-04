import express from 'express';
import xlsx from 'xlsx';
import db from '../db/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/reports/dashboard
 */
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const totalSalesRow = await db.queryOne(`SELECT SUM(grand_total) as total_revenue, COUNT(*) as total_bills FROM bills WHERE payment_status != 'void'`);
    const totalProductsRow = await db.queryOne(`SELECT COUNT(*) as total FROM products WHERE is_active = true`);
    const lowStockRow = await db.queryOne(`SELECT COUNT(*) as total FROM products WHERE stock_quantity <= low_stock_threshold AND is_active = true`);
    const totalCustomersRow = await db.queryOne(`SELECT COUNT(*) as total FROM customers`);

    // Monthly sales chart data
    const monthlySales = await db.query(
      `SELECT bill_date, SUM(grand_total) as revenue, COUNT(*) as bill_count
       FROM bills
       WHERE payment_status != 'void'
       GROUP BY bill_date
       ORDER BY created_at DESC LIMIT 30`
    );

    // Payment method breakdown
    const paymentMethods = await db.query(
      `SELECT payment_method, SUM(amount) as total_amount, COUNT(*) as tx_count
       FROM bill_payments
       GROUP BY payment_method`
    );

    return res.json({
      summary: {
        totalRevenue: parseFloat(totalSalesRow?.total_revenue || 0),
        totalBills: parseInt(totalSalesRow?.total_bills || 0),
        totalProducts: parseInt(totalProductsRow?.total || 0),
        lowStockCount: parseInt(lowStockRow?.total || 0),
        totalCustomers: parseInt(totalCustomersRow?.total || 0)
      },
      monthlySales: monthlySales.reverse(),
      paymentMethods
    });
  } catch (err) {
    console.error('[REPORTS] Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard report' });
  }
});

/**
 * GET /api/reports/top-sellers
 */
router.get('/top-sellers', authenticate, async (req, res) => {
  try {
    const topSellers = await db.query(
      `SELECT item_name, SUM(quantity) as total_qty, SUM(line_total) as total_revenue
       FROM bill_items
       GROUP BY item_name
       ORDER BY total_qty DESC LIMIT 10`
    );
    return res.json({ topSellers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch top sellers' });
  }
});

/**
 * GET /api/reports/global-search?q=...
 */
router.get('/global-search', authenticate, async (req, res) => {
  try {
    const q = req.query.q ? req.query.q.trim() : '';
    if (!q || q.length < 2) {
      return res.json({ invoices: [], products: [], customers: [] });
    }

    const term = `%${q}%`;

    const invoices = await db.query(
      `SELECT id, bill_number, customer_name, grand_total, payment_status, bill_date
       FROM bills
       WHERE bill_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR customer_email LIKE ?
       ORDER BY created_at DESC LIMIT 5`,
      [term, term, term, term]
    );

    const products = await db.query(
      `SELECT id, sku, name, retail_price, stock_quantity, category
       FROM products
       WHERE (name LIKE ? OR sku LIKE ? OR category LIKE ?) AND is_active = true
       ORDER BY name ASC LIMIT 5`,
      [term, term, term]
    );

    const customers = await db.query(
      `SELECT id, name, phone, email
       FROM customers
       WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?
       ORDER BY name ASC LIMIT 5`,
      [term, term, term]
    );

    return res.json({ invoices, products, customers });
  } catch (err) {
    console.error('[SEARCH] Global search error:', err);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

/**
 * GET /api/reports/gstr1
 */
router.get('/gstr1', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let sql = `
      SELECT b.bill_number, b.bill_date, b.customer_name, b.subtotal, b.discount_total, b.tax_total, b.grand_total,
             i.hsn_sac, i.quantity, i.unit_price, i.cgst_amount, i.sgst_amount, i.igst_amount
      FROM bills b
      JOIN bill_items i ON b.id = i.bill_id
      WHERE b.payment_status != 'void'
    `;
    const params = [];

    if (startDate) {
      sql += ` AND b.bill_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND b.bill_date <= ?`;
      params.push(endDate);
    }

    const gstrData = await db.query(sql, params);
    return res.json({ gstrData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate GSTR-1 report' });
  }
});

/**
 * GET /api/reports/reconciliation
 */
router.get('/reconciliation', authenticate, async (req, res) => {
  try {
    const paymentMethods = await db.query(
      `SELECT payment_method, SUM(amount) as total_received, COUNT(*) as tx_count
       FROM bill_payments
       GROUP BY payment_method`
    );
    return res.json({ paymentMethods });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reconciliation report' });
  }
});

/**
 * GET /api/reports/export-excel
 * Multi-Sheet Formatted Business Workbook
 */
router.get('/export-excel', authenticate, async (req, res) => {
  try {
    const wb = xlsx.utils.book_new();

    // 1. Summary Sheet
    const totalSalesRow = await db.queryOne(`SELECT SUM(grand_total) as total_revenue, COUNT(*) as total_bills FROM bills WHERE payment_status != 'void'`);
    const totalProductsRow = await db.queryOne(`SELECT COUNT(*) as total FROM products WHERE is_active = true`);
    const totalCustomersRow = await db.queryOne(`SELECT COUNT(*) as total FROM customers`);
    
    const summaryData = [
      { Metric: 'Total System Revenue (₹)', Value: parseFloat(totalSalesRow?.total_revenue || 0).toFixed(2) },
      { Metric: 'Total Issued Invoices', Value: parseInt(totalSalesRow?.total_bills || 0) },
      { Metric: 'Active Product Catalog Items', Value: parseInt(totalProductsRow?.total || 0) },
      { Metric: 'Registered Customer Profiles', Value: parseInt(totalCustomersRow?.total || 0) },
      { Metric: 'Report Generated At', Value: new Date().toLocaleString() }
    ];
    const wsSummary = xlsx.utils.json_to_sheet(summaryData);
    xlsx.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // 2. Invoices Sheet
    const bills = await db.query(
      `SELECT bill_number as "Invoice Number", bill_date as "Date", customer_name as "Customer", grand_total as "Grand Total (₹)", received_amount as "Received (₹)", balance_amount as "Balance (₹)", payment_status as "Status", executed_by as "Signatory"
       FROM bills ORDER BY created_at DESC`
    );
    const wsBills = xlsx.utils.json_to_sheet(bills);
    xlsx.utils.book_append_sheet(wb, wsBills, 'Invoices');

    // 3. Customers Sheet
    const customers = await db.query(
      `SELECT name as "Customer Name", phone as "Phone", email as "Email", address as "Address", gstin as "GSTIN", state_code as "State Code"
       FROM customers ORDER BY name ASC`
    );
    const wsCustomers = xlsx.utils.json_to_sheet(customers);
    xlsx.utils.book_append_sheet(wb, wsCustomers, 'Customers');

    // 4. Products Sheet
    const products = await db.query(
      `SELECT sku as "SKU", name as "Product Name", category as "Category", retail_price as "Selling Price (₹)", cost_price as "Cost Price (₹)", stock_quantity as "Current Stock", low_stock_threshold as "Low Threshold", is_active as "Active"
       FROM products ORDER BY name ASC`
    );
    const wsProducts = xlsx.utils.json_to_sheet(products);
    xlsx.utils.book_append_sheet(wb, wsProducts, 'Products');

    // 5. Inventory Logs Sheet
    const inventoryLogs = await db.query(
      `SELECT adjustment_date as "Date", product_id as "Product ID", change_qty as "Quantity Change", reason_code as "Reason", notes as "Notes"
       FROM inventory_adjustments ORDER BY created_at DESC LIMIT 100`
    );
    const wsInventory = xlsx.utils.json_to_sheet(inventoryLogs);
    xlsx.utils.book_append_sheet(wb, wsInventory, 'Inventory');

    // 6. Monthly Sales Sheet
    const monthlySales = await db.query(
      `SELECT bill_date as "Date", SUM(grand_total) as "Daily Revenue (₹)", COUNT(*) as "Bills Issued"
       FROM bills WHERE payment_status != 'void'
       GROUP BY bill_date ORDER BY created_at DESC LIMIT 60`
    );
    const wsMonthly = xlsx.utils.json_to_sheet(monthlySales);
    xlsx.utils.book_append_sheet(wb, wsMonthly, 'Monthly Sales');

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Memotrix_Master_Business_Report.xlsx"');
    return res.send(buf);
  } catch (err) {
    console.error('[EXCEL] Export error:', err);
    res.status(500).json({ error: 'Failed to export excel report' });
  }
});

/**
 * Helper to build export payload filtered by month
 */
async function buildExportPayload(tenantId, month) {
  const bp = await db.queryOne('SELECT * FROM business_profile WHERE tenant_id = ? LIMIT 1', [tenantId]) || {};
  
  let billSql = `SELECT * FROM bills WHERE tenant_id = ?`;
  const params = [tenantId];
  if (month && month !== 'all') {
    let year = '';
    let mon = '';
    if (month.includes('-')) {
      const parts = month.split('-');
      if (parts[0].length === 4) {
        year = parts[0];
        mon = parts[1].padStart(2, '0');
      } else {
        mon = parts[0].padStart(2, '0');
        year = parts[1];
      }
    } else {
      mon = month.padStart(2, '0');
      year = new Date().getFullYear().toString();
    }

    billSql += ` AND (bill_date LIKE ? OR bill_date LIKE ? OR bill_date LIKE ? OR bill_date LIKE ?)`;
    params.push(`%${mon}-${year}%`, `%${month}%`, `%-${mon}-%`, `${year}-${mon}%`);
  }
  billSql += ` ORDER BY created_at DESC`;
  const bills = await db.query(billSql, params);

  const billIds = bills.map(b => b.id);
  let allItems = [];
  let allPayments = [];
  if (billIds.length > 0) {
    allItems = await db.query(`SELECT * FROM bill_items WHERE bill_id IN (${billIds.map(() => '?').join(',')})`, billIds);
    allPayments = await db.query(`SELECT * FROM bill_payments WHERE bill_id IN (${billIds.map(() => '?').join(',')})`, billIds);
  }

  const customers = await db.query(`SELECT id, name, phone, email, address, gstin, state_code, total_spent, outstanding_balance FROM customers WHERE tenant_id = ?`, [tenantId]);
  const products = await db.query(`SELECT id, sku, name, category, hsn_sac, cost_price, retail_price, stock_quantity, is_active FROM products WHERE tenant_id = ?`, [tenantId]);

  let totalSubtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let totalGrand = 0;
  let paidCount = 0;
  let pendingCount = 0;

  const transactions = bills.map(b => {
    const bItems = allItems.filter(i => i.bill_id === b.id);
    const bPays = allPayments.filter(p => p.bill_id === b.id);
    const primaryPayMethod = bPays.length > 0 ? bPays[0].payment_method : 'cash';

    const sub = parseFloat(b.subtotal || 0);
    const disc = parseFloat(b.discount_total || 0);
    const tax = parseFloat(b.tax_total || 0);
    const grand = parseFloat(b.grand_total || 0);

    totalSubtotal += sub;
    totalDiscount += disc;
    totalTax += tax;
    totalGrand += grand;

    if (b.payment_status === 'paid') paidCount++;
    else pendingCount++;

    return {
      invoiceNo: b.bill_number,
      customer: b.customer_name,
      phone: b.customer_phone || '',
      email: b.customer_email || '',
      date: b.bill_date,
      dueDate: b.due_date || '',
      status: b.payment_status ? (b.payment_status.charAt(0).toUpperCase() + b.payment_status.slice(1)) : 'Pending',
      items: bItems.map(i => ({
        item_name: i.item_name,
        hsn_sac: i.hsn_sac || '',
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount_amount: i.discount_amount,
        line_total: i.line_total
      })),
      subtotal: sub,
      discount: disc,
      tax: tax,
      total: grand,
      receivedAmount: parseFloat(b.received_amount || 0),
      balanceAmount: parseFloat(b.balance_amount || 0),
      paymentMode: primaryPayMethod.toUpperCase(),
      createdBy: b.executed_by || 'Admin'
    };
  });

  const exportMonthName = month && month !== 'all' ? month : new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return {
    business: {
      business_name: bp.business_name || 'Memotrix',
      phone: bp.phone || '',
      email: bp.email || '',
      address: bp.address || '',
      gstin: bp.gstin || '',
      state_code: bp.state_code || ''
    },
    exportDate: new Date().toISOString().split('T')[0],
    month: exportMonthName,
    summary: {
      totalBills: bills.length,
      paid: paidCount,
      pending: pendingCount,
      subtotal: totalSubtotal,
      discount: totalDiscount,
      tax: totalTax,
      grandTotal: totalGrand
    },
    customers,
    products,
    transactions
  };
}

/**
 * GET /api/reports/export/json
 */
router.get('/export/json', authenticate, async (req, res) => {
  const tenantId = req.user.tenantId || 'tenant-memotrix-01';
  const month = req.query.month || '';
  console.log(`[EXPORT JSON] Export started for month: "${month || 'all'}"...`);

  try {
    const payload = await buildExportPayload(tenantId, month);
    console.log(`[EXPORT JSON] Records found: ${payload.transactions.length} invoices, ${payload.customers.length} customers, ${payload.products.length} products.`);

    if (payload.transactions.length === 0 && month && month !== 'all') {
      return res.status(404).json({ error: `No billing data found for the selected month (${month}).` });
    }

    const jsonString = JSON.stringify(payload, null, 2);
    const filename = `memotrix-export-${month || new Date().toISOString().slice(0,7)}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    console.log('[EXPORT JSON] Export completed successfully.');
    return res.send(jsonString);
  } catch (err) {
    console.error('[EXPORT JSON] Export error:', err);
    return res.status(500).json({ error: 'Export failed. Please try again.' });
  }
});

/**
 * GET /api/reports/export/csv
 */
router.get('/export/csv', authenticate, async (req, res) => {
  const tenantId = req.user.tenantId || 'tenant-memotrix-01';
  const month = req.query.month || '';
  console.log(`[EXPORT CSV] Export started for month: "${month || 'all'}"...`);

  try {
    const payload = await buildExportPayload(tenantId, month);
    console.log(`[EXPORT CSV] Records found: ${payload.transactions.length} invoices.`);

    if (payload.transactions.length === 0 && month && month !== 'all') {
      return res.status(404).json({ error: `No billing data found for the selected month (${month}).` });
    }

    // CSV Header
    const headers = [
      'Invoice Number', 'Invoice Date', 'Customer', 'Phone', 'Email', 'GSTIN',
      'Items Summary', 'Item Count', 'Subtotal', 'Discount', 'Tax', 'Grand Total',
      'Payment Status', 'Payment Mode', 'Created By', 'Export Date'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvText = headers.map(escapeCsv).join(',') + '\n';

    for (const t of payload.transactions) {
      const itemsText = t.items.map(i => `${i.item_name} (x${i.quantity})`).join('; ');
      const itemCount = t.items.reduce((sum, i) => sum + parseInt(i.quantity || 1), 0);

      const row = [
        t.invoiceNo,
        t.date,
        t.customer,
        t.phone,
        t.email,
        payload.business.gstin || '',
        itemsText,
        itemCount,
        t.subtotal.toFixed(2),
        t.discount.toFixed(2),
        t.tax.toFixed(2),
        t.total.toFixed(2),
        t.status,
        t.paymentMode,
        t.createdBy,
        payload.exportDate
      ];

      csvText += row.map(escapeCsv).join(',') + '\n';
    }

    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const csvBuffer = Buffer.concat([bom, Buffer.from(csvText, 'utf-8')]);
    const filename = `memotrix-export-${month || new Date().toISOString().slice(0,7)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    console.log('[EXPORT CSV] Export completed successfully.');
    return res.send(csvBuffer);
  } catch (err) {
    console.error('[EXPORT CSV] Export error:', err);
    return res.status(500).json({ error: 'Export failed. Please try again.' });
  }
});

/**
 * GET /api/reports/export/excel
 * Multi-sheet Excel workbook export (Summary, Invoices, Products, Customers)
 */
router.get('/export/excel', authenticate, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'tenant-memotrix-01';
    const month = req.query.month || '';
    console.log(`[EXPORT EXCEL] Export requested for month: "${month || 'all'}"`);

    const payload = await buildExportPayload(tenantId, month);
    const wb = xlsx.utils.book_new();

    // Sheet 1: Executive Summary
    const summaryData = [
      { Metric: 'Company Name', Value: payload.business.name },
      { Metric: 'GSTIN', Value: payload.business.gstin || 'N/A' },
      { Metric: 'Export Date', Value: payload.exportDate },
      { Metric: 'Selected Filter', Value: month || 'All Time' },
      { Metric: 'Total Invoices', Value: payload.summary.totalInvoices },
      { Metric: 'Total Revenue (INR)', Value: payload.summary.totalRevenue },
      { Metric: 'Paid Invoices Count', Value: payload.summary.paidCount },
      { Metric: 'Pending Invoices Count', Value: payload.summary.pendingCount },
      { Metric: 'Total Active Customers', Value: payload.customers.length },
      { Metric: 'Total Catalog Products', Value: payload.products.length }
    ];
    const wsSummary = xlsx.utils.json_to_sheet(summaryData);
    xlsx.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2: Invoices Breakdown
    const invoiceRows = payload.transactions.map(t => ({
      'Invoice Number': t.invoiceNo,
      'Date': t.date,
      'Customer': t.customer,
      'Phone': t.phone,
      'Email': t.email,
      'Item Count': t.items.reduce((acc, i) => acc + parseInt(i.quantity || 1), 0),
      'Items': t.items.map(i => `${i.item_name} (x${i.quantity})`).join('; '),
      'Subtotal (INR)': t.subtotal,
      'Discount (INR)': t.discount,
      'Tax (INR)': t.tax,
      'Grand Total (INR)': t.total,
      'Payment Status': t.status,
      'Payment Mode': t.paymentMode,
      'Issued By': t.createdBy
    }));
    const wsInvoices = xlsx.utils.json_to_sheet(invoiceRows);
    xlsx.utils.book_append_sheet(wb, wsInvoices, 'Invoices');

    // Sheet 3: Product Inventory Catalog
    const productRows = payload.products.map(p => ({
      'Product Name': p.name,
      'SKU': p.sku,
      'Category': p.category_name || 'General',
      'Retail Price (INR)': p.retail_price,
      'GST Rate (%)': p.gst_rate,
      'Stock Quantity': p.stock_quantity,
      'Low Stock Threshold': p.low_stock_threshold,
      'Status': p.stock_quantity <= p.low_stock_threshold ? 'Low Stock' : 'In Stock'
    }));
    const wsProducts = xlsx.utils.json_to_sheet(productRows);
    xlsx.utils.book_append_sheet(wb, wsProducts, 'Products');

    // Sheet 4: Customer Directory
    const customerRows = payload.customers.map(c => ({
      'Customer Name': c.name,
      'Phone Number': c.phone,
      'Email Address': c.email,
      'Billing Address': c.address,
      'GSTIN': c.gstin || '',
      'Total Orders': c.total_orders || 0
    }));
    const wsCustomers = xlsx.utils.json_to_sheet(customerRows);
    xlsx.utils.book_append_sheet(wb, wsCustomers, 'Customers');

    const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `memotrix-report-${month || new Date().toISOString().slice(0,7)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    console.log('[EXPORT EXCEL] Excel export completed successfully.');
    return res.send(excelBuffer);
  } catch (err) {
    console.error('[EXPORT EXCEL] Export error:', err);
    return res.status(500).json({ error: 'Excel export failed. Please try again.' });
  }
});

export default router;
