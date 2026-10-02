import React from 'react';
import { Home, Package, Plus, ArrowRight, Users, ReceiptText, Sparkles } from 'lucide-react';

export type ActiveTab = 'home' | 'products' | 'add' | 'total' | 'preorder' | 'people' | 'history';

interface TabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  cartItemCount: number;
  customerSelected: boolean;
  activePreOrdersCount?: number;
  onQuickNewSale?: () => void;
  onOpenInventory?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onTabChange,
  cartItemCount,
  customerSelected,
  activePreOrdersCount = 0,
  onQuickNewSale,
}) => {
  return (
    <div className="sticky bottom-0 z-40 shrink-0 select-none w-full">
      {/* Layered Papercut Dock Container */}
      <nav
        aria-label="Main Bottom Navigation"
        className="relative bg-[#081020]/95 backdrop-blur-md border-t border-[#1e3052] px-2 py-1.5 flex items-center justify-around paper-sheet-1 shadow-2xl"
      >
        {/* Tab 1: Home */}
        <button
          type="button"
          onClick={() => onTabChange('home')}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center min-h-[44px] transition-all cursor-pointer ${
            activeTab === 'home'
              ? 'text-blue-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all paper-card ${activeTab === 'home' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-blue-900/30' : 'hover:bg-slate-800/40'}`}>
            <Home className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5]' : ''}`} />
          </div>
          <span className="text-[10px] font-mono tracking-tight mt-0.5 font-medium">Home</span>
        </button>

        {/* Tab 2: Products (Manage & Inventory Products) */}
        <button
          type="button"
          onClick={() => onTabChange('products')}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center min-h-[44px] transition-all relative cursor-pointer ${
            activeTab === 'products'
              ? 'text-blue-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all relative paper-card ${activeTab === 'products' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-blue-900/30' : 'hover:bg-slate-800/40'}`}>
            <Package className={`w-5 h-5 ${activeTab === 'products' ? 'stroke-[2.5]' : ''}`} />
          </div>
          <span className="text-[10px] font-mono tracking-tight mt-0.5 font-medium">Products</span>
        </button>

        {/* Center Floating Action Button (Paper Seal Circle) - Changes to Arrow when product added */}
        <div className="relative -top-4 flex flex-col items-center px-2">
          <button
            type="button"
            onClick={() => {
              if (cartItemCount > 0) {
                onTabChange('total');
              } else if (onQuickNewSale) {
                onQuickNewSale();
              } else {
                onTabChange('add');
              }
            }}
            className={`w-13 h-13 rounded-full flex items-center justify-center paper-seal transition-all cursor-pointer group active:scale-95 ${
              cartItemCount > 0
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-950/60'
                : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-950/60'
            }`}
            title={cartItemCount > 0 ? `Checkout (${cartItemCount} items) - Proceed to Total` : 'New Sale / Quick Billing'}
          >
            {cartItemCount > 0 ? (
              <ArrowRight className="w-6 h-6 stroke-[3] group-hover:translate-x-1 transition-transform duration-200" />
            ) : (
              <Plus className="w-6 h-6 stroke-[3] group-hover:rotate-90 transition-transform duration-200" />
            )}

            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-amber-400 text-slate-950 font-mono text-[9.5px] font-black flex items-center justify-center ring-2 ring-[#091122] shadow-md animate-bounce">
                {cartItemCount}
              </span>
            )}
          </button>
          <span
            className={`text-[9px] font-mono font-bold tracking-tight mt-0.5 ${
              cartItemCount > 0 ? 'text-emerald-300' : 'text-blue-300'
            }`}
          >
            {cartItemCount > 0 ? 'Checkout' : 'New Bill'}
          </span>
        </div>

        {/* Tab 3: Customer */}
        <button
          type="button"
          onClick={() => onTabChange('people')}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center min-h-[44px] transition-all relative cursor-pointer ${
            activeTab === 'people'
              ? 'text-blue-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all relative paper-card ${activeTab === 'people' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-blue-900/30' : 'hover:bg-slate-800/40'}`}>
            <Users className={`w-5 h-5 ${activeTab === 'people' ? 'stroke-[2.5]' : ''}`} />
            {customerSelected && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#091122] shadow-xs"></span>
            )}
          </div>
          <span className="text-[10px] font-mono tracking-tight mt-0.5 font-medium">Customer</span>
        </button>

        {/* Tab 4: Sale History */}
        <button
          type="button"
          onClick={() => onTabChange('history')}
          className={`flex-1 py-1.5 flex flex-col items-center justify-center min-h-[44px] transition-all relative cursor-pointer ${
            activeTab === 'history'
              ? 'text-blue-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-all relative paper-card ${activeTab === 'history' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-blue-900/30' : 'hover:bg-slate-800/40'}`}>
            <ReceiptText className={`w-5 h-5 ${activeTab === 'history' ? 'stroke-[2.5]' : ''}`} />
            {activePreOrdersCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-3.5 h-3.5 px-1 rounded-full bg-amber-500 text-slate-950 font-mono text-[9px] flex items-center justify-center font-black shadow-xs">
                {activePreOrdersCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono tracking-tight mt-0.5 font-medium">Sale History</span>
        </button>
      </nav>
    </div>
  );
};
