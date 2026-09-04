import express from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import db from '../db/db.js';
import { authenticate } from '../middleware/auth.js';
import { numberToWords } from '../services/numberToWords.js';
import { buildUpiString, generateQrDataUri } from '../services/qrService.js';
import { generateInvoicePdf } from '../services/pdfService.js';
import { sendLowStockAlert } from '../services/emailService.js';
import { encrypt, decrypt } from '../services/cryptoService.js';

const router = express.Router();

const isVercel = !!process.env.VERCEL;
const PDF_STORAGE_DIR = isVercel ? path.join('/tmp', 'pdfs') : path.join(process.cwd(), 'storage', 'pdfs');
if (!fs.existsSync(PDF_STORAGE_DIR)) {
  try {
    fs.mkdirSync(PDF_STORAGE_DIR, { recursive: true });
  } catch (e) {}
}

router.use(authenticate);

async function generateBillNumber(tenantId) {
  const year = new Date().getFullYear();
  const countRow = await db.queryOne('SELECT COUNT(*) as total FROM bills WHERE tenant_id = ?', [tenantId || 'tenant-memotrix-01']);
  const nextSeq = (parseInt(countRow?.total || 0) + 1).toString().padStart(4, '0');
  return `MTX-${year}-${nextSeq}`;
}

function deriveStatus(bill) {
  if (bill.payment_status === 'void' || bill.payment_status === 'paid' || bill.payment_status === 'overdue') {
    return bill.payment_status;
  }
  if (bill.due_date) {
    const today = new Date().toISOString().split('T')[0];
    if (bill.due_date < today && bill.balance_amount > 0) {
      return 'overdue';
    }
  }
  if (bill.received_amount > 0 && bill.balance_amount > 0) return 'partial';
  if (bill.received_amount === 0 && (!bill.payment_status || bill.payment_status === 'unpaid')) return 'pending';
  return bill.payment_status || 'pending';
}

/**
 * GET /api/bills/draft/current
 */
router.get('/draft/current', async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-memotrix-01';
    const userId = req.user.id;

    const draftRow = await db.queryOne(
      'SELECT * FROM billing_drafts WHERE tenant_id = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 1',
      [tenantId, userId]
    );

    if (!draftRow) return res.json({ draft: null });

    let parsedDraft = null;
    try {
      parsedDraft = JSON.parse(draftRow.draft_json);
    } catch (e) {
      parsedDraft = null;
    }

    return res.json({
      draft: parsedDraft,
      updatedAt: draftRow.updated_at
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch billing draft' });
  }
});

/**
 * POST /api/bills/draft/save
 */
router.post('/draft/save', async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-memotrix-01';
    const userId = req.user.id;
    const draftPayload = req.body;

    if (!draftPayload || typeof draftPayload !== 'object') {
      return res.status(400).json({ error: 'Invalid draft payload' });
    }

    const draftJson = JSON.stringify(draftPayload);
    const existing = await db.queryOne(
      'SELECT id FROM billing_drafts WHERE tenant_id = ? AND user_id = ?',
      [tenantId, userId]
    );

    if (existing) {
      await db.query(
        'UPDATE billing_drafts SET draft_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [draftJson, existing.id]
      );
    } else {
      await db.query(
        'INSERT INTO billing_drafts (id, tenant_id, user_id, draft_json) VALUES (?, ?, ?, ?)',
        [`draft-${Date.now()}`, tenantId, userId, draftJson]
      );
    }

    return res.json({ message: 'Draft saved successfully', updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save billing draft' });
  }
});

/**
 * DELETE /api/bills/draft/clear
 */
router.delete('/draft/clear', async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-memotrix-01';
    const userId = req.user.id;

    await db.query('DELETE FROM billing_drafts WHERE tenant_id = ? AND user_id = ?', [tenantId, userId]);
    return res.json({ message: 'Draft cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear draft' });
  }
});

/**
 * GET /api/bills
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.tenantId || 'tenant-memotrix-01';
    const { startDate, endDate, customerId, status, search } = req.query;

    let sql = `SELECT b.*, c.email as customer_email FROM bills b LEFT JOIN customers c ON b.customer_id = c.id WHERE b.tenant_id = ?`;
    const params = [tenantId];

    if (startDate) {
      sql += ` AND b.bill_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND b.bill_date <= ?`;
      params.push(endDate);
    }
    if (customerId) {
      sql += ` AND b.customer_id = ?`;
      params.push(customerId);
    }
    if (status) {
      sql += ` AND b.payment_status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (b.bill_number LIKE ? OR b.customer_name LIKE ? OR b.customer_phone LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY b.created_at DESC`;
    const rawBills = await db.query(sql, params);

    const bills = rawBills.map(b => ({
      ...b,
      payment_status: deriveStatus(b)
    }));

    return res.json({ bills });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

/**
 * GET /api/bills/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId || 'tenant-memotrix-01';

    const bill = await db.queryOne('SELECT * FROM bills WHERE (id = ? OR bill_number = ?) AND tenant_id = ?', [id, id, tenantId]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    bill.payment_status = deriveStatus(bill);

    const items = await db.query('SELECT * FROM bill_items WHERE bill_id = ?', [bill.id]);
    const rawPayments = await db.query('SELECT * FROM bill_payments WHERE bill_id = ?', [bill.id]);
    const bp = await db.queryOne('SELECT * FROM business_profile WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const templateSettings = await db.queryOne('SELECT * FROM bill_template_settings WHERE tenant_id = ? LIMIT 1', [tenantId]);

    const payments = rawPayments.map(p => ({
      ...p,
      transaction_reference: decrypt(p.transaction_reference)
    }));

    const amountInWords = numberToWords(bill.grand_total);
    const upiString = bp?.upi_id ? buildUpiString({
      upiId: bp.upi_id,
      payeeName: bp.payee_name || bp.business_name || 'Memotrix',
      amount: bill.grand_total,
      currency: bp.currency || 'INR',
      note: bp.default_transaction_note || bill.bill_number
    }) : '';
    const upiQrDataUri = await generateQrDataUri(upiString);

    return res.json({
      bill,
      items,
      payments,
      businessProfile: bp,
      templateSettings,
      amountInWords,
      upiQrDataUri
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bill details' });
  }
});

/**
 * POST /api/bills
 */
router.post('/', async (req, res) => {
  const tenantId = req.user.tenantId || 'tenant-memotrix-01';
  const userId = req.user.id;
  const { customer_id, customer_name, customer_phone, customer_email, due_date, items, payments, coupon_code, notes, executed_by, invoice_type } = req.body;

  if (!customer_name || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer name and at least one line item are required.' });
  }

  try {
    const bp = await db.queryOne('SELECT * FROM business_profile WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const tpl = await db.queryOne('SELECT * FROM bill_template_settings WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const customer = customer_id ? await db.queryOne('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [customer_id, tenantId]) : null;

    const billId = `bill-${Date.now()}`;
    const billNumber = await generateBillNumber(tenantId);
    const todayFormatted = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const processedItems = [];

    for (const item of items) {
      const product = item.product_id ? await db.queryOne('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [item.product_id, tenantId]) : null;
      const unitPrice = parseFloat(item.unit_price || product?.retail_price || 0);
      const qty = parseInt(item.quantity || 1);
      const lineSubtotal = unitPrice * qty;

      let discAmt = parseFloat(item.discount_amount || 0);
      let discPct = parseFloat(item.discount_percent || 0);
      if (discPct > 0 && discAmt === 0) discAmt = (lineSubtotal * discPct) / 100;
      else if (discAmt > 0 && lineSubtotal > 0) discPct = (discAmt / lineSubtotal) * 100;

      const lineTotal = lineSubtotal - discAmt;
      subtotal += lineSubtotal;
      totalDiscount += discAmt;

      let cgstRate = 0, cgstAmt = 0, sgstRate = 0, sgstAmt = 0, igstRate = 0, igstAmt = 0;
      if (bp && bp.gst_enabled) {
        const itemTaxRate = parseFloat(item.tax_rate || 18);
        const isIntraState = !customer || customer.state_code === bp.state_code;
        if (isIntraState) {
          cgstRate = itemTaxRate / 2;
          sgstRate = itemTaxRate / 2;
          cgstAmt = (lineTotal * cgstRate) / 100;
          sgstAmt = (lineTotal * sgstRate) / 100;
          totalTax += cgstAmt + sgstAmt;
        } else {
          igstRate = itemTaxRate;
          igstAmt = (lineTotal * igstRate) / 100;
          totalTax += igstAmt;
        }
      }

      processedItems.push({
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product_id: item.product_id || null,
        item_name: item.item_name || product?.name || 'Product / Service',
        hsn_sac: item.hsn_sac || product?.hsn_sac || '',
        quantity: qty,
        unit_price: unitPrice,
        discount_amount: discAmt,
        discount_percent: discPct,
        tax_rate: parseFloat(item.tax_rate || 0),
        cgst_rate: cgstRate,
        cgst_amount: cgstAmt,
        sgst_rate: sgstRate,
        sgst_amount: sgstAmt,
        igst_rate: igstRate,
        igst_amount: igstAmt,
        line_total: lineTotal
      });

      if (product) {
        const newStock = Math.max(0, product.stock_quantity - qty);
        await db.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, product.id]);
        if (newStock <= product.low_stock_threshold) {
          sendLowStockAlert({ ...product, stock_quantity: newStock });
        }
      }
    }

    const grandTotal = Math.max(0, subtotal - totalDiscount + totalTax);

    let receivedAmount = 0;
    const processedPayments = [];
    if (payments && Array.isArray(payments) && payments.length > 0) {
      for (const p of payments) {
        const pAmt = parseFloat(p.amount || 0);
        receivedAmount += pAmt;
        processedPayments.push({
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          payment_method: p.payment_method || 'cash',
          amount: pAmt,
          transaction_reference: encrypt(p.transaction_reference || '')
        });
      }
    }

    const balanceAmount = Math.max(0, grandTotal - receivedAmount);
    let paymentStatus = 'paid';
    if (receivedAmount === 0) paymentStatus = 'pending';
    else if (receivedAmount < grandTotal) paymentStatus = 'partial';

    let execByValue = tpl?.executed_by_value || 'Authorized Signatory';
    if (executed_by && typeof executed_by === 'string' && executed_by.trim().length > 0 && executed_by.trim().toLowerCase() !== customer_name.trim().toLowerCase()) {
      execByValue = executed_by.trim();
    }

    const invType = invoice_type || 'tax_invoice';

    await db.query(
      `INSERT INTO bills (id, tenant_id, bill_number, customer_id, customer_name, customer_phone, customer_email, bill_date, due_date, subtotal, discount_total, tax_total, grand_total, received_amount, balance_amount, payment_status, notes, executed_by, coupon_code, invoice_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [billId, tenantId, billNumber, customer_id || null, customer_name, customer_phone || '', customer_email || '', todayFormatted, due_date || null, subtotal, totalDiscount, totalTax, grandTotal, receivedAmount, balanceAmount, paymentStatus, notes || '', execByValue, coupon_code || null, invType]
    );

    for (const item of processedItems) {
      await db.query(
        `INSERT INTO bill_items (id, bill_id, product_id, item_name, hsn_sac, quantity, unit_price, discount_amount, discount_percent, tax_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.id, billId, item.product_id, item.item_name, item.hsn_sac, item.quantity, item.unit_price, item.discount_amount, item.discount_percent, item.tax_rate, item.cgst_rate, item.cgst_amount, item.sgst_rate, item.sgst_amount, item.igst_rate, item.igst_amount, item.line_total]
      );
    }

    for (const p of processedPayments) {
      await db.query(
        `INSERT INTO bill_payments (id, bill_id, payment_method, amount, transaction_reference)
         VALUES (?, ?, ?, ?, ?)`,
        [p.id, billId, p.payment_method, p.amount, p.transaction_reference]
      );
    }

    await db.query('DELETE FROM billing_drafts WHERE tenant_id = ? AND user_id = ?', [tenantId, userId]);

    await db.query(
      `INSERT INTO bill_audit_logs (id, tenant_id, bill_id, action, changes_json, admin_id)
       VALUES (?, ?, ?, 'created', ?, ?)`,
      [`audit-${Date.now()}`, tenantId, billId, JSON.stringify({ grandTotal, itemCount: processedItems.length }), userId]
    );

    const createdBill = await db.queryOne('SELECT * FROM bills WHERE id = ?', [billId]);
    return res.status(201).json({
      message: 'Product Billing Invoice generated successfully',
      bill: createdBill,
      items: processedItems,
      payments: processedPayments
    });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate product billing invoice' });
  }
});

/**
 * POST /api/bills/:id/void
 */
router.post('/:id/void', async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId || 'tenant-memotrix-01';
  const { adminPassword, reason } = req.body;

  if (!adminPassword || !reason) {
    return res.status(400).json({ error: 'Admin password re-entry and a mandatory reason are required.' });
  }

  try {
    const adminUser = await db.queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const isPasswordValid = bcrypt.compareSync(adminPassword, adminUser.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect admin password.' });
    }

    const bill = await db.queryOne('SELECT * FROM bills WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    await db.query(`UPDATE bills SET payment_status = 'void', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);

    await db.query(
      `INSERT INTO bill_audit_logs (id, tenant_id, bill_id, action, changes_json, reason, admin_id)
       VALUES (?, ?, ?, 'voided', ?, ?, ?)`,
      [`audit-${Date.now()}`, tenantId, id, JSON.stringify({ prevStatus: bill.payment_status }), reason, req.user.id]
    );

    return res.json({ message: 'Bill has been voided successfully.', billId: id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to void bill' });
  }
});

/**
 * PATCH /api/bills/:id/status
 * Admin-editable status (paid, pending, overdue, void).
 * DOES NOT invalidate pdf_path per Addendum Correction #1.
 */
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId || 'tenant-memotrix-01';
  const { status, reason } = req.body;

  const validStatuses = ['paid', 'pending', 'overdue', 'void'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const bill = await db.queryOne('SELECT * FROM bills WHERE (id = ? OR bill_number = ?) AND tenant_id = ?', [id, id, tenantId]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const prevStatus = bill.payment_status;
    await db.query(`UPDATE bills SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, bill.id]);

    await db.query(
      `INSERT INTO bill_audit_logs (id, tenant_id, bill_id, action, changes_json, reason, admin_id)
       VALUES (?, ?, ?, 'status_changed', ?, ?, ?)`,
      [`audit-${Date.now()}`, tenantId, bill.id, JSON.stringify({ prevStatus, newStatus: status }), reason || 'Admin manual status update', req.user.id]
    );

    return res.json({ message: `Bill status updated to ${status}`, billId: bill.id, status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update bill status' });
  }
});

/**
 * PUT /api/bills/:id
 * 24-hour edit-window endpoint.
 * Invalidates pdf_path (clears DB column and deletes cached PDF file on disk) per Addendum Correction #1.
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId || 'tenant-memotrix-01';
  const { customer_name, customer_phone, customer_email, notes, executed_by } = req.body;

  try {
    const bill = await db.queryOne('SELECT * FROM bills WHERE (id = ? OR bill_number = ?) AND tenant_id = ?', [id, id, tenantId]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    // Check 24h edit window
    const createdAtTime = new Date(bill.created_at).getTime();
    const diffHours = (Date.now() - createdAtTime) / (1000 * 60 * 60);
    if (diffHours > 24) {
      return res.status(403).json({ error: 'Bill edit window (24 hours) has expired.' });
    }

    // Invalidate cached PDF file on disk if exists
    if (bill.pdf_path && fs.existsSync(bill.pdf_path)) {
      try {
        fs.unlinkSync(bill.pdf_path);
      } catch (e) {
        // ignore
      }
    }

    await db.query(
      `UPDATE bills 
       SET customer_name = COALESCE(?, customer_name), 
           customer_phone = COALESCE(?, customer_phone), 
           customer_email = COALESCE(?, customer_email), 
           notes = COALESCE(?, notes), 
           executed_by = COALESCE(?, executed_by), 
           pdf_path = NULL, 
           pdf_generated_at = NULL, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [customer_name || null, customer_phone || null, customer_email || null, notes || null, executed_by || null, bill.id]
    );

    await db.query(
      `INSERT INTO bill_audit_logs (id, tenant_id, bill_id, action, changes_json, admin_id)
       VALUES (?, ?, ?, 'edited', ?, ?)`,
      [`audit-${Date.now()}`, tenantId, bill.id, JSON.stringify({ customer_name, customer_email, notes, executed_by }), req.user.id]
    );

    const updatedBill = await db.queryOne('SELECT * FROM bills WHERE id = ?', [bill.id]);
    return res.json({ message: 'Bill updated successfully (PDF cache invalidated)', bill: updatedBill });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update bill' });
  }
});

function getLogoBase64DataUri(logoUrl) {
  const defaultLogoPaths = [
    path.join(process.cwd(), 'public', 'logo-default.png'),
    path.join(process.cwd(), '..', 'frontend', 'public', 'logo-default.png'),
    path.join(process.cwd(), 'logo-default.png')
  ];

  let targetPath = null;

  if (logoUrl && typeof logoUrl === 'string' && logoUrl.trim().length > 0) {
    const rawUrl = logoUrl.trim().split('?')[0];
    if (rawUrl.startsWith('data:image/')) {
      return rawUrl;
    }

    if (rawUrl.startsWith('/uploads/')) {
      targetPath = path.join(process.cwd(), 'public', rawUrl);
    } else if (rawUrl.startsWith('/')) {
      targetPath = path.join(process.cwd(), 'public', rawUrl);
      if (!fs.existsSync(targetPath)) {
        targetPath = path.join(process.cwd(), '..', 'frontend', 'public', rawUrl);
      }
    } else if (fs.existsSync(rawUrl)) {
      targetPath = rawUrl;
    }
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    for (const p of defaultLogoPaths) {
      if (fs.existsSync(p)) {
        targetPath = p;
        break;
      }
    }
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    console.warn('[LOGO BASE64] Could not find any logo file on disk.');
    return '/logo-default.png';
  }

  try {
    const ext = path.extname(targetPath).toLowerCase();
    let mimeType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.svg') mimeType = 'image/svg+xml';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.png') mimeType = 'image/png';

    const fileBuffer = fs.readFileSync(targetPath);
    const base64Data = fileBuffer.toString('base64');
    return `data:${mimeType};base64,${base64Data}`;
  } catch (err) {
    console.error('[LOGO BASE64] Failed to read logo file:', err.message);
    return '/logo-default.png';
  }
}

function buildInvoiceHtml(bill, items, bp, tpl, amountInWords, upiQrDataUri) {
  const totalQty = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
  const itemsHtml = items.map((item, idx) => {
    const qty = parseInt(item.quantity) || 1;
    const unitPrice = parseFloat(item.unit_price || 0);
    const discAmt = parseFloat(item.discount_amount || 0);
    const discPct = item.discount_percent ? parseFloat(item.discount_percent) : (unitPrice * qty > 0 ? (discAmt / (unitPrice * qty)) * 100 : 0);
    const lineTotal = parseFloat(item.line_total || 0);

    const discLabel = discAmt > 0 
      ? `&#8377; ${discAmt.toFixed(2)}<br/><span style="font-size: 10px; color: #555;">(${discPct.toFixed(1)}%)</span>`
      : `&#8377; 0.00<span style="font-size: 10px; color: #555;"> (0.0%)</span>`;

    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 7px; text-align: center; color: #333;">${idx + 1}</td>
        <td style="padding: 7px; font-weight: bold; color: #111;">${item.item_name}</td>
        <td style="padding: 7px; color: #555;">${item.hsn_sac || ''}</td>
        <td style="padding: 7px; text-align: center; font-weight: bold;">${qty}</td>
        <td style="padding: 7px; text-align: right;">&#8377; ${unitPrice.toFixed(2)}</td>
        <td style="padding: 7px; text-align: right; line-height: 1.2;">${discLabel}</td>
        <td style="padding: 7px; text-align: right; font-weight: bold; color: #111;">&#8377; ${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const executedByName = bill.executed_by || tpl?.executed_by_value || 'Authorized Signatory';
  const logoDataUri = getLogoBase64DataUri(bp?.logo_original_url || bp?.logo_url);

  let pdfTitle = 'TAX INVOICE';
  if (bill.invoice_type === 'receipt') pdfTitle = 'CASH RECEIPT';
  if (bill.invoice_type === 'estimate') pdfTitle = 'ESTIMATE / PROFORMA';
  if (bill.invoice_type === 'quotation') pdfTitle = 'COMMERCIAL QUOTATION';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${pdfTitle} - ${bill.bill_number}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #111111; font-size: 11px; line-height: 1.35; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .business-title { font-size: 22px; font-weight: 800; margin: 0; color: #0f172a; tracking-tight: -0.5px; }
        .sub-text { font-size: 10px; color: #475569; margin: 1px 0; }
        .logo-container { width: 160px; height: 80px; display: flex; align-items: center; justify-content: flex-end; }
        .logo-img { max-width: 160px; max-height: 80px; width: auto; height: auto; object-fit: contain; }
        .title-bar { border-top: 2px solid #2563EB; border-bottom: 2px solid #2563EB; color: #2563EB; background-color: transparent; text-align: center; font-size: 16px; font-weight: bold; padding: 4px 0; margin: 10px 0; letter-spacing: 0.5px; text-transform: uppercase; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 11px; }
        .info-block { width: 48%; }
        .info-block strong { color: #000000; display: block; font-size: 11px; margin-bottom: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5px; }
        th { background-color: #2563EB; color: #ffffff; text-align: left; padding: 6px 7px; font-weight: bold; }
        .table-footer { font-weight: bold; background-color: #ffffff; border-top: 2px solid #0f172a; border-bottom: 1px solid #0f172a; }
        .table-footer td { padding: 8px 7px; }
        .main-grid { display: flex; justify-content: space-between; margin-top: 15px; gap: 20px; }
        .left-col { width: 55%; }
        .right-col { width: 42%; }
        .section-title { font-weight: bold; text-transform: uppercase; font-size: 10px; margin-bottom: 4px; color: #000000; letter-spacing: 0.5px; }
        .terms-list { font-size: 10px; color: #334155; line-height: 1.4; white-space: pre-line; margin-top: 3px; }
        .summary-box { border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; font-size: 11px; background-color: #ffffff; }
        .summary-row { display: flex; justify-content: space-between; padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
        .summary-row.total-bar { background-color: #2563EB; color: #ffffff; font-weight: bold; border-bottom: none; font-size: 13px; }
        .signature-area { text-align: right; margin-top: 20px; }
        .signature-name { font-size: 13px; font-weight: 800; color: #0f172a; margin: 10px 0 2px 0; border-bottom: 2px solid #0f172a; display: inline-block; padding-bottom: 2px; }
        .signature-label { font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; }
        .ack-section { margin-top: 20px; padding-top: 10px; border-top: 1px dashed #94a3b8; }
        .ack-header { text-align: center; margin-bottom: 8px; }
        .ack-grid { display: flex; justify-content: space-between; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="business-title">${bp?.business_name || 'Memotrix'}</h1>
          ${bp?.address ? `<p class="sub-text">${bp.address}</p>` : ''}
          <p class="sub-text">Phone: ${bp?.phone || '6384241882'} | Email: ${bp?.email || 'teammemotrix@gmail.com'}</p>
          ${bp?.gstin ? `<p class="sub-text">GSTIN: ${bp.gstin}</p>` : ''}
          ${bp?.website ? `<p class="sub-text">Website: ${bp.website}</p>` : ''}
        </div>
        <div class="logo-container">
          <img src="${logoDataUri}" class="logo-img" alt="Business Logo" />
        </div>
      </div>

      <div class="title-bar">${pdfTitle}</div>

      <div class="info-row">
        <div class="info-block">
          <strong>Bill To</strong>
          <span style="font-weight: bold; font-size: 12px; color: #0f172a;">${bill.customer_name}</span>
          ${bill.customer_phone ? `<br/><span style="color: #64748b;">Phone: ${bill.customer_phone}</span>` : ''}
          ${bill.customer_email ? `<br/><span style="color: #1d4ed8;">Email: ${bill.customer_email}</span>` : ''}
        </div>
        <div class="info-block" style="text-align: right;">
          <strong>Invoice Details</strong>
          <span>Invoice No: <strong>${bill.bill_number}</strong></span><br/>
          <span>Invoice Date: ${bill.bill_date}</span>
          ${bill.due_date ? `<br/><span style="color: #b45309; font-weight: bold;">Due Date: ${bill.due_date}</span>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 25px; text-align: center;">#</th>
            <th>Item Name</th>
            <th style="width: 80px;">HSN/ SAC</th>
            <th style="width: 60px; text-align: center;">Quantity</th>
            <th style="width: 80px; text-align: right;">Price/ Unit</th>
            <th style="width: 90px; text-align: right;">Discount</th>
            <th style="width: 90px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr class="table-footer">
            <td colspan="3" style="padding-left: 7px;">Total</td>
            <td style="text-align: center;">${totalQty}</td>
            <td></td>
            <td style="text-align: right;">&#8377; ${parseFloat(bill.discount_total || 0).toFixed(2)}</td>
            <td style="text-align: right; font-size: 13px; color: #0B8A3E; font-weight: 800;">&#8377; ${parseFloat(bill.grand_total).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="main-grid">
        <div class="left-col">
          <div style="margin-bottom: 12px;">
            <div class="section-title">Invoice Amount In Words</div>
            <div style="color: #0f172a; font-weight: 500; font-size: 11px;">${amountInWords}</div>
          </div>

          <div style="margin-bottom: 12px;">
            <div class="section-title">Terms And Conditions</div>
            <div class="terms-list">${tpl?.terms_and_conditions || ''}</div>
          </div>

          ${(upiQrDataUri && bp?.show_qr_code !== false) ? `
            <div style="margin-top: 10px;">
              <div style="display: inline-block; padding: 6px; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; background: #ffffff;">
                <img src="${upiQrDataUri}" style="width: 85px; height: 85px; display: block; margin: 0 auto;" />
                <div style="font-size: 9px; font-weight: bold; color: #1e293b; margin-top: 4px;">Scan & Pay</div>
                ${bp?.show_upi_text !== false && bp?.upi_id ? `<div style="font-size: 8px; color: #475569; margin-top: 1px;">UPI ID: <strong>${bp.upi_id}</strong></div>` : ''}
              </div>
            </div>
          ` : ''}
        </div>

        <div class="right-col">
          <div class="summary-box">
            <div class="summary-row"><span>Sub Total</span><span>&#8377; ${parseFloat(bill.subtotal).toFixed(2)}</span></div>
            <div class="summary-row"><span>Discount</span><span>&#8377; ${parseFloat(bill.discount_total || 0).toFixed(2)}</span></div>
            <div class="summary-row total-bar"><span>Total</span><span>&#8377; ${parseFloat(bill.grand_total).toFixed(2)}</span></div>
            <div class="summary-row"><span>Received</span><span>&#8377; ${parseFloat(bill.received_amount || 0).toFixed(2)}</span></div>
            <div class="summary-row"><span>Balance</span><span>&#8377; ${parseFloat(bill.balance_amount || 0).toFixed(2)}</span></div>
            <div class="summary-row"><span>You Saved</span><span>&#8377; ${parseFloat(bill.discount_total || 0).toFixed(2)}</span></div>
          </div>

          <div class="signature-area">
            <div style="font-size: 10px; color: #64748b;">For: ${bp?.business_name || 'Memotrix'}</div>
            <div class="signature-name">${executedByName}</div>
            <div class="signature-label">
              ${tpl?.executed_by_label || 'Authorized Signatory'}
            </div>
          </div>
        </div>
      </div>

      <div class="ack-section">
        <div class="ack-header">
          <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b;">${tpl?.footer_content || 'Acknowledgment'}</div>
          <div style="font-size: 12px; font-weight: bold; color: #2563EB;">${tpl?.disclaimer_text || bp?.business_name || 'Memotrix'}</div>
        </div>

        <div class="ack-grid">
          <div>
            <span style="color: #2563EB; font-weight: bold;">Invoice To:</span><br/>
            <strong>${bill.customer_name}</strong>
          </div>
          <div>
            <span style="color: #2563EB; font-weight: bold;">Invoice Details:</span><br/>
            Invoice Date : ${bill.bill_date}<br/>
            Invoice Amount : &#8377; ${parseFloat(bill.grand_total).toFixed(2)}
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; justify-content: flex-end;">
            <div style="border-bottom: 1px dotted #94a3b8; width: 140px; margin-left: auto; margin-bottom: 3px;"></div>
            <span style="font-size: 9px; color: #64748b;">Receiver's Seal & Sign</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * POST /api/bills/:id/regenerate-pdf
 * Admin force PDF regeneration. Overwrites disk cache.
 */
router.post('/:id/regenerate-pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId || 'tenant-memotrix-01';
    const bill = await db.queryOne('SELECT * FROM bills WHERE (id = ? OR bill_number = ?) AND tenant_id = ?', [id, id, tenantId]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const items = await db.query('SELECT * FROM bill_items WHERE bill_id = ?', [bill.id]);
    const bp = await db.queryOne('SELECT * FROM business_profile WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const tpl = await db.queryOne('SELECT * FROM bill_template_settings WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const amountInWords = numberToWords(bill.grand_total);
    const upiString = bp?.upi_id ? buildUpiString({
      upiId: bp.upi_id,
      payeeName: bp.payee_name || bp.business_name || 'Memotrix',
      amount: bill.grand_total,
      currency: bp.currency || 'INR',
      note: bp.default_transaction_note || bill.bill_number
    }) : '';
    const upiQrDataUri = upiString ? await generateQrDataUri(upiString) : null;

    const htmlContent = buildInvoiceHtml(bill, items, bp, tpl, amountInWords, upiQrDataUri);
    const pdfBuf = await generateInvoicePdf(htmlContent);

    const targetFilePath = path.join(PDF_STORAGE_DIR, `${bill.bill_number}.pdf`);
    fs.writeFileSync(targetFilePath, pdfBuf);

    await db.query(
      `UPDATE bills SET pdf_path = ?, pdf_generated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [targetFilePath, bill.id]
    );

    await db.query(
      `INSERT INTO bill_audit_logs (id, tenant_id, bill_id, action, changes_json, admin_id)
       VALUES (?, ?, ?, 'pdf_regenerated', ?, ?)`,
      [`audit-${Date.now()}`, tenantId, bill.id, JSON.stringify({ pdf_path: targetFilePath }), req.user.id]
    );

    return res.json({ message: 'PDF regenerated successfully', pdf_path: targetFilePath });
  } catch (err) {
    console.error('[PDF] Regeneration error:', err);
    res.status(500).json({ error: 'Failed to regenerate PDF' });
  }
});

/**
 * GET /api/bills/:id/pdf
 * Serves cached PDF if available; generates and caches once if missing.
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId || 'tenant-memotrix-01';
    const bill = await db.queryOne('SELECT * FROM bills WHERE (id = ? OR bill_number = ?) AND tenant_id = ?', [id, id, tenantId]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    // 1. Check if cached PDF already exists on disk
    if (bill.pdf_path && fs.existsSync(bill.pdf_path)) {
      console.log(`[PDF CACHE HIT] Serving cached PDF for bill ${bill.bill_number} from ${bill.pdf_path}`);
      res.setHeader('Content-Type', 'application/pdf; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${bill.bill_number}.pdf"`);
      return res.sendFile(path.resolve(bill.pdf_path));
    }

    // 2. Generate PDF once and cache to disk
    console.log(`[PDF CACHE MISS] Generating fresh PDF for bill ${bill.bill_number}...`);
    const items = await db.query('SELECT * FROM bill_items WHERE bill_id = ?', [bill.id]);
    const bp = await db.queryOne('SELECT * FROM business_profile WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const tpl = await db.queryOne('SELECT * FROM bill_template_settings WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const amountInWords = numberToWords(bill.grand_total);
    const upiString = bp?.upi_id ? buildUpiString({
      upiId: bp.upi_id,
      payeeName: bp.payee_name || bp.business_name || 'Memotrix',
      amount: bill.grand_total,
      currency: bp.currency || 'INR',
      note: bp.default_transaction_note || bill.bill_number
    }) : '';
    const upiQrDataUri = upiString ? await generateQrDataUri(upiString) : null;

    const htmlContent = buildInvoiceHtml(bill, items, bp, tpl, amountInWords, upiQrDataUri);
    const pdfBuf = await generateInvoicePdf(htmlContent);

    const targetFilePath = path.join(PDF_STORAGE_DIR, `${bill.bill_number}.pdf`);
    fs.writeFileSync(targetFilePath, pdfBuf);

    await db.query(
      `UPDATE bills SET pdf_path = ?, pdf_generated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [targetFilePath, bill.id]
    );

    res.setHeader('Content-Type', 'application/pdf; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${bill.bill_number}.pdf"`);
    return res.send(pdfBuf);

  } catch (err) {
    console.error('[PDF] Export error:', err);
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
});

export default router;
