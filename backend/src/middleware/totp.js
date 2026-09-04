import speakeasy from 'speakeasy';

export function verifyTotpToken(secretBase32, token) {
  if (!secretBase32 || !token) return false;
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: 'base32',
    token: token.toString().trim(),
    window: 2 // Allow +/- 60 seconds time drift
  });
}

export function generateTotpSecret(username = 'admin') {
  return speakeasy.generateSecret({
    length: 20,
    name: `Memotrix (${username})`,
    issuer: 'Memotrix POS'
  });
}

export default {
  verifyTotpToken,
  generateTotpSecret
};
