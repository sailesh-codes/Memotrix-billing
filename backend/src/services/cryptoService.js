import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'memotrix_secret_key_32bytes_long!'; // 32 chars
const KEY = crypto.scryptSync(SECRET_KEY, 'memotrix_salt', 32);

export function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[CRYPTO] Encryption error:', err);
    return text;
  }
}

export function decrypt(cipherText) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.includes(':')) return cipherText;
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails, return original text (useful if already plaintext)
    return cipherText;
  }
}

export default {
  encrypt,
  decrypt
};
