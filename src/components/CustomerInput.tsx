import React, { useState, useEffect, useRef } from 'react';
import { Customer } from '../types/pos';
import { UserCheck, Search, Plus, X, Phone, User, Trash2 } from 'lucide-react';

interface CustomerInputProps {
  customer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  customersList: Customer[];
  onSaveNewCustomer: (newCustomer: Customer) => void;
  onDeleteCustomer?: (customerId: string) => void;
}

export const CustomerInput: React.FC<CustomerInputProps> = ({
  customer,
  onSelectCustomer,
  customersList,
  onSaveNewCustomer,
  onDeleteCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredCustomers = customersList.filter((c) => {
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
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
      loyaltyPoints: 0,
      totalSpent: 0,
      ordersCount: 0,
    };

    onSaveNewCustomer(createdCustomer);
    onSelectCustomer(createdCustomer);
    setShowAddModal(false);
    setNewName('');
    setNewPhone('');
    setSearchQuery('');
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
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {customer.countryCode} {customer.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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
                onClick={() => onDeleteCustomer(customer.id)}
                title="Delete customer record"
                className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
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
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          {/* Dropdown options */}
          {isOpenDropdown && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-[#0c1427] border border-[#1b2b48] rounded-2xl shadow-2xl z-40 overflow-hidden max-h-56 overflow-y-auto divide-y divide-[#152442]">
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
                      <div className="w-6 h-6 rounded-full bg-[#1b2d52] text-blue-400 font-bold text-[10px] flex items-center justify-center font-mono shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-100 truncate block">{c.name}</span>
                        <span className="font-mono text-slate-400 text-[11px]">{c.phone}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-blue-400 font-bold group-hover:underline">Select</span>
                      {onDeleteCustomer && c.id !== 'walk-in' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCustomer(c.id);
                          }}
                          title="Delete Customer"
                          className="p-1 text-slate-500 hover:text-rose-400 rounded-md hover:bg-rose-500/10 transition-colors"
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
                      className="mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
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

      {/* Quick Add Modal matching dark theme */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-sm shadow-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b2b48] mb-4">
              <h4 className="font-bold text-sm text-slate-100">Add Customer</h4>
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
                  CUSTOMER NAME (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amit Sharma"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
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
    </div>
  );
};
