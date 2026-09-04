import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { Mail, Download, Printer, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export function InvoiceView({ bill, items = [], businessProfile, templateSettings, amountInWords, upiQrDataUri, onPrint, onDownloadPdf, onRegeneratePdf, onStatusChange }) {
  const { showToast } = useToast();

  const bp = businessProfile || {
    business_name: 'Memotrix',
    phone: '6384241882',
    email: 'teammemotrix@gmail.com',
    logo_url: '/logo-default.png'
  };

  const tpl = templateSettings || {
    executed_by_label: 'Executed by',
    executed_by_value: 'Authorized Signatory',
    terms_and_conditions: '1.Products can only be returned or exchanged if they are damaged at delivery.\n2.Price mentioned is final.\n3.Please inspect products upon delivery.',
    footer_content: 'Acknowledgment',
    disclaimer_text: 'Memotrix'
  };

  const [effectiveQrDataUri, setEffectiveQrDataUri] = useState(upiQrDataUri);

  useEffect(() => {
    let isMounted = true;
    if (upiQrDataUri) {
      setEffectiveQrDataUri(upiQrDataUri);
    } else if (bp?.upi_id) {
      const payeeName = encodeURIComponent(bp.payee_name || bp.business_name || 'Memotrix');
      const amount = parseFloat(bill?.grand_total || bill?.total_amount || 0).toFixed(2);
      const note = encodeURIComponent(bp.default_transaction_note || bill?.bill_number || 'Invoice Payment');
      const upiUrl = `upi://pay?pa=${encodeURIComponent(bp.upi_id)}&pn=${payeeName}&am=${amount}&cu=INR&tn=${note}`;
      QRCode.toDataURL(upiUrl, { margin: 1, width: 300 }, (err, url) => {
        if (!err && url && isMounted) setEffectiveQrDataUri(url);
      });
    } else {
      setEffectiveQrDataUri(null);
    }
    return () => { isMounted = false; };
  }, [upiQrDataUri, bp, bill]);

  if (!bill) return <div className="p-4 text-center text-gray-500">No invoice loaded</div>;

  const totalQty = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);

  const getInvoiceTypeTitle = (type) => {
    if (type === 'receipt') return 'CASH RECEIPT';
    if (type === 'estimate') return 'ESTIMATE / PROFORMA';
    if (type === 'quotation') return 'COMMERCIAL QUOTATION';
    return 'TAX INVOICE';
  };

  const handleDownloadImage = async (format = 'png') => {
    const element = document.getElementById('invoice-render-card');
    if (!element) return;

    try {
      showToast(`Generating 300 DPI high-definition ${format.toUpperCase()} image...`, 'info');

      // Preload all images inside card & wait for fonts
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const images = element.getElementsByTagName('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));

      const canvas = await html2canvas(element, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const imageUri = canvas.toDataURL(mime, 0.98);

      const link = document.createElement('a');
      link.href = imageUri;
      link.download = `Invoice_${bill.bill_number}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`Downloaded 300 DPI Invoice_${bill.bill_number}.${format}`, 'success');
    } catch (err) {
      console.error('Image export error:', err);
      showToast('Failed to generate image download', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar (Hidden during print) */}
      <div className="flex flex-wrap justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 no-print gap-3 shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-black px-3 py-1 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 rounded-full border border-blue-200">
            {getInvoiceTypeTitle(bill.invoice_type)} #{bill.bill_number}
          </span>
          <select
            value={bill.payment_status || 'pending'}
            onChange={(e) => onStatusChange && onStatusChange(e.target.value)}
            className={`px-3 py-1 rounded-full text-xs font-extrabold border outline-none cursor-pointer ${
              bill.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
              bill.payment_status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-300' :
              bill.payment_status === 'overdue' ? 'bg-rose-100 text-rose-800 border-rose-300' :
              bill.payment_status === 'void' ? 'bg-gray-100 text-gray-800 border-gray-300' : 'bg-blue-100 text-blue-800 border-blue-300'
            }`}
          >
            <option value="paid">PAID</option>
            <option value="pending">PENDING</option>
            <option value="overdue">OVERDUE</option>
            <option value="void">VOID</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Email Invoice Delivery Action */}
          <button
            disabled={!bill.customer_email}
            onClick={() => {
              if (bill.customer_email) {
                showToast(`Invoice #${bill.bill_number} successfully dispatched to ${bill.customer_email}!`, 'success');
              }
            }}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
              bill.customer_email
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            }`}
            title={bill.customer_email ? `Send invoice email to ${bill.customer_email}` : 'No customer email recorded for this invoice'}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{bill.customer_email ? `Email` : 'Email (Disabled)'}</span>
          </button>

          {/* Download PNG */}
          <button
            onClick={() => handleDownloadImage('png')}
            className="px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl transition flex items-center space-x-1 cursor-pointer"
            title="Download crisp 2x resolution PNG image"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>PNG</span>
          </button>

          {/* Download JPG */}
          <button
            onClick={() => handleDownloadImage('jpg')}
            className="px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl transition flex items-center space-x-1 cursor-pointer"
            title="Download crisp 2x resolution JPG image"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>JPG</span>
          </button>

          {onRegeneratePdf && (
            <button
              onClick={onRegeneratePdf}
              className="px-3 py-2 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl shadow-sm transition flex items-center space-x-1 cursor-pointer"
              title="Regenerate PDF Cache"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate PDF</span>
            </button>
          )}

          {onPrint && (
            <button
              onClick={onPrint}
              className="px-3 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl shadow-sm transition flex items-center space-x-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          )}

          {onDownloadPdf && (
            <button
              onClick={onDownloadPdf}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition flex items-center space-x-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Render Card Container with ID for html2canvas */}
      <div id="invoice-render-card" className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-4xl mx-auto font-sans print-area text-gray-900 text-xs leading-normal">

      {/* 1. Header Row */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{bp.business_name || 'Memotrix'}</h1>
          {bp.address && <p className="text-xs text-slate-600 mt-0.5">{bp.address}</p>}
          <p className="text-xs text-slate-600">Phone: {bp.phone || '6384241882'} | Email: {bp.email || 'teammemotrix@gmail.com'}</p>
          {bp.gstin && <p className="text-xs text-slate-600">GSTIN: {bp.gstin}</p>}
          {bp.website && <p className="text-xs text-slate-600">Website: {bp.website}</p>}
        </div>
        <div className="flex items-center justify-end max-w-[160px] max-h-[80px]">
          <img
            src={bp.logo_original_url || bp.logo_url || '/logo-default.png'}
            alt="Business Logo"
            className="max-h-[80px] max-w-[160px] w-auto h-auto object-contain flex-shrink-0 bg-transparent"
          />
        </div>
      </div>

      {/* 2. Title Bar (Enterprise Blue Theme #2563EB) */}
      <div className="border-t-2 border-b-2 border-[#2563EB] py-1 my-3 text-center">
        <h2 className="text-lg font-bold text-[#2563EB] tracking-wide uppercase">{getInvoiceTypeTitle(bill.invoice_type)}</h2>
      </div>

      {/* 3. Bill To / Invoice Details Row */}
      <div className="flex justify-between items-start my-3 text-xs">
        <div>
          <span className="font-bold text-black block mb-0.5">Bill To</span>
          <p className="font-semibold text-gray-900">{bill.customer_name}</p>
          {bill.customer_phone && <p className="text-gray-500">{bill.customer_phone}</p>}
          {bill.customer_email && <p className="text-blue-700 text-[11px] font-medium">{bill.customer_email}</p>}
        </div>
        <div className="text-right">
          <span className="font-bold text-black block mb-0.5">Invoice Details</span>
          <p className="font-semibold text-gray-900">Date: {bill.bill_date}</p>
          {bill.due_date && <p className="text-amber-700 font-medium">Due Date: {bill.due_date}</p>}
        </div>
      </div>

      {/* 4. Line Items Table (Enterprise Blue Header #2563EB) */}
      <div className="overflow-x-auto my-3">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#2563EB] text-white font-bold uppercase text-[11px]">
              <th className="py-2 px-2 text-center w-8">#</th>
              <th className="py-2 px-2 text-left">Item Name</th>
              <th className="py-2 px-2 text-left w-24">HSN/ SAC</th>
              <th className="py-2 px-2 text-center w-16">Quantity</th>
              <th className="py-2 px-2 text-right w-24">Price/ Unit</th>
              <th className="py-2 px-2 text-right w-28">Discount</th>
              <th className="py-2 px-2 text-right w-24">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item, idx) => {
              const qty = parseInt(item.quantity) || 1;
              const unitPrice = parseFloat(item.unit_price || 0);
              const discAmt = parseFloat(item.discount_amount || 0);
              const discPct = item.discount_percent ? parseFloat(item.discount_percent) : (unitPrice * qty > 0 ? (discAmt / (unitPrice * qty)) * 100 : 0);
              const lineTotal = parseFloat(item.line_total || 0);

              return (
                <tr key={idx} className={idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}>
                  <td className="py-2 px-2 text-center text-gray-600">{idx + 1}</td>
                  <td className="py-2 px-2 font-bold text-gray-900">{item.item_name}</td>
                  <td className="py-2 px-2 text-gray-600">{item.hsn_sac || ''}</td>
                  <td className="py-2 px-2 text-center font-bold text-gray-900">{qty}</td>
                  <td className="py-2 px-2 text-right text-gray-900">₹ {unitPrice.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right text-gray-700">
                    ₹ {discAmt.toFixed(2)}
                    {discAmt > 0 && <span className="block text-[10px] text-gray-500">({discPct.toFixed(1)}%)</span>}
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-gray-900">₹ {lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-b border-gray-900 font-bold text-xs bg-white">
              <td colSpan="3" className="py-2 px-2 text-left">Total</td>
              <td className="py-2 px-2 text-center text-gray-900">{totalQty}</td>
              <td></td>
              <td className="py-2 px-2 text-right text-gray-900">₹ {parseFloat(bill.discount_total || 0).toFixed(2)}</td>
              <td className="py-2 px-2 text-right text-[#2563EB] font-extrabold">₹ {parseFloat(bill.grand_total).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 5. Left Column (Words & Terms & QR) vs Right Column (Summary & Signature) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-3">
        {/* Left Side */}
        <div className="space-y-3">
          <div>
            <h4 className="font-bold text-black text-xs uppercase">Invoice Amount In Words</h4>
            <p className="text-xs text-gray-800 font-medium mt-0.5">{amountInWords}</p>
          </div>

          <div>
            <h4 className="font-bold text-black text-xs uppercase mb-1">Terms And Conditions</h4>
            <div className="text-[10px] text-gray-700 space-y-1 whitespace-pre-line leading-relaxed">
              {tpl.terms_and_conditions}
            </div>
          </div>

          {/* UPI QR Code */}
          {effectiveQrDataUri && bp.show_qr_code !== false && (
            <div className="pt-2">
              <div className="inline-block p-2 border border-gray-200 rounded-xl bg-white text-center shadow-xs">
                <img src={effectiveQrDataUri} alt="UPI QR Code" className="w-20 h-20 mx-auto" />
                <div className="mt-1 text-[10px] font-bold text-slate-900 tracking-wide">
                  Scan & Pay
                </div>
                {bp.show_upi_text !== false && bp.upi_id && (
                  <div className="text-[9px] text-slate-600 font-mono mt-0.5 max-w-[120px] break-all leading-tight">
                    UPI ID: <span className="font-bold">{bp.upi_id}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side Summary & Signature */}
        <div className="flex flex-col justify-between">
          <div className="border border-gray-200 rounded p-2.5 space-y-1.5 bg-gray-50/50 text-xs">
            <div className="flex justify-between text-gray-700">
              <span>Sub Total</span>
              <span className="font-medium">₹ {parseFloat(bill.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Discount</span>
              <span className="font-medium">₹ {parseFloat(bill.discount_total || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between bg-[#2563EB] text-white font-bold p-1.5 rounded">
              <span>Total</span>
              <span>₹ {parseFloat(bill.grand_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700 pt-0.5">
              <span>Received</span>
              <span className="font-medium">₹ {parseFloat(bill.received_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Balance</span>
              <span className="font-medium">₹ {parseFloat(bill.balance_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>You Saved</span>
              <span className="font-medium">₹ {parseFloat(bill.discount_total || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Signature Area */}
          <div className="text-right mt-6 pt-2">
            <p className="text-xs text-gray-500">For: {bp.business_name || 'Memotrix'}</p>
            <div className="font-bold text-sm text-slate-900 my-2 border-b-2 border-slate-900 inline-block pb-0.5">
              {bill.executed_by || tpl.executed_by_value || 'Authorized Signatory'}
            </div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              {tpl.executed_by_label || 'Authorized Signatory'}
            </p>
          </div>
        </div>
      </div>

      {/* 6. Acknowledgment Section (Tear-Off) */}
      <div className="mt-6 pt-3 border-t border-dashed border-gray-400">
        <div className="text-center mb-2">
          <span className="text-[11px] font-bold text-gray-700 uppercase block">{tpl.footer_content || 'Acknowledgment'}</span>
          <h3 className="text-sm font-bold text-[#2563EB]">{tpl.disclaimer_text || bp.business_name || 'Memotrix'}</h3>
        </div>

        <div className="grid grid-cols-3 gap-4 text-xs mt-2">
          <div>
            <span className="text-[#0B8A3E] font-semibold text-[10px] block">Invoice To:</span>
            <p className="font-bold text-gray-900">{bill.customer_name}</p>
          </div>
          <div>
            <span className="text-[#0B8A3E] font-semibold text-[10px] block">Invoice Details:</span>
            <p className="text-gray-900">Invoice Date : {bill.bill_date}</p>
            <p className="text-gray-900">Invoice Amount : {bill.grand_total}</p>
          </div>
          <div className="text-right flex flex-col justify-end">
            <div className="border-b border-dotted border-gray-400 mb-1 w-32 ml-auto"></div>
            <span className="text-[10px] text-gray-600 font-medium">Receiver's Seal & Sign</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}

export default InvoiceView;
