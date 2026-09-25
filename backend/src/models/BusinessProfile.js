import mongoose from 'mongoose';

const businessProfileSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tenant_id: { type: String, default: 'tenant-memotrix-01' },
  business_name: { type: String, required: true },
  tagline: { type: String },
  phone: { type: String, required: true },
  email: { type: String, required: true, default: 'teammemotrix@gmail.com' },
  address: { type: String, required: true },
  state_code: { type: String, default: '33' },
  gstin: { type: String },
  gst_enabled: { type: Boolean, default: false },
  upi_id: { type: String, default: 'viyasviyas82@okicici' },
  payee_name: { type: String, default: 'Memotrix' },
  merchant_name: { type: String, default: '' },
  currency: { type: String, default: 'INR' },
  default_transaction_note: { type: String, default: '' },
  show_qr_code: { type: Boolean, default: true },
  show_upi_text: { type: Boolean, default: true },
  website: { type: String, default: '' },
  logo_url: { type: String },
  logo_original_url: { type: String },
  logo_zoom: { type: Number, default: 1.0 },
  logo_x: { type: Number, default: 0.0 },
  logo_y: { type: Number, default: 0.0 },
  updated_at: { type: Date, default: Date.now }
}, { collection: 'business_profile', timestamps: false });

export const BusinessProfile = mongoose.models.BusinessProfile || mongoose.model('BusinessProfile', businessProfileSchema);
export default BusinessProfile;
