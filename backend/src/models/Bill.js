import mongoose from 'mongoose';

const billSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tenant_id: { type: String, default: 'tenant-memotrix-01' },
  bill_number: { type: String, required: true },
  customer_id: { type: String },
  customer_name: { type: String, required: true },
  customer_phone: { type: String },
  customer_email: { type: String },
  customer_address: { type: String },
  customer_gstin: { type: String },
  pdf_path: { type: String },
  pdf_generated_at: { type: Date },
  bill_date: { type: String, required: true },
  due_date: { type: String },
  subtotal: { type: Number, required: true },
  discount_total: { type: Number, default: 0 },
  tax_total: { type: Number, default: 0 },
  grand_total: { type: Number, required: true },
  received_amount: { type: Number, default: 0 },
  balance_amount: { type: Number, default: 0 },
  payment_status: { type: String, default: 'paid' },
  notes: { type: String },
  executed_by: { type: String, default: 'VIYASH S' },
  coupon_code: { type: String },
  invoice_type: { type: String, default: 'tax_invoice' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: 'bills', timestamps: false });

export const Bill = mongoose.models.Bill || mongoose.model('Bill', billSchema);
export default Bill;
