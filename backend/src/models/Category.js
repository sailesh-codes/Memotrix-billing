import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tenant_id: { type: String, default: 'tenant-memotrix-01' },
  name: { type: String, required: true },
  description: { type: String },
  created_at: { type: Date, default: Date.now }
}, { collection: 'categories', timestamps: false });

export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
export default Category;
