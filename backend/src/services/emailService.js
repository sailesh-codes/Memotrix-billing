/**
 * Memotrix Email Service (No-Op Stub for Single-Factor Authentication)
 * No SMTP server connection or Gmail App Password required.
 */

export async function verifySmtpConnection() {
  return { ready: true, message: 'Email service disabled (Single-Factor Auth Active).' };
}

export async function sendPasswordResetCode() {
  return { success: false, error: 'Email OTP disabled.' };
}

export async function sendSecurityAlert({ username, ipAddress }) {
  console.log(`[SECURITY LOG] Session alert for ${username} from IP ${ipAddress}`);
  return true;
}

export async function sendLowStockAlert(product) {
  console.log(`[INVENTORY LOG] Low Stock: ${product.name} (SKU: ${product.sku}) - Qty: ${product.stock_quantity}`);
  return true;
}

export async function sendBackupReport({ status, fileName }) {
  console.log(`[BACKUP LOG] Database Backup Report (${status}): ${fileName}`);
  return true;
}

export default {
  verifySmtpConnection,
  sendPasswordResetCode,
  sendSecurityAlert,
  sendLowStockAlert,
  sendBackupReport
};
