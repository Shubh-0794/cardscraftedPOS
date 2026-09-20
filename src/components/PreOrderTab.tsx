import React, { useState, useMemo, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { PreOrder, Product, Customer, StoreSettings, PaymentMethod } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import { buildUPIDeepLink } from '../utils/upi';
import { getWhatsAppPreOrderDirectUrl, buildWhatsAppPreOrderMessage } from '../utils/whatsapp';
import { createPreOrderPdfBlob, generatePreOrderPdf } from '../utils/qrPdfGenerator';
import { posAudio } from '../utils/audio';
import {
  PackagePlus,
  IndianRupee,
  Calendar,
  User,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Share2,
  Trash2,
  Edit3,
  Search,
  Check,
  QrCode,
  Banknote,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  FileDown,
  MessageCircle,
  Percent,
  Plus,
  Minus,
} from 'lucide-react';

interface PreOrderTabProps {
  preOrders: PreOrder[];
  products: Product[];
  customers: Customer[];
  settings: StoreSettings;
  onSavePreOrder: (preOrder: PreOrder) => void;
  onDeletePreOrder: (id: string) => void;
  onUpdatePreOrderStatus: (id: string, status: PreOrder['status']) => void;
  onOpenPreOrderSlip: (preOrder: PreOrder) => void;
  onConvertToSale?: (preOrder: PreOrder) => void;
}

export const PreOrderTab: React.FC<PreOrderTabProps> = ({
  preOrders,
  products,
  customers,
  settings,
  onSavePreOrder,
  onDeletePreOrder,
  onUpdatePreOrderStatus,
  onOpenPreOrderSlip,
  onConvertToSale,
}) => {
  const symbol = settings.currencySymbol || '₹';

  // Active View Mode: 'create' or 'list'
  const [activeSubView, setActiveSubView] = useState<'create' | 'list'>('create');

  // Manual Form States
  const [productName, setProductName] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [advancePayment, setAdvancePayment] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<PaymentMethod>('upi');

  // Editing existing pre-order id (if in edit mode)
  const [editingPreOrderId, setEditingPreOrderId] = useState<string | null>(null);

  // Suggestions dropdown toggles
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // UPI QR Code preview for Advance Payment
  const [showAdvanceQr, setShowAdvanceQr] = useState(false);
  const [advanceQrDataUrl, setAdvanceQrDataUrl] = useState<string>('');

  // Search & Filter in list view
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'advance_paid' | 'completed' | 'cancelled'>('all');

  // Settle Balance modal state
  const [settleOrder, setSettleOrder] = useState<PreOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<PreOrder | null>(null);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('cash');
  const [sendingPdfOrderId, setSendingPdfOrderId] = useState<string | null>(null);

  // Form Calculations
  const totalPrice = useMemo(() => {
    const qty = Math.max(1, Number(quantity) || 1);
    const price = Math.max(0, Number(unitPrice) || 0);
    return Math.round(qty * price * 100) / 100;
  }, [quantity, unitPrice]);

  const balanceDue = useMemo(() => {
    const adv = Math.max(0, Number(advancePayment) || 0);
    return Math.max(0, Math.round((totalPrice - adv) * 100) / 100);
  }, [totalPrice, advancePayment]);

  // Filtered product suggestions
  const filteredProductSuggestions = useMemo(() => {
    if (!productName.trim()) return products.slice(0, 5);
    return products.filter((p) =>
      p.name.toLowerCase().includes(productName.toLowerCase()) ||
      p.category?.toLowerCase().includes(productName.toLowerCase())
    ).slice(0, 6);
  }, [products, productName]);

  // Filtered customer suggestions
  const filteredCustomerSuggestions = useMemo(() => {
    if (!customerName.trim() && !customerPhone.trim()) return customers.filter(c => c.id !== 'walk-in').slice(0, 5);
    const query = (customerName || customerPhone).toLowerCase();
    return customers.filter((c) =>
      c.id !== 'walk-in' &&
      (c.name.toLowerCase().includes(query) || c.phone.includes(query))
    ).slice(0, 5);
  }, [customers, customerName, customerPhone]);

  // Generate QR for Advance Payment when requested
  useEffect(() => {
    if (showAdvanceQr && advancePayment > 0 && settings.upiId) {
      const upiLink = buildUPIDeepLink({
        upiId: settings.upiId,
        payeeName: settings.upiPayeeName || settings.storeName,
        amount: advancePayment,
        currency: settings.currencyCode || 'INR',
        transactionNote: `Advance for ${productName || 'Pre-Order'}`,
        transactionRef: `ADV${Date.now().toString().slice(-6)}`,
      });

      QRCode.toDataURL(upiLink, {
        width: 170,
        margin: 1,
        color: { dark: '#0a0f1d', light: '#ffffff' },
      })
        .then((url) => setAdvanceQrDataUrl(url))
        .catch((err) => console.error('Error generating advance QR:', err));
    } else {
      setAdvanceQrDataUrl('');
    }
  }, [showAdvanceQr, advancePayment, settings.upiId, settings.upiPayeeName, settings.storeName, productName, settings.currencyCode]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const active = preOrders.filter((o) => o.status === 'advance_paid');
    const totalAdvance = preOrders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.advancePayment : 0), 0);
    const totalPendingBalance = active.reduce((sum, o) => sum + o.balanceDue, 0);
    return {
      activeCount: active.length,
      totalCount: preOrders.length,
      totalAdvance,
      totalPendingBalance,
    };
  }, [preOrders]);

  // Filtered Pre-Orders List
  const filteredPreOrders = useMemo(() => {
    return preOrders
      .filter((order) => {
        if (statusFilter !== 'all' && order.status !== statusFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          order.orderNumber.toLowerCase().includes(q) ||
          order.productName.toLowerCase().includes(q) ||
          (order.customerName && order.customerName.toLowerCase().includes(q)) ||
          (order.customerPhone && order.customerPhone.includes(q))
        );
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [preOrders, statusFilter, searchQuery]);

  // Quick Preset Advance Percentages
  const setAdvanceByPercentage = (percent: number) => {
    if (totalPrice <= 0) return;
    const calc = Math.round((totalPrice * (percent / 100)) * 100) / 100;
    setAdvancePayment(calc);
  };

  // Reset Form
  const handleResetForm = () => {
    setProductName('');
    setQuantity(1);
    setUnitPrice(0);
    setAdvancePayment(0);
    setCustomerName('');
    setCustomerPhone('');
    setExpectedDeliveryDate('');
    setNotes('');
    setEditingPreOrderId(null);
    setShowAdvanceQr(false);
  };

  // Save or Update Pre-Order
  const handleSubmitPreOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName.trim()) {
      alert('Please enter a Product Name for the pre-order.');
      return;
    }

    if (unitPrice <= 0) {
      alert('Please enter a valid Price.');
      return;
    }

    const calculatedTotal = Math.round(quantity * unitPrice * 100) / 100;
    const cleanAdvance = Math.min(calculatedTotal, Math.max(0, advancePayment));
    const calculatedBalance = Math.max(0, Math.round((calculatedTotal - cleanAdvance) * 100) / 100);

    const orderNumber = editingPreOrderId
      ? preOrders.find((p) => p.id === editingPreOrderId)?.orderNumber || `PRE-${Date.now().toString().slice(-4)}`
      : `PRE-${Date.now().toString().slice(-4)}`;

    const newPreOrder: PreOrder = {
      id: editingPreOrderId || `pre-${Date.now()}`,
      orderNumber,
      productName: productName.trim(),
      quantity: Number(quantity) || 1,
      unitPrice: Number(unitPrice) || 0,
      totalPrice: calculatedTotal,
      advancePayment: cleanAdvance,
      balanceDue: calculatedBalance,
      customerName: customerName.trim() || 'Walk-in Customer',
      customerPhone: customerPhone.trim(),
      expectedDeliveryDate: expectedDeliveryDate.trim(),
      notes: notes.trim(),
      advancePaymentMethod,
      status: calculatedBalance <= 0 ? 'completed' : 'advance_paid',
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
    };

    onSavePreOrder(newPreOrder);
    posAudio.playReceiptPrintSound();

    handleResetForm();
    setActiveSubView('list');
    onOpenPreOrderSlip(newPreOrder);
  };

  // Direct 1-Click WhatsApp PDF Slip Dispatcher from list
  const handleDirectWhatsAppPdf = async (order: PreOrder) => {
    setSendingPdfOrderId(order.id);
    try {
      const { doc, file, filename } = await createPreOrderPdfBlob(order, settings);
      const cleanPhoneDigits = (order.customerPhone || '').replace(/\D/g, '');
      const cleanCountry = '91';
      const fullCustomerNumber = cleanPhoneDigits.length === 10 ? `${cleanCountry}${cleanPhoneDigits}` : cleanPhoneDigits;
      const plainTextMessage = buildWhatsAppPreOrderMessage(order, settings, true);

      const canNativeShareFiles =
        typeof navigator !== 'undefined' &&
        navigator.canShare &&
        navigator.canShare({ files: [file] });

      if (canNativeShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: `Pre-Order Slip #${order.orderNumber} - ${settings.storeName}`,
            text: plainTextMessage,
          });
          posAudio.playSuccessChime();
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      // Universal Fallback: Download PDF & open WhatsApp chat
      doc.save(filename);
      posAudio.playSuccessChime();
      const url = getWhatsAppPreOrderDirectUrl(order, settings);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to dispatch pre-order PDF via WhatsApp:', err);
      onOpenPreOrderSlip(order);
    } finally {
      setSendingPdfOrderId(null);
    }
  };

  // Load Pre-Order for editing
  const handleEditPreOrder = (order: PreOrder) => {
    setEditingPreOrderId(order.id);
    setProductName(order.productName);
    setQuantity(order.quantity);
    setUnitPrice(order.unitPrice);
    setAdvancePayment(order.advancePayment);
    setCustomerName(order.customerName || '');
    setCustomerPhone(order.customerPhone || '');
    setExpectedDeliveryDate(order.expectedDeliveryDate || '');
    setNotes(order.notes || '');
    setAdvancePaymentMethod(order.advancePaymentMethod || 'upi');
    setActiveSubView('create');
  };

  // Settle Balance action
  const handleConfirmSettleBalance = () => {
    if (!settleOrder) return;
    onUpdatePreOrderStatus(settleOrder.id, 'completed');
    posAudio.playSuccessChime();
    setSettleOrder(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Banner with Metrics & Sub-View Switcher */}
      <div className="bg-linear-to-r from-blue-950/60 via-[#0d1c38] to-[#0a162d] border border-blue-500/40 rounded-2xl p-3 shadow-md">
        <div className="flex items-center justify-between pb-2 border-b border-blue-500/20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider font-mono">
                Pre-Order Management
              </h3>
              <p className="text-[10px] text-blue-300/80">
                Book advance orders &amp; calculate pending balances
              </p>
            </div>
          </div>

          {/* Sub-view Switcher Toggle */}
          <div className="flex bg-[#070d1a] p-1 rounded-xl border border-blue-500/30 text-xs">
            <button
              type="button"
              onClick={() => {
                handleResetForm();
                setActiveSubView('create');
              }}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
                activeSubView === 'create'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#121f3a]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" /> New Pre-Order
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('list')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubView === 'list'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#121f3a]'
              }`}
            >
              <span>Records ({metrics.activeCount})</span>
              {metrics.activeCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* 3 Metrics Cards */}
        <div className="grid grid-cols-3 gap-2 pt-2.5 text-center font-mono">
          <div className="bg-[#080e1d]/80 border border-[#162744] rounded-xl p-2">
            <span className="text-[9px] text-slate-400 block uppercase">Active Orders</span>
            <span className="text-sm font-extrabold text-blue-400">{metrics.activeCount}</span>
          </div>
          <div className="bg-[#080e1d]/80 border border-[#162744] rounded-xl p-2">
            <span className="text-[9px] text-slate-400 block uppercase">Advance Collected</span>
            <span className="text-sm font-extrabold text-emerald-400">
              {symbol}
              {metrics.totalAdvance.toFixed(0)}
            </span>
          </div>
          <div className="bg-[#080e1d]/80 border border-[#162744] rounded-xl p-2">
            <span className="text-[9px] text-slate-400 block uppercase">Pending Balance</span>
            <span className="text-sm font-extrabold text-amber-400">
              {symbol}
              {metrics.totalPendingBalance.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* VIEW 1: MANUAL PRE-ORDER ENTRY FORM */}
      {activeSubView === 'create' && (
        <form
          onSubmit={handleSubmitPreOrder}
          className="bg-[#091122] border border-[#192b49] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#172744]">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-600/30 text-blue-300 text-[10px] font-mono font-bold uppercase">
                {editingPreOrderId ? 'Edit Mode' : 'Manual Entry'}
              </span>
              <h4 className="font-bold text-xs sm:text-sm text-slate-200">
                {editingPreOrderId ? 'Update Pre-Order Details' : 'Enter Pre-Order Details'}
              </h4>
            </div>
            {editingPreOrderId && (
              <button
                type="button"
                onClick={handleResetForm}
                className="text-xs text-rose-400 hover:underline cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {/* 1. PRODUCT NAME (Manually Enter) */}
          <div className="space-y-1 relative">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center justify-between">
              <span>
                1. Product Name <span className="text-rose-400">*</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Manually entered</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                  setShowProductSuggestions(true);
                }}
                onFocus={() => setShowProductSuggestions(true)}
                placeholder="e.g. Customized Wedding Card / Gift Hamper"
                className="w-full bg-[#060c18] border border-[#1d3052] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition-colors"
              />
              {productName && (
                <button
                  type="button"
                  onClick={() => setProductName('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Catalog Suggestions if needed */}
            {showProductSuggestions && filteredProductSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#0b1428] border border-[#1f355c] rounded-xl shadow-2xl p-2 max-h-48 overflow-y-auto space-y-1">
                <div className="flex items-center justify-between px-1.5 pb-1 border-b border-[#172744]">
                  <span className="text-[10px] text-slate-400 font-mono uppercase">
                    Quick Suggestions from Catalog:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowProductSuggestions(false)}
                    className="text-[10px] text-blue-400 hover:underline"
                  >
                    Close
                  </button>
                </div>
                {filteredProductSuggestions.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => {
                      setProductName(prod.name);
                      if (unitPrice === 0) setUnitPrice(prod.unitPrice);
                      setShowProductSuggestions(false);
                    }}
                    className="w-full text-left p-2 hover:bg-[#12203d] rounded-lg flex items-center justify-between transition-colors group cursor-pointer"
                  >
                    <span className="text-xs text-slate-200 group-hover:text-blue-300 font-medium truncate">
                      {prod.name}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-white shrink-0 ml-2">
                      {symbol}
                      {prod.unitPrice}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. QUANTITY & PRICE (Manually Enter) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Quantity */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center justify-between">
                <span>
                  2. Quantity <span className="text-rose-400">*</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">Manually enter</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 bg-[#060c18] border border-[#1d3052] hover:border-blue-500 rounded-xl flex items-center justify-center text-slate-300 hover:text-white font-bold transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 bg-[#060c18] border border-[#1d3052] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3 py-2 text-center text-sm font-bold font-mono text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 bg-[#060c18] border border-[#1d3052] hover:border-blue-500 rounded-xl flex items-center justify-center text-slate-300 hover:text-white font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Price Per Unit (Manually Enter) */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center justify-between">
                <span>
                  3. Price ({symbol}) <span className="text-rose-400">*</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">Manually enter</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">
                  {symbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={unitPrice || ''}
                  onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full bg-[#060c18] border border-[#1d3052] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-8 pr-3.5 py-2.5 text-sm font-bold font-mono text-slate-100 placeholder:text-slate-600"
                />
              </div>
            </div>
          </div>

          {/* Total Price Calculated Banner */}
          <div className="bg-[#070e1c] border border-blue-500/30 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase font-bold text-slate-400">
                Calculated Total:
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ({quantity} × {symbol}{unitPrice})
              </span>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-blue-300 font-mono">
                {symbol}
                {totalPrice.toFixed(2)}
              </span>
            </div>
          </div>

          {/* 3. ADVANCE PAYMENT (Manually Enter & Deducted from Total Price) */}
          <div className="space-y-2 pt-2 border-t border-[#172744]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>4. Advance Payment ({symbol})</span>
                <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-emerald-400 font-mono">
                Manually enter advance
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Advance Amount Input */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-mono font-bold">
                  {symbol}
                </span>
                <input
                  type="number"
                  min="0"
                  max={totalPrice || undefined}
                  step="any"
                  value={advancePayment || ''}
                  onChange={(e) => setAdvancePayment(parseFloat(e.target.value) || 0)}
                  placeholder="Enter Advance Paid..."
                  className="w-full bg-[#060c18] border-2 border-emerald-600/50 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-xl pl-8 pr-3.5 py-2.5 text-sm font-black font-mono text-emerald-300 placeholder:text-emerald-900/60"
                />
              </div>

              {/* Advance Payment Method Selector */}
              <div className="flex bg-[#060c18] p-1 rounded-xl border border-[#1d3052]">
                {(['upi', 'cash', 'whatsapp'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAdvancePaymentMethod(m)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      advancePaymentMethod === m
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m === 'upi' ? (
                      <>
                        <QrCode className="w-3 h-3" /> UPI QR
                      </>
                    ) : m === 'cash' ? (
                      <>
                        <Banknote className="w-3 h-3" /> Cash
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3 h-3" /> WhatsApp
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Percentage Presets */}
            {totalPrice > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500 font-mono">Quick Preset:</span>
                {[20, 30, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setAdvanceByPercentage(pct)}
                    className="px-2 py-0.5 rounded-md bg-[#101b33] hover:bg-emerald-950/60 hover:border-emerald-500/40 border border-[#1b2b48] text-[10px] font-mono text-slate-300 transition-colors cursor-pointer"
                  >
                    {pct}% ({symbol}
                    {Math.round(totalPrice * (pct / 100))})
                  </button>
                ))}
              </div>
            )}

            {/* Live Financial Breakdown Card: Advance Paid & Remaining Balance Due */}
            <div className="bg-linear-to-r from-[#0c162c] to-[#080f1e] border-2 border-[#1c3258] rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between text-xs font-mono text-slate-300">
                <span>Total Order Amount:</span>
                <span className="font-bold">{symbol}{totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-mono text-emerald-400">
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Advance Paid (Deducted):
                </span>
                <span className="font-bold">-{symbol}{advancePayment.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-[#1a2d4f] flex justify-between items-baseline">
                <div>
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wide font-mono block">
                    Remaining Balance Due:
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {balanceDue <= 0 ? 'Fully Paid Upfront' : 'To be paid upon order delivery'}
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`text-lg font-black font-mono ${
                      balanceDue <= 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {symbol}
                    {balanceDue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Instant UPI QR Toggle for Collecting Advance Right Now */}
          {advancePayment > 0 && settings.upiId && (
            <div className="bg-[#080e1c] border border-blue-500/30 rounded-xl p-3 text-center">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Collect {symbol}{advancePayment.toFixed(2)} Advance via UPI QR
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanceQr(!showAdvanceQr)}
                  className="px-2.5 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer"
                >
                  {showAdvanceQr ? 'Hide QR' : 'Show UPI QR'}
                </button>
              </div>

              {showAdvanceQr && advanceQrDataUrl && (
                <div className="mt-3 p-3 bg-[#060c18] border border-[#1b2b48] rounded-xl inline-block text-center animate-in fade-in">
                  <div className="p-2 bg-white rounded-xl shadow-md inline-block">
                    <img src={advanceQrDataUrl} alt="Advance UPI QR" className="w-32 h-32 mx-auto" />
                  </div>
                  <p className="text-[11px] font-mono text-emerald-400 font-bold mt-2">
                    Advance Amount: {symbol}{advancePayment.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">UPI ID: {settings.upiId}</p>
                </div>
              )}
            </div>
          )}

          {/* 4. CUSTOMER DETAILS & DELIVERY INFO (Optional / Manual) */}
          <div className="space-y-3 pt-2 border-t border-[#172744]">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono block">
              Customer &amp; Delivery Information
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Customer Name */}
              <div className="space-y-1 relative">
                <label className="text-[10px] font-bold text-slate-300 uppercase font-mono flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" /> Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setShowCustomerSuggestions(true);
                  }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-[#060c18] border border-[#1d3052] focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500"
                />

                {/* Suggestions */}
                {showCustomerSuggestions && filteredCustomerSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#0b1428] border border-[#1f355c] rounded-xl shadow-2xl p-1.5 max-h-40 overflow-y-auto space-y-1">
                    <div className="flex items-center justify-between px-1 pb-1 border-b border-[#172744]">
                      <span className="text-[9px] text-slate-400 font-mono">Saved Customers:</span>
                      <button
                        type="button"
                        onClick={() => setShowCustomerSuggestions(false)}
                        className="text-[9px] text-blue-400"
                      >
                        Close
                      </button>
                    </div>
                    {filteredCustomerSuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomerName(c.name);
                          setCustomerPhone(c.phone);
                          setShowCustomerSuggestions(false);
                        }}
                        className="w-full text-left p-1.5 hover:bg-[#12203d] rounded-lg flex items-center justify-between text-xs cursor-pointer"
                      >
                        <span className="text-slate-200 font-medium truncate">{c.name}</span>
                        <span className="text-slate-400 font-mono text-[10px]">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Phone */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-300 uppercase font-mono flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-400" /> Phone (for WhatsApp)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-[#060c18] border border-[#1d3052] focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono placeholder:text-slate-500"
                />
              </div>

              {/* Expected Delivery Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-300 uppercase font-mono flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-400" /> Expected Delivery / Event Date
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="w-full bg-[#060c18] border border-[#1d3052] focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono"
                />
              </div>

              {/* Notes / Custom Specs */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-300 uppercase font-mono">
                  Customization Notes / Specs
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Gold foil, Red envelope, 50 pcs batch"
                  className="w-full bg-[#060c18] border border-[#1d3052] focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#172744] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="px-3.5 py-2.5 bg-[#0e172a] hover:bg-[#13203b] border border-[#1b2b48] text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Reset
            </button>

            <button
              type="submit"
              className="flex-1 py-3 px-4 bg-linear-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 transition-all cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>{editingPreOrderId ? 'Update Pre-Order' : 'Save Pre-Order Booking'}</span>
            </button>
          </div>
        </form>
      )}

      {/* VIEW 2: PRE-ORDERS LEDGER / LIST */}
      {activeSubView === 'list' && (
        <div className="space-y-3">
          {/* Search & Filter Controls */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pre-orders by order #, product, or customer..."
                className="w-full bg-[#091122] border border-[#192b49] rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            {/* Status Tabs Filter */}
            <div className="flex bg-[#070d1a] p-1 rounded-xl border border-[#192b49] text-xs">
              {(
                [
                  { id: 'all', label: 'All Orders' },
                  { id: 'advance_paid', label: 'Pending Balance' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'cancelled', label: 'Cancelled' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer truncate ${
                    statusFilter === tab.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#121f3a]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards List */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {filteredPreOrders.length > 0 ? (
              filteredPreOrders.map((order) => {
                const isCompleted = order.status === 'completed';
                const isCancelled = order.status === 'cancelled';

                return (
                  <div
                    key={order.id}
                    className={`border rounded-2xl p-3.5 space-y-2.5 transition-all ${
                      isCompleted
                        ? 'bg-[#081220] border-emerald-500/30'
                        : isCancelled
                        ? 'bg-[#150a0f] border-rose-500/30 opacity-70'
                        : 'bg-[#091122] hover:bg-[#0c162e] border-[#192b49] hover:border-blue-500/50'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-blue-400">
                            #{order.orderNumber}
                          </span>
                          <span className="font-bold text-xs text-slate-100 truncate">
                            {order.productName}
                          </span>
                          {isCompleted ? (
                            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold rounded">
                              COMPLETED
                            </span>
                          ) : isCancelled ? (
                            <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-400 text-[9px] font-mono font-bold rounded">
                              CANCELLED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 text-[9px] font-mono font-bold rounded flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> ADVANCE PAID
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Qty: <strong className="text-slate-200">{order.quantity}</strong> × {symbol}
                          {order.unitPrice} • Customer:{' '}
                          <span className="text-slate-300 font-semibold">{order.customerName}</span>
                          {order.customerPhone && ` (${order.customerPhone})`}
                        </p>
                      </div>

                      {/* Financial Pill */}
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 block font-mono">
                          Total: {symbol}{order.totalPrice.toFixed(0)}
                        </span>
                        <span
                          className={`text-xs font-mono font-black ${
                            order.balanceDue <= 0 ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          Due: {symbol}{order.balanceDue.toFixed(0)}
                        </span>
                      </div>
                    </div>

                    {/* Meta info & Notes */}
                    {(order.expectedDeliveryDate || order.notes) && (
                      <div className="bg-[#050a14] p-2 rounded-xl text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2 border border-[#13223f]">
                        {order.expectedDeliveryDate && (
                          <span className="flex items-center gap-1 text-blue-300">
                            <Calendar className="w-3 h-3 text-blue-400" /> Expected:{' '}
                            {order.expectedDeliveryDate}
                          </span>
                        )}
                        {order.notes && (
                          <span className="italic text-slate-300 truncate max-w-xs">
                            "{order.notes}"
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action Toolbar */}
                    <div className="pt-1 flex items-center justify-between gap-1 flex-wrap border-t border-[#14233e]">
                      {/* Left: Quick Actions */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onOpenPreOrderSlip(order)}
                          className="px-2.5 py-1 bg-[#101b33] hover:bg-[#162547] text-blue-300 rounded-lg text-[10px] font-bold font-mono flex items-center gap-1 border border-blue-500/20 transition-colors cursor-pointer"
                        >
                          <FileText className="w-3 h-3 text-blue-400" /> Slip
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDirectWhatsAppPdf(order)}
                          disabled={sendingPdfOrderId === order.id}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-lg text-[10px] font-bold font-mono flex items-center gap-1 shadow-xs transition-all cursor-pointer disabled:opacity-60"
                        >
                          <MessageCircle className="w-3 h-3" />
                          {sendingPdfOrderId === order.id ? 'Sending...' : 'WhatsApp PDF'}
                        </button>
                      </div>

                      {/* Right: Settle / Edit / Delete */}
                      <div className="flex items-center gap-1">
                        {!isCompleted && !isCancelled && (
                          <button
                            type="button"
                            onClick={() => setSettleOrder(order)}
                            className="px-2.5 py-1 bg-linear-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 rounded-lg text-[10px] font-black font-mono flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Settle Balance
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleEditPreOrder(order)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-[#12203d] transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingOrder(order);
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Delete Pre-Order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs bg-[#080f1e] rounded-2xl border border-[#192b49]">
                <PackagePlus className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="font-semibold text-slate-400">No Pre-Orders found</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Click "New Pre-Order" above to book an advance order
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Pre-Order Confirmation Modal */}
      {deletingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#0c1427] border border-rose-500/40 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-100">Delete Pre-Order #{deletingOrder.orderNumber}?</h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Are you sure you want to permanently delete pre-order for <strong className="text-slate-200">{deletingOrder.productName}</strong> ({deletingOrder.customerName || 'Customer'})?
              </p>
              <p className="text-[11px] text-rose-400/80 font-mono mt-1">
                This will be permanently removed from Supabase and local storage.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingOrder(null)}
                className="flex-1 py-2.5 bg-[#16233b] hover:bg-[#1e2f4f] text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeletePreOrder(deletingOrder.id);
                  setDeletingOrder(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-rose-950/40 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Balance Confirmation Modal */}
      {settleOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#0c1427] border border-[#1e3358] rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#1b2b48]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-100">Settle Pre-Order Balance</h4>
                  <p className="text-[10px] text-slate-400 font-mono">#{settleOrder.orderNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettleOrder(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#080d1a] border border-[#1a2d4f] rounded-2xl p-3.5 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Product:</span>
                <span className="font-bold text-slate-100">{settleOrder.productName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Amount:</span>
                <span>{symbol}{settleOrder.totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Advance Already Paid:</span>
                <span>-{symbol}{settleOrder.advancePayment.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-[#182a4d] flex justify-between items-baseline">
                <span className="font-bold text-slate-200">Balance to Collect:</span>
                <span className="text-base font-black text-amber-400">
                  {symbol}{settleOrder.balanceDue.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                Received Balance Via:
              </label>
              <div className="flex bg-[#060c18] p-1 rounded-xl border border-[#1d3052]">
                {(['cash', 'upi'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSettleMethod(m)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      settleMethod === m
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m === 'cash' ? <Banknote className="w-3.5 h-3.5" /> : <QrCode className="w-3.5 h-3.5" />}
                    <span>{m.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSettleOrder(null)}
                className="flex-1 py-2 bg-[#0e172a] hover:bg-[#13203b] border border-[#1b2b48] text-slate-400 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSettleBalance}
                className="flex-1 py-2 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1 shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" /> Mark Fully Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
