/**
 * Memotrix SMS Service (No-Op Stub for Single-Factor Authentication)
 * No Twilio connection required.
 */

export function validateE164Phone(phoneNumber) {
  if (!phoneNumber) return { valid: false, error: 'Phone number required' };
  return { valid: true, phone: phoneNumber };
}

export function maskPhone(phoneNumber) {
  if (!phoneNumber) return null;
  return phoneNumber;
}

export async function verifySmsConnection() {
  return { ready: true, message: 'SMS service disabled (Single-Factor Auth Active).' };
}

export async function sendOtpSms() {
  return { success: false, error: 'SMS OTP disabled.' };
}

export default {
  validateE164Phone,
  maskPhone,
  verifySmsConnection,
  sendOtpSms
};
