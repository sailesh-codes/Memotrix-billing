import express from 'express';
import db from '../db/db.js';
import { authenticate } from '../middleware/auth.js';
import { sendLowStockAlert } from '../services/emailService.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/inventory/logs
 */
router.get('/logs', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const logs = await db.query(
      `SELECT a.*, p.name as product_name, p.sku 
       FROM inventory_adjustments a
       JOIN products p ON a.product_id = p.id
       WHERE a.tenant_id = ?
       ORDER BY a.adjustment_date DESC, a.created_at DESC LIMIT 200`,
      [tenantId]
    );
    return res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inventory adjustment logs' });
  }
});

/**
 * POST /api/inventory/adjust
 */
router.post('/adjust', async (req, res) => {
  const tenantId = req.user.tenantId;
  const { product_id, change_qty, reason_code, notes, adjustment_date } = req.body;

  if (!product_id || change_qty === undefined || !reason_code) {
    return res.status(400).json({ error: 'product_id, change_qty, and reason_code are required.' });
  }

  try {
    const product = await db.queryOne('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [product_id, tenantId]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const newStock = Math.max(0, product.stock_quantity + parseInt(change_qty));
    await db.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, product_id]);

    const logId = `adj-${Date.now()}`;
    const adjDate = adjustment_date || new Date().toISOString();

    await db.query(
      `INSERT INTO inventory_adjustments (id, tenant_id, product_id, change_qty, reason_code, notes, adjustment_date, admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [logId, tenantId, product_id, parseInt(change_qty), reason_code, notes || '', adjDate, req.user.id]
    );

    if (newStock <= product.low_stock_threshold) {
      sendLowStockAlert({ ...product, stock_quantity: newStock });
    }

    return res.json({
      message: 'Inventory adjusted successfully',
      productId: product_id,
      oldStock: product.stock_quantity,
      newStock
    });
  } catch (err) {
    console.error('[INVENTORY] Adjust error:', err);
    res.status(500).json({ error: 'Failed to adjust inventory' });
  }
});

export default router;
