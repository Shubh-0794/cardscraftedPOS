import React, { useState, useEffect } from 'react';
import { Invoice, StoreSettings } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import { generateWhatsAppPayloads } from '../utils/whatsapp';
import { posAudio } from '../utils/audio';
import { generateInvoicePdf, createInvoicePdfBlob } from '../utils/qrPdfGenerator';
import {
  Printer,
  Send,
  X,
  CheckCircle2,
  RefreshCw,
  FileDown,
  Check,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { ProductQrBadge } from './ProductQrBadge';

interface InvoiceModalProps {
  invoice: Invoice | null;
  settings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateWhatsAppStatus: (invoiceId: string, status: 'sent' | 'failed') => void;
  onViewBarcode?: (barcode: string, name: string, price?: number, sku?: string, category?: string) => void;
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
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [animationKey, setAnimationKey] = useState<number>(0);
  const [isPrintingAnim, setIsPrintingAnim] = useState(true);

  // Customer WhatsApp phone state (strictly targets customer's number)
  const [customerPhone, setCustomerPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  useEffect(() => {
    if (isOpen && invoice) {
      setAnimationKey((prev) => prev + 1);
      setIsPrintingAnim(true);
      setPdfDownloaded(false);
      setShareNotice(null);
      setCustomerPhone(invoice.customer.phone || '');
      setCountryCode(invoice.customer.countryCode || '+91');
      setIsEditingPhone(!invoice.customer.phone);
      posAudio.playReceiptPrintSound();
      const timer = setTimeout(() => {
        setIsPrintingAnim(false);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [isOpen, invoice?.id, invoice?.customer?.phone]);

  if (!isOpen || !invoice) return null;

  const payloads = generateWhatsAppPayloads(invoice, settings, customerPhone, countryCode);

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

  // Download exact visual PDF invoice
  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await generateInvoicePdf(invoice, settings);
      setPdfDownloaded(true);
      posAudio.playSuccessChime();
      setTimeout(() => setPdfDownloaded(false), 3000);
    } catch (err) {
      console.error('Failed to export invoice PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Share PDF directly to Customer WhatsApp number (Strictly customer only, no e-bill link)
  const handleDispatchWhatsAppPdf = async () => {
    const cleanPhoneDigits = customerPhone.replace(/\D/g, '');
    if (!cleanPhoneDigits) {
      setIsEditingPhone(true);
      setShareNotice('Please enter the customer WhatsApp phone number');
      return;
    }

    setIsSendingWhatsApp(true);
    setShareNotice(null);

    try {
      // 1. Build high-fidelity PDF blob & File for attachment
      const { doc, file, filename } = await createInvoicePdfBlob(invoice, settings);

      // Cleaned phone representation for customer
      const cleanCountry = countryCode.replace(/\D/g, '') || '91';
      const fullCustomerNumber = `${cleanCountry}${cleanPhoneDigits}`;

      // 2. Check if native Web Share with Files is supported (Android/iOS/Chrome Mobile)
      const canNativeShareFiles =
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] });

      if (canNativeShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: `Invoice #${invoice.invoiceNumber} - ${settings.storeName}`,
            text: `🧾 Tax Invoice #${invoice.invoiceNumber} from ${settings.storeName}\nCustomer: ${invoice.customer.name || 'Valued Customer'}\nTotal: ${formatCurrency(invoice.grandTotal, settings.currencySymbol)}\n📎 PDF Invoice attached.`,
          });
          onUpdateWhatsAppStatus(invoice.id, 'sent');
          setPdfDownloaded(true);
          posAudio.playSuccessChime();
          setIsSendingWhatsApp(false);
          setShareNotice(`PDF shared to WhatsApp (+${fullCustomerNumber})!`);
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            setIsSendingWhatsApp(false);
            return;
          }
          console.warn('Native file share fallback:', shareErr);
        }
      }

      // Fallback: Download PDF directly and open customer WhatsApp chat
      doc.save(filename);
      setPdfDownloaded(true);
      posAudio.playSuccessChime();

      setShareNotice(`PDF downloaded & opened chat for +${fullCustomerNumber}!`);

      // Target strictly the customer's WhatsApp chat URL
      const customerWaMeUrl = `https://wa.me/${fullCustomerNumber}?text=${encodeURIComponent(payloads.plainTextMessage)}`;
      window.open(customerWaMeUrl, '_blank', 'noopener,noreferrer');

      onUpdateWhatsAppStatus(invoice.id, 'sent');
      setTimeout(() => {
        setIsSendingWhatsApp(false);
      }, 1000);
    } catch (err) {
      console.error('Error in WhatsApp PDF dispatch:', err);
      setIsSendingWhatsApp(false);
    }
  };

  const formattedCustomerPhone = customerPhone
    ? `${countryCode} ${customerPhone}`
    : 'No phone entered';

  return (
    <div
      id="modal-invoice-viewer"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-[#0b1222] border border-[#1b2b48] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh] relative">
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
                  {invoice.paymentStatus === 'success' ? 'PAID' : invoice.paymentStatus.toUpperCase()}
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
              className="text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-[#15233e] transition-colors text-xs flex items-center gap-1 font-mono cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPrintingAnim ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-[#15233e] transition-colors cursor-pointer"
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
              <span className="text-[10px] font-mono tracking-widest text-slate-300 font-bold uppercase">
                {isPrintingAnim ? 'PRINTING 80MM RECEIPT...' : 'THERMAL RECEIPT READY'}
              </span>
            </div>
            <span className="text-[9px] font-mono text-slate-500 font-bold">POS-80</span>
          </div>

          {/* Paper Output Container */}
          <div className="w-full max-w-[340px] overflow-hidden relative pb-4">
            {/* The Bill Paper (Animates downward) */}
            <div
              key={animationKey}
              className="receipt-feed-paper bg-white text-slate-900 shadow-2xl p-4 sm:p-5 font-mono text-xs border-x border-b border-slate-300 rounded-b-lg relative"
            >
              {/* Paper Watermark Texture */}
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
                <h2 className="font-extrabold text-base tracking-tight text-slate-900 uppercase">
                  {(settings.storeName || 'Cardcrafted').replace(/by\s+shivani/gi, '').trim() || 'Cardcrafted'}
                </h2>
                <div className="text-[11px] font-bold text-blue-600 font-sans tracking-wide">
                  By Shivani
                </div>
                {settings.tagline && (
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-sans">
                    {settings.tagline}
                  </p>
                )}
                {settings.address && (
                  <p className="text-[10px] text-slate-500 leading-tight pt-0.5">{settings.address}</p>
                )}
                {settings.phone && (
                  <p className="text-[10px] text-slate-500">Phone: {settings.phone}</p>
                )}
                {settings.gstin && (
                  <p className="text-[10px] font-bold text-slate-700">GSTIN: {settings.gstin}</p>
                )}
              </div>

              {/* Meta information */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between font-bold">
                  <span>INVOICE: #{invoice.invoiceNumber}</span>
                  <span className="text-emerald-700 uppercase">
                    {invoice.paymentStatus === 'success' ? 'PAID' : invoice.paymentStatus}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 text-[10px]">
                  <span>DATE: {new Date(invoice.timestamp).toLocaleDateString()}</span>
                  <span>{new Date(invoice.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between text-slate-600 text-[10px]">
                  <span>PAY METHOD:</span>
                  <span className="font-bold text-slate-800 uppercase">{invoice.paymentMethod}</span>
                </div>
                {invoice.customer && (
                  <div className="pt-1 text-[10px] text-slate-700">
                    <span>CUSTOMER: </span>
                    <span className="font-bold">{invoice.customer.name}</span>
                    {invoice.customer.phone && <span className="text-slate-500"> ({invoice.customer.phone})</span>}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="py-2.5 border-b border-dashed border-slate-300">
                <div className="flex justify-between text-[10px] font-extrabold text-slate-500 pb-1 border-b border-slate-200 uppercase">
                  <span>ITEM / QTY</span>
                  <span>TOTAL</span>
                </div>

                <div className="space-y-1.5 pt-1.5">
                  {invoice.items.map((item, idx) => (
                    <div key={idx} className="text-[11px]">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span className="truncate pr-2">{item.product.name}</span>
                        <span>{formatCurrency(item.totalAmount, settings.currencySymbol)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>
                          {item.quantity} {item.product.unit || 'pcs'} × {formatCurrency(item.unitPrice, settings.currencySymbol)}
                        </span>
                        {item.discountValue > 0 && (
                          <span className="text-emerald-600 font-bold">
                            Saved {item.discountType === 'percent' ? `${item.discountValue}%` : formatCurrency(item.discountValue, settings.currencySymbol)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="py-2.5 space-y-1 text-[11px] border-b border-dashed border-slate-300">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(invoice.subtotal, settings.currencySymbol)}</span>
                </div>

                {invoice.itemDiscountsTotal > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Item Discounts:</span>
                    <span>-{formatCurrency(invoice.itemDiscountsTotal, settings.currencySymbol)}</span>
                  </div>
                )}

                {invoice.billDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Bill Discount:</span>
                    <span>-{formatCurrency(invoice.billDiscountAmount, settings.currencySymbol)}</span>
                  </div>
                )}

                {invoice.totalTax > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>GST (Tax Incl.):</span>
                    <span>{formatCurrency(invoice.totalTax, settings.currencySymbol)}</span>
                  </div>
                )}

                {invoice.roundOff !== 0 && (
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>Round-off:</span>
                    <span>{invoice.roundOff > 0 ? '+' : ''}{formatCurrency(invoice.roundOff, settings.currencySymbol)}</span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="flex justify-between items-center pt-2 font-extrabold text-sm text-slate-900 border-t border-slate-800">
                  <span>TOTAL PAID:</span>
                  <span className="text-blue-700 text-base font-black">
                    {formatCurrency(invoice.grandTotal, settings.currencySymbol)}
                  </span>
                </div>
              </div>

              {/* QR Code section */}
              <div className="pt-3 pb-1 text-center space-y-2">
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      onViewBarcode?.(
                        `INVOICE-${invoice.invoiceNumber}`,
                        `Bill #${invoice.invoiceNumber}`,
                        invoice.grandTotal
                      )
                    }
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-blue-50 transition-colors group flex flex-col items-center cursor-pointer"
                    title="Click to view & download large QR"
                  >
                    <ProductQrBadge code={`INVOICE:${invoice.invoiceNumber}|TOTAL:${invoice.grandTotal}`} size={28} />
                    <span className="text-[9px] text-slate-500 font-sans mt-1 group-hover:text-blue-600 font-medium">
                      Scan QR Code to verify bill
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

        {/* Customer WhatsApp Destination Info / Quick Edit */}
        <div className="px-4 py-2.5 bg-[#070c17] border-t border-[#1b2b48] shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <MessageCircle className="w-3.5 h-3.5" />
              </div>
              {isEditingPhone ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-slate-400 font-mono text-xs">{countryCode}</span>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="bg-[#111d35] border border-[#233860] rounded-lg px-2 py-0.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500 w-32"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(false)}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    Set
                  </button>
                </div>
              ) : (
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Customer WhatsApp Number:
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-400 truncate">
                    {formattedCustomerPhone}
                  </div>
                </div>
              )}
            </div>

            {!isEditingPhone && (
              <button
                type="button"
                onClick={() => setIsEditingPhone(true)}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-mono hover:underline cursor-pointer shrink-0"
              >
                Change #
              </button>
            )}
          </div>
        </div>

        {shareNotice && (
          <div className="px-4 py-1.5 bg-emerald-950/60 border-t border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1.5 font-mono shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{shareNotice}</span>
          </div>
        )}

        {/* Action Buttons - PDF & WhatsApp First */}
        <div className="p-4 border-t border-[#1b2b48] bg-[#090f1c] space-y-2 shrink-0">
          {/* Primary Button: Share PDF directly to Customer WhatsApp */}
          <button
            type="button"
            onClick={handleDispatchWhatsAppPdf}
            disabled={isSendingWhatsApp}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
            title={`Share PDF invoice directly to customer's WhatsApp (${customerPhone || 'phone'})`}
          >
            <Send className="w-4 h-4" />
            <span>
              {isSendingWhatsApp
                ? 'Preparing PDF Invoice...'
                : customerPhone
                ? `Send PDF to WhatsApp (${countryCode} ${customerPhone})`
                : 'Send PDF to Customer WhatsApp'}
            </span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            {/* Download PDF directly */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-950/40"
              title="Download exact on-screen invoice in PDF format"
            >
              {pdfDownloaded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Downloaded!</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>{isDownloadingPdf ? 'Exporting...' : 'PDF Invoice'}</span>
                </>
              )}
            </button>

            {/* Print thermal receipt */}
            <button
              type="button"
              onClick={handlePrint}
              className="py-2.5 bg-[#121e38] hover:bg-[#18284c] text-slate-300 border border-[#1e2f50] rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print POS</span>
            </button>

            {/* New sale */}
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 bg-[#172542] hover:bg-[#20335c] text-slate-200 rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border border-[#233860]"
            >
              New Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

