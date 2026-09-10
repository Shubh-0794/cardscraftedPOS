import React, { useState } from 'react';
import { StoreSettings } from '../types/pos';
import { Settings, Save, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  onSaveSettings: (newSettings: StoreSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<StoreSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div id="modal-store-settings" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1b2b48] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm text-slate-100">Store &amp; UPI Settings</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
          <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
            <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
              STORE / BUSINESS NAME *
            </label>
            <input
              type="text"
              value={formData.storeName}
              onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
              className="w-full bg-transparent text-slate-100 font-bold focus:outline-none mt-0.5"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
              <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                UPI VPA ID *
              </label>
              <input
                type="text"
                value={formData.upiId}
                onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                className="w-full bg-transparent text-blue-400 font-mono font-bold focus:outline-none mt-0.5"
                required
              />
            </div>
            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
              <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                PAYEE NAME
              </label>
              <input
                type="text"
                value={formData.upiPayeeName}
                onChange={(e) => setFormData({ ...formData, upiPayeeName: e.target.value })}
                className="w-full bg-transparent text-slate-100 focus:outline-none mt-0.5"
              />
            </div>
          </div>

          <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
            <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
              STORE ADDRESS / CITY
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-transparent text-slate-100 focus:outline-none mt-0.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
              <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                STORE WHATSAPP / PHONE
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-transparent text-slate-100 font-mono focus:outline-none mt-0.5"
              />
            </div>
            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
              <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                GSTIN (OPTIONAL)
              </label>
              <input
                type="text"
                value={formData.gstin || ''}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                className="w-full bg-transparent text-slate-100 font-mono uppercase focus:outline-none mt-0.5"
              />
            </div>
          </div>

          <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
            <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
              RECEIPT FOOTER NOTE
            </label>
            <input
              type="text"
              value={formData.invoiceFooterNote || ''}
              onChange={(e) => setFormData({ ...formData, invoiceFooterNote: e.target.value })}
              className="w-full bg-transparent text-slate-100 focus:outline-none mt-0.5"
            />
          </div>

          <div className="pt-3 border-t border-[#1b2b48] flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-2xl font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold uppercase tracking-wider transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{savedSuccess ? 'Saved!' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
