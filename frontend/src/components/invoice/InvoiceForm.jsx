import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { productsApi, customersApi, billsApi, couponsApi } from '../../api/endpoints';
import { Search, Plus, Trash2, UserPlus, Tag, CreditCard, QrCode, CheckCircle } from 'lucide-react';

export function InvoiceForm({ onInvoiceCreated }) {
  const {
    selectedCustomer,
    setSelectedCustomer,
    cartItems,
    addItem,
    updateQuantity,
    updateItemDiscount,
    removeItem,
    clearCart,
    coupon,
    setCoupon,
    notes,
    setNotes,
    payments,
    setPayments,
    executedBy,
    setExecutedBy,
    totals
  } = useCart();

  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await productsApi.getAll({ activeOnly: 'true' });
      setProducts(res.data.products || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await customersApi.getAll();
      setCustomers(res.data.customers || []);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleApplyCoupon = async () => {
    setCouponError('');
    try {
      const res = await couponsApi.validate({ code: couponInput, orderAmount: totals.subtotal });
      setCoupon(res.data.coupon);
      setCouponInput('');
    } catch (err) {
      setCouponError(err.response?.data?.error || 'Failed to apply coupon');
    }
  };

  const handleCreateInvoice = async () => {
    const custName = selectedCustomer ? selectedCustomer.name : newCustomerName;
    const custPhone = selectedCustomer ? selectedCustomer.phone : newCustomerPhone;

    if (!custName) {
      showToast('Please select or enter a Customer Name.', 'warning');
      return;
    }
    if (cartItems.length === 0) {
      showToast('Cart is empty. Please add at least one product.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      let custId = selectedCustomer ? selectedCustomer.id : null;
      if (!selectedCustomer && newCustomerName) {
        const cRes = await customersApi.create({ name: newCustomerName, phone: newCustomerPhone || '' });
        custId = cRes.data.customer.id;
      }

      // Default single cash payment if split payment amounts not set
      const formattedPayments = payments.map(p => ({
        ...p,
        amount: p.amount > 0 ? p.amount : totals.grandTotal
      }));

      const res = await billsApi.create({
        customer_id: custId,
        customer_name: custName,
        customer_phone: custPhone,
        items: cartItems,
        payments: formattedPayments,
        coupon_code: coupon ? coupon.code : null,
        notes,
        executed_by: executedBy
      });

      clearCart();
      showToast(`Invoice #${res.data.bill.bill_number} generated successfully!`, 'success');
      if (onInvoiceCreated) {
        onInvoiceCreated(res.data.bill.id);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to generate bill', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Cols: Product Catalog & Cart items */}
      <div className="lg:col-span-2 space-y-6">
        {/* Product Catalog Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900">Product Selection</h3>
            <span className="text-xs text-gray-500">{products.length} products active</span>
          </div>
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search product by name or SKU..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-56 overflow-y-auto pr-1">
            {filteredProducts.map(prod => (
              <button
                key={prod.id}
                onClick={() => addItem(prod)}
                className="p-3 border border-gray-200 rounded-lg text-left hover:border-brand-700 hover:bg-brand-50 transition flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-mono text-gray-400 block">{prod.sku}</span>
                  <span className="text-sm font-semibold text-gray-800 line-clamp-1">{prod.name}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-brand-700">₹{prod.retail_price}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${prod.stock_quantity > 5 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    Qty: {prod.stock_quantity}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart Table */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Cart Items ({cartItems.length})</h3>
            {cartItems.length > 0 && (
              <button onClick={clearCart} className="text-xs text-red-600 hover:underline">
                Clear Cart
              </button>
            )}
          </div>

          {cartItems.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              No items in cart. Click a product above to add.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 text-gray-600 font-bold uppercase">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-right">Price</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Discount</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cartItems.map(item => (
                    <tr key={item.product_id}>
                      <td className="p-2 font-medium text-gray-900">{item.item_name}</td>
                      <td className="p-2 text-right">₹{item.unit_price}</td>
                      <td className="p-2 text-center">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            className="w-5 h-5 bg-gray-200 rounded text-gray-700 flex items-center justify-center font-bold"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-bold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            className="w-5 h-5 bg-gray-200 rounded text-gray-700 flex items-center justify-center font-bold"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          value={item.discount_amount}
                          onChange={e => updateItemDiscount(item.product_id, e.target.value, item.discount_percent)}
                          placeholder="₹"
                          className="w-16 p-1 border rounded text-right text-xs"
                        />
                      </td>
                      <td className="p-2 text-right font-bold text-brand-700">
                        ₹{(item.unit_price * item.quantity - item.discount_amount).toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => removeItem(item.product_id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Col: Customer, Billing Details & Checkout */}
      <div className="space-y-6">
        {/* Customer Select */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-3">Customer Details</h3>
          <div className="space-y-3">
            <select
              value={selectedCustomer ? selectedCustomer.id : ''}
              onChange={e => {
                const found = customers.find(c => c.id === e.target.value);
                setSelectedCustomer(found || null);
              }}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-700"
            >
              <option value="">-- Select Registered Customer --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) - {c.customer_type.toUpperCase()}
                </option>
              ))}
            </select>

            {!selectedCustomer && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <input
                  type="text"
                  placeholder="Customer Name *"
                  value={newCustomerName}
                  onChange={e => setNewCustomerName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Customer Phone"
                  value={newCustomerPhone}
                  onChange={e => setNewCustomerPhone(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Coupon Code */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-2 flex items-center">
            <Tag className="w-4 h-4 mr-2 text-brand-700" />
            Coupon Discount
          </h3>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="e.g. WELCOME10"
              value={couponInput}
              onChange={e => setCouponInput(e.target.value)}
              className="flex-1 p-2 border border-gray-300 rounded-lg text-sm uppercase"
            />
            <button
              onClick={handleApplyCoupon}
              className="px-3 py-2 bg-gray-800 text-white rounded-lg text-xs font-semibold hover:bg-gray-900"
            >
              Apply
            </button>
          </div>
          {couponError && <p className="text-xs text-red-600 mt-1">{couponError}</p>}
          {coupon && (
            <p className="text-xs text-green-700 font-bold mt-1">
              ✓ Coupon '{coupon.code}' Applied!
            </p>
          )}
        </div>

        {/* Summary & Generate Button */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
          <h3 className="font-bold text-gray-900 border-b pb-2">Payment Summary</h3>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>₹{totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Total Discount</span>
            <span>- ₹{totals.totalDiscount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-extrabold text-brand-700 border-t pt-2">
            <span>Grand Total</span>
            <span>₹{totals.grandTotal.toFixed(2)}</span>
          </div>

          <div className="pt-2">
            <label className="text-xs font-bold text-gray-600">Bill Executed By:</label>
            <input
              type="text"
              value={executedBy}
              onChange={e => setExecutedBy(e.target.value)}
              className="w-full p-2 mt-1 border border-gray-300 rounded-lg text-sm font-semibold text-gray-800"
            />
          </div>

          <button
            onClick={handleCreateInvoice}
            disabled={isSubmitting}
            className="w-full py-3 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center space-x-2"
          >
            <CheckCircle className="w-5 h-5" />
            <span>{isSubmitting ? 'Generating Invoice...' : 'Generate Invoice'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default InvoiceForm;
