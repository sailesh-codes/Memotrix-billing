import cron from 'node-cron';
import db from '../db/db.js';
import { performBackup } from './backupService.js';
import { sendBackupReport } from './emailService.js';

export function initScheduler() {
  console.log('[SCHEDULER] Initializing node-cron recurring bill & backup scheduler...');

  // 1. Daily Recurring Bills Job at 00:05
  cron.schedule('5 0 * * *', async () => {
    console.log('[SCHEDULER] Running daily recurring bill generation...');
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const dueTemplates = await db.query(
        `SELECT * FROM recurring_templates WHERE is_active = true AND next_run_date <= ?`,
        [todayStr]
      );

      for (const tpl of dueTemplates) {
        await processRecurringTemplate(tpl);
      }
    } catch (err) {
      console.error('[SCHEDULER] Recurring bill job failed:', err);
    }
  });

  // 2. Daily Encrypted Backup Job at 02:00
  cron.schedule('0 2 * * *', async () => {
    console.log('[SCHEDULER] Running automated daily 02:00 encrypted database backup...');
    try {
      await performBackup();
    } catch (err) {
      console.error('[SCHEDULER] Daily backup failed:', err);
    }
  });
}

async function processRecurringTemplate(tpl) {
  try {
    const items = JSON.parse(tpl.items_json || '[]');
    let subtotal = 0;
    items.forEach(i => {
      subtotal += parseFloat(i.unit_price || 0) * parseInt(i.quantity || 1);
    });

    const grandTotal = subtotal;
    const billNumber = `MTX-REC-${Date.now().toString().slice(-6)}`;
    const billId = `bill-rec-${Date.now()}`;
    const todayFormatted = new Date().toISOString().split('T')[0];

    const customer = await db.queryOne('SELECT * FROM customers WHERE id = ?', [tpl.customer_id]);
    const custName = customer ? customer.name : 'Corporate Client';
    const custPhone = customer ? customer.phone : '';

    await db.query(
      `INSERT INTO bills (id, bill_number, customer_id, customer_name, customer_phone, bill_date, subtotal, discount_total, tax_total, grand_total, payment_status, executed_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [billId, billNumber, tpl.customer_id, custName, custPhone, todayFormatted, subtotal, 0, 0, grandTotal, 'unpaid', 'Authorized Signatory', `Auto-generated from template: ${tpl.template_name}`]
    );

    for (const item of items) {
      await db.query(
        `INSERT INTO bill_items (id, bill_id, product_id, item_name, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`item-${Date.now()}-${Math.random()}`, billId, item.product_id, item.item_name, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );
    }

    // Advance next_run_date
    const nextDate = calculateNextRunDate(tpl.next_run_date, tpl.frequency);
    await db.query('UPDATE recurring_templates SET next_run_date = ? WHERE id = ?', [nextDate, tpl.id]);

    console.log(`[SCHEDULER] Auto-generated recurring bill ${billNumber} for ${custName}`);
  } catch (err) {
    console.error(`[SCHEDULER] Failed to process template ${tpl.id}:`, err);
  }
}

function calculateNextRunDate(currentDateStr, frequency) {
  const dt = new Date(currentDateStr || Date.now());
  if (frequency === 'daily') dt.setDate(dt.getDate() + 1);
  else if (frequency === 'weekly') dt.setDate(dt.getDate() + 7);
  else if (frequency === 'monthly') dt.setMonth(dt.getMonth() + 1);
  else if (frequency === 'quarterly') dt.setMonth(dt.getMonth() + 3);
  else dt.setMonth(dt.getMonth() + 1);
  return dt.toISOString().split('T')[0];
}

export default {
  initScheduler
};
