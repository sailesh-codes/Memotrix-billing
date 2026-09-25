import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tenant_id: { type: String, default: 'tenant-memotrix-01' },
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  email: { type: String },
  address: { type: String },
  state_code: { type: String, default: '33' },
  gstin: { type: String },
  customer_type: { type: String, default: 'retail' },
  loyalty_points: { type: Number, default: 0 },
  notes: { type: String },
  total_spent: { type: Number, default: 0 },
  outstanding_balance: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
}, { collection: 'customers', timestamps: false });

export const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
export default Customer;
