import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Invoice, StoreSettings } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import { generateWhatsAppPayloads, formatWhatsAppFullNumber } from '../utils/whatsapp';
import { executeCompleteWhatsAppDispatch, formatIndianWhatsAppNumber } from '../services/whatsapp';
import { updateInvoiceWhatsAppStatusInSupabase } from '../lib/supabase';
import { posAudio } from '../utils/audio';
import { generateInvoicePdf, createInvoicePdfBlob } from '../utils/qrPdfGenerator';
import { printInvoiceReceipt } from '../utils/printReceipt';
import {
  Printer,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileDown,
  Check,
  Phone,
  MessageCircle,
  Zap,
  Sparkles,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { ProductQrBadge } from './ProductQrBadge';

interface InvoiceModalProps {
  invoice: Invoice | null;
  settings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateWhatsAppStatus: (
    invoiceId: string,
    status: 'sent' | 'failed' | 'pending',
    details?: { messageId?: string; error?: string; invoicePath?: string; documentUrl?: string }
  ) => void;
  onViewBarcode?: (barcode: string, name: string, price?: number, sku?: string, category?: string) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  invoice,
  settings,
  isOpen,
  onClose,
  onUpdateWhatsAppStatus,
  onViewBarcode,
  onDeleteInvoice,
}) => {
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<'pending' | 'sent' | 'failed'>('pending');
  const [animationKey, setAnimationKey] = useState<number>(0);
  const [isPrintingAnim, setIsPrintingAnim] = useState(true);

  // Customer WhatsApp phone state (strictly targets customer's number)
  const [customerPhone, setCustomerPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  // Track auto-dispatched invoices to prevent duplicate loops
  const autoDispatchedRef = useRef<string | null>(null);

  // Dispatch PDF directly to Customer WhatsApp (Supabase Storage -> Netlify Function -> WhatsApp Cloud API)
  const handleDispatchWhatsAppPdf = useCallback(
    async (isAutoTrigger = false, overrideTargetPhone?: string) => {
      if (!invoice) return;

      const rawPhone = overrideTargetPhone !== undefined ? overrideTargetPhone : customerPhone;
      let formattedPhone = '';
      try {
        formattedPhone = formatIndianWhatsAppNumber(rawPhone);
      } catch {
        setIsEditingPhone(true);
        setShareNotice('Enter valid 10-digit customer mobile number');
        return;
      }

      setIsSendingWhatsApp(true);
      setShareNotice(null);
      setErrorMessage(null);

      try {
        // Execute complete pipeline: PDF Gen -> Supabase Storage Upload -> Netlify Function WhatsApp Cloud API
        const dispatchResult = await executeCompleteWhatsAppDispatch(invoice, settings, {
          customPhone: formattedPhone,
        });

        if (dispatchResult.success) {
          setDeliveryStatus('sent');
          onUpdateWhatsAppStatus(invoice.id, 'sent', {
            messageId: dispatchResult.messageId,
            documentUrl: dispatchResult.documentUrl,
            invoicePath: dispatchResult.invoicePath,
          });
          updateInvoiceWhatsAppStatusInSupabase(invoice.id, 'sent', {
            messageId: dispatchResult.messageId,
            documentUrl: dispatchResult.documentUrl,
            invoicePath: dispatchResult.invoicePath,
          });

          posAudio.playSuccessChime();
          setShareNotice(
            dispatchResult.method === 'cloud_api'
              ? `⚡ Invoice PDF automatically delivered to WhatsApp (+${formattedPhone})!`
              : `⚡ Invoice ready on WhatsApp (+${formattedPhone})!`
          );
        } else {
          setDeliveryStatus('failed');
          setErrorMessage(dispatchResult.error || 'WhatsApp delivery failed. You can retry or open in WhatsApp directly.');
          onUpdateWhatsAppStatus(invoice.id, 'failed', {
            error: dispatchResult.error,
            invoicePath: dispatchResult.invoicePath,
            documentUrl: dispatchResult.documentUrl,
          });
          updateInvoiceWhatsAppStatusInSupabase(invoice.id, 'failed', {
            error: dispatchResult.error,
            invoicePath: dispatchResult.invoicePath,
            documentUrl: dispatchResult.documentUrl,
          });
        }
      } catch (err: any) {
        console.error('Error in WhatsApp PDF dispatch:', err);
        setDeliveryStatus('failed');
        setErrorMessage(err.message || 'WhatsApp sending failed');
      } finally {
        setIsSendingWhatsApp(false);
      }
    },
    [invoice, customerPhone, countryCode, settings, onUpdateWhatsAppStatus]
  );

  // Initialize and trigger automatic WhatsApp PDF dispatch as soon as payment is done
  useEffect(() => {
    if (isOpen && invoice) {
      setAnimationKey((prev) => prev + 1);
      setIsPrintingAnim(true);
      setPdfDownloaded(false);
      setShareNotice(null);
      setErrorMessage(null);

      const initialStatus = invoice.whatsappStatus || (invoice.whatsappDispatchStatus === 'sent' ? 'sent' : 'pending');
      setDeliveryStatus(initialStatus as any);

      const initialPhone = invoice.customer.phone || '';
      const initialCountry = invoice.customer.countryCode || '+91';
      setCustomerPhone(initialPhone);
      setCountryCode(initialCountry);

      const cleanDigits = initialPhone.replace(/\D/g, '');
      const hasValidPhone = cleanDigits.length >= 10 && cleanDigits !== '9999999999';
      setIsEditingPhone(!hasValidPhone);

      posAudio.playReceiptPrintSound();
      const printTimer = setTimeout(() => {
        setIsPrintingAnim(false);
      }, 900);

      // AUTOMATIC PDF DISPATCH TO CUSTOMER'S WHATSAPP ON PAYMENT COMPLETION
      const shouldAutoSend = settings.autoOpenWhatsApp !== false;
      if (shouldAutoSend && hasValidPhone && autoDispatchedRef.current !== invoice.id && initialStatus !== 'sent') {
        autoDispatchedRef.current = invoice.id;
        const autoTimer = setTimeout(() => {
          handleDispatchWhatsAppPdf(true, cleanDigits);
        }, 400);
        return () => {
          clearTimeout(printTimer);
          clearTimeout(autoTimer);
        };
      }

      return () => clearTimeout(printTimer);
    }
  }, [isOpen, invoice?.id, invoice?.customer?.phone, settings.autoOpenWhatsApp, handleDispatchWhatsAppPdf]);

  if (!isOpen || !invoice) return null;

  const handlePrint = async () => {
    setIsPrintingReceipt(true);
    try {
      await printInvoiceReceipt(invoice, settings);
      posAudio.playReceiptPrintSound();
    } catch (err) {
      console.error('Failed to print invoice receipt:', err);
    } finally {
      setIsPrintingReceipt(false);
    }
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
            {onDeleteInvoice && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete Invoice"
                className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors text-xs flex items-center gap-1 font-mono cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-400" />
              </button>
            )}
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

        {/* Delete Confirmation Popup */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#0e1628] border border-rose-500/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-center">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">Delete Invoice #{invoice.invoiceNumber}?</h4>
                <p className="text-xs text-slate-400 mt-1">
                  This will permanently remove this invoice record from the database and history ledger.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 bg-[#16233b] hover:bg-[#1e2f4f] text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteInvoice && invoice) {
                      onDeleteInvoice(invoice.id);
                      setShowDeleteConfirm(false);
                      onClose();
                    }
                  }}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-rose-950/40 cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

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
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4" />
              </div>
              {isEditingPhone ? (
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-slate-400 font-mono text-xs">{countryCode}</span>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setIsEditingPhone(false);
                        handleDispatchWhatsAppPdf(false, customerPhone);
                      }
                    }}
                    className="bg-[#111d35] border border-emerald-500/50 rounded-lg px-2 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-400 flex-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPhone(false);
                      handleDispatchWhatsAppPdf(false, customerPhone);
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer shrink-0 flex items-center gap-1 shadow-md shadow-emerald-950/40"
                  >
                    <Send className="w-3 h-3" />
                    <span>Send PDF</span>
                  </button>
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <span>WhatsApp Invoice:</span>
                    {deliveryStatus === 'sent' && (
                      <span className="text-emerald-400 font-semibold flex items-center gap-0.5 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/30">
                        <Check className="w-3 h-3" /> Sent
                      </span>
                    )}
                    {deliveryStatus === 'failed' && (
                      <span className="text-rose-400 font-semibold flex items-center gap-0.5 bg-rose-950/80 px-1.5 py-0.2 rounded border border-rose-500/30">
                        <AlertCircle className="w-3 h-3" /> Delivery Failed
                      </span>
                    )}
                    {deliveryStatus === 'pending' && (
                      <span className="text-amber-400 font-semibold flex items-center gap-0.5 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/30">
                        Pending
                      </span>
                    )}
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

        {/* Real-Time Auto-Dispatch Notification Banner */}
        {shareNotice && (
          <div className="px-4 py-2 bg-emerald-950/80 border-t border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 font-mono shrink-0 animate-in fade-in duration-200">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 fill-amber-400 animate-pulse" />
            <span className="font-semibold">{shareNotice}</span>
          </div>
        )}

        {/* Error Notification Banner with Retry Option */}
        {errorMessage && (
          <div className="px-4 py-2.5 bg-rose-950/80 border-t border-rose-500/40 text-rose-300 text-xs flex items-center justify-between gap-2 font-mono shrink-0 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate text-[11px]">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => handleDispatchWhatsAppPdf(false)}
              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold shrink-0 uppercase transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Action Buttons - PDF & WhatsApp First */}
        <div className="p-4 border-t border-[#1b2b48] bg-[#090f1c] space-y-2 shrink-0">
          {/* Primary Button: Send or Resend PDF directly to Customer WhatsApp */}
          <button
            type="button"
            onClick={() => handleDispatchWhatsAppPdf(false)}
            disabled={isSendingWhatsApp}
            className={`w-full py-3 text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              deliveryStatus === 'failed'
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/40'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
            }`}
            title={`Send PDF invoice directly to customer's WhatsApp (${customerPhone || 'phone'})`}
          >
            {deliveryStatus === 'failed' ? <RefreshCw className={`w-4 h-4 ${isSendingWhatsApp ? 'animate-spin' : ''}`} /> : <Send className="w-4 h-4" />}
            <span>
              {isSendingWhatsApp
                ? 'Preparing & Sending via Cloud API...'
                : deliveryStatus === 'sent'
                ? `Resend WhatsApp Invoice (+${customerPhone})`
                : deliveryStatus === 'failed'
                ? `Retry WhatsApp Invoice (+${customerPhone})`
                : customerPhone
                ? `Send WhatsApp Invoice (+${customerPhone})`
                : 'Send Invoice to WhatsApp'}
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

