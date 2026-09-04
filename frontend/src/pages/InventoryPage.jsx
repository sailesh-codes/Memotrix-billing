import React, { useState, useEffect } from 'react';
import { inventoryApi, productsApi } from '../api/endpoints';
import { Warehouse, Plus, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export function InventoryPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [productId, setProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [changeQty, setChangeQty] = useState('5');
  const [reasonCode, setReasonCode] = useState('restock');
  const [notes, setNotes] = useState('');
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchLogs();
    fetchProducts();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await inventoryApi.getLogs();
      setLogs(res.data.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await productsApi.getAll();
      setProducts(res.data.products || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    if (!productId) {
      showToast('Please select a product to adjust.', 'warning');
      return;
    }
    try {
      await inventoryApi.adjust({
        product_id: productId,
        change_qty: parseInt(changeQty),
        reason_code: reasonCode,
        notes,
        adjustment_date: adjustmentDate
      });
      showToast('Inventory stock adjusted successfully!', 'success');
      setShowModal(false);
      setNotes('');
      setProductId('');
      fetchLogs();
      fetchProducts();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to adjust stock', 'error');
    }
  };

  const filteredPickerProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Logs & Stock Adjustments</h1>
          <p className="text-sm text-gray-500">Track stock restocking, damaged goods, returns, and backdated corrections</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl shadow-sm transition flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Adjust Stock</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading inventory logs...</div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-100 text-gray-600 font-bold uppercase border-b">
              <tr>
                <th className="p-3">Adjustment Date</th>
                <th className="p-3">Product Name</th>
                <th className="p-3">SKU</th>
                <th className="p-3 text-center">Change Qty</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => {
                const isPositive = log.change_qty > 0;
                const dateStr = log.adjustment_date ? new Date(log.adjustment_date).toLocaleDateString() : new Date(log.created_at).toLocaleDateString();
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-500 font-mono">{dateStr}</td>
                    <td className="p-3 font-semibold text-gray-900">{log.product_name}</td>
                    <td className="p-3 font-mono text-gray-600">{log.sku}</td>
                    <td className="p-3 text-center font-bold">
                      <span className={`px-2 py-0.5 rounded-full inline-flex items-center text-[10px] ${
                        isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                        {log.change_qty > 0 ? `+${log.change_qty}` : log.change_qty}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-gray-800 uppercase">{log.reason_code}</td>
                    <td className="p-3 text-gray-600">{log.notes || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Search & Select Product to Adjust</h3>

            {/* Searchable Product Picker */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Search Active Product</label>
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter product by name or SKU..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded text-xs"
                />
              </div>
              <div className="max-h-36 overflow-y-auto border border-gray-200 rounded p-1 divide-y divide-gray-100">
                {filteredPickerProducts.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setProductId(p.id)}
                    className={`p-2 text-xs rounded cursor-pointer flex justify-between items-center ${
                      productId === p.id ? 'bg-brand-50 border border-brand-700 font-bold text-brand-900' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span>{p.name} <span className="font-mono text-gray-400">({p.sku})</span></span>
                    <span className="text-gray-500">Current Stock: <strong>{p.stock_quantity}</strong></span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleAdjust} className="space-y-3 pt-2 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity Change (+ / -) *</label>
                  <input
                    type="number"
                    required
                    value={changeQty}
                    onChange={e => setChangeQty(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Adjustment Date (Supports Backdating)</label>
                  <input
                    type="date"
                    value={adjustmentDate}
                    onChange={e => setAdjustmentDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason Code *</label>
                <select
                  value={reasonCode}
                  onChange={e => setReasonCode(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm font-semibold"
                >
                  <option value="restock">Restock / New Inventory Received</option>
                  <option value="damage">Damaged / Expired Stock Disposal</option>
                  <option value="return">Customer Return</option>
                  <option value="audit_correction">Manual Inventory Audit Correction</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Backdated correction for physical count on Monday"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex space-x-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-brand-700 hover:bg-brand-800 text-white rounded-lg"
                >
                  Submit Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryPage;
