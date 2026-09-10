import React from 'react';
import { HoldCart } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import { PauseCircle, Play, Trash2, X, ShoppingCart } from 'lucide-react';

interface HoldBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  holdCarts: HoldCart[];
  onResumeCart: (cartId: string) => void;
  onDeleteHoldCart: (cartId: string) => void;
  currencySymbol: string;
}

export const HoldBillsModal: React.FC<HoldBillsModalProps> = ({
  isOpen,
  onClose,
  holdCarts,
  onResumeCart,
  onDeleteHoldCart,
  currencySymbol,
}) => {
  if (!isOpen) return null;

  return (
    <div id="modal-hold-bills" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 border-b border-[#1b2b48] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm text-slate-100">Held / Parked Bills ({holdCarts.length})</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {holdCarts.length > 0 ? (
            holdCarts.map((cart) => (
              <div
                key={cart.id}
                id={`held-cart-${cart.id}`}
                className="bg-[#0b1325] border border-[#1a2b47] rounded-2xl p-3.5 flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="font-bold text-xs text-slate-100">{cart.name}</h4>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                    <span>{cart.itemCount} items</span>
                    <span>•</span>
                    <span>{new Date(cart.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs font-mono text-blue-400 mr-1">
                    {formatCurrency(cart.totalAmount, currencySymbol)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onResumeCart(cart.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-3 h-3" /> Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteHoldCart(cart.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition-colors"
                    title="Discard"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-xs font-medium text-slate-400">No bills currently on hold</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
