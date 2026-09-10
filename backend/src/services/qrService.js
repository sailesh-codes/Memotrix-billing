import QRCode from 'qrcode';

export function buildUpiString({ upiId, payeeName, amount, currency = 'INR', note }) {
  const effectiveUpiId = upiId || 'viyasviyas82@okicici';
  const cleanAmount = parseFloat(amount || 0).toFixed(2);
  const encodedName = encodeURIComponent(payeeName || 'Memotrix');
  const encodedNote = encodeURIComponent(note || 'Invoice Payment');
  return `upi://pay?pa=${effectiveUpiId}&pn=${encodedName}&am=${cleanAmount}&cu=${currency || 'INR'}&tn=${encodedNote}`;
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
  buildUpiString,
  generateQrDataUri,
  generateQrSvg,
  generateQrBuffer
};
