import express from 'express';
import db from '../db/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/discount-rules
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const rules = await db.query(
      `SELECT r.*, c.name as customer_name 
       FROM customer_discount_rules r
       JOIN customers c ON r.customer_id = c.id
       ORDER BY r.created_at DESC`
    );
    return res.json({ rules });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer discount rules' });
  }
});

/**
 * POST /api/discount-rules
 */
router.post('/', authenticate, async (req, res) => {
  const { customer_id, discount_type, value, applies_to, category_id } = req.body;
  if (!customer_id || !discount_type || !value) {
    return res.status(400).json({ error: 'customer_id, discount_type, and value are required.' });
  }

  try {
    const id = `rule-${Date.now()}`;
    await db.query(
      `INSERT INTO customer_discount_rules (id, customer_id, discount_type, value, applies_to, category_id, created_by_admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, customer_id, discount_type, value, applies_to || 'all', category_id || null, req.user.id]
    );

    const created = await db.queryOne('SELECT * FROM customer_discount_rules WHERE id = ?', [id]);
    return res.status(201).json({ message: 'Customer discount rule created', rule: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create discount rule' });
  }
});

export default router;
