import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { productsApi, customersApi, billsApi, couponsApi, settingsApi } from '../../api/endpoints';
import { Search, Plus, Trash2, CheckCircle, PlusCircle, Save, Check, RefreshCw, X, ChevronDown, Mail, Layers, User, Phone, Tag } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export function ProductBillingForm({ onInvoiceCreated }) {
  const { showToast } = useToast();
  const { templateSettings } = useAuth();
  const {
    draft,
    updateDraft,
    saveStatus,
    restoredBannerInfo,
    setRestoredBannerInfo,
    clearDraft,
    discardDraft
  } = useCart();

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  // Free-text / Catalog Custom Item State
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customDiscount, setCustomDiscount] = useState('0');

  const [couponCode, setCouponCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Multi-tender payment state toggle
  const [isMultiTender, setIsMultiTender] = useState(false);
  const [tenderMethod, setTenderMethod] = useState('cash');
  const [tenderAmount, setTenderAmount] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const [executedByTouched, setExecutedByTouched] = useState(false);

  // Populate default signatory from templateSettings once on mount if untouched
  useEffect(() => {
    if (!executedByTouched && draft.executedBy === undefined && templateSettings?.executed_by_value) {
      updateDraft({ executedBy: templateSettings.executed_by_value });
    }
  }, [templateSettings, draft.executedBy, executedByTouched, updateDraft]);

  const fetchData = async () => {
    try {
      const pRes = await productsApi.getAll({ activeOnly: 'true' });
      setProducts(pRes.data.products || []);
      const cRes = await customersApi.getAll();
      setCustomers(cRes.data.customers || []);
    } catch (e) {
      console.error(e);
    }
  };

  const selectCatalogItem = (prod) => {
    setSelectedProductId(prod.id);
    setCustomName(prod.name);
    setCustomPrice(prod.retail_price.toString());
    setIsCatalogOpen(false);
    setProductSearch('');
  };

  const addCustomItem = async (e) => {
    if (e) e.preventDefault();
    if (!customName.trim() || !customPrice || parseFloat(customPrice) <= 0) {
      showToast('Please enter a valid Item Name and Price/Rate.', 'warning');
      return;
    }

    let prodId = selectedProductId;

    if (!prodId) {
      const existingProd = products.find(p => p.name.toLowerCase() === customName.trim().toLowerCase());
      if (existingProd) {
        prodId = existingProd.id;
      } else {
        try {
          const pRes = await productsApi.create({
            name: customName.trim(),
            retail_price: parseFloat(customPrice),
            category: 'General',
            stock_quantity: 100
          });
          if (pRes.data?.product?.id) {
            prodId = pRes.data.product.id;
            fetchData();
          }
        } catch (pErr) {
          console.warn('[INVOICE] Catalog auto-register warning:', pErr);
        }
      }
    }

    const newItem = {
      product_id: prodId || null,
      item_name: customName.trim(),
      hsn_sac: '',
      quantity: parseInt(customQty) || 1,
      unit_price: parseFloat(customPrice),
      discount_amount: parseFloat(customDiscount || 0)
    };

    updateDraft(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, newItem]
    }));

    setSelectedProductId(null);
    setCustomName('');
    setCustomPrice('');
    setCustomQty('1');
    setCustomDiscount('0');
    showToast(`Added "${newItem.item_name}" to invoice.`, 'success');
  };

  const removeLineItem = (index) => {
    updateDraft(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index)
    }));
  };

  const updateLineItemQuantity = (index, qty) => {
    const parsed = parseInt(qty) || 1;
    updateDraft(prev => {
      const copy = [...prev.lineItems];
      copy[index] = { ...copy[index], quantity: Math.max(1, parsed) };
      return { ...prev, lineItems: copy };
    });
  };

  const updateLineItemPrice = (index, price) => {
    const parsed = parseFloat(price) || 0;
    updateDraft(prev => {
      const copy = [...prev.lineItems];
      copy[index] = { ...copy[index], unit_price: Math.max(0, parsed) };
      return { ...prev, lineItems: copy };
    });
  };

  const updateLineItemDiscount = (index, disc) => {
    const parsed = parseFloat(disc) || 0;
    updateDraft(prev => {
      const copy = [...prev.lineItems];
      copy[index] = { ...copy[index], discount_amount: Math.max(0, parsed) };
      return { ...prev, lineItems: copy };
    });
  };

  const addTenderPayment = () => {
    const amt = parseFloat(tenderAmount);
    if (!amt || amt <= 0) return;
    const newPayment = { payment_method: tenderMethod, amount: amt };
    updateDraft(prev => ({
      ...prev,
      payments: [...(prev.payments || []), newPayment]
    }));
    setTenderAmount('');
  };

  const removeTenderPayment = (index) => {
    updateDraft(prev => ({
      ...prev,
      payments: (prev.payments || []).filter((_, i) => i !== index)
    }));
  };

  const subtotal = draft.lineItems.reduce((sum, item) => {
    const lineTotal = (item.unit_price * item.quantity) - (item.discount_amount || 0);
    return sum + Math.max(0, lineTotal);
  }, 0);

  let couponDiscount = 0;
  if (draft.couponApplied) {
    couponDiscount = draft.couponApplied.discount_type === 'percent' ? (subtotal * draft.couponApplied.value) / 100 : draft.couponApplied.value;
  }
  const grandTotal = Math.max(0, subtotal - couponDiscount);

  let totalReceived = 0;
  if (isMultiTender && draft.payments && draft.payments.length > 0) {
    totalReceived = draft.payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  } else {
    totalReceived = draft.receivedAmount !== '' ? parseFloat(draft.receivedAmount) : grandTotal;
  }

  const handleCreateInvoice = async () => {
    const custName = (draft.newCustomerName || draft.selectedCustomer?.name || '').trim();
    const custPhone = (draft.newCustomerPhone || draft.selectedCustomer?.phone || '').trim();
    const custEmail = (draft.newCustomerEmail || draft.selectedCustomer?.email || '').trim();
    const custAddress = (draft.newCustomerAddress || draft.selectedCustomer?.address || '').trim();
    const custGstin = (draft.newCustomerGstin || draft.selectedCustomer?.gstin || '').trim();

    if (!custName) {
      showToast('Please enter or select a Customer Name.', 'warning');
      return;
    }

    if (custEmail && custEmail.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(custEmail.trim())) {
        showToast('Please enter a valid Customer Email address.', 'warning');
        return;
      }
    }

    if (draft.lineItems.length === 0) {
      showToast('Please add at least one line item before generating invoice.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      let custId = draft.selectedCustomer ? draft.selectedCustomer.id : null;

      const finalPayments = isMultiTender && draft.payments && draft.payments.length > 0
        ? draft.payments
        : [{ payment_method: draft.paymentMethod, amount: totalReceived }];

      const res = await billsApi.create({
        customer_id: custId,
        customer_name: custName,
        customer_phone: custPhone,
        customer_email: custEmail,
        customer_address: custAddress,
        customer_gstin: custGstin,
        due_date: draft.dueDate || null,
        items: draft.lineItems,
        payments: finalPayments,
        coupon_code: draft.couponApplied ? draft.couponApplied.code : null,
        notes: draft.notes,
        executed_by: draft.executedBy,
        invoice_type: draft.invoiceType || 'tax_invoice'
      });

      await clearDraft();
      const savedSignatory = templateSettings?.executed_by_value || 'Authorized Signatory';
      updateDraft({ executedBy: savedSignatory });
      showToast(`Invoice #${res.data.bill.bill_number} generated successfully!`, 'success');

      // Refresh customers list immediately so new/updated customer shows up next time everywhere
      fetchData();

      if (onInvoiceCreated) {
        onInvoiceCreated(res.data.bill.id);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to generate invoice', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* RESTORE DRAFT BANNER */}
      {restoredBannerInfo && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 text-amber-600 animate-spin-slow" />
            <span className="text-xs font-bold">
              Restored unfinished draft for <strong>{restoredBannerInfo.name}</strong> from {restoredBannerInfo.time}.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setRestoredBannerInfo(null)}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-xs"
            >
              Keep Editing
            </button>
            <button
              onClick={async () => {
                await discardDraft();
                const savedSignatory = templateSettings?.executed_by_value || 'Authorized Signatory';
                updateDraft({ executedBy: savedSignatory });
              }}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 font-bold border border-amber-400 rounded-xl text-xs cursor-pointer"
            >
              Discard & New
            </button>
          </div>
        </div>
      )}

      {/* AUTO-SAVE STATUS INDICATOR */}
      <div className="flex justify-end items-center space-x-2 text-xs font-bold text-slate-500 dark:text-slate-400 pr-1">
        {saveStatus === 'saving' && (
          <span className="inline-flex items-center text-amber-600 dark:text-amber-400 animate-pulse">
            ● Saving draft...
          </span>
        )}
        {(saveStatus === 'saved' || saveStatus === 'restored') && (
          <span className="inline-flex items-center text-blue-600 dark:text-blue-400">
            ✓ Draft Auto-Saved {draft.lastSavedAt ? `(${new Date(draft.lastSavedAt).toLocaleTimeString()})` : ''}
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
        {/* Left Column (65% Width): Customer & Line Items */}
        <div className="lg:w-[65%] w-full space-y-6 flex-1 min-w-0">
          
          {/* SECTION 1: CUSTOMER DETAILS */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-600" />
              1. Customer Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Document Type *
                </label>
                <select
                  value={draft.invoiceType || 'tax_invoice'}
                  onChange={e => updateDraft({ invoiceType: e.target.value })}
                  className="w-full p-3 form-select text-xs font-bold"
                >
                  <option value="tax_invoice">Tax Invoice (GST)</option>
                  <option value="receipt">Cash Receipt</option>
                  <option value="estimate">Estimate / Proforma</option>
                  <option value="quotation">Commercial Quotation</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Select Registered Customer
                  </label>
                  {draft.selectedCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        updateDraft({
                          selectedCustomer: null,
                          newCustomerName: '',
                          newCustomerPhone: '',
                          newCustomerEmail: '',
                          newCustomerAddress: '',
                          newCustomerGstin: ''
                        });
                      }}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                    >
                      + Clear / New Customer
                    </button>
                  )}
                </div>
                <select
                  value={draft.selectedCustomer ? draft.selectedCustomer.id : ''}
                  onChange={e => {
                    const found = customers.find(c => c.id === e.target.value);
                    if (found) {
                      updateDraft({
                        selectedCustomer: found,
                        newCustomerName: found.name || '',
                        newCustomerPhone: found.phone || '',
                        newCustomerEmail: found.email || '',
                        newCustomerAddress: found.address || '',
                        newCustomerGstin: found.gstin || ''
                      });
                    } else {
                      updateDraft({
                        selectedCustomer: null,
                        newCustomerName: '',
                        newCustomerPhone: '',
                        newCustomerEmail: '',
                        newCustomerAddress: '',
                        newCustomerGstin: ''
                      });
                    }
                  }}
                  className="w-full p-3 form-select text-xs"
                >
                  <option value="">-- Choose Existing Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                  ))}
                </select>
              </div>

              {draft.selectedCustomer && (
                <div className="bg-blue-50/80 dark:bg-blue-950/40 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center justify-between text-xs">
                  <div className="text-blue-900 dark:text-blue-200">
                    <span className="font-bold">Customer Profile:</span> {draft.selectedCustomer.name}
                    {draft.selectedCustomer.phone && <span className="ml-1 text-slate-600 dark:text-slate-400">({draft.selectedCustomer.phone})</span>}
                  </div>
                  <span className="text-[10px] bg-blue-200/60 dark:bg-blue-900/60 px-2 py-0.5 rounded font-bold text-blue-800 dark:text-blue-300">
                    Auto-Linked
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    placeholder="Enter customer name..."
                    value={draft.newCustomerName || ''}
                    onChange={e => updateDraft({ newCustomerName: e.target.value })}
                    className="w-full p-3 form-input text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      value={draft.newCustomerPhone || ''}
                      onChange={e => updateDraft({ newCustomerPhone: e.target.value })}
                      className="w-full p-2.5 form-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="customer@email.com"
                      value={draft.newCustomerEmail || ''}
                      onChange={e => updateDraft({ newCustomerEmail: e.target.value })}
                      className="w-full p-2.5 form-input text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Billing Address</label>
                  <input
                    type="text"
                    placeholder="Customer billing / delivery address..."
                    value={draft.newCustomerAddress || ''}
                    onChange={e => updateDraft({ newCustomerAddress: e.target.value })}
                    className="w-full p-2.5 form-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 33AAAAA0000A1Z5"
                    value={draft.newCustomerGstin || ''}
                    onChange={e => updateDraft({ newCustomerGstin: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 form-input text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Executed By Label / Signatory Name
              </label>
              <input
                type="text"
                placeholder="e.g. Authorized Signatory / Jane Doe"
                value={draft.executedBy ?? ''}
                onChange={e => {
                  setExecutedByTouched(true);
                  updateDraft({ executedBy: e.target.value });
                }}
                className="w-full p-2.5 form-input text-xs font-semibold"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                This name will be saved with the invoice and rendered on the PDF signature line. If left blank, defaults to "Authorized Signatory".
              </p>
            </div>
          </div>

          {/* SECTION 2: PRODUCT SELECTION */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base flex items-center">
              <Tag className="w-5 h-5 mr-2 text-blue-600" />
              2. Product Selection & Catalog Entry
            </h3>

            {/* Expandable Catalog Selector Combobox */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Search Product Dropdown
              </label>
              <div
                onClick={() => setIsCatalogOpen(!isCatalogOpen)}
                className="w-full p-3 form-input flex justify-between items-center cursor-pointer text-xs"
              >
                <div className="flex items-center space-x-2 truncate">
                  <Search className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="font-semibold truncate text-slate-900 dark:text-slate-100">
                    {customName && selectedProductId ? `Selected: ${customName}` : 'Click to search active catalog dropdown...'}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transform transition-transform ${isCatalogOpen ? 'rotate-180' : ''}`} />
              </div>

              {isCatalogOpen && (
                <div className="absolute z-30 left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-2 max-h-60 overflow-y-auto">
                  <div className="p-1 mb-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search active products by name or SKU..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="w-full p-2.5 form-input text-xs"
                    />
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">No matching products found</div>
                    ) : (
                      filteredProducts.map(prod => (
                        <div
                          key={prod.id}
                          onClick={() => selectCatalogItem(prod)}
                          className="p-3 hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-pointer rounded-xl flex justify-between items-center transition text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100 block">{prod.name}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">SKU: {prod.sku} | Stock: {prod.stock_quantity}</span>
                          </div>
                          <span className="font-black text-blue-600 dark:text-blue-400">₹{prod.retail_price}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Line Item Entry Row */}
            <div className="bg-blue-50/60 dark:bg-slate-800/60 p-4 rounded-2xl border border-blue-100 dark:border-slate-700">
              <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 mb-2 uppercase tracking-wider flex items-center">
                <PlusCircle className="w-4 h-4 mr-1.5 text-blue-600" />
                Add Product Row (Direct Edit or Custom Item)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <input
                  type="text"
                  placeholder="Product/Service Name *"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="sm:col-span-2 p-2.5 form-input text-xs"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Rate ₹ *"
                  value={customPrice}
                  onChange={e => setCustomPrice(e.target.value)}
                  className="p-2.5 form-input text-xs"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={customQty}
                  onChange={e => setCustomQty(e.target.value)}
                  className="p-2.5 form-input text-xs text-center"
                />
                <button
                  onClick={addCustomItem}
                  className="btn-primary py-2.5 text-xs font-bold"
                >
                  + Add Product
                </button>
              </div>
            </div>

            {/* SECTION 3: INVOICE ITEMS TABLE */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden mt-4 shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Item / Service Name</th>
                    <th className="p-3 text-center w-20">Qty</th>
                    <th className="p-3 text-right">Price / Rate (₹)</th>
                    <th className="p-3 text-right">Discount (₹)</th>
                    <th className="p-3 text-right">Line Total (₹)</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {draft.lineItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-slate-400 font-medium">
                        No products added yet. Select from catalog dropdown or add a product row above.
                      </td>
                    </tr>
                  ) : (
                    draft.lineItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                          {item.item_name}
                          {!item.product_id && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded font-bold">Free-text</span>}
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => updateLineItemQuantity(idx, e.target.value)}
                            className="w-14 p-1.5 form-input text-center text-xs"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={e => updateLineItemPrice(idx, e.target.value)}
                            className="w-20 p-1.5 form-input text-right text-xs"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            value={item.discount_amount}
                            onChange={e => updateLineItemDiscount(idx, e.target.value)}
                            className="w-20 p-1.5 form-input text-right text-xs"
                          />
                        </td>
                        <td className="p-3 text-right font-black text-blue-600 dark:text-blue-400">
                          ₹{((item.unit_price * item.quantity) - item.discount_amount).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <button onClick={() => removeLineItem(idx)} className="p-1 text-rose-500 hover:text-rose-700 transition">
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

        {/* Right Column (35% Width): Payment Details & Invoice Summary (Sticky on Desktop) */}
        <div className="lg:w-[35%] w-full space-y-6 lg:sticky lg:top-6 self-start flex-shrink-0">
          
          {/* SECTION 4: PAYMENT DETAILS */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">4. Payment Details</h3>
              <button
                type="button"
                onClick={() => setIsMultiTender(!isMultiTender)}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center"
              >
                <Layers className="w-3.5 h-3.5 mr-1" />
                {isMultiTender ? 'Single Payment' : 'Split Multi-Tender'}
              </button>
            </div>

            {!isMultiTender ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={draft.paymentMethod}
                    onChange={e => updateDraft({ paymentMethod: e.target.value })}
                    className="w-full p-3 form-select text-xs font-bold"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / Online Transfer</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="credit">Store Credit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Amount Received (₹)</label>
                  <input
                    type="number"
                    placeholder={`₹${grandTotal.toFixed(2)}`}
                    value={draft.receivedAmount}
                    onChange={e => updateDraft({ receivedAmount: e.target.value })}
                    className="w-full p-3 form-input text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3 bg-blue-50/60 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-blue-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-blue-900 dark:text-blue-300">Split Multi-Tender Entries</label>
                <div className="flex space-x-2">
                  <select
                    value={tenderMethod}
                    onChange={e => setTenderMethod(e.target.value)}
                    className="p-2 form-select text-xs"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Amount ₹"
                    value={tenderAmount}
                    onChange={e => setTenderAmount(e.target.value)}
                    className="w-24 p-2 form-input text-xs"
                  />
                  <button
                    onClick={addTenderPayment}
                    className="px-3 py-2 btn-primary text-xs font-bold"
                  >
                    + Add
                  </button>
                </div>

                <div className="space-y-1.5 pt-1">
                  {(draft.payments || []).map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                      <span className="font-bold uppercase text-slate-800 dark:text-slate-200">{p.payment_method}</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-blue-600 dark:text-blue-400">₹{p.amount.toFixed(2)}</span>
                        <button onClick={() => removeTenderPayment(idx)} className="text-rose-500 hover:text-rose-700">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Due Date (Optional)</label>
              <input
                type="date"
                value={draft.dueDate}
                onChange={e => updateDraft({ dueDate: e.target.value })}
                className="w-full p-3 form-input text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Remarks</label>
              <input
                type="text"
                placeholder="Special instructions or notes..."
                value={draft.notes}
                onChange={e => updateDraft({ notes: e.target.value })}
                className="w-full p-3 form-input text-xs"
              />
            </div>
          </div>

          {/* SECTION 5: INVOICE SUMMARY & GENERATE BUTTON */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-black text-slate-900 dark:text-slate-100 text-base border-b border-slate-100 dark:border-slate-800 pb-3">
              Invoice Summary
            </h3>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 font-semibold">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-slate-900 dark:text-slate-100 font-bold">₹{subtotal.toFixed(2)}</span>
              </div>

              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Coupon Discount</span>
                  <span>- ₹{couponDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-lg font-black text-blue-600 dark:text-blue-400 border-t border-slate-200 dark:border-slate-800 pt-3">
                <span>Grand Total</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCreateInvoice}
              disabled={isSubmitting}
              className="w-full btn-primary py-4 text-sm font-bold shadow-xl shadow-blue-600/30"
            >
              <CheckCircle className="w-5 h-5" />
              <span>{isSubmitting ? 'Generating Invoice...' : 'Generate Invoice'}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default ProductBillingForm;
