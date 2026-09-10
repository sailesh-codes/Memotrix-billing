import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    const { chromium } = await import('playwright');
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    browserInstance.on('disconnected', () => {
      browserInstance = null;
    });
  }
  return browserInstance;
}

/**
 * Pure vector PDFKit generator.
 * Produces an exact pixel-perfect, single-page styled invoice
 * with exact colors, table, QR code, totals, and acknowledgment.
 * Operates with zero external browser dependencies (works instantly on Vercel serverless).
 */
export async function generatePdfKitInvoice(data = {}) {
  const { bill = {}, items = [], bp = {}, tpl = {}, amountInWords = '', upiQrDataUri = null } = data;

  // Ensure QR Code buffer is always generated
  const effectiveUpiId = bp?.upi_id || 'viyasviyas82@okicici';
  const payeeName = bp?.payee_name || bp?.business_name || 'Memotrix';
  const amount = parseFloat(bill?.grand_total || bill?.total_amount || 0).toFixed(2);
  const note = bp?.default_transaction_note || bill?.bill_number || 'Invoice Payment';
  const upiUrl = `upi://pay?pa=${encodeURIComponent(effectiveUpiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

  let qrBuffer = null;
  if (upiQrDataUri && typeof upiQrDataUri === 'string' && upiQrDataUri.startsWith('data:image/')) {
    try {
      const qrBase64 = upiQrDataUri.replace(/^data:image\/\w+;base64,/, '');
      qrBuffer = Buffer.from(qrBase64, 'base64');
    } catch (e) {}
  }
  if (!qrBuffer) {
    try {
      qrBuffer = await QRCode.toBuffer(upiUrl, { margin: 1, width: 300 });
    } catch (err) {
      console.error('[QR] Failed to generate QR buffer in PDFKit:', err.message);
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const { bill = {}, items = [], bp = {}, tpl = {}, amountInWords = '', upiQrDataUri = null } = data;
      const totalQty = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
      const executedByName = bill.executed_by || tpl?.executed_by_value || 'VIYASH S';

      let pdfTitle = 'TAX INVOICE';
      if (bill.invoice_type === 'receipt') pdfTitle = 'CASH RECEIPT';
      if (bill.invoice_type === 'estimate') pdfTitle = 'ESTIMATE / PROFORMA';
      if (bill.invoice_type === 'quotation') pdfTitle = 'COMMERCIAL QUOTATION';

      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        bufferPages: true
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = 32;
      const right = 563;
      const contentWidth = right - left; // 531 pt

      // 1. Header Row
      let y = 32;
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#0F172A').text(bp.business_name || 'Memotrix', left, y);
      y += 24;
      if (bp.address) {
        doc.font('Helvetica').fontSize(9).fillColor('#475569').text(bp.address, left, y);
        y += 12;
      }
      doc.font('Helvetica').fontSize(9).fillColor('#475569').text(`Phone: ${bp.phone || '6384241882'} | Email: ${bp.email || 'teammemotrix@gmail.com'}`, left, y);
      y += 12;
      if (bp.gstin) {
        doc.font('Helvetica').fontSize(9).fillColor('#475569').text(`GSTIN: ${bp.gstin}`, left, y);
        y += 12;
      }

      // Logo on top right
      const logoCandidates = [
        bp.logo_original_url,
        bp.logo_url,
        path.join(process.cwd(), 'public', 'uploads', 'logo_1788409748465.jpeg'),
        path.join(process.cwd(), 'public', 'logo-default.png'),
        path.join(process.cwd(), 'assets', 'logo-default.png')
      ];
      for (const cand of logoCandidates) {
        if (!cand) continue;
        const clean = cand.split('?')[0].replace(/^\//, '');
        const full = path.isAbsolute(cand) ? cand : path.join(process.cwd(), clean);
        const fullPublic = path.join(process.cwd(), 'public', clean);
        const resolved = fs.existsSync(cand) ? cand : (fs.existsSync(full) ? full : (fs.existsSync(fullPublic) ? fullPublic : null));
        if (resolved) {
          try {
            doc.image(resolved, right - 110, 32, { fit: [110, 55], align: 'right' });
            break;
          } catch (e) {}
        }
      }

      // 2. Title Bar
      y = Math.max(y + 8, 88);
      doc.rect(left, y, contentWidth, 1.5).fill('#2563EB');
      y += 5;
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#2563EB').text(pdfTitle, left, y, { width: contentWidth, align: 'center', characterSpacing: 1 });
      y += 17;
      doc.rect(left, y, contentWidth, 1.5).fill('#2563EB');
      y += 10;

      // 3. Bill To / Invoice Details Row
      const infoTop = y;
      // Left info
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000000').text('Bill To', left, infoTop);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111827').text(bill.customer_name || 'Customer', left, infoTop + 13);
      let infoLeftY = infoTop + 25;
      if (bill.customer_phone) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#6B7280').text(bill.customer_phone, left, infoLeftY);
        infoLeftY += 11;
      }
      if (bill.customer_email) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#1D4ED8').text(bill.customer_email, left, infoLeftY);
        infoLeftY += 11;
      }

      // Right info
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000000').text('Invoice Details', left, infoTop, { width: contentWidth, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111827').text(`Date: ${bill.bill_date}`, left, infoTop + 13, { width: contentWidth, align: 'right' });
      if (bill.due_date) {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#B45309').text(`Due Date: ${bill.due_date}`, left, infoTop + 25, { width: contentWidth, align: 'right' });
      }

      y = Math.max(infoLeftY + 8, infoTop + 40);

      // 4. Line Items Table
      const colX = {
        num: left,
        name: left + 26,
        hsn: left + 195,
        qty: left + 265,
        price: left + 325,
        disc: left + 395,
        amount: left + 465
      };
      const colW = {
        num: 26,
        name: 169,
        hsn: 70,
        qty: 60,
        price: 70,
        disc: 70,
        amount: 66
      };

      // Header Bar
      const thHeight = 18;
      doc.rect(left, y, contentWidth, thHeight).fill('#2563EB');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
      doc.text('#', colX.num, y + 5, { width: colW.num, align: 'center' });
      doc.text('ITEM NAME', colX.name, y + 5, { width: colW.name, align: 'left' });
      doc.text('HSN/ SAC', colX.hsn, y + 5, { width: colW.hsn, align: 'left' });
      doc.text('QUANTITY', colX.qty, y + 5, { width: colW.qty, align: 'center' });
      doc.text('PRICE/ UNIT', colX.price, y + 5, { width: colW.price, align: 'right' });
      doc.text('DISCOUNT', colX.disc, y + 5, { width: colW.disc, align: 'right' });
      doc.text('AMOUNT', colX.amount, y + 5, { width: colW.amount, align: 'right' });
      y += thHeight;

      // Table Rows
      items.forEach((item, idx) => {
        const qty = parseInt(item.quantity) || 1;
        const unitPrice = parseFloat(item.unit_price || 0);
        const discAmt = parseFloat(item.discount_amount || 0);
        const lineTotal = parseFloat(item.line_total || 0);
        const rowHeight = 20;

        if (idx % 2 === 1) {
          doc.rect(left, y, contentWidth, rowHeight).fill('#F9FAFB');
        }

        doc.moveTo(left, y + rowHeight).lineTo(right, y + rowHeight).lineWidth(0.5).strokeColor('#E5E7EB').stroke();

        doc.font('Helvetica').fontSize(8.5).fillColor('#4B5563').text(`${idx + 1}`, colX.num, y + 6, { width: colW.num, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text(item.item_name || '', colX.name, y + 6, { width: colW.name, align: 'left' });
        doc.font('Helvetica').fontSize(8.5).fillColor('#4B5563').text(item.hsn_sac || '', colX.hsn, y + 6, { width: colW.hsn, align: 'left' });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text(`${qty}`, colX.qty, y + 6, { width: colW.qty, align: 'center' });
        doc.font('Helvetica').fontSize(8.5).fillColor('#111827').text(`₹ ${unitPrice.toFixed(2)}`, colX.price, y + 6, { width: colW.price, align: 'right' });
        doc.font('Helvetica').fontSize(8.5).fillColor('#374151').text(`₹ ${discAmt.toFixed(2)}`, colX.disc, y + 6, { width: colW.disc, align: 'right' });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text(`₹ ${lineTotal.toFixed(2)}`, colX.amount, y + 6, { width: colW.amount, align: 'right' });

        y += rowHeight;
      });

      // Total Row
      const tfHeight = 20;
      doc.rect(left, y, contentWidth, 1.5).fill('#111827');
      doc.rect(left, y + 1.5, contentWidth, tfHeight - 2.5).fill('#FFFFFF');
      doc.rect(left, y + tfHeight - 1, contentWidth, 1).fill('#111827');

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text('Total', colX.name, y + 6, { width: colW.name, align: 'left' });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text(`${totalQty}`, colX.qty, y + 6, { width: colW.qty, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text(`₹ ${parseFloat(bill.discount_total || 0).toFixed(2)}`, colX.disc, y + 6, { width: colW.disc, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#2563EB').text(`₹ ${parseFloat(bill.grand_total).toFixed(2)}`, colX.amount, y + 6, { width: colW.amount, align: 'right' });
      y += tfHeight + 10;

      // 5. Middle Section: Left (Words, Terms, QR) vs Right (Summary & Signature)
      const midY = y;
      const leftColWidth = 270;
      const rightColWidth = 220;
      const rightColLeft = right - rightColWidth;

      // Left Column
      let curLeftY = midY;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000').text('INVOICE AMOUNT IN WORDS', left, curLeftY);
      curLeftY += 12;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1F2937').text(amountInWords || 'Eight Hundred Rupees only', left, curLeftY, { width: leftColWidth });
      curLeftY += 20;

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000').text('TERMS AND CONDITIONS', left, curLeftY);
      curLeftY += 12;
      const terms = tpl?.terms_and_conditions || 'Standard Terms';
      doc.font('Helvetica').fontSize(7.5).fillColor('#374151').text(terms, left, curLeftY, { width: leftColWidth, lineGap: 2 });
      curLeftY += doc.heightOfString(terms, { width: leftColWidth, lineGap: 2 }) + 8;

      // UPI QR Card
      const showQr = bp?.show_qr_code !== false && bp?.show_qr_code !== 0 && bp?.show_qr_code !== 'false';
      if (showQr && qrBuffer) {
        const qrCardW = 90;
        const qrCardH = 95;
        doc.roundedRect(left, curLeftY, qrCardW, qrCardH, 8).lineWidth(0.8).strokeColor('#E5E7EB').stroke();
        try {
          doc.image(qrBuffer, left + 15, curLeftY + 8, { width: 60, height: 60 });
        } catch (e) {
          console.error('[PDF] Failed to draw QR image:', e.message);
        }
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A').text('Scan & Pay', left, curLeftY + 70, { width: qrCardW, align: 'center' });
        const showUpiText = bp?.show_upi_text !== false && bp?.show_upi_text !== 0;
        if (showUpiText && effectiveUpiId) {
          doc.font('Helvetica').fontSize(6.5).fillColor('#475569').text(`UPI ID: ${effectiveUpiId}`, left + 4, curLeftY + 80, { width: qrCardW - 8, align: 'center' });
        }
      }

      // Right Column: Summary Box
      let curRightY = midY;
      const boxPad = 8;
      const summaryBoxH = 110;
      doc.roundedRect(rightColLeft, curRightY, rightColWidth, summaryBoxH, 6).lineWidth(0.8).strokeColor('#E5E7EB').fillAndStroke('#F9FAFB', '#E5E7EB');

      const sLeft = rightColLeft + boxPad;
      const sRightW = rightColWidth - (boxPad * 2);
      let sy = curRightY + 6;

      const drawSummaryRow = (label, val, isBold = false) => {
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#374151').text(label, sLeft, sy);
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#374151').text(`₹ ${val}`, sLeft, sy, { width: sRightW, align: 'right' });
        sy += 13;
      };

      drawSummaryRow('Sub Total', parseFloat(bill.subtotal).toFixed(2));
      drawSummaryRow('Discount', parseFloat(bill.discount_total || 0).toFixed(2));

      // Blue total pill
      doc.roundedRect(sLeft - 2, sy - 1, sRightW + 4, 16, 3).fill('#2563EB');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF').text('Total', sLeft + 2, sy + 3);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF').text(`₹ ${parseFloat(bill.grand_total).toFixed(2)}`, sLeft, sy + 3, { width: sRightW - 2, align: 'right' });
      sy += 20;

      drawSummaryRow('Received', parseFloat(bill.received_amount || 0).toFixed(2));
      drawSummaryRow('Balance', parseFloat(bill.balance_amount || 0).toFixed(2));
      drawSummaryRow('You Saved', parseFloat(bill.discount_total || 0).toFixed(2));

      // Signature Area
      let sigY = curRightY + summaryBoxH + 18;
      doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text(`For: ${bp.business_name || 'Memotrix'}`, rightColLeft, sigY, { width: rightColWidth, align: 'right' });
      sigY += 14;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text(executedByName, rightColLeft, sigY, { width: rightColWidth, align: 'right' });
      sigY += 14;
      doc.moveTo(right - 85, sigY - 2).lineTo(right, sigY - 2).lineWidth(1.5).strokeColor('#0F172A').stroke();
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#6B7280').text(tpl?.executed_by_label || 'AUTHORIZED SIGNATORY', rightColLeft, sigY + 2, { width: rightColWidth, align: 'right', characterSpacing: 0.5 });

      // 6. Acknowledgment Section
      const ackY = 730;
      doc.moveTo(left, ackY).lineTo(right, ackY).dash(3, { space: 3 }).lineWidth(0.8).strokeColor('#9CA3AF').stroke().undash();

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151').text(tpl?.footer_content || 'ACKNOWLEDGMENT', left, ackY + 8, { width: contentWidth, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#2563EB').text(tpl?.disclaimer_text || bp?.business_name || 'Memotrix', left, ackY + 18, { width: contentWidth, align: 'center' });

      const col3W = contentWidth / 3;
      const ackRowY = ackY + 36;

      // Col 1: Invoice To
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0B8A3E').text('Invoice To:', left, ackRowY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(bill.customer_name || '', left, ackRowY + 10);

      // Col 2: Invoice Details
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0B8A3E').text('Invoice Details:', left + col3W, ackRowY);
      doc.font('Helvetica').fontSize(8).fillColor('#111827').text(`Invoice Date : ${bill.bill_date}`, left + col3W, ackRowY + 10);
      doc.font('Helvetica').fontSize(8).fillColor('#111827').text(`Invoice Amount : ₹ ${parseFloat(bill.grand_total).toFixed(2)}`, left + col3W, ackRowY + 20);

      // Col 3: Seal & Sign
      doc.moveTo(right - 100, ackRowY + 22).lineTo(right, ackRowY + 22).dash(1, { space: 2 }).lineWidth(0.8).strokeColor('#9CA3AF').stroke().undash();
      doc.font('Helvetica').fontSize(7.5).fillColor('#4B5563').text("Receiver's Seal & Sign", right - 110, ackRowY + 26, { width: 110, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate invoice PDF.
 * Automatically chooses between Playwright (for local high-res rendering)
 * and pure vector PDFKit (for Vercel serverless / lightweight production environments).
 */
export async function generateInvoicePdf(htmlContent, invoiceData = null) {
  // On Vercel serverless, Chromium is not available. Use vector PDFKit generator directly.
  if (process.env.VERCEL && invoiceData) {
    return generatePdfKitInvoice(invoiceData);
  }

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.setViewportSize({ width: 794, height: 1123 });
    await page.setContent(htmlContent, { waitUntil: 'load', timeout: 15000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });

    await page.close();
    return pdfBuffer;
  } catch (err) {
    console.warn('[PDF SERVICE] Playwright Chromium error. Falling back to vector PDFKit generator:', err.message);
    if (invoiceData) {
      return generatePdfKitInvoice(invoiceData);
    }
    throw err;
  }
}

export default {
  generateInvoicePdf,
  generatePdfKitInvoice
};
