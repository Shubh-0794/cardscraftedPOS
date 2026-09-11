import React, { useState, useEffect, useRef } from 'react';
import { Customer } from '../types/pos';
import { Plus, X, Trash2, Edit2, Check, Mail, Phone, User, Award, DollarSign } from 'lucide-react';

interface CustomerInputProps {
  customer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  customersList: Customer[];
  onSaveNewCustomer: (newCustomer: Customer) => void;
  onUpdateCustomer?: (updatedCustomer: Customer) => void;
  onDeleteCustomer?: (customerId: string) => void;
}

export const CustomerInput: React.FC<CustomerInputProps> = ({
  customer,
  onSelectCustomer,
  customersList,
  onSaveNewCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  
  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Edit modal state
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLoyaltyPoints, setEditLoyaltyPoints] = useState<number>(0);

  // Delete confirmation modal state
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredCustomers = customersList.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpenDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) return;

    const createdCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: newName.trim() || `Customer (${newPhone.slice(-4)})`,
      phone: newPhone.replace(/\D/g, ''),
      countryCode: '+91',
      email: newEmail.trim() || undefined,
      loyaltyPoints: 0,
      totalSpent: 0,
      ordersCount: 0,
    };

    onSaveNewCustomer(createdCustomer);
    onSelectCustomer(createdCustomer);
    setShowAddModal(false);
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setSearchQuery('');
  };

  const handleStartEdit = (cust: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCustomer(cust);
    setEditName(cust.name || '');
    setEditPhone(cust.phone || '');
    setEditEmail(cust.email || '');
    setEditLoyaltyPoints(cust.loyaltyPoints || 0);
    setIsOpenDropdown(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editPhone.trim()) return;

    const updatedCustomer: Customer = {
      ...editingCustomer,
      name: editName.trim() || editingCustomer.name,
      phone: editPhone.replace(/\D/g, ''),
      email: editEmail.trim() || undefined,
      loyaltyPoints: Math.max(0, Number(editLoyaltyPoints) || 0),
    };

    if (onUpdateCustomer) {
      onUpdateCustomer(updatedCustomer);
    } else {
      onSaveNewCustomer(updatedCustomer);
    }

    if (customer && customer.id === updatedCustomer.id) {
      onSelectCustomer(updatedCustomer);
    }

    setEditingCustomer(null);
  };

  const handleConfirmDelete = () => {
    if (!customerToDelete) return;
    if (onDeleteCustomer) {
      onDeleteCustomer(customerToDelete.id);
    }
    if (customer && customer.id === customerToDelete.id) {
      onSelectCustomer(null);
    }
    setCustomerToDelete(null);
  };

  return (
    <div id="customer-onboarding-panel" className="relative" ref={dropdownRef}>
      {customer ? (
        // Selected Customer Card matching Reference UI
        <div className="bg-[#0a101d] border border-blue-500/40 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center font-mono shrink-0">
              {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-100 truncate">{customer.name}</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 rounded-md">
                  LINKED
                </span>
                {customer.loyaltyPoints > 0 && (
                  <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-950/50 border border-amber-500/30 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                    <Award className="w-2.5 h-2.5" /> {customer.loyaltyPoints} pts
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                <span>{customer.countryCode} {customer.phone}</span>
                {customer.email && <span className="text-slate-500 truncate max-w-[120px]">({customer.email})</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {customer.id !== 'walk-in' && (
              <button
                type="button"
                onClick={(e) => handleStartEdit(customer, e)}
                title="Edit Customer Details"
                className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-blue-500/10 transition-colors flex items-center gap-1 text-[11px] font-semibold"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            <button
              id="btn-remove-customer"
              type="button"
              onClick={() => onSelectCustomer(null)}
              className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-[#14203a] font-semibold transition-colors"
            >
              Change
            </button>
            {onDeleteCustomer && customer.id !== 'walk-in' && (
              <button
                type="button"
                onClick={() => setCustomerToDelete(customer)}
                title="Delete customer record from Supabase & POS"
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        // Input Box with Floating Micro-Label
        <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500 transition-colors">
          <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
            CUSTOMER (WHATSAPP RECEIPT)
          </label>
          <div className="flex items-center gap-2 mt-0.5">
            <input
              type="text"
              id="customer-search-input"
              placeholder="Search or enter 10-digit mobile number..."
              value={searchQuery}
              onFocus={() => setIsOpenDropdown(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpenDropdown(true);
              }}
              className="w-full bg-transparent text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none font-medium"
            />
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          {/* Dropdown options */}
          {isOpenDropdown && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-[#0c1427] border border-[#1b2b48] rounded-2xl shadow-2xl z-40 overflow-hidden max-h-64 overflow-y-auto divide-y divide-[#152442]">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectCustomer(c);
                      setIsOpenDropdown(false);
                      setSearchQuery('');
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-[#121e38] flex items-center justify-between text-xs transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-[#1b2d52] text-blue-400 font-bold text-xs flex items-center justify-center font-mono shrink-0">
                        {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 truncate block">{c.name}</span>
                          {c.loyaltyPoints > 0 && (
                            <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-950/40 px-1 py-0.2 rounded border border-amber-500/20">
                              {c.loyaltyPoints} pts
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 font-mono text-slate-400 text-[11px] mt-0.5">
                          <span>{c.phone}</span>
                          {c.email && <span className="text-slate-500 truncate max-w-[120px]">({c.email})</span>}
                          {c.totalSpent > 0 && (
                            <span className="text-slate-500">₹{c.totalSpent.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-blue-400 font-bold group-hover:underline mr-1">Select</span>
                      {c.id !== 'walk-in' && (
                        <button
                          type="button"
                          onClick={(e) => handleStartEdit(c, e)}
                          title="Edit Customer"
                          className="p-1.5 text-slate-400 hover:text-blue-400 rounded-md hover:bg-blue-500/10 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteCustomer && c.id !== 'walk-in' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomerToDelete(c);
                          }}
                          title="Delete Customer from Supabase"
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center">
                  <p className="text-xs text-slate-400">No customer found for &quot;{searchQuery}&quot;</p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        if (/^\d+$/.test(searchQuery.trim())) {
                          setNewPhone(searchQuery.trim());
                          setNewName('');
                        } else {
                          setNewName(searchQuery.trim());
                          setNewPhone('');
                        }
                        setShowAddModal(true);
                        setIsOpenDropdown(false);
                      }}
                      className="mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add &quot;{searchQuery}&quot; as customer
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-sm shadow-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b2b48] mb-4">
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                <span>Add New Customer</span>
              </h4>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAdd} className="space-y-3.5">
              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  MOBILE PHONE NUMBER *
                </label>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="font-mono text-slate-400 text-xs">+91</span>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-mono text-sm focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  CUSTOMER NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amit Sharma"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-transparent text-slate-100 text-sm focus:outline-none mt-0.5"
                />
              </div>

              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  EMAIL ADDRESS (OPTIONAL)
                </label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-transparent text-slate-100 text-sm focus:outline-none mt-0.5"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/30"
                >
                  Save &amp; Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-sm shadow-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b2b48] mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-400" />
                <h4 className="font-bold text-sm text-slate-100">Edit Customer Details</h4>
              </div>
              <button onClick={() => setEditingCustomer(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Customer Lifetime Stats Banner */}
            <div className="bg-[#080d1a] border border-[#182642] rounded-xl p-2.5 mb-3.5 flex items-center justify-around text-center">
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">ORDERS</span>
                <span className="font-bold text-xs text-slate-200 font-mono">{editingCustomer.ordersCount || 0}</span>
              </div>
              <div className="w-[1px] h-6 bg-[#182642]" />
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">TOTAL SPENT</span>
                <span className="font-bold text-xs text-emerald-400 font-mono">₹{(editingCustomer.totalSpent || 0).toLocaleString()}</span>
              </div>
              <div className="w-[1px] h-6 bg-[#182642]" />
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">LOYALTY</span>
                <span className="font-bold text-xs text-amber-400 font-mono">{editingCustomer.loyaltyPoints || 0} pts</span>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  CUSTOMER NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Customer Full Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-transparent text-slate-100 text-sm focus:outline-none mt-0.5 font-medium"
                />
              </div>

              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  MOBILE PHONE NUMBER *
                </label>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="font-mono text-slate-400 text-xs">+91</span>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-transparent text-slate-100 font-mono text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  EMAIL ADDRESS (OPTIONAL)
                </label>
                <input
                  type="email"
                  placeholder="customer@email.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-transparent text-slate-100 text-sm focus:outline-none mt-0.5"
                />
              </div>

              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  LOYALTY POINTS
                </label>
                <input
                  type="number"
                  min="0"
                  value={editLoyaltyPoints}
                  onChange={(e) => setEditLoyaltyPoints(parseInt(e.target.value) || 0)}
                  className="w-full bg-transparent text-slate-100 font-mono text-sm focus:outline-none mt-0.5"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="flex-1 py-2.5 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1427] border border-rose-500/30 rounded-3xl w-full max-w-sm shadow-2xl p-5">
            <div className="flex items-center gap-2.5 text-rose-400 mb-3">
              <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">Delete Customer?</h4>
                <p className="text-[11px] text-slate-400">This will delete the customer from Supabase DB.</p>
              </div>
            </div>

            <div className="bg-[#080d1a] border border-[#182642] rounded-xl p-3 my-3">
              <p className="font-bold text-xs text-slate-200">{customerToDelete.name}</p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{customerToDelete.phone}</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="flex-1 py-2.5 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-900/30 cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
