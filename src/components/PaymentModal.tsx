import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import { Customer, Invoice, PaymentMethod, PaymentStatus, StoreSettings } from '../types/pos';
import { CalculationSummary, formatCurrency } from '../utils/taxCalculator';
import { buildUPIDeepLink } from '../utils/upi';
import { getWhatsAppPaymentDirectUrl, buildWhatsAppPaymentLinkMessage } from '../utils/whatsapp';
import { posAudio } from '../utils/audio';
import confetti from 'canvas-confetti';
import {
  QrCode,
  Banknote,
  CheckCircle2,
  X,
  Copy,
  Check,
  Send,
  Phone,
  MessageSquare,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculation: CalculationSummary;
  customer: Customer | null;
  settings: StoreSettings;
  onCompletePayment: (paymentData: {
    method: PaymentMethod;
    status: PaymentStatus;
    details: Invoice['paymentDetails'];
  }) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  calculation,
  customer,
  settings,
  onCompletePayment,
}) => {
  const [activeTab, setActiveTab] = useState<PaymentMethod>('upi');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedUPI, setCopiedUPI] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isLinkSent, setIsLinkSent] = useState(false);

  // Cash States
  const [cashTendered, setCashTendered] = useState<number>(calculation.grandTotal);
  const changeDue = Math.max(0, cashTendered - calculation.grandTotal);

  // WhatsApp States
  const [whatsAppPhone, setWhatsAppPhone] = useState<string>('');
  const [whatsAppCustomerName, setWhatsAppCustomerName] = useState<string>('');

  // Canvas ref for zero-flicker instant QR rendering
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Synchronize inputs when modal opens
  useEffect(() => {
    if (isOpen) {
      setCashTendered(calculation.grandTotal);
      setWhatsAppPhone(customer?.phone || '');
      setWhatsAppCustomerName(customer?.name || 'Customer');
      setIsLinkSent(false);
      setCopiedUPI(false);
      setCopiedLink(false);
    }
  }, [isOpen, customer, calculation.grandTotal]);

  // Stable UPI Deep Link (memoized by parameters, not Date.now)
  const upiDeepLink = useMemo(() => {
    return buildUPIDeepLink({
      upiId: settings.upiId,
      payeeName: settings.upiPayeeName || settings.storeName,
      amount: calculation.grandTotal,
      currency: settings.currencyCode || 'INR',
      transactionNote: `Bill for ${whatsAppCustomerName || customer?.name || 'Customer'}`,
      transactionRef: `INV${Math.floor(calculation.grandTotal * 100)}`,
    });
  }, [settings.upiId, settings.upiPayeeName, settings.storeName, calculation.grandTotal, whatsAppCustomerName, customer?.name, settings.currencyCode]);

  // Render QR directly to canvas without network or image reloading
  useEffect(() => {
    if (isOpen && activeTab === 'upi' && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, upiDeepLink, {
        width: 190,
        margin: 1,
        color: {
          dark: '#070b14',
          light: '#ffffff',
        },
      }).catch((err) => {
        console.error('QR Canvas error:', err);
      });
    }
  }, [isOpen, activeTab, upiDeepLink]);

  // Generate stable temporary invoice number for current transaction session
  const invoiceNumberTemp = useMemo(() => {
    return `INV-${Math.floor(100000 + Math.random() * 900000)}`;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendWhatsAppPaymentLink = () => {
    const targetPhone = whatsAppPhone.trim() || '9999999999';
    const waUrl = getWhatsAppPaymentDirectUrl(targetPhone, customer?.countryCode || '+91', {
      customerName: whatsAppCustomerName || customer?.name || 'Customer',
      amount: calculation.grandTotal,
      currencySymbol: settings.currencySymbol || '₹',
      storeName: settings.storeName || 'Cardcrafted by Shivani',
      upiId: settings.upiId,
      upiDeepLink,
      invoiceNumber: invoiceNumberTemp,
    });

    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setIsLinkSent(true);
    posAudio.playScanBeep();
  };

  const handleCopyPaymentLink = () => {
    const message = buildWhatsAppPaymentLinkMessage({
      customerName: whatsAppCustomerName || customer?.name || 'Customer',
      amount: calculation.grandTotal,
      currencySymbol: settings.currencySymbol || '₹',
      storeName: settings.storeName || 'Cardcrafted by Shivani',
      upiId: settings.upiId,
      upiDeepLink,
      invoiceNumber: invoiceNumberTemp,
    });
    navigator.clipboard.writeText(message);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(settings.upiId);
    setCopiedUPI(true);
    setTimeout(() => setCopiedUPI(false), 2000);
  };

  const handleConfirmSuccess = () => {
    setIsProcessing(true);
    posAudio.playSuccessChime();

    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }

    setTimeout(() => {
      setIsProcessing(false);
      let paymentDetails: Invoice['paymentDetails'] = {};

      if (activeTab === 'upi') {
        paymentDetails = {
          upiRef: `UPI${Date.now().toString().slice(-8)}`,
          upiIdUsed: settings.upiId,
        };
      } else if (activeTab === 'cash') {
        paymentDetails = {
          cashTendered,
          changeDue,
        };
      } else if (activeTab === 'whatsapp') {
        paymentDetails = {
          whatsappPhone: whatsAppPhone,
          paymentLinkSent: isLinkSent,
          paymentLink: upiDeepLink,
          upiIdUsed: settings.upiId,
        };
      }

      onCompletePayment({
        method: activeTab,
        status: 'completed',
        details: paymentDetails,
      });
    }, 400);
  };

  return (
    <div id="modal-payment-gateway" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1b2b48] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-100">Collect Payment</h3>
            <p className="text-xs text-slate-400">
              Total Payable: <span className="font-bold font-mono text-blue-400 text-sm">{formatCurrency(calculation.grandTotal, settings.currencySymbol)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Payment Methods Tabs (UPI QR, Cash, WhatsApp Link) */}
        <div className="flex border-b border-[#1b2b48] bg-[#090f1c] p-1.5 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('upi')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'upi' ? 'bg-[#15274d] text-blue-400 border border-blue-500/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>UPI QR</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cash')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'cash' ? 'bg-[#15274d] text-blue-400 border border-blue-500/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Cash</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'whatsapp' ? 'bg-[#0f2d26] text-emerald-400 border border-emerald-500/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-4 h-4 text-emerald-400" />
            <span>WhatsApp Link</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {/* TAB 1: UPI QR CODE (Zero flickering with Canvas) */}
          {activeTab === 'upi' && (
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3.5 bg-white rounded-2xl shadow-xl flex items-center justify-center">
                <canvas ref={canvasRef} className="rounded-xl w-[190px] h-[190px] block" />
              </div>

              <div>
                <p className="text-xs font-bold text-slate-200">Scan with GPay, PhonePe, Paytm or BHIM</p>
                <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-slate-400 font-mono">
                  <span>VPA: {settings.upiId}</span>
                  <button onClick={handleCopyUPI} className="p-1 hover:text-blue-400" title="Copy UPI VPA">
                    {copiedUPI ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CASH PAYMENT */}
          {activeTab === 'cash' && (
            <div className="space-y-3.5">
              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  CASH TENDERED
                </label>
                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent text-xl font-bold font-mono text-slate-100 focus:outline-none mt-1"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                {[100, 200, 500, 2000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCashTendered(preset)}
                    className="flex-1 py-1.5 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-xl text-xs font-bold font-mono transition-colors"
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>

              <div className="p-3 bg-[#0a101d] border border-[#1b2b48] rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Change Due to Customer:</span>
                <span className="font-bold text-base font-mono text-emerald-400">
                  {formatCurrency(changeDue, settings.currencySymbol)}
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: WHATSAPP PAYMENT LINK */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-3.5">
              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-emerald-500 transition-colors">
                <label className="block text-[10px] font-extrabold text-emerald-400 tracking-wider uppercase font-mono">
                  CUSTOMER WHATSAPP NUMBER *
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-400 font-mono text-xs font-bold">
                    {customer?.countryCode || '+91'}
                  </span>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={whatsAppPhone}
                    onChange={(e) => setWhatsAppPhone(e.target.value)}
                    className="w-full bg-transparent text-sm font-mono font-bold text-slate-100 focus:outline-none placeholder:text-slate-600"
                    autoFocus
                  />
                </div>
              </div>

              {/* Action: Send payment link directly to WhatsApp */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSendWhatsAppPaymentLink}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Payment Link to WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </button>

                <button
                  type="button"
                  onClick={handleCopyPaymentLink}
                  className="w-full py-2 px-3 bg-[#111c33] hover:bg-[#162442] text-slate-300 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Payment Message Link'}</span>
                </button>
              </div>

              {/* Status Banner */}
              {isLinkSent ? (
                <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-medium">
                    Payment link sent to WhatsApp! Once paid, click below to complete.
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  Sends customer an instant WhatsApp message with UPI intent to pay via GPay, PhonePe, or Paytm.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-[#1b2b48] bg-[#090f1c] flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-2xl text-xs font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleConfirmSuccess}
            className={`flex-2 py-3 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5 ${
              activeTab === 'whatsapp' && isLinkSent
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isProcessing ? 'Processing...' : 'Complete Payment'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
