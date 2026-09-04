import express from 'express';
import db from '../db/db.js';
import { authenticate } from '../middleware/auth.js';
import { encrypt, decrypt } from '../services/cryptoService.js';

const router = express.Router();

/**
 * GET /api/customers
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT * FROM customers WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ` AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY created_at DESC`;
    const customers = await db.query(sql, params);

    const decrypted = customers.map(c => ({
      ...c,
      phone: decrypt(c.phone),
      email: decrypt(c.email),
      gstin: decrypt(c.gstin)
    }));

    return res.json({ customers: decrypted });
  } catch (err) {
    console.error('[CUSTOMERS] Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

/**
 * GET /api/customers/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const customer = await db.queryOne('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Fetch purchase history & rules
    const bills = await db.query('SELECT * FROM bills WHERE customer_id = ? ORDER BY created_at DESC', [customer.id]);
    const discountRules = await db.query('SELECT * FROM customer_discount_rules WHERE customer_id = ?', [customer.id]);

    customer.phone = decrypt(customer.phone);
    customer.email = decrypt(customer.email);
    customer.gstin = decrypt(customer.gstin);

    return res.json({ customer, bills, discountRules });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer profile' });
  }
});

/**
 * POST /api/customers
 */
router.post('/', authenticate, async (req, res) => {
  const { name, phone, email, address, state_code, gstin, customer_type } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Customer Name and Phone are required.' });
  }

  try {
    const id = `cust-${Date.now()}`;
    const encPhone = encrypt(phone);
    const encEmail = encrypt(email || '');
    const encGstin = encrypt(gstin || '');

    await db.query(
      `INSERT INTO customers (id, name, phone, email, address, state_code, gstin, customer_type, loyalty_points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, name, encPhone, encEmail, address || '', state_code || '33', encGstin, customer_type || 'retail']
    );

    const created = await db.queryOne('SELECT * FROM customers WHERE id = ?', [id]);
    created.phone = phone;
    created.email = email;
    created.gstin = gstin;

    return res.status(201).json({ message: 'Customer created successfully', customer: created });
  } catch (err) {
    console.error('[CUSTOMERS] Create error:', err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

/**
 * PUT /api/customers/:id
 */
router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address, state_code, gstin, customer_type, loyalty_points } = req.body;

  try {
    const existing = await db.queryOne('SELECT id FROM customers WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const encPhone = encrypt(phone);
    const encEmail = encrypt(email || '');
    const encGstin = encrypt(gstin || '');

    await db.query(
      `UPDATE customers 
       SET name = ?, phone = ?, email = ?, address = ?, state_code = ?, gstin = ?, customer_type = ?, loyalty_points = ?
       WHERE id = ?`,
      [name, encPhone, encEmail, address, state_code || '33', encGstin, customer_type || 'retail', loyalty_points || 0, id]
    );

    const updated = await db.queryOne('SELECT * FROM customers WHERE id = ?', [id]);
    updated.phone = phone;
    updated.email = email;
    updated.gstin = gstin;

    return res.json({ message: 'Customer updated successfully', customer: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

export default router;
