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
  const { sku, name, description, category_id, hsn_sac, cost_price, retail_price, wholesale_price, corporate_price, stock_quantity, low_stock_threshold, image_urls } = req.body;

  if (!sku || !name || !retail_price) {
    return res.status(400).json({ error: 'SKU, Product Name, and Retail Price are required.' });
  }

  try {
    const existing = await db.queryOne('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existing) {
      return res.status(400).json({ error: `Product with SKU '${sku}' already exists.` });
    }

    const id = `prod-${Date.now()}`;
    const imagesJson = JSON.stringify(image_urls || []);

    await db.query(
      `INSERT INTO products (id, sku, name, description, category_id, hsn_sac, cost_price, retail_price, wholesale_price, corporate_price, stock_quantity, low_stock_threshold, image_urls, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
      [id, sku, name, description || '', category_id || null, hsn_sac || '', cost_price || 0, retail_price, wholesale_price || retail_price, corporate_price || retail_price, stock_quantity || 0, low_stock_threshold || 5, imagesJson]
    );

    const created = await db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
    return res.status(201).json({ message: 'Product created successfully', product: created });
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
  const { sku, name, description, category_id, hsn_sac, cost_price, retail_price, wholesale_price, corporate_price, stock_quantity, low_stock_threshold, image_urls, is_active } = req.body;

  try {
    const existing = await db.queryOne('SELECT id FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const imagesJson = JSON.stringify(image_urls || []);

    await db.query(
      `UPDATE products 
       SET sku = ?, name = ?, description = ?, category_id = ?, hsn_sac = ?, cost_price = ?, retail_price = ?, wholesale_price = ?, corporate_price = ?, stock_quantity = ?, low_stock_threshold = ?, image_urls = ?, is_active = ?
       WHERE id = ?`,
      [sku, name, description, category_id, hsn_sac, cost_price, retail_price, wholesale_price, corporate_price, stock_quantity, low_stock_threshold, imagesJson, is_active !== undefined ? is_active : true, id]
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
