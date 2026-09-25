import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tenant_id: { type: String, default: 'tenant-memotrix-01' },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, default: 'General' },
  category_id: { type: String },
  hsn_sac: { type: String, default: '' },
  cost_price: { type: Number, default: 0 },
  retail_price: { type: Number, required: true },
  wholesale_price: { type: Number, default: 0 },
  corporate_price: { type: Number, default: 0 },
  stock_quantity: { type: Number, default: 0 },
  low_stock_threshold: { type: Number, default: 5 },
  image_url: { type: String },
  image_urls: { type: String, default: '[]' },
  barcode: { type: String },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
}, { collection: 'products', timestamps: false });

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
export default Product;
