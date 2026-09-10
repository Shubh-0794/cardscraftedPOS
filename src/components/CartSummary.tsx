import React, { useState } from 'react';
import { BillDiscount, CartItem, Customer, PaymentMethod } from '../types/pos';
import { CalculationSummary, formatCurrency } from '../utils/taxCalculator';
import {
  Trash2,
  Plus,
  Minus,
  PauseCircle,
  RotateCcw,
  Check,
  Tag,
  ArrowRight,
  Receipt,
  X,
  Send,
  QrCode,
  Banknote,
} from 'lucide-react';

interface CartSummaryProps {
  cart: CartItem[];
  customer: Customer | null;
  billDiscount: BillDiscount;
  calculation: CalculationSummary;
  currencySymbol: string;
  onUpdateQuantity: (itemId: string, newQty: number) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateItemDiscount: (itemId: string, type: 'percent' | 'fixed', value: number) => void;
  onUpdateBillDiscount: (discount: BillDiscount) => void;
  onClearCart: () => void;
  onHoldCart: () => void;
  onProceedToPayment: () => void;
}

const AVATAR_COLORS = [
  'bg-blue-600 text-white',
  'bg-amber-600 text-white',
  'bg-emerald-600 text-white',
  'bg-purple-600 text-white',
  'bg-rose-600 text-white',
  'bg-indigo-600 text-white',
  'bg-cyan-600 text-white',
];

export const CartSummary: React.FC<CartSummaryProps> = ({
  cart,
  customer,
  billDiscount,
  calculation,
  currencySymbol,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateBillDiscount,
  onClearCart,
  onHoldCart,
  onProceedToPayment,
}) => {
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMethod>('upi');
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountVal, setDiscountVal] = useState(billDiscount.value || '');

  const totalItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleApplyDiscount = (val: number) => {
    onUpdateBillDiscount({
      type: 'percent',
      value: Math.min(100, Math.max(0, val)),
      reason: 'Special Discount',
    });
  };

  return (
    <div id="cart-summary-panel" className="space-y-4">
      {/* TOTAL AMOUNT Box Matching Reference UI Top Box */}
      <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-3">
        <div className="flex items-center justify-between">
          <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
            TOTAL AMOUNT
          </label>
          {cart.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onHoldCart}
                className="text-[10px] text-amber-400 hover:underline font-bold uppercase tracking-wider flex items-center gap-1"
              >
                <PauseCircle className="w-3 h-3" /> HOLD
              </button>
              <button
                type="button"
                onClick={onClearCart}
                className="text-[10px] text-slate-400 hover:text-rose-400 font-bold uppercase tracking-wider"
              >
                CLEAR
              </button>
            </div>
          )}
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
            {formatCurrency(calculation.grandTotal, currencySymbol)}
          </span>
          <span className="text-xs text-slate-400 font-mono font-medium">
            {totalItemCount} {totalItemCount === 1 ? 'unit' : 'units'} • {cart.length} {cart.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      {/* Cart Items Section matching Reference UI 'SPLIT DISTRIBUTION' section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
              CART ITEMS
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#152442] text-blue-400 text-[10px] font-bold font-mono">
              {cart.length} {cart.length === 1 ? 'ITEM' : 'ITEMS'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setShowDiscountInput(!showDiscountInput)}
              className="text-blue-400 hover:text-blue-300 font-mono"
            >
              {billDiscount.value > 0 ? `DISCOUNT: ${billDiscount.value}%` : '+ DISCOUNT'}
            </button>
          </div>
        </div>

        {/* Discount Inline Drawer */}
        {showDiscountInput && (
          <div className="mb-2 p-2.5 bg-[#0a101d] border border-[#1b2b48] rounded-xl flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">Discount %:</span>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="0"
              value={discountVal}
              onChange={(e) => {
                setDiscountVal(e.target.value);
                handleApplyDiscount(parseFloat(e.target.value) || 0);
              }}
              className="w-20 bg-[#121d36] border border-[#1e3054] rounded-lg px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowDiscountInput(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Done
            </button>
          </div>
        )}

        {/* Cart Item Cards matching Reference UI List items */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {cart.length > 0 ? (
            cart.map((item, idx) => {
              const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const initial = item.product.name.charAt(0).toUpperCase();

              return (
                <div
                  key={item.id}
                  className="bg-[#0b1325] border border-[#1a2b47] rounded-2xl p-3 flex items-center justify-between gap-2 transition-all shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Active check icon matching reference image */}
                    <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>

                    {/* Round colored avatar initial */}
                    <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center font-bold text-xs shrink-0 font-mono shadow-xs`}>
                      {initial}
                    </div>

                    {/* Title and price */}
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-slate-100 truncate">
                        {item.product.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {formatCurrency(item.unitPrice, currencySymbol)} × {item.quantity}
                      </p>
                    </div>
                  </div>

                  {/* Quantity Stepper & Price */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-[#101b33] border border-[#1b2b48] rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-[#18284a] text-xs transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-mono font-bold text-xs text-slate-100">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-[#18284a] text-xs transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="w-16 text-right font-bold text-xs text-slate-100 font-mono">
                      {formatCurrency(item.totalAmount, currencySymbol)}
                    </span>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs">
              <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-600 stroke-[1.5]" />
              <p className="font-semibold text-slate-400">Cart is empty</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Scan barcode or select items to start</p>
            </div>
          )}
        </div>
      </div>

      {/* WHO PAID? / PAYMENT MODE Selector Box matching Reference Image */}
      <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2">
        <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono mb-1">
          PAYMENT METHOD
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedPaymentMode('upi')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              selectedPaymentMode === 'upi'
                ? 'bg-[#15274d] text-blue-400 border border-blue-500/50'
                : 'bg-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>UPI QR</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPaymentMode('cash')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              selectedPaymentMode === 'cash'
                ? 'bg-[#15274d] text-blue-400 border border-blue-500/50'
                : 'bg-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Cash</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPaymentMode('whatsapp')}
            className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              selectedPaymentMode === 'whatsapp'
                ? 'bg-[#0f2d26] text-emerald-400 border border-emerald-500/50'
                : 'bg-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>WhatsApp</span>
          </button>
        </div>
      </div>

      {/* PRIMARY CTA BUTTON: Large Royal Blue Button matching Reference UI */}
      <button
        id="btn-proceed-to-payment"
        type="button"
        disabled={cart.length === 0}
        onClick={onProceedToPayment}
        className={`w-full py-3.5 px-4 rounded-2xl text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
          cart.length > 0
            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-[0.99] shadow-blue-900/40'
            : 'bg-[#121c33] text-slate-500 cursor-not-allowed border border-[#1b2b48]'
        }`}
      >
        <span>
          {cart.length > 0
            ? `PROCEED TO PAY ${formatCurrency(calculation.grandTotal, currencySymbol)}`
            : 'ADD ITEMS TO PAY'}
        </span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
