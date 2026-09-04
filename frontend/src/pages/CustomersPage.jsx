import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { customersApi, billsApi } from '../api/endpoints';
import { UserPlus, Search, Award, FileText, X, Phone, Mail, MapPin, User, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function CustomersPage() {
  const { featureFlags } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerBills, setCustomerBills] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [customerType, setCustomerType] = useState('retail');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await customersApi.getAll();
      setCustomers(res.data.customers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    setLoadingHistory(true);
    try {
      const res = await billsApi.getAll({ customerId: cust.id });
      setCustomerBills(res.data.bills || []);
    } catch (err) {
      console.error('Failed to fetch customer bills:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await customersApi.create({ name, phone, email, address, customer_type: customerType });
      setShowModal(false);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      fetchCustomers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create customer');
    }
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Customer Profiles</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Retail, wholesale, and corporate customer contacts & purchase history</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary py-2.5 px-4 text-xs font-bold shadow-lg shadow-blue-600/20"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />
          <span>Add Customer Profile</span>
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="glass-card p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer profiles by name or phone number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 form-input text-xs"
          />
        </div>
      </div>

      {/* TABLE LIST & DRAWER FLEX CONTAINER */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className={`glass-card overflow-hidden transition-all ${selectedCustomer ? 'lg:w-[60%]' : 'w-full'}`}>
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 font-semibold">Loading customer profiles...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Customer Name</th>
                    <th className="p-3.5">Phone</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Type</th>
                    {featureFlags?.loyalty_enabled && <th className="p-3.5 text-center">Loyalty</th>}
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-slate-400">No customer profiles found</td>
                    </tr>
                  ) : (
                    filtered.map(c => (
                      <tr
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className={`hover:bg-blue-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition ${
                          selectedCustomer?.id === c.id ? 'bg-blue-50 dark:bg-slate-800 border-l-4 border-blue-600' : ''
                        }`}
                      >
                        <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">{c.name}</td>
                        <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">{c.phone || '-'}</td>
                        <td className="p-3.5 text-slate-500 dark:text-slate-400">{c.email || '-'}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            c.customer_type === 'corporate' ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300' :
                            c.customer_type === 'wholesale' ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {(c.customer_type || 'retail').toUpperCase()}
                          </span>
                        </td>
                        {featureFlags?.loyalty_enabled && (
                          <td className="p-3.5 text-center font-bold text-amber-600 dark:text-amber-400">
                            <span className="inline-flex items-center">
                              <Award className="w-3.5 h-3.5 mr-1" />
                              {c.loyalty_points || 0} pts
                            </span>
                          </td>
                        )}
                        <td className="p-3.5 text-right">
                          <ChevronRight className="w-4 h-4 text-slate-400 inline-block" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CUSTOMER DETAILS & PURCHASE HISTORY DRAWER */}
        {selectedCustomer && (
          <div className="lg:w-[40%] w-full glass-card p-6 space-y-5 animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block mb-0.5">Profile Details</span>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">{selectedCustomer.name}</h3>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 font-semibold">
              {selectedCustomer.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  <span>{selectedCustomer.phone}</span>
                </div>
              )}
              {selectedCustomer.email && (
                <div className="flex items-center space-x-2">
                  <Mail className="w-3.5 h-3.5 text-purple-600" />
                  <span>{selectedCustomer.email}</span>
                </div>
              )}
              {selectedCustomer.address && (
                <div className="flex items-center space-x-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{selectedCustomer.address}</span>
                </div>
              )}
            </div>

            {/* PURCHASE HISTORY TABLE */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-blue-600" />
                Purchase History ({customerBills.length} Bills)
              </h4>

              {loadingHistory ? (
                <div className="p-4 text-center text-xs text-slate-400 font-semibold">Loading purchase history...</div>
              ) : customerBills.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  No invoices generated for this customer yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {customerBills.map(bill => (
                    <div
                      key={bill.id}
                      onClick={() => navigate(`/invoices/${bill.id}`)}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 cursor-pointer transition flex justify-between items-center text-xs"
                    >
                      <div>
                        <span className="font-bold text-blue-600 dark:text-blue-400 font-mono block">{bill.bill_number}</span>
                        <span className="text-[10px] text-slate-400">{bill.bill_date}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-slate-900 dark:text-slate-100 block">₹{parseFloat(bill.grand_total).toFixed(2)}</span>
                        <span className={`text-[10px] font-bold uppercase ${
                          bill.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {bill.payment_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE CUSTOMER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Add Customer Profile</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <p className="text-xs text-rose-600 font-bold">{typeof error === 'object' ? (error.message || JSON.stringify(error)) : String(error)}</p>}

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kathir"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-2.5 form-input text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="9876543210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full p-2.5 form-input text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full p-2.5 form-input text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Customer Type</label>
                <select
                  value={customerType}
                  onChange={e => setCustomerType(e.target.value)}
                  className="w-full p-2.5 form-select text-xs"
                >
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="corporate">Corporate</option>
                </select>
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
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomersPage;
