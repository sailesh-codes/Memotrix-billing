import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tenant_id: { type: String, default: 'tenant-memotrix-01' },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, default: 'teammemotrix@gmail.com' },
  phone_number: { type: String },
  phone_verified: { type: Boolean, default: false },
  phone_locked: { type: Boolean, default: false },
  password_hash: { type: String, required: true },
  totp_secret: { type: String },
  totp_enabled: { type: Boolean, default: false },
  must_reset_password: { type: Boolean, default: true },
  failed_login_count: { type: Number, default: 0 },
  locked_until: { type: Date },
  role: { type: String, default: 'admin' },
  active_session_token: { type: String },
  last_login_at: { type: Date },
  created_at: { type: Date, default: Date.now }
}, { collection: 'users', timestamps: false });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
