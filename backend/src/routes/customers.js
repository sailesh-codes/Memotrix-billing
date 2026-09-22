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
    const tenantId = req.user.tenantId || 'tenant-memotrix-01';
    const { search } = req.query;

    const customers = await db.query(
      'SELECT * FROM customers WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId]
    );

    const decrypted = customers.map(c => ({
      ...c,
      phone: decrypt(c.phone),
      email: decrypt(c.email),
      gstin: decrypt(c.gstin)
    }));

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const term = search.trim().toLowerCase();
      const filtered = decrypted.filter(c => {
        const nameMatch = c.name && c.name.toLowerCase().includes(term);
        const phoneMatch = c.phone && c.phone.toLowerCase().includes(term);
        const emailMatch = c.email && c.email.toLowerCase().includes(term);
        const addressMatch = c.address && c.address.toLowerCase().includes(term);
        const gstinMatch = c.gstin && c.gstin.toLowerCase().includes(term);
        return nameMatch || phoneMatch || emailMatch || addressMatch || gstinMatch;
      });
      return res.json({ customers: filtered });
    }

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
    const tenantId = req.user.tenantId || 'tenant-memotrix-01';
    const customer = await db.queryOne('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Fetch purchase history & rules
    const bills = await db.query('SELECT * FROM bills WHERE customer_id = ? AND tenant_id = ? ORDER BY created_at DESC', [customer.id, tenantId]);
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
  const tenantId = req.user.tenantId || 'tenant-memotrix-01';
  const { name, phone, email, address, state_code, gstin, customer_type, notes } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Customer Name is required.' });
  }

  const cleanName = name.trim();
  const cleanPhone = (phone || '').toString().trim();
  const cleanEmail = (email || '').toString().trim();
  const cleanAddress = (address || '').toString().trim();
  const cleanStateCode = (state_code || '33').toString().trim();
  const cleanGstin = (gstin || '').toString().trim();
  const cleanType = customer_type || 'retail';
  const cleanNotes = (notes || '').toString().trim();

  try {
    // If phone is provided, check if an existing customer has this phone number
    if (cleanPhone) {
      const existingCustomers = await db.query('SELECT * FROM customers WHERE tenant_id = ?', [tenantId]);
      const matched = existingCustomers.find(c => decrypt(c.phone) === cleanPhone);
      if (matched) {
        // Update details if newer values provided
        const updatedEmail = cleanEmail || decrypt(matched.email) || '';
        const updatedAddress = cleanAddress || matched.address || '';
        const updatedGstin = cleanGstin || decrypt(matched.gstin) || '';
        const updatedNotes = cleanNotes || matched.notes || '';

        await db.query(
          `UPDATE customers
           SET name = ?, email = ?, address = ?, gstin = ?, notes = ?
           WHERE id = ?`,
          [cleanName, encrypt(updatedEmail), updatedAddress, encrypt(updatedGstin), updatedNotes, matched.id]
        );

        const updated = await db.queryOne('SELECT * FROM customers WHERE id = ?', [matched.id]);
        updated.phone = cleanPhone;
        updated.email = updatedEmail;
        updated.gstin = updatedGstin;

        return res.status(200).json({
          message: 'Existing customer profile identified and updated',
          customer: updated
        });
      }
    }

    const id = `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const encPhone = encrypt(cleanPhone);
    const encEmail = encrypt(cleanEmail);
    const encGstin = encrypt(cleanGstin);

    await db.query(
      `INSERT INTO customers (id, tenant_id, name, phone, email, address, state_code, gstin, customer_type, notes, loyalty_points, total_spent, outstanding_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
      [id, tenantId, cleanName, encPhone, encEmail, cleanAddress, cleanStateCode, encGstin, cleanType, cleanNotes]
    );

    const created = await db.queryOne('SELECT * FROM customers WHERE id = ?', [id]);
    created.phone = cleanPhone;
    created.email = cleanEmail;
    created.gstin = cleanGstin;

    return res.status(201).json({ message: 'Customer created successfully', customer: created });
  } catch (err) {
    console.error('[CUSTOMERS] Create error:', err);
    res.status(500).json({ error: 'Failed to create customer profile' });
  }
});

/**
 * PUT /api/customers/:id
 */
router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId || 'tenant-memotrix-01';
  const { name, phone, email, address, state_code, gstin, customer_type, loyalty_points, notes } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Customer Name cannot be empty.' });
  }

  try {
    const existing = await db.queryOne('SELECT id FROM customers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (!existing) return res.status(404).json({ error: 'Customer not found' });

    const cleanPhone = (phone || '').toString().trim();
    const cleanEmail = (email || '').toString().trim();
    const cleanGstin = (gstin || '').toString().trim();

    const encPhone = encrypt(cleanPhone);
    const encEmail = encrypt(cleanEmail);
    const encGstin = encrypt(cleanGstin);

    await db.query(
      `UPDATE customers 
       SET name = ?, phone = ?, email = ?, address = ?, state_code = ?, gstin = ?, customer_type = ?, loyalty_points = ?, notes = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        name.trim(),
        encPhone,
        encEmail,
        (address || '').toString().trim(),
        state_code || '33',
        encGstin,
        customer_type || 'retail',
        parseInt(loyalty_points) || 0,
        (notes || '').toString().trim(),
        id,
        tenantId
      ]
    );

    const updated = await db.queryOne('SELECT * FROM customers WHERE id = ?', [id]);
    updated.phone = cleanPhone;
    updated.email = cleanEmail;
    updated.gstin = cleanGstin;

    return res.json({ message: 'Customer updated successfully', customer: updated });
  } catch (err) {
    console.error('[CUSTOMERS] Update error:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

/**
 * DELETE /api/customers/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId || 'tenant-memotrix-01';

  try {
    const existing = await db.queryOne('SELECT id, name FROM customers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (!existing) return res.status(404).json({ error: 'Customer profile not found' });

    // Detach customer ID from existing bills so invoice records remain intact
    await db.query('UPDATE bills SET customer_id = NULL WHERE customer_id = ? AND tenant_id = ?', [id, tenantId]);

    // Delete discount rules linked to this customer
    await db.query('DELETE FROM customer_discount_rules WHERE customer_id = ?', [id]).catch(() => {});

    // Delete customer
    await db.query('DELETE FROM customers WHERE id = ? AND tenant_id = ?', [id, tenantId]);

    return res.json({ message: `Customer profile for "${existing.name}" deleted successfully.` });
  } catch (err) {
    console.error('[CUSTOMERS] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete customer profile' });
  }
});

export default router;
