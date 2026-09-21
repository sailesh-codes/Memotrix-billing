import QRCode from 'qrcode';

export function sanitizeUpiId(rawUpi) {
  if (!rawUpi || typeof rawUpi !== 'string') return 'viyasviyas82@okicici';
  const cleaned = rawUpi.trim();
  if (!cleaned || cleaned.includes('@gmail.com') || cleaned.includes('@yahoo.') || cleaned.includes('@outlook.') || cleaned.includes('@hotmail.') || !cleaned.includes('@')) {
    return 'viyasviyas82@okicici';
  }
  return cleaned;
}

export function buildUpiString({ upiId, payeeName, amount, currency = 'INR', note }) {
  const effectiveUpiId = sanitizeUpiId(upiId);
  const numAmount = parseFloat(amount || 0);
  const encodedName = encodeURIComponent((payeeName || 'Memotrix').trim());
  const encodedNote = encodeURIComponent((note || 'Invoice Payment').trim());
  const cleanCurrency = (currency || 'INR').trim();

  let upiUrl = `upi://pay?pa=${effectiveUpiId}&pn=${encodedName}&cu=${cleanCurrency}&tn=${encodedNote}`;
  if (numAmount > 0) {
    upiUrl += `&am=${numAmount.toFixed(2)}`;
  }
  return upiUrl;
}

export async function generateQrDataUri(text) {
  try {
    if (!text) return null;
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: 400,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('[QR] Failed to generate QR code Data URI:', err.message);
    return null;
  }
}

export async function generateQrSvg(text) {
  try {
    if (!text) return '';
    return await QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      width: 80,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('[QR] Failed to generate QR SVG:', err.message);
    return '';
  }
}

export async function generateQrBuffer(text) {
  try {
    if (!text) return null;
    return await QRCode.toBuffer(text, {
      type: 'png',
      margin: 1,
      width: 300,
      errorCorrectionLevel: 'M'
    });
  } catch (err) {
    console.error('[QR] Failed to generate QR Buffer:', err.message);
    return null;
  }
}

export default {
  sanitizeUpiId,
  buildUpiString,
  generateQrDataUri,
  generateQrSvg,
  generateQrBuffer
};
