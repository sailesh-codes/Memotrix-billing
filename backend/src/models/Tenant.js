import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  business_name: { type: String, required: true },
  subdomain_or_slug: { type: String, unique: true },
  status: { type: String, default: 'active' },
  created_at: { type: Date, default: Date.now }
}, { collection: 'tenants', timestamps: false });

export const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema);
export default Tenant;
