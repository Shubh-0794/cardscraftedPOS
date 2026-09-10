import React, { useState } from 'react';
import { Invoice, StoreSettings } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import { generateWhatsAppPayloads } from '../utils/whatsapp';
import {
  History,
  Search,
  FileText,
  Send,
  X,
} from 'lucide-react';

interface SalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  settings: StoreSettings;
  onSelectInvoice: (invoice: Invoice) => void;
}

export const SalesHistoryModal: React.FC<SalesHistoryModalProps> = ({
  isOpen,
  onClose,
  invoices,
  settings,
  onSelectInvoice,
}) => {
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');

  if (!isOpen) return null;

  const filteredInvoices = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customer.name.toLowerCase().includes(q) ||
      inv.customer.phone.includes(q);
    const matchesMethod = filterMethod === 'all' || inv.paymentMethod === filterMethod;
    return matchesSearch && matchesMethod;
  });

  const totalSales = invoices.reduce((acc, inv) => acc + inv.grandTotal, 0);

  const handleQuickSendWA = (invoice: Invoice) => {
    const payloads = generateWhatsAppPayloads(invoice, settings);
    window.open(payloads.waMeLink, '_blank', 'noopener,noreferrer');
  };

  return (
    <div id="modal-sales-history" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1b2b48] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-100">Sales Ledger</h3>
            <p className="text-xs text-slate-400">
              Total Revenue: <span className="font-bold font-mono text-blue-400">{formatCurrency(totalSales, settings.currencySymbol)}</span> ({invoices.length} bills)
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 bg-[#090f1c] border-b border-[#1b2b48] flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search invoice number, customer name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0c1427] border border-[#1b2b48] text-slate-100 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-1 bg-[#121e38] p-0.5 rounded-xl text-xs">
            {['all', 'upi', 'cash', 'whatsapp'].map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMethod(mode)}
                className={`px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold ${
                  filterMethod === mode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'whatsapp' ? 'WApp' : mode}
              </button>
            ))}
          </div>
        </div>

        {/* Invoices List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredInvoices.length > 0 ? (
            filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-[#0b1325] border border-[#1a2b47] rounded-2xl p-3 flex items-center justify-between gap-3 hover:border-blue-500/40 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs font-mono text-blue-400">#{inv.invoiceNumber}</span>
                    <span className="text-xs text-slate-200 font-medium">{inv.customer.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                    <span>{new Date(inv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>•</span>
                    <span className="uppercase">{inv.paymentMethod}</span>
                    <span>•</span>
                    <span>{inv.items.length} items</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-xs font-mono text-slate-100">
                    {formatCurrency(inv.grandTotal, settings.currencySymbol)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickSendWA(inv)}
                    className="p-1.5 rounded-xl hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 transition-colors"
                    title="Send WhatsApp"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectInvoice(inv);
                      onClose();
                    }}
                    className="px-2.5 py-1.5 bg-[#14223d] hover:bg-[#1b2f54] text-blue-400 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <FileText className="w-3 h-3" /> View
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              No sales invoices found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
