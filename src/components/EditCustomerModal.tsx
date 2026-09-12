import React, { useState, useEffect } from 'react';
import { Customer } from '../types/pos';
import { X, Check, User, Phone, Mail, Award } from 'lucide-react';

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSave: (updatedCustomer: Customer) => void;
}

export const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);

  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setEmail(customer.email || '');
      setLoyaltyPoints(customer.loyaltyPoints || 0);
    }
  }, [customer, isOpen]);

  if (!isOpen || !customer) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    const updated: Customer = {
      ...customer,
      name: name.trim() || customer.name,
      phone: phone.replace(/\D/g, ''),
      email: email.trim() || undefined,
      loyaltyPoints: Math.max(0, Number(loyaltyPoints) || 0),
    };

    onSave(updated);
    onClose();
  };

  return (
    <div
      id="modal-edit-customer"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
    >
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col my-auto animate-scaleUp">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1b2b48] flex items-center justify-between bg-[#080e1b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs font-mono">
              {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Edit Customer Profile</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {customer.countryCode || '+91'} {customer.phone}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-[#142340] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 bg-[#0a101d]">
          <div className="bg-[#070c17] border border-[#1b2b48] rounded-2xl px-3.5 pt-2.5 pb-2 focus-within:border-blue-500 transition-colors">
            <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono flex items-center gap-1.5">
              <User className="w-3 h-3 text-blue-400" />
              CUSTOMER NAME
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-slate-100 text-sm focus:outline-none mt-1 font-medium"
            />
          </div>

          <div className="bg-[#070c17] border border-[#1b2b48] rounded-2xl px-3.5 pt-2.5 pb-2 focus-within:border-blue-500 transition-colors">
            <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-emerald-400" />
              10-DIGIT MOBILE NUMBER (WHATSAPP)
            </label>
            <input
              type="tel"
              required
              placeholder="e.g. 9820154321"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full bg-transparent text-slate-100 font-mono text-sm focus:outline-none mt-1 font-medium"
            />
          </div>

          <div className="bg-[#070c17] border border-[#1b2b48] rounded-2xl px-3.5 pt-2.5 pb-2 focus-within:border-blue-500 transition-colors">
            <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono flex items-center gap-1.5">
              <Mail className="w-3 h-3 text-purple-400" />
              EMAIL ADDRESS (OPTIONAL)
            </label>
            <input
              type="email"
              placeholder="customer@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-slate-100 text-sm focus:outline-none mt-1"
            />
          </div>

          <div className="bg-[#070c17] border border-[#1b2b48] rounded-2xl px-3.5 pt-2.5 pb-2 focus-within:border-blue-500 transition-colors">
            <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono flex items-center gap-1.5">
              <Award className="w-3 h-3 text-amber-400" />
              LOYALTY REWARD POINTS
            </label>
            <input
              type="number"
              min="0"
              value={loyaltyPoints}
              onChange={(e) => setLoyaltyPoints(parseInt(e.target.value) || 0)}
              className="w-full bg-transparent text-slate-100 font-mono text-sm focus:outline-none mt-1"
            />
          </div>

          {/* Stats Readout */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-[#070c17] border border-[#1b2b48] rounded-xl px-3.5 py-2">
            <span>Total Spent: ₹{customer.totalSpent || 0}</span>
            <span>Visits: {customer.ordersCount || 0}</span>
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-900/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Details</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
