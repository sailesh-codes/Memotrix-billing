import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { productsApi } from '../api/endpoints';
import { Plus, Search, Barcode, AlertTriangle, Package, Tag, TrendingUp, X } from 'lucide-react';

export function ProductsPage() {
  const { featureFlags } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [barcodeModalProd, setBarcodeModalProd] = useState(null);

  // Form state
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [hsnSac, setHsnSac] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('10');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await productsApi.getAll();
      setProducts(res.data.products || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await productsApi.create({
        sku,
        name,
        category,
        hsn_sac: hsnSac,
        cost_price: parseFloat(costPrice || 0),
        retail_price: parseFloat(retailPrice),
        stock_quantity: parseInt(stockQuantity),
        low_stock_threshold: parseInt(lowStockThreshold)
      });
      setShowModal(false);
      setSku('');
      setName('');
      setCategory('General');
      setCostPrice('');
      setRetailPrice('');
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create product');
    }
  };

  // Derive unique categories
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category || p.category_name || 'General')))];

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || (p.category || p.category_name || 'General') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Product & Service Catalog</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Inventory management, selling prices, profit margins & barcode labels</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary py-2.5 px-4 text-xs font-bold shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* FILTER & CATEGORY TABS BAR */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search active products by name, SKU, or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 form-input text-xs"
            />
          </div>

          <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* PRODUCTS TABLE */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 font-semibold">Loading catalog products...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">SKU</th>
                  <th className="p-3.5">Product Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">HSN/SAC</th>
                  <th className="p-3.5 text-right">Cost Price</th>
                  <th className="p-3.5 text-right">Selling Price</th>
                  <th className="p-3.5 text-right">Profit Margin</th>
                  <th className="p-3.5 text-center">Stock Status</th>
                  {featureFlags?.barcode_enabled && <th className="p-3.5 text-center">Barcode</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-6 text-center text-slate-400">No matching products found</td>
                  </tr>
                ) : (
                  filtered.map(p => {
                    const isLowStock = p.stock_quantity <= p.low_stock_threshold;
                    const cost = parseFloat(p.cost_price || 0);
                    const retail = parseFloat(p.retail_price || 0);
                    const profitMargin = retail > 0 ? (((retail - cost) / retail) * 100).toFixed(1) : '0';

                    return (
                      <tr key={p.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition">
                        <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">{p.sku}</td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">{p.name}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                            {p.category || p.category_name || 'General'}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 font-mono">{p.hsn_sac || '-'}</td>
                        <td className="p-3.5 text-right text-slate-500 font-mono">₹{cost.toFixed(2)}</td>
                        <td className="p-3.5 text-right font-black text-slate-900 dark:text-slate-100 font-mono">₹{retail.toFixed(2)}</td>
                        <td className="p-3.5 text-right">
                          <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            {profitMargin}%
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center ${
                            isLowStock
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          }`}>
                            {isLowStock && <AlertTriangle className="w-3 h-3 mr-1" />}
                            {p.stock_quantity} Units
                          </span>
                        </td>
                        {featureFlags?.barcode_enabled && (
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => setBarcodeModalProd(p)}
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 rounded-xl"
                              title="Generate Barcode"
                            >
                              <Barcode className="w-4 h-4 text-blue-600" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE PRODUCT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Create New Product</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <p className="text-xs text-rose-600 font-bold">{typeof error === 'object' ? (error.message || JSON.stringify(error)) : String(error)}</p>}

            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">SKU *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FRAME-A4"
                  value={sku}
                  onChange={e => setSku(e.target.value)}
                  className="w-full p-2.5 form-input text-xs uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Premium A4 Frame"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-2.5 form-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Frames"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full p-2.5 form-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">HSN/SAC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 4414"
                    value={hsnSac}
                    onChange={e => setHsnSac(e.target.value)}
                    className="w-full p-2.5 form-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 150.00"
                    value={costPrice}
                    onChange={e => setCostPrice(e.target.value)}
                    className="w-full p-2.5 form-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 299.00"
                    value={retailPrice}
                    onChange={e => setRetailPrice(e.target.value)}
                    className="w-full p-2.5 form-input text-xs font-bold text-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Stock Qty *</label>
                  <input
                    type="number"
                    required
                    value={stockQuantity}
                    onChange={e => setStockQuantity(e.target.value)}
                    className="w-full p-2.5 form-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    value={lowStockThreshold}
                    onChange={e => setLowStockThreshold(e.target.value)}
                    className="w-full p-2.5 form-input text-xs"
                  />
                </div>
              </div>

              <div className="flex space-x-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2 px-4 text-xs font-bold shadow-lg shadow-blue-600/20"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductsPage;
