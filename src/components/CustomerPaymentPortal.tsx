import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { StoreSettings } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import { buildUPIDeepLink } from '../utils/upi';
import { posAudio } from '../utils/audio';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  Store,
  ExternalLink,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface CustomerPaymentPortalProps {
  invoiceNumber: string;
  amount: number;
  settings: StoreSettings;
  onClose: () => void;
}

export const CustomerPaymentPortal: React.FC<CustomerPaymentPortalProps> = ({
  invoiceNumber,
  amount,
  settings,
  onClose,
}) => {
  const [copiedUPI, setCopiedUPI] = useState(false);
  const [isPaidConfirmed, setIsPaidConfirmed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Exact UPI deep link for the exact purchase amount (e.g. ₹120.00)
  const upiDeepLink = buildUPIDeepLink({
    upiId: settings.upiId,
    payeeName: settings.upiPayeeName || settings.storeName,
    amount: amount,
    currency: settings.currencyCode || 'INR',
    transactionNote: `Invoice #${invoiceNumber}`,
    transactionRef: invoiceNumber,
  });

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, upiDeepLink, {
        width: 220,
        margin: 1,
        color: {
          dark: '#070b14',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      }).catch((err) => {
        console.error('Customer QR Canvas error:', err);
      });
    }
  }, [upiDeepLink]);

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(settings.upiId);
    setCopiedUPI(true);
    posAudio.playScanBeep();
    setTimeout(() => setCopiedUPI(false), 2500);
  };

  const handleConfirmCustomerPaid = () => {
    setIsPaidConfirmed(true);
    posAudio.playSuccessChime();
    try {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
  };

  return (
    <div
      id="customer-payment-portal"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-[#0b1222] border border-[#1b2b48] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col my-auto relative">
        {/* Brand Header */}
        <div className="px-6 py-5 bg-linear-to-b from-[#132342] to-[#0b1222] border-b border-[#1b2b48] text-center relative">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mb-2 shadow-inner">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-100 uppercase tracking-tight">
            {settings.storeName || 'Cardcrafted by Shivani'}
          </h2>
          <p className="text-xs text-blue-400 font-medium">Instant UPI Payment Gateway</p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/80 border border-slate-700/60 text-[11px] font-mono text-slate-300">
            <span>Invoice #{invoiceNumber}</span>
          </div>
        </div>

        {/* Amount Hero Card */}
        <div className="p-6 text-center space-y-5">
          {isPaidConfirmed ? (
            <div className="py-8 space-y-3 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Payment Submitted!</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Thank you! Your payment of{' '}
                <span className="font-bold text-emerald-400 font-mono">
                  {formatCurrency(amount, settings.currencySymbol)}
                </span>{' '}
                has been recorded for Invoice #{invoiceNumber}.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  Return to Store
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Exact Amount Banner */}
              <div className="bg-[#0e192e] border border-[#203358] rounded-2xl p-4 shadow-inner">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Amount to Pay
                </span>
                <div className="text-3xl font-black text-blue-400 font-mono mt-1 tracking-tight">
                  {formatCurrency(amount, settings.currencySymbol)}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Zero Transaction Fees • Verified Merchant</span>
                </div>
              </div>

              {/* 1-Tap Pay UPI Link (Direct Intent for Mobile) */}
              <div className="space-y-2">
                <a
                  href={upiDeepLink}
                  className="w-full py-3.5 px-4 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 transition-all active:scale-[0.99]"
                >
                  <span>Pay {formatCurrency(amount, settings.currencySymbol)} via UPI App</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <p className="text-[10px] text-slate-400">
                  Tap to launch Google Pay, PhonePe, Paytm, BHIM or Cred on your phone
                </p>
              </div>

              {/* UPI QR Code */}
              <div className="flex flex-col items-center space-y-2 pt-2">
                <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-blue-500/30 flex items-center justify-center">
                  <canvas ref={canvasRef} className="rounded-lg" />
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Or Scan QR with any UPI App to pay exact{' '}
                  <span className="font-bold text-slate-200">
                    {formatCurrency(amount, settings.currencySymbol)}
                  </span>
                </span>
              </div>

              {/* UPI ID Copy Box */}
              <div className="bg-[#080d1a] border border-[#1b2b48] rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="text-left">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block">Merchant UPI ID</span>
                  <span className="font-bold font-mono text-slate-200">{settings.upiId}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUPI}
                  className="px-3 py-1.5 bg-[#142340] hover:bg-[#1c305a] text-blue-400 rounded-lg text-[11px] font-bold font-mono transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copiedUPI ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUPI ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Confirm Paid Button */}
              <div className="pt-2 border-t border-[#1b2b48]">
                <button
                  type="button"
                  onClick={handleConfirmCustomerPaid}
                  className="w-full py-2.5 bg-[#132342] hover:bg-[#1a2f58] text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>I Have Completed the Payment</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Modal Close / Back */}
        <div className="px-6 py-3 bg-[#080d19] border-t border-[#1b2b48] text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 font-mono transition-colors cursor-pointer"
          >
            Close & Go to POS Terminal
          </button>
        </div>
      </div>
    </div>
  );
};
