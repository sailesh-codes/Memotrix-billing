import express from 'express';
import db from '../db/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/coupons
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const coupons = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
    return res.json({ coupons });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

/**
 * POST /api/coupons/validate
 */
router.post('/validate', authenticate, async (req, res) => {
  const { code, orderAmount } = req.body;
  if (!code) return res.status(400).json({ error: 'Coupon code is required.' });

  try {
    const coupon = await db.queryOne('SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) AND is_active = true', [code]);
    if (!coupon) {
      return res.status(404).json({ error: 'Invalid or inactive coupon code.' });
    }

    if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
      return res.status(400).json({ error: 'Coupon usage limit has been reached.' });
    }

    if (orderAmount && parseFloat(orderAmount) < coupon.min_order_amount) {
      return res.status(400).json({ error: `Minimum order amount of ₹${coupon.min_order_amount} required for this coupon.` });
    }

    return res.json({ message: 'Coupon applied successfully', coupon });
  } catch (err) {
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

/**
 * POST /api/coupons
 */
router.post('/', authenticate, async (req, res) => {
  const { code, discount_type, value, min_order_amount, usage_limit } = req.body;
  if (!code || !discount_type || !value) {
    return res.status(400).json({ error: 'Code, discount_type, and value are required.' });
  }

  try {
    const id = `coup-${Date.now()}`;
    await db.query(
      `INSERT INTO coupons (id, code, discount_type, value, min_order_amount, usage_limit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, code.toUpperCase(), discount_type, value, min_order_amount || 0, usage_limit || 100]
    );

    const created = await db.queryOne('SELECT * FROM coupons WHERE id = ?', [id]);
    return res.status(201).json({ message: 'Coupon created successfully', coupon: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

export default router;
