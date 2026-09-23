import express from 'express';
import bwipjs from 'bwip-js';
import db from '../db/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/products
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, search, activeOnly } = req.query;
    let sql = `
      SELECT p.*, c.name as category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (activeOnly === 'true') {
      sql += ` AND p.is_active = true`;
    }
    if (category) {
      sql += ` AND p.category_id = ?`;
      params.push(category);
    }
    if (search) {
      sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY p.created_at DESC`;
    const products = await db.query(sql, params);
    
    // Parse image_urls JSON
    const formatted = products.map(p => ({
      ...p,
      image_urls: typeof p.image_urls === 'string' ? JSON.parse(p.image_urls || '[]') : (p.image_urls || [])
    }));

    return res.json({ products: formatted });
  } catch (err) {
    console.error('[PRODUCTS] Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/scan/:sku
 * Fast scan-to-lookup for POS billing
 */
router.get('/scan/:sku', authenticate, async (req, res) => {
  try {
    const { sku } = req.params;
    const product = await db.queryOne(
      `SELECT p.*, c.name as category_name 
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE (p.sku = ? OR p.id = ?) AND p.is_active = true`,
      [sku, sku]
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found for scanned SKU/barcode' });
    }

    product.image_urls = typeof product.image_urls === 'string' ? JSON.parse(product.image_urls || '[]') : (product.image_urls || []);
    return res.json({ product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to scan product' });
  }
});

/**
 * POST /api/products
 */
router.post('/', authenticate, async (req, res) => {
  const tenantId = req.user?.tenantId || 'tenant-memotrix-01';
  let { sku, name, description, category, category_id, hsn_sac, cost_price, retail_price, wholesale_price, corporate_price, stock_quantity, low_stock_threshold, image_urls } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Product Name is required.' });
  }

  const cleanName = name.trim();
  const cleanPrice = parseFloat(retail_price);
  if (isNaN(cleanPrice) || cleanPrice < 0) {
    return res.status(400).json({ error: 'A valid Selling Price is required.' });
  }

  // Auto-generate SKU if omitted or blank
  if (!sku || typeof sku !== 'string' || !sku.trim()) {
    const prefix = cleanName.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase() || 'ITEM';
    sku = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  } else {
    sku = sku.trim().toUpperCase();
  }

  try {
    const existing = await db.queryOne('SELECT id, name FROM products WHERE (sku = ? OR (LOWER(name) = LOWER(?) AND tenant_id = ?))', [sku, cleanName, tenantId]);
    if (existing) {
      if (existing.name.toLowerCase() !== cleanName.toLowerCase()) {
        sku = `${sku}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      } else {
        await db.query(
          `UPDATE products 
           SET retail_price = ?, stock_quantity = stock_quantity + ?, is_active = true
           WHERE id = ?`,
          [cleanPrice, parseInt(stock_quantity) || 0, existing.id]
        );
        const updated = await db.queryOne('SELECT * FROM products WHERE id = ?', [existing.id]);
        return res.status(200).json({ message: 'Existing product updated successfully', product: updated });
      }
    }

    const cleanCategory = (category || '').trim() || 'General';
    let effectiveCategoryId = category_id || null;

    if (!effectiveCategoryId && cleanCategory) {
      const existingCat = await db.queryOne('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND tenant_id = ?', [cleanCategory, tenantId]);
      if (existingCat) {
        effectiveCategoryId = existingCat.id;
      } else {
        const newCatId = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        await db.query(
          `INSERT INTO categories (id, tenant_id, name, description) VALUES (?, ?, ?, ?)`,
          [newCatId, tenantId, cleanCategory, '']
        ).catch(() => {});
        effectiveCategoryId = newCatId;
      }
    }

    const id = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const imagesJson = JSON.stringify(image_urls || []);

    await db.query(
      `INSERT INTO products (id, tenant_id, sku, name, description, category, category_id, hsn_sac, cost_price, retail_price, wholesale_price, corporate_price, stock_quantity, low_stock_threshold, image_urls, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
      [id, tenantId, sku, cleanName, description || '', cleanCategory, effectiveCategoryId, hsn_sac || '', parseFloat(cost_price || 0), cleanPrice, parseFloat(wholesale_price || cleanPrice), parseFloat(corporate_price || cleanPrice), parseInt(stock_quantity) || 10, parseInt(lowStock_threshold || 5), imagesJson]
    );

    const created = await db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
    return res.status(201).json({ message: 'Product created successfully and stored in catalog', product: created });
  } catch (err) {
    console.error('[PRODUCTS] Create error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

/**
 * PUT /api/products/:id
 */
router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { sku, name, description, category, category_id, hsn_sac, cost_price, retail_price, wholesale_price, corporate_price, stock_quantity, low_stock_threshold, image_urls, is_active } = req.body;

  try {
    const existing = await db.queryOne('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const cleanCategory = (category || '').trim() || 'General';
    const imagesJson = JSON.stringify(image_urls || []);

    await db.query(
      `UPDATE products 
       SET sku = ?, name = ?, description = ?, category = ?, category_id = ?, hsn_sac = ?, cost_price = ?, retail_price = ?, wholesale_price = ?, corporate_price = ?, stock_quantity = ?, low_stock_threshold = ?, image_urls = ?, is_active = ?
       WHERE id = ?`,
      [sku, name, description, cleanCategory, category_id || null, hsn_sac, cost_price, retail_price, wholesale_price, corporate_price, stock_quantity, low_stock_threshold, imagesJson, is_active !== undefined ? is_active : true, id]
    );

    const updated = await db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
    return res.json({ message: 'Product updated successfully', product: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

/**
 * GET /api/products/:id/barcode
 * Generates barcode PNG image buffer using bwip-js
 */
router.get('/:id/barcode', authenticate, async (req, res) => {
  try {
    const product = await db.queryOne('SELECT sku, name FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: product.sku,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: 'center'
    });

    res.type('png');
    return res.send(png);
  } catch (err) {
    console.error('[BARCODE] Generation error:', err);
    res.status(500).json({ error: 'Failed to generate barcode image' });
  }
});

export default router;
