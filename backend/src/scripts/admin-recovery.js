import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from '../db/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const args = process.argv.slice(2);

async function runAdminRecovery() {
  console.log('===========================================================');
  console.log('       MEMOTRIX SERVER-SIDE BREAK GLASS RECOVERY TOOL       ');
  console.log('===========================================================');
  console.log(' WARNING: This tool bypasses normal authentication & verification.');
  console.log(' Use ONLY when the admin is legitimately locked out of recovery.');
  console.log('-----------------------------------------------------------');

  const admin = await db.queryOne('SELECT * FROM users WHERE username = ? OR role = ?', ['admin', 'admin']);

  if (!admin) {
    console.error('ERROR: Admin account not found in database.');
    process.exit(1);
  }

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('\nUsage: node src/scripts/admin-recovery.js [command]');
    console.log('\nCommands:');
    console.log('  --status                   Display current admin security & recovery status');
    console.log('  --reset-phone              Clear registered phone number and unlock phone field');
    console.log('  --reset-password <pass>    Set a new admin password directly (min 12 chars)');
    console.log('  --clear-2fa                Disable Google Authenticator (TOTP 2FA)');
    console.log('  --unlock-all               Full emergency reset (clears phone, 2FA, and resets password requirement)');
    console.log('\n===========================================================\n');
    process.exit(0);
  }

  const logRecoveryEvent = async (action, details) => {
    try {
      const logId = `recovery-${Date.now()}`;
      await db.query(
        `INSERT INTO account_security_logs (id, user_id, event_type, ip_address, user_agent, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, admin.id, `BREAK_GLASS_${action}`, '127.0.0.1', 'CLI_RECOVERY_SCRIPT', JSON.stringify({ details })]
      );
      console.log(`✓ Audit log created: BREAK_GLASS_${action} (${details})`);
    } catch (e) {
      console.warn('Audit log write warning:', e.message);
    }
  };

  if (args.includes('--status')) {
    console.log('\n[ADMIN SECURITY STATUS REPORT]');
    console.log(`- User ID: ${admin.id}`);
    console.log(`- Username: ${admin.username}`);
    console.log(`- Email: ${admin.email}`);
    console.log(`- Phone Number: ${admin.phone_number || '(Not Registered)'}`);
    console.log(`- Phone Verified: ${admin.phone_verified ? 'YES' : 'NO'}`);
    console.log(`- Phone Locked: ${admin.phone_locked ? 'YES' : 'NO'}`);
    console.log(`- TOTP 2FA Active: ${admin.totp_enabled ? 'YES' : 'NO'}`);
    console.log(`- Must Reset Password: ${admin.must_reset_password ? 'YES (Lockout Active)' : 'NO'}`);
    console.log(`- Role: ${admin.role}`);
    console.log('\n===========================================================\n');
    process.exit(0);
  }

  if (args.includes('--reset-phone')) {
    await db.query('UPDATE users SET phone_number = NULL, phone_verified = false, phone_locked = false WHERE id = ?', [admin.id]);
    console.log('✓ SUCCESS: Admin phone number cleared and unlocked.');
    await logRecoveryEvent('RESET_PHONE', 'Cleared phone_number, phone_verified=false, phone_locked=false');
  }

  const passIndex = args.indexOf('--reset-password');
  if (passIndex !== -1 && args[passIndex + 1]) {
    const newPass = args[passIndex + 1];
    if (newPass.length < 12) {
      console.error('ERROR: New password must be at least 12 characters.');
      process.exit(1);
    }
    const passHash = bcrypt.hashSync(newPass, 12);
    await db.query('UPDATE users SET password_hash = ?, must_reset_password = false WHERE id = ?', [passHash, admin.id]);
    console.log('✓ SUCCESS: Admin password reset successfully and lockout cleared.');
    await logRecoveryEvent('RESET_PASSWORD', 'Updated password_hash and cleared must_reset_password flag');
  }

  if (args.includes('--clear-2fa')) {
    await db.query('UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = ?', [admin.id]);
    console.log('✓ SUCCESS: Google Authenticator (TOTP 2FA) disabled for admin.');
    await logRecoveryEvent('CLEAR_2FA', 'Set totp_enabled=false, totp_secret=NULL');
  }

  if (args.includes('--unlock-all')) {
    const defaultNewPass = 'MemotrixAdmin2026!';
    const passHash = bcrypt.hashSync(defaultNewPass, 12);
    await db.query(
      `UPDATE users SET phone_number = NULL, phone_verified = false, phone_locked = false,
       totp_enabled = false, totp_secret = NULL, must_reset_password = false, password_hash = ?
       WHERE id = ?`,
      [passHash, admin.id]
    );
    console.log('✓ SUCCESS: Full emergency recovery complete.');
    console.log(`  - Temp Password: ${defaultNewPass}`);
    console.log('  - Phone & TOTP 2FA: Unlocked & Cleared');
    await logRecoveryEvent('UNLOCK_ALL', `Full recovery performed. Reset password to ${defaultNewPass}`);
  }

  console.log('\n===========================================================\n');
}

runAdminRecovery().then(() => process.exit(0)).catch(err => {
  console.error('Break glass recovery failed:', err);
  process.exit(1);
});
