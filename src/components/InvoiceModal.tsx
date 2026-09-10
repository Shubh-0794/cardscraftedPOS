import React, { useState, useEffect } from 'react';
import { Invoice, StoreSettings } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import { generateWhatsAppPayloads } from '../utils/whatsapp';
import { posAudio } from '../utils/audio';
import {
  FileText,
  Printer,
  Send,
  X,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  QrCode,
  Zap,
} from 'lucide-react';
import { ProductBarcodeBadge } from './ProductBarcodeBadge';

interface InvoiceModalProps {
  invoice: Invoice | null;
  settings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateWhatsAppStatus: (invoiceId: string, status: 'sent' | 'failed') => void;
  onViewBarcode?: (barcode: string, name: string, price?: number) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  invoice,
  settings,
  isOpen,
  onClose,
  onUpdateWhatsAppStatus,
  onViewBarcode,
}) => {
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [animationKey, setAnimationKey] = useState<number>(0);
  const [isPrintingAnim, setIsPrintingAnim] = useState(true);

  useEffect(() => {
    if (isOpen && invoice) {
      setAnimationKey((prev) => prev + 1);
      setIsPrintingAnim(true);
      posAudio.playReceiptPrintSound();
      const timer = setTimeout(() => {
        setIsPrintingAnim(false);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [isOpen, invoice?.id]);

  if (!isOpen || !invoice) return null;

  const payloads = generateWhatsAppPayloads(invoice, settings);

  const handlePrint = () => {
    window.print();
  };

  const handleReplayFeed = () => {
    setAnimationKey((prev) => prev + 1);
    setIsPrintingAnim(true);
    posAudio.playReceiptPrintSound();
    setTimeout(() => {
      setIsPrintingAnim(false);
    }, 900);
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
    <div
      id="modal-invoice-viewer"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-[#0b1222] border border-[#1b2b48] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] relative">
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-[#1b2b48] flex items-center justify-between bg-[#080d1a] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                <span>Sale Complete</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-300 font-mono border border-emerald-500/30">
                  PAID
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">Invoice #{invoice.invoiceNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleReplayFeed}
              title="Replay Paper Feed Animation"
              className="text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-[#15233e] transition-colors text-xs flex items-center gap-1 font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPrintingAnim ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-[#15233e] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Realistic Thermal Printer Feed Chamber */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#060a14] relative flex flex-col items-center">
          {/* POS Thermal Printer Slot Head Mechanism */}
          <div className="w-full max-w-[340px] bg-linear-to-b from-[#111c33] via-[#0d1629] to-[#080d19] border-t-2 border-x-2 border-[#203254] rounded-t-2xl pt-2 pb-1.5 px-4 shadow-lg shadow-black/80 relative z-20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isPrintingAnim ? 'bg-emerald-400 animate-printer-led' : 'bg-emerald-500'
                }`}
              />
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-300">
                POS-80 THERMAL PRINTER
              </span>
            </div>
            <span className="text-[9px] font-mono font-bold text-emerald-400/90 uppercase">
              {isPrintingAnim ? 'FEEDING PAPER...' : 'READY'}
            </span>

            {/* Serrated Tear Slot Mouth */}
            <div className="absolute -bottom-1.5 left-2 right-2 h-1.5 bg-[#020408] rounded-full shadow-inner border-b border-[#2d426d]/40" />
          </div>

          {/* Paper Feed Container with Keyframe Physics Animation */}
          <div
            key={animationKey}
            className="w-full max-w-[340px] animate-paper-feed relative z-10 -mt-1 origin-top shadow-2xl"
          >
            {/* Moving Thermal Laser Scan Line (Simulates thermal printhead line moving down) */}
            {isPrintingAnim && (
              <div className="absolute left-0 right-0 h-1 bg-linear-to-r from-transparent via-emerald-400/80 to-transparent shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-print-laser pointer-events-none z-30" />
            )}

            {/* Thermal Receipt Paper Card (High Contrast Dark Luxury Theme) */}
            <div className="bg-[#0b1428] border-x border-b border-[#1f3152] rounded-b-2xl p-5 shadow-2xl space-y-3.5 font-sans text-xs text-slate-300 relative overflow-hidden">
              {/* Subtle Thermal Paper Grain Top Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-blue-500/20 via-emerald-400/30 to-blue-500/20" />

              {/* Store Header Info */}
              <div className="text-center pb-2.5 border-b border-dashed border-[#1f3152]">
                <h4 className="font-bold text-lg text-blue-400 font-cursive tracking-wide leading-tight">
                  {(settings.storeName || 'Cardcrafted').replace(/by\s+shivani/gi, '').trim() || 'Cardcrafted'}
                </h4>
                <p className="text-[11px] text-blue-300/80 font-cursive tracking-wider mb-1">By Shivani</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">{settings.address}</p>
                {settings.gstin && (
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">GSTIN: {settings.gstin}</p>
                )}
              </div>

              {/* Bill Meta Data */}
              <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono bg-[#070d1a] px-3 py-1.5 rounded-lg border border-[#162542]">
                <span>{new Date(invoice.timestamp).toLocaleDateString()} {new Date(invoice.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="uppercase text-emerald-400 font-extrabold tracking-wide">
                  {invoice.paymentMethod === 'whatsapp' ? 'WhatsApp Link' : invoice.paymentMethod}
                </span>
              </div>

              {/* Customer Info */}
              {invoice.customer && (
                <div className="text-[11px] text-slate-300 pb-0.5 bg-[#070d1a]/50 p-2 rounded-lg border border-[#142038]">
                  <span className="text-slate-400">Customer: </span>
                  <span className="font-bold text-slate-100">{invoice.customer.name}</span>
                  <span className="text-slate-400 ml-1">({invoice.customer.phone})</span>
                </div>
              )}

              {/* Items Table */}
              <div className="border-t border-b border-dashed border-[#1f3152] py-2.5 space-y-2 font-mono text-[11px]">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>ITEM / QTY</span>
                  <span>AMOUNT</span>
                </div>
                {invoice.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start pt-1">
                    <div className="min-w-0 pr-2">
                      <div className="font-sans font-bold text-slate-100 truncate max-w-[190px]">
                        {item.product.name}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{item.quantity} × {formatCurrency(item.unitPrice, settings.currencySymbol)}</span>
                        {item.product.barcode && (
                          <button
                            type="button"
                            onClick={() => onViewBarcode?.(item.product.barcode, item.product.name, item.product.unitPrice)}
                            title="Click to view big barcode"
                            className="inline-flex hover:scale-105 transition-transform"
                          >
                            <ProductBarcodeBadge code={item.product.barcode} width={34} height={11} />
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-slate-100 font-mono shrink-0">
                      {formatCurrency(item.totalAmount, settings.currencySymbol)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Financials Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate-200">
                    {formatCurrency(invoice.subtotal, settings.currencySymbol)}
                  </span>
                </div>

                {invoice.billDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount</span>
                    <span className="font-mono">
                      -{formatCurrency(invoice.billDiscountAmount, settings.currencySymbol)}
                    </span>
                  </div>
                )}

                {invoice.taxSummary && invoice.taxSummary.totalGst > 0 && (
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>GST (Tax Inc.)</span>
                    <span className="font-mono">
                      {formatCurrency(invoice.taxSummary.totalGst, settings.currencySymbol)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-sm text-slate-100 pt-2 border-t border-[#1f3152]">
                  <span>Total Paid</span>
                  <span className="font-mono text-blue-400 font-extrabold text-base">
                    {formatCurrency(invoice.grandTotal, settings.currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Invoice Barcode & Footer Note */}
              <div className="pt-2 text-center space-y-2 border-t border-dashed border-[#1f3152]">
                <div className="flex flex-col items-center justify-center gap-1 py-1">
                  <button
                    type="button"
                    onClick={() =>
                      onViewBarcode?.(
                        invoice.invoiceNumber,
                        `Invoice #${invoice.invoiceNumber}`,
                        invoice.grandTotal
                      )
                    }
                    className="cursor-pointer group flex flex-col items-center gap-1"
                    title="Click to view & download high-res invoice barcode"
                  >
                    <ProductBarcodeBadge
                      code={invoice.invoiceNumber}
                      width={120}
                      height={24}
                      showText={true}
                      className="group-hover:ring-2 ring-blue-400/50 transition-all"
                    />
                    <span className="text-[9px] font-mono text-slate-400 group-hover:text-blue-400 transition-colors">
                      Click barcode to expand & download PNG
                    </span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 font-medium">
                  {settings.invoiceFooterNote || 'Thank you for shopping with Cardcrafted by Shivani!'}
                </p>
              </div>

              {/* Serrated Bottom Paper Tear Effect */}
              <div className="w-full h-2 zigzag-edge-bottom mt-2 opacity-80" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-[#1b2b48] bg-[#090f1c] space-y-2 shrink-0">
          <button
            type="button"
            onClick={handleDispatchWhatsApp}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Send WhatsApp Invoice</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-2.5 bg-[#121e38] hover:bg-[#18284c] text-slate-300 border border-[#1e2f50] rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-md shadow-blue-950/50"
            >
              New Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
