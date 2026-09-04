import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifySmtpConnection } from '../services/emailService.js';
import { verifySmsConnection } from '../services/smsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runDeliveryVerification() {
  console.log('====================================================');
  console.log('       MEMOTRIX REAL DELIVERY PIPELINE VERIFICATION ');
  console.log('====================================================');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`OTP Demo Mode: ${process.env.OTP_DEMO_MODE || 'false'}`);
  console.log('----------------------------------------------------');

  // 1. Check Email SMTP Transport
  console.log('\n[1/2] Testing Email Delivery Pipeline (SMTP)...');
  const smtpUser = process.env.SMTP_USER || 'unconfigured';
  const smtpPass = process.env.SMTP_PASS;
  const isSmtpReal = smtpPass && smtpPass !== 'mock_app_password';

  console.log(`- SMTP Target User: ${smtpUser}`);
  console.log(`- SMTP Configured: ${isSmtpReal ? 'YES (Real Credential Set)' : 'NO (Placeholder/Mock)'}`);

  const emailCheck = await verifySmtpConnection();
  if (emailCheck.ready) {
    console.log(`✓ [EMAIL RESULT]: PASS — ${emailCheck.message}`);
  } else {
    console.log(`✗ [EMAIL RESULT]: FAIL — ${emailCheck.message}`);
  }

  // 2. Check Twilio SMS Transport
  console.log('\n[2/2] Testing SMS Delivery Pipeline (Twilio)...');
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;
  const isTwilioReal = twilioSid && !twilioSid.includes('mock') && twilioFrom !== '+15005550006';

  console.log(`- Twilio Account SID: ${twilioSid || 'unconfigured'}`);
  console.log(`- Twilio From Number: ${twilioFrom || 'unconfigured'}`);
  console.log(`- Twilio Configured: ${isTwilioReal ? 'YES (Real SID & Sender Number)' : 'NO (Placeholder/Magic Number)'}`);

  const smsCheck = await verifySmsConnection();
  if (smsCheck.ready) {
    console.log(`✓ [SMS RESULT]: PASS — ${smsCheck.message}`);
  } else {
    console.log(`✗ [SMS RESULT]: FAIL — ${smsCheck.message}`);
  }

  console.log('\n====================================================');
  if (emailCheck.ready && smsCheck.ready) {
    console.log(' STATUS: ALL REAL DELIVERY PIPELINES OPERATIONAL');
  } else {
    console.log(' STATUS: REAL DELIVERY UNCONFIGURED OR INCOMPLETE');
    console.log(' Action: Update backend/.env with real Gmail App Password & Twilio SID/AuthToken');
  }
  console.log('====================================================\n');
}

runDeliveryVerification().catch(err => {
  console.error('Verification script error:', err);
  process.exit(1);
});
