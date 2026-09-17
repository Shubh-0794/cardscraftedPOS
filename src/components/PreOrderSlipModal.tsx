import React, { useRef, useState, useEffect } from 'react';
import { PreOrder, StoreSettings } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import { buildUPIDeepLink } from '../utils/upi';
import { getWhatsAppPreOrderDirectUrl, buildWhatsAppPreOrderMessage } from '../utils/whatsapp';
import { createPreOrderPdfBlob, generatePreOrderPdf } from '../utils/qrPdfGenerator';
import { posAudio } from '../utils/audio';
import QRCode from 'qrcode';
import {
  Printer,
  Share2,
  X,
  Clock,
  CheckCircle2,
  Calendar,
  User,
  Phone,
  Package,
  IndianRupee,
  FileText,
  FileDown,
  Check,
  MessageCircle,
  AlertTriangle,
} from 'lucide-react';

interface PreOrderSlipModalProps {
  preOrder: PreOrder | null;
  settings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
  onSettleBalance?: (preOrder: PreOrder) => void;
}

export const PreOrderSlipModal: React.FC<PreOrderSlipModalProps> = ({
  preOrder,
  settings,
  isOpen,
  onClose,
  onSettleBalance,
}) => {
  const [balanceQrDataUrl, setBalanceQrDataUrl] = useState<string>('');
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  // Editable customer phone state
  const [customerPhone, setCustomerPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  const slipRef = useRef<HTMLDivElement>(null);
  const symbol = settings.currencySymbol || '₹';

  useEffect(() => {
    if (isOpen && preOrder) {
      setPdfDownloaded(false);
      setShareNotice(null);
      setCustomerPhone(preOrder.customerPhone || '');
      setCountryCode('+91');
      setIsEditingPhone(!preOrder.customerPhone);
      posAudio.playReceiptPrintSound();
    }
  }, [isOpen, preOrder?.id, preOrder?.customerPhone]);

  // Generate UPI QR for collecting remaining balance
  useEffect(() => {
    if (!preOrder || preOrder.balanceDue <= 0 || !settings.upiId) {
      setBalanceQrDataUrl('');
      return;
    }

    const upiLink = buildUPIDeepLink({
      upiId: settings.upiId,
      payeeName: settings.upiPayeeName || settings.storeName,
      amount: preOrder.balanceDue,
      currency: settings.currencyCode || 'INR',
      transactionNote: `Balance for Pre-Order #${preOrder.orderNumber}`,
      transactionRef: `PRE${preOrder.orderNumber.replace(/\D/g, '')}`,
    });

    QRCode.toDataURL(upiLink, {
      width: 160,
      margin: 1,
      color: {
        dark: '#0a0f1d',
        light: '#ffffff',
      },
    })
      .then((url) => setBalanceQrDataUrl(url))
      .catch((err) => console.error('Failed to generate balance QR:', err));
  }, [preOrder, settings.upiId, settings.upiPayeeName, settings.storeName, settings.currencyCode]);

  if (!isOpen || !preOrder) return null;

  const isCompleted = preOrder.status === 'completed';
  const isCancelled = preOrder.status === 'cancelled';

  const handlePrint = () => {
    window.print();
  };

  // Download PDF Slip
  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await generatePreOrderPdf(preOrder, settings);
      setPdfDownloaded(true);
      posAudio.playSuccessChime();
      setTimeout(() => setPdfDownloaded(false), 3000);
    } catch (err) {
      console.error('Failed to export pre-order PDF slip:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Dispatch PDF Slip to Customer WhatsApp
  const handleSendPdfWhatsApp = async () => {
    const cleanPhoneDigits = customerPhone.replace(/\D/g, '');
    if (!cleanPhoneDigits) {
      setIsEditingPhone(true);
      setShareNotice('Please enter the customer WhatsApp phone number.');
      return;
    }

    setIsSendingWhatsApp(true);
    setShareNotice(null);

    const cleanCountry = countryCode.replace(/\D/g, '') || '91';
    const fullCustomerNumber = `${cleanCountry}${cleanPhoneDigits}`;

    try {
      // 1. Create high-fidelity Pre-Order PDF Slip Blob and File
      const { doc, file, filename } = await createPreOrderPdfBlob(preOrder, settings);

      // 2. Check if native Web Share with Files is supported (Mobile WhatsApp share)
      const canNativeShareFiles =
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] });

      const plainTextMessage = buildWhatsAppPreOrderMessage(preOrder, settings, true);

      if (canNativeShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: `Pre-Order Slip #${preOrder.orderNumber} - ${settings.storeName}`,
            text: plainTextMessage,
          });
          setPdfDownloaded(true);
          posAudio.playSuccessChime();
          setIsSendingWhatsApp(false);
          setShareNotice(`PDF Slip shared to WhatsApp (+${fullCustomerNumber})!`);
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            setIsSendingWhatsApp(false);
            return;
          }
          console.warn('Native file share fallback:', shareErr);
        }
      }

      // 3. Fallback: Download the PDF slip and open direct WhatsApp chat
      doc.save(filename);
      setPdfDownloaded(true);
      posAudio.playSuccessChime();

      setShareNotice(`PDF Slip downloaded! Opening WhatsApp for +${fullCustomerNumber}...`);

      const customerWaMeUrl = getWhatsAppPreOrderDirectUrl(preOrder, settings, customerPhone, countryCode);
      window.open(customerWaMeUrl, '_blank', 'noopener,noreferrer');

      setTimeout(() => {
        setIsSendingWhatsApp(false);
      }, 1000);
    } catch (err) {
      console.error('Failed to send PDF slip via WhatsApp:', err);
      setIsSendingWhatsApp(false);
      setShareNotice('Could not generate PDF. Opening text WhatsApp slip...');
      const fallbackUrl = getWhatsAppPreOrderDirectUrl(preOrder, settings, customerPhone, countryCode);
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1b2b48] bg-[#090f1d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                Pre-Order Booking Slip
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-mono border border-blue-500/30">
                  PDF Enabled
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">Order #{preOrder.orderNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-[#15233e] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WhatsApp Customer Phone & Feedback Bar */}
        <div className="px-5 py-2.5 bg-[#0e1930] border-b border-[#1b2b48] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] text-slate-400">Customer WhatsApp:</span>
              {isEditingPhone ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="text"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-12 px-1.5 py-0.5 bg-[#090f1d] border border-slate-700 rounded text-[11px] text-white font-mono text-center"
                    placeholder="+91"
                  />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className="flex-1 px-2 py-0.5 bg-[#090f1d] border border-emerald-500/50 rounded text-[11px] text-emerald-300 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(false)}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold text-emerald-300">
                    {customerPhone ? `${countryCode} ${customerPhone}` : 'No phone set'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(true)}
                    className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                  >
                    (Edit)
                  </button>
                </div>
              )}
            </div>

            {/* Quick WhatsApp Send Button at Top */}
            <button
              type="button"
              onClick={handleSendPdfWhatsApp}
              disabled={isSendingWhatsApp}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40 cursor-pointer disabled:opacity-60"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {isSendingWhatsApp ? 'Sending PDF Slip...' : 'Send PDF on WhatsApp'}
            </button>
          </div>

          {shareNotice && (
            <div className="text-[11px] font-medium text-emerald-300 bg-emerald-950/50 border border-emerald-500/40 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{shareNotice}</span>
            </div>
          )}
        </div>

        {/* Printable Slip Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-200" ref={slipRef}>
          {/* Printable Ticket Box with Receipt Styling */}
          <div className="bg-[#080d1a] border border-[#1e2f50] rounded-2xl p-4 sm:p-5 relative shadow-inner">
            {/* Store Branding Header */}
            <div className="text-center pb-4 border-b border-dashed border-[#1f3358]">
              <h2 className="text-lg font-black text-slate-100 uppercase tracking-wide">
                {settings.storeName}
              </h2>
              {settings.tagline && (
                <p className="text-xs text-blue-400 font-medium italic mt-0.5">{settings.tagline}</p>
              )}
              {settings.address && (
                <p className="text-[11px] text-slate-400 mt-1">
                  {settings.address}, {settings.city}
                </p>
              )}
              {settings.phone && (
                <p className="text-[11px] text-slate-400 font-mono">Phone: {settings.phone}</p>
              )}
              {settings.gstin && (
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">GSTIN: {settings.gstin}</p>
              )}
            </div>

            {/* Slip Meta Info */}
            <div className="grid grid-cols-2 gap-2 py-3 border-b border-dashed border-[#1f3358] text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">PRE-ORDER NO</span>
                <span className="font-bold text-blue-400">#{preOrder.orderNumber}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[10px]">BOOKING DATE</span>
                <span className="text-slate-300">
                  {new Date(preOrder.timestamp).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              {preOrder.expectedDeliveryDate && (
                <div className="col-span-2 bg-blue-950/40 border border-blue-500/30 rounded-lg p-1.5 flex items-center justify-between mt-1">
                  <span className="text-[10px] text-blue-300 font-bold flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-400" /> EXPECTED DELIVERY
                  </span>
                  <span className="text-xs font-bold text-blue-200">
                    {preOrder.expectedDeliveryDate}
                  </span>
                </div>
              )}
            </div>

            {/* Customer Details */}
            <div className="py-3 border-b border-dashed border-[#1f3358] text-xs">
              <span className="text-[10px] font-mono text-slate-500 block uppercase mb-1">
                Customer Details
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-200">
                    {preOrder.customerName || 'Walk-in Customer'}
                  </span>
                </div>
                {customerPhone && (
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                    <Phone className="w-3 h-3 text-emerald-400" />
                    <span>{customerPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Product Items Table */}
            <div className="py-3 border-b border-dashed border-[#1f3358]">
              <span className="text-[10px] font-mono text-slate-500 block uppercase mb-2">
                Order Item Specifications
              </span>
              <div className="bg-[#0c1427] rounded-xl p-3 border border-[#1a2948]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{preOrder.productName}</span>
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Quantity: <strong className="text-slate-200">{preOrder.quantity}</strong> ×{' '}
                      {formatCurrency(preOrder.unitPrice, symbol)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400 block font-mono">Item Total</span>
                    <span className="font-bold text-sm text-slate-100 font-mono">
                      {formatCurrency(preOrder.totalPrice, symbol)}
                    </span>
                  </div>
                </div>

                {preOrder.notes && (
                  <div className="mt-2.5 pt-2 border-t border-[#1b2b48] text-[11px] text-slate-300">
                    <span className="text-slate-500 font-mono text-[10px] block">CUSTOM NOTES:</span>
                    <p className="italic bg-[#070c18] p-1.5 rounded-lg border border-[#16243f] mt-0.5">
                      {preOrder.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Ledger Breakdown */}
            <div className="py-3 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Total Order Price:</span>
                <span className="font-bold">{formatCurrency(preOrder.totalPrice, symbol)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Advance Paid:
                </span>
                <span className="font-bold">
                  -{formatCurrency(preOrder.advancePayment, symbol)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#1f3358] flex justify-between items-baseline">
                <div>
                  <span className="font-bold text-sm text-slate-100 block">Remaining Balance:</span>
                  <span className="text-[10px] text-slate-400">
                    {preOrder.balanceDue <= 0 ? 'Fully Paid' : 'Due upon collection'}
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`text-lg font-black ${
                      preOrder.balanceDue <= 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {formatCurrency(preOrder.balanceDue, symbol)}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Stamp */}
            <div className="mt-2 text-center">
              {isCompleted ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ORDER COMPLETED &amp; DELIVERED
                </div>
              ) : isCancelled ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold font-mono">
                  <X className="w-3.5 h-3.5" /> ORDER CANCELLED
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold font-mono">
                  <Clock className="w-3.5 h-3.5" /> ADVANCE RECEIVED • PENDING BALANCE
                </div>
              )}
            </div>

            {/* Dynamic UPI QR for Paying Balance */}
            {preOrder.balanceDue > 0 && balanceQrDataUrl && (
              <div className="mt-4 pt-3 border-t border-dashed border-[#1f3358] flex flex-col items-center text-center">
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Scan with GPay / PhonePe / Paytm to Pay Balance
                </p>
                <div className="p-2 bg-white rounded-xl shadow-md inline-block">
                  <img
                    src={balanceQrDataUrl}
                    alt="Balance Payment QR"
                    className="w-28 h-28 mx-auto"
                  />
                </div>
                <p className="text-[11px] font-mono font-bold text-amber-300 mt-1.5">
                  Amount: {formatCurrency(preOrder.balanceDue, symbol)}
                </p>
                {settings.upiId && (
                  <p className="text-[10px] text-slate-500 font-mono">UPI ID: {settings.upiId}</p>
                )}
              </div>
            )}

            {/* Footer Terms */}
            <div className="mt-4 pt-3 border-t border-dashed border-[#1f3358] text-center text-[10px] text-slate-500">
              <p>{settings.invoiceFooterNote || 'Thank you for your business!'}</p>
              <p className="mt-0.5">Please show this slip when collecting your order.</p>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="p-4 border-t border-[#1b2b48] bg-[#090f1d] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* WhatsApp PDF Button */}
            <button
              type="button"
              onClick={handleSendPdfWhatsApp}
              disabled={isSendingWhatsApp}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40 cursor-pointer disabled:opacity-50"
            >
              <MessageCircle className="w-4 h-4" />
              {isSendingWhatsApp ? 'Generating PDF...' : 'Send PDF to WhatsApp'}
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-3 py-2 bg-[#12203d] hover:bg-[#182a52] text-slate-200 border border-[#1b2b48] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {pdfDownloaded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Saved</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5 text-blue-400" />
                  <span>{isDownloadingPdf ? 'Exporting...' : 'PDF Slip'}</span>
                </>
              )}
            </button>

            {/* Print Slip Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 bg-[#12203d] hover:bg-[#182a52] text-slate-300 border border-[#1b2b48] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" /> Print
            </button>
          </div>

          {/* Settle Balance Button */}
          {preOrder.balanceDue > 0 && onSettleBalance && (
            <button
              type="button"
              onClick={() => {
                onSettleBalance(preOrder);
                onClose();
              }}
              className="px-4 py-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-900/30 transition-all cursor-pointer"
            >
              <IndianRupee className="w-4 h-4" /> Settle Balance ({formatCurrency(preOrder.balanceDue, symbol)})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
