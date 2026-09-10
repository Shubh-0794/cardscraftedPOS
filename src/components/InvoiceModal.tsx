import React, { useState } from 'react';
import { Invoice, StoreSettings } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import { generateWhatsAppPayloads } from '../utils/whatsapp';
import {
  FileText,
  Printer,
  Send,
  X,
  CheckCircle2,
} from 'lucide-react';

interface InvoiceModalProps {
  invoice: Invoice | null;
  settings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateWhatsAppStatus: (invoiceId: string, status: 'sent' | 'failed') => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  invoice,
  settings,
  isOpen,
  onClose,
  onUpdateWhatsAppStatus,
}) => {
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  if (!isOpen || !invoice) return null;

  const payloads = generateWhatsAppPayloads(invoice, settings);

  const handlePrint = () => {
    window.print();
  };

  const handleDispatchWhatsApp = () => {
    setIsSendingWhatsApp(true);
    window.open(payloads.waMeLink, '_blank', 'noopener,noreferrer');

    setTimeout(() => {
      setIsSendingWhatsApp(false);
      onUpdateWhatsAppStatus(invoice.id, 'sent');
    }, 800);
  };

  return (
    <div id="modal-invoice-viewer" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#1b2b48] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm text-slate-100">Sale Complete</h3>
              <p className="text-[11px] text-slate-400 font-mono">Invoice #{invoice.invoiceNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt Body matching clean dark card */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#080d19]">
          <div className="bg-[#0c1427] border border-[#1b2b48] rounded-2xl p-4 shadow-xl space-y-3 font-sans text-xs text-slate-300">
            {/* Store details */}
            <div className="text-center pb-2 border-b border-[#1b2b48]">
              <h4 className="font-bold text-base text-blue-400 font-cursive tracking-wide leading-tight">
                {(settings.storeName || 'Cardcrafted').replace(/by\s+shivani/gi, '').trim() || 'Cardcrafted'}
              </h4>
              <p className="text-[10px] text-blue-300/80 font-cursive tracking-wider mb-1">By Shivani</p>
              <p className="text-[11px] text-slate-400">{settings.address}</p>
              {settings.gstin && <p className="text-[10px] text-slate-400 font-mono">GSTIN: {settings.gstin}</p>}
            </div>

            {/* Bill info */}
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>{new Date(invoice.timestamp).toLocaleDateString()}</span>
              <span className="uppercase text-blue-400 font-bold">
                {invoice.paymentMethod === 'whatsapp' ? 'WhatsApp Link' : invoice.paymentMethod}
              </span>
            </div>

            {/* Customer info */}
            {invoice.customer && (
              <div className="text-[11px] text-slate-300 pb-1">
                <span className="font-bold text-slate-100">{invoice.customer.name}</span>
                <span className="text-slate-400 ml-1">({invoice.customer.phone})</span>
              </div>
            )}

            {/* Items Table */}
            <div className="border-t border-b border-[#1b2b48] py-2 space-y-1.5 font-mono text-[11px]">
              {invoice.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span className="truncate max-w-[180px] font-sans text-slate-200">
                    {item.product.name} × {item.quantity}
                  </span>
                  <span className="font-bold text-slate-100">
                    {formatCurrency(item.totalAmount, settings.currencySymbol)}
                  </span>
                </div>
              ))}
            </div>

            {/* Financials Breakdown */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono text-slate-200">{formatCurrency(invoice.subtotal, settings.currencySymbol)}</span>
              </div>

              {invoice.billDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount</span>
                  <span className="font-mono">-{formatCurrency(invoice.billDiscountAmount, settings.currencySymbol)}</span>
                </div>
              )}

              <div className="flex justify-between font-bold text-sm text-slate-100 pt-2 border-t border-[#1b2b48]">
                <span>Total Paid</span>
                <span className="font-mono text-blue-400 font-extrabold">{formatCurrency(invoice.grandTotal, settings.currencySymbol)}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 text-center pt-2">
              {settings.invoiceFooterNote || 'Thank you for your visit!'}
            </p>
          </div>
        </div>

        {/* Action Buttons matching Reference UI CTA */}
        <div className="p-4 border-t border-[#1b2b48] bg-[#090f1c] space-y-2">
          <button
            type="button"
            onClick={handleDispatchWhatsApp}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>Send WhatsApp Invoice</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-2.5 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors"
            >
              New Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
