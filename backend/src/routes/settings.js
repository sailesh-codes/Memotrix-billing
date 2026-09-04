import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db/db.js';
import { authenticate } from '../middleware/auth.js';
import { buildUpiString, generateQrDataUri } from '../services/qrService.js';

const router = express.Router();
router.use(authenticate);

const FIXED_ADMIN_EMAIL = 'teammemotrix@gmail.com';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isVercel = !!process.env.VERCEL;
    const uploadDir = isVercel ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
      } catch (e) {}
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // Unlimited / High-Res Large File Support (up to 500MB)
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid image format. Only PNG, JPG, JPEG, SVG, and WebP are allowed.'));
  }
});

/**
 * GET /api/settings/business-profile
 */
router.get('/business-profile', async (req, res) => {
  try {
    const bp = await db.queryOne('SELECT * FROM business_profile LIMIT 1');
    const templateSettings = await db.queryOne('SELECT * FROM bill_template_settings LIMIT 1');
    const featureFlags = await db.queryOne('SELECT * FROM feature_flags LIMIT 1');

    if (bp) bp.email = FIXED_ADMIN_EMAIL;

    return res.json({
      businessProfile: bp,
      templateSettings,
      featureFlags: featureFlags || { barcode_enabled: false, loyalty_enabled: false }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * PUT /api/settings/business-profile
 */
router.put('/business-profile', async (req, res) => {
  const {
    business_name, tagline, phone, email, address, state_code, gstin, gst_enabled,
    upi_id, logo_url, logo_original_url, logo_zoom, logo_x, logo_y, website,
    payee_name, merchant_name, currency, default_transaction_note, show_qr_code, show_upi_text
  } = req.body;

  try {
    const bp = await db.queryOne('SELECT id FROM business_profile LIMIT 1');
    if (!bp) {
      await db.query(
        `INSERT INTO business_profile (
          id, tenant_id, business_name, tagline, phone, email, address, state_code, gstin,
          gst_enabled, upi_id, logo_url, logo_original_url, logo_zoom, logo_x, logo_y, website,
          payee_name, merchant_name, currency, default_transaction_note, show_qr_code, show_upi_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'bp-001', 'tenant-memotrix-01', business_name, tagline, phone, email || 'teammemotrix@gmail.com',
          address, state_code, gstin, gst_enabled ? true : false, upi_id, logo_url, logo_original_url || logo_url,
          logo_zoom || 1.0, logo_x || 0.0, logo_y || 0.0, website || '', payee_name || business_name,
          merchant_name || '', currency || 'INR', default_transaction_note || '', show_qr_code !== false, show_upi_text !== false
        ]
      );
    } else {
      await db.query(
        `UPDATE business_profile 
         SET business_name = ?, tagline = ?, phone = ?, email = ?, address = ?, state_code = ?, gstin = ?,
             gst_enabled = ?, upi_id = ?, logo_url = ?, logo_original_url = ?, logo_zoom = ?, logo_x = ?, logo_y = ?,
             website = ?, payee_name = ?, merchant_name = ?, currency = ?, default_transaction_note = ?,
             show_qr_code = ?, show_upi_text = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          business_name, tagline, phone, email || 'teammemotrix@gmail.com', address, state_code, gstin,
          gst_enabled ? true : false, upi_id, logo_url, logo_original_url || logo_url, logo_zoom || 1.0,
          logo_x || 0.0, logo_y || 0.0, website || '', payee_name || business_name, merchant_name || '',
          currency || 'INR', default_transaction_note || '', show_qr_code !== false, show_upi_text !== false, bp.id
        ]
      );
    }

    return res.json({ message: 'Business profile updated successfully' });
  } catch (err) {
    console.error('[SETTINGS] Update business profile error:', err);
    res.status(500).json({ error: 'Failed to update business profile' });
  }
});

/**
 * PUT /api/settings/payment-profile
 */
router.put('/payment-profile', async (req, res) => {
  const { upi_id, payee_name, merchant_name, currency, default_transaction_note, show_qr_code, show_upi_text } = req.body;

  if (!upi_id || typeof upi_id !== 'string' || upi_id.trim().length === 0) {
    return res.status(400).json({ error: 'UPI Payee ID cannot be empty.' });
  }

  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  if (!upiRegex.test(upi_id.trim())) {
    return res.status(400).json({ error: 'Invalid UPI Payee ID format. Expected format: username@bank' });
  }

  try {
    const bp = await db.queryOne('SELECT id FROM business_profile LIMIT 1');
    if (!bp) {
      await db.query(
        `INSERT INTO business_profile (id, tenant_id, business_name, phone, address, upi_id, payee_name, merchant_name, currency, default_transaction_note, show_qr_code, show_upi_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['bp-001', 'tenant-memotrix-01', 'Memotrix', '6384241882', 'Memotrix Studio', upi_id.trim(), payee_name || 'Memotrix', merchant_name || '', currency || 'INR', default_transaction_note || '', show_qr_code !== false, show_upi_text !== false]
      );
    } else {
      await db.query(
        `UPDATE business_profile
         SET upi_id = ?, payee_name = ?, merchant_name = ?, currency = ?, default_transaction_note = ?, show_qr_code = ?, show_upi_text = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [upi_id.trim(), payee_name || '', merchant_name || '', currency || 'INR', default_transaction_note || '', show_qr_code !== false, show_upi_text !== false, bp.id]
      );
    }

    return res.json({ message: 'Payment settings updated successfully' });
  } catch (err) {
    console.error('[SETTINGS] Update payment profile error:', err);
    res.status(500).json({ error: 'Failed to update payment settings' });
  }
});

/**
 * GET /api/settings/qr-preview
 */
router.get('/qr-preview', async (req, res) => {
  const { upi_id, payee_name, amount, currency, note } = req.query;
  if (!upi_id) return res.status(400).json({ error: 'UPI ID is required' });

  try {
    const upiString = buildUpiString({
      upiId: upi_id,
      payeeName: payee_name || 'Memotrix',
      amount: amount || 1.00,
      currency: currency || 'INR',
      note: note || 'SAMPLE-1001'
    });

    const qrDataUri = await generateQrDataUri(upiString);
    return res.json({ upiString, qrDataUri });
  } catch (err) {
    console.error('[SETTINGS] QR preview error:', err);
    res.status(500).json({ error: 'Failed to generate QR preview' });
  }
});

/**
 * PUT /api/settings/bill-template
 */
router.put('/bill-template', async (req, res) => {
  const { terms_and_conditions, executed_by_label, executed_by_value, footer_content, disclaimer_text } = req.body;

  try {
    const existing = await db.queryOne('SELECT id FROM bill_template_settings LIMIT 1');
    if (!existing) {
      await db.query(
        `INSERT INTO bill_template_settings (id, tenant_id, terms_and_conditions, executed_by_label, executed_by_value, footer_content, disclaimer_text)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['tpl-001', 'tenant-memotrix-01', terms_and_conditions, executed_by_label, executed_by_value, footer_content, disclaimer_text]
      );
    } else {
      await db.query(
        `UPDATE bill_template_settings
         SET terms_and_conditions = ?, executed_by_label = ?, executed_by_value = ?, footer_content = ?, disclaimer_text = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [terms_and_conditions, executed_by_label, executed_by_value, footer_content, disclaimer_text, existing.id]
      );
    }

    return res.json({ message: 'Bill template settings saved successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update bill template settings' });
  }
});

/**
 * PUT /api/settings/feature-flags
 */
router.put('/feature-flags', async (req, res) => {
  const { barcode_enabled, loyalty_enabled } = req.body;

  try {
    const existing = await db.queryOne('SELECT id FROM feature_flags LIMIT 1');
    if (!existing) {
      await db.query(
        `INSERT INTO feature_flags (id, tenant_id, barcode_enabled, loyalty_enabled)
         VALUES (?, ?, ?, ?)`,
        ['ff-001', 'tenant-memotrix-01', barcode_enabled ? true : false, loyalty_enabled ? true : false]
      );
    } else {
      await db.query(
        `UPDATE feature_flags
         SET barcode_enabled = ?, loyalty_enabled = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [barcode_enabled ? true : false, loyalty_enabled ? true : false, existing.id]
      );
    }

    return res.json({ message: 'Feature toggles updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update feature toggles' });
  }
});



/**
 * POST /api/settings/upload-logo & POST /api/settings/logo
 * Lossless storage of original high-resolution logo (PNG, JPG, SVG, WebP up to 20MB)
 */
const handleLogoUpload = (req, res) => {
  upload.single('logo')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Failed to upload logo' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No logo file provided. Please select a valid image file.' });
    }

    try {
      const timestamp = Date.now();
      const logoUrl = `/uploads/${req.file.filename}?v=${timestamp}`;
      await db.query('UPDATE business_profile SET logo_url = ?, logo_original_url = ?', [logoUrl, logoUrl]);
      
      // Invalidate PDF cache on disk & DB
      const pdfStorageDir = path.join(process.cwd(), 'storage', 'pdfs');
      if (fs.existsSync(pdfStorageDir)) {
        const pdfFiles = fs.readdirSync(pdfStorageDir);
        for (const f of pdfFiles) {
          if (f.endsWith('.pdf')) {
            try { fs.unlinkSync(path.join(pdfStorageDir, f)); } catch (e) {}
          }
        }
      }
      await db.query('UPDATE bills SET pdf_path = NULL, pdf_generated_at = NULL');

      return res.json({ success: true, message: 'Logo Updated Successfully.', logoUrl, logoOriginalUrl: logoUrl });
    } catch (dbErr) {
      return res.status(500).json({ success: false, error: 'Failed to save logo in database. Please try again.' });
    }
  });
};

router.post('/upload-logo', handleLogoUpload);
router.post('/logo', handleLogoUpload);

/**
 * GET /api/settings/export-data
 * Alias handler redirecting format=json/csv to /api/reports/export/:format
 */
router.get('/export-data', async (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();
  const month = req.query.month || '';
  if (format === 'csv') {
    return res.redirect(`/api/reports/export/csv${month ? '?month=' + month : ''}`);
  }
  return res.redirect(`/api/reports/export/json${month ? '?month=' + month : ''}`);
});

export default router;
