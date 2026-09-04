import QRCode from 'qrcode';

export function buildUpiString({ upiId, payeeName, amount, currency = 'INR', note }) {
  if (!upiId) return '';
  const cleanAmount = parseFloat(amount || 0).toFixed(2);
  const encodedName = encodeURIComponent(payeeName || 'Memotrix');
  const encodedNote = encodeURIComponent(note || 'Invoice Payment');
  return `upi://pay?pa=${upiId}&pn=${encodedName}&am=${cleanAmount}&cu=${currency || 'INR'}&tn=${encodedNote}`;
}

export async function generateQrDataUri(text) {
  try {
    if (!text) return null;
    return await QRCode.toDataURL(text, {
      margin: 2,
      width: 600,
      errorCorrectionLevel: 'H',
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

export default {
  buildUpiString,
  generateQrDataUri
};
