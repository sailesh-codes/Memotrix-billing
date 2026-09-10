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
  let targetPath = null;

  if (logoUrl && typeof logoUrl === 'string' && logoUrl.trim().length > 0) {
    const rawUrl = logoUrl.trim().split('?')[0];
    if (rawUrl.startsWith('data:image/')) {
      return rawUrl;
    }

    const cleanRelative = rawUrl.replace(/^\//, '');
    const candidatePaths = [
      path.join(process.cwd(), 'public', cleanRelative),
      path.join(process.cwd(), cleanRelative),
      path.join(process.cwd(), 'assets', cleanRelative),
      path.join(process.cwd(), '..', 'frontend', 'public', cleanRelative),
      path.resolve(cleanRelative)
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        targetPath = p;
        break;
      }
    }
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    const fallbackPaths = [
      path.join(process.cwd(), 'public', 'logo-default.png'),
      path.join(process.cwd(), 'assets', 'logo-default.png'),
      path.join(process.cwd(), '..', 'frontend', 'public', 'logo-default.png'),
      path.join(process.cwd(), 'logo-default.png')
    ];
    for (const p of fallbackPaths) {
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
  const executedByName = bill.executed_by || tpl?.executed_by_value || 'Authorized Signatory';
  const logoDataUri = getLogoBase64DataUri(bp?.logo_original_url || bp?.logo_url);

  let pdfTitle = 'TAX INVOICE';
  if (bill.invoice_type === 'receipt') pdfTitle = 'CASH RECEIPT';
  if (bill.invoice_type === 'estimate') pdfTitle = 'ESTIMATE / PROFORMA';
  if (bill.invoice_type === 'quotation') pdfTitle = 'COMMERCIAL QUOTATION';

  const itemsHtml = items.map((item, idx) => {
    const qty = parseInt(item.quantity) || 1;
    const unitPrice = parseFloat(item.unit_price || 0);
    const discAmt = parseFloat(item.discount_amount || 0);
    const discPct = item.discount_percent ? parseFloat(item.discount_percent) : (unitPrice * qty > 0 ? (discAmt / (unitPrice * qty)) * 100 : 0);
    const lineTotal = parseFloat(item.line_total || 0);

    const discDisplay = discAmt > 0
      ? `₹ ${discAmt.toFixed(2)}<span style="display:block;font-size:8.5px;color:#6b7280;">(${discPct.toFixed(1)}%)</span>`
      : '₹ 0.00';

    return `
      <tr style="border-bottom: 1px solid #e5e7eb; ${idx % 2 === 1 ? 'background-color: #f9fafb;' : 'background-color: #ffffff;'}">
        <td style="padding: 7px 6px; text-align: center; color: #4b5563; font-size: 10.5px;">${idx + 1}</td>
        <td style="padding: 7px 6px; font-weight: 700; color: #111827; font-size: 10.5px;">${item.item_name}</td>
        <td style="padding: 7px 6px; color: #4b5563; font-size: 10.5px;">${item.hsn_sac || ''}</td>
        <td style="padding: 7px 6px; text-align: center; font-weight: 700; color: #111827; font-size: 10.5px;">${qty}</td>
        <td style="padding: 7px 6px; text-align: right; color: #111827; font-size: 10.5px;">₹ ${unitPrice.toFixed(2)}</td>
        <td style="padding: 7px 6px; text-align: right; color: #374151; font-size: 10.5px;">${discDisplay}</td>
        <td style="padding: 7px 6px; text-align: right; font-weight: 700; color: #111827; font-size: 10.5px;">₹ ${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${pdfTitle} - ${bill.bill_number}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .invoice-container {
      width: 100%;
      background: #ffffff;
      padding: 0;
      font-size: 10.5px;
      line-height: 1.4;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .business-name {
      font-size: 24px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.025em;
      margin: 0;
      line-height: 1.1;
    }
    .business-sub {
      font-size: 11px;
      color: #475569;
      margin: 2px 0 0 0;
    }
    .logo-box {
      max-width: 160px;
      max-height: 80px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }
    .logo-img {
      max-height: 75px;
      max-width: 150px;
      width: auto;
      height: auto;
      object-fit: contain;
    }
    .title-banner {
      border-top: 2px solid #2563EB;
      border-bottom: 2px solid #2563EB;
      padding: 4px 0;
      margin: 10px 0 8px 0;
      text-align: center;
    }
    .title-text {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #2563EB;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 6px 0 8px 0;
      font-size: 11px;
    }
    .info-label {
      font-weight: 700;
      color: #000000;
      display: block;
      margin-bottom: 2px;
      font-size: 11px;
    }
    .customer-name {
      font-weight: 600;
      color: #111827;
      margin: 0;
      font-size: 11px;
    }
    .customer-sub {
      color: #6b7280;
      margin: 1px 0 0 0;
      font-size: 10px;
    }
    .customer-email {
      color: #1d4ed8;
      margin: 1px 0 0 0;
      font-size: 10.5px;
      font-weight: 500;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin: 6px 0 8px 0;
    }
    .items-table th {
      background-color: #2563EB;
      color: #ffffff;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.025em;
      padding: 7px 6px;
    }
    .items-table tfoot tr {
      border-top: 2px solid #111827;
      border-bottom: 1px solid #111827;
      background-color: #ffffff;
      font-weight: 700;
    }
    .items-table tfoot td {
      padding: 7px 6px;
      font-size: 10.5px;
    }
    .middle-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 8px 0 10px 0;
      gap: 20px;
    }
    .middle-left {
      width: 55%;
    }
    .middle-right {
      width: 42%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .section-heading {
      font-weight: 700;
      color: #000000;
      font-size: 10px;
      text-transform: uppercase;
      margin: 0 0 3px 0;
    }
    .words-text {
      font-size: 10.5px;
      color: #1f2937;
      font-weight: 500;
      margin: 0 0 8px 0;
    }
    .terms-text {
      font-size: 9px;
      color: #374151;
      line-height: 1.35;
      white-space: pre-line;
      margin: 0 0 8px 0;
    }
    .qr-card {
      display: inline-block;
      padding: 7px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #ffffff;
      text-align: center;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .qr-img {
      width: 68px;
      height: 68px;
      display: block;
      margin: 0 auto;
    }
    .qr-title {
      margin-top: 4px;
      font-size: 9.5px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.025em;
    }
    .qr-upi {
      font-size: 8px;
      color: #475569;
      font-family: monospace;
      margin-top: 2px;
      max-width: 110px;
      word-break: break-all;
      line-height: 1.2;
    }
    .summary-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px 10px;
      background-color: #f9fafb;
      font-size: 10px;
    }
    .summary-item {
      display: flex;
      justify-content: space-between;
      color: #374151;
      margin-bottom: 4px;
    }
    .summary-total-pill {
      display: flex;
      justify-content: space-between;
      background-color: #2563EB;
      color: #ffffff;
      font-weight: 700;
      padding: 5px 8px;
      border-radius: 4px;
      margin: 5px 0;
      font-size: 11px;
    }
    .signature-container {
      text-align: right;
      margin-top: 16px;
    }
    .signature-for {
      font-size: 10px;
      color: #6b7280;
      margin: 0;
    }
    .signature-person {
      font-weight: 800;
      font-size: 13px;
      color: #0f172a;
      margin: 6px 0 3px 0;
      border-bottom: 2px solid #0f172a;
      display: inline-block;
      padding-bottom: 1px;
    }
    .signature-title {
      font-size: 8.5px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0;
    }
    .acknowledgment-box {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px dashed #9ca3af;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .ack-center {
      text-align: center;
      margin-bottom: 4px;
    }
    .ack-title {
      font-size: 10px;
      font-weight: 700;
      color: #374151;
      text-transform: uppercase;
      display: block;
    }
    .ack-brand {
      font-size: 12px;
      font-weight: 700;
      color: #2563EB;
      margin: 2px 0 0 0;
    }
    .ack-columns {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 10px;
      margin-top: 3px;
    }
    .ack-tag {
      color: #0B8A3E;
      font-weight: 600;
      font-size: 9px;
      display: block;
      margin-bottom: 2px;
    }
    .ack-sign-line {
      border-bottom: 1px dotted #9ca3af;
      width: 120px;
      margin-left: auto;
      margin-bottom: 3px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- 1. Header Row -->
    <div class="header-row">
      <div>
        <h1 class="business-name">${bp?.business_name || 'Memotrix'}</h1>
        ${bp?.address ? `<p class="business-sub">${bp.address}</p>` : ''}
        <p class="business-sub">Phone: ${bp?.phone || '6384241882'} | Email: ${bp?.email || 'teammemotrix@gmail.com'}</p>
        ${bp?.gstin ? `<p class="business-sub">GSTIN: ${bp.gstin}</p>` : ''}
        ${bp?.website ? `<p class="business-sub">Website: ${bp.website}</p>` : ''}
      </div>
      <div class="logo-box">
        <img src="${logoDataUri}" class="logo-img" alt="Business Logo" />
      </div>
    </div>

    <!-- 2. Title Bar -->
    <div class="title-banner">
      <h2 class="title-text">${pdfTitle}</h2>
    </div>

    <!-- 3. Bill To / Invoice Details Row -->
    <div class="info-row">
      <div>
        <span class="info-label">Bill To</span>
        <p class="customer-name">${bill.customer_name}</p>
        ${bill.customer_phone ? `<p class="customer-sub">${bill.customer_phone}</p>` : ''}
        ${bill.customer_email ? `<p class="customer-email">${bill.customer_email}</p>` : ''}
      </div>
      <div style="text-align: right;">
        <span class="info-label">Invoice Details</span>
        <p class="customer-name">Date: ${bill.bill_date}</p>
        ${bill.due_date ? `<p style="color: #b45309; font-size: 10px; font-weight: 500; margin: 1px 0 0 0;">Due Date: ${bill.due_date}</p>` : ''}
      </div>
    </div>

    <!-- 4. Line Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="text-align: center; width: 30px;">#</th>
          <th style="text-align: left;">ITEM NAME</th>
          <th style="text-align: left; width: 85px;">HSN/ SAC</th>
          <th style="text-align: center; width: 70px;">QUANTITY</th>
          <th style="text-align: right; width: 90px;">PRICE/ UNIT</th>
          <th style="text-align: right; width: 95px;">DISCOUNT</th>
          <th style="text-align: right; width: 95px;">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align: left;">Total</td>
          <td style="text-align: center;">${totalQty}</td>
          <td></td>
          <td style="text-align: right;">₹ ${parseFloat(bill.discount_total || 0).toFixed(2)}</td>
          <td style="text-align: right; color: #2563EB; font-weight: 800;">₹ ${parseFloat(bill.grand_total).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- 5. Middle Section (Words, Terms, QR & Summary, Sign) -->
    <div class="middle-section">
      <!-- Left Column -->
      <div class="middle-left">
        <div>
          <h4 class="section-heading">INVOICE AMOUNT IN WORDS</h4>
          <p class="words-text">${amountInWords}</p>
        </div>

        <div>
          <h4 class="section-heading">TERMS AND CONDITIONS</h4>
          <div class="terms-text">${tpl?.terms_and_conditions || 'Standard Terms'}</div>
        </div>

        ${(upiQrDataUri && bp?.show_qr_code !== false) ? `
          <div style="padding-top: 4px;">
            <div class="qr-card">
              <img src="${upiQrDataUri}" class="qr-img" alt="UPI QR Code" />
              <div class="qr-title">Scan & Pay</div>
              ${(bp?.show_upi_text !== false && bp?.upi_id) ? `
                <div class="qr-upi">
                  UPI ID: ${bp.upi_id}
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Right Column -->
      <div class="middle-right">
        <div class="summary-card">
          <div class="summary-item">
            <span>Sub Total</span>
            <span style="font-weight: 500;">₹ ${parseFloat(bill.subtotal).toFixed(2)}</span>
          </div>
          <div class="summary-item">
            <span>Discount</span>
            <span style="font-weight: 500;">₹ ${parseFloat(bill.discount_total || 0).toFixed(2)}</span>
          </div>
          <div class="summary-total-pill">
            <span>Total</span>
            <span>₹ ${parseFloat(bill.grand_total).toFixed(2)}</span>
          </div>
          <div class="summary-item" style="padding-top: 2px;">
            <span>Received</span>
            <span style="font-weight: 500;">₹ ${parseFloat(bill.received_amount || 0).toFixed(2)}</span>
          </div>
          <div class="summary-item">
            <span>Balance</span>
            <span style="font-weight: 500;">₹ ${parseFloat(bill.balance_amount || 0).toFixed(2)}</span>
          </div>
          <div class="summary-item">
            <span>You Saved</span>
            <span style="font-weight: 500;">₹ ${parseFloat(bill.discount_total || 0).toFixed(2)}</span>
          </div>
        </div>

        <div class="signature-container">
          <p class="signature-for">For: ${bp?.business_name || 'Memotrix'}</p>
          <div class="signature-person">${executedByName}</div><br/>
          <span class="signature-title">${tpl?.executed_by_label || 'AUTHORIZED SIGNATORY'}</span>
        </div>
      </div>
    </div>

    <!-- 6. Acknowledgment Section -->
    <div class="acknowledgment-box">
      <div class="ack-center">
        <span class="ack-title">${tpl?.footer_content || 'ACKNOWLEDGMENT'}</span>
        <h3 class="ack-brand">${tpl?.disclaimer_text || bp?.business_name || 'Memotrix'}</h3>
      </div>

      <div class="ack-columns">
        <div>
          <span class="ack-tag">Invoice To:</span>
          <p style="margin: 0; font-weight: 700; color: #111827; font-size: 10.5px;">${bill.customer_name}</p>
        </div>
        <div>
          <span class="ack-tag">Invoice Details:</span>
          <p style="margin: 0; color: #111827; font-size: 10px;">Invoice Date : ${bill.bill_date}</p>
          <p style="margin: 2px 0 0 0; color: #111827; font-size: 10px;">Invoice Amount : ₹ ${parseFloat(bill.grand_total).toFixed(2)}</p>
        </div>
        <div style="text-align: right;">
          <div class="ack-sign-line"></div>
          <span style="font-size: 9px; color: #4b5563; font-weight: 500;">Receiver's Seal & Sign</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
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
