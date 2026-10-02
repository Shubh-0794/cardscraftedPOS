import React from 'react';
import { StoreSettings } from '../types/pos';
import {
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
  PauseCircle,
  Package,
} from 'lucide-react';

interface NavbarProps {
  settings: StoreSettings;
  cashierName?: string;
  heldCartsCount: number;
  todaySalesCount: number;
  onOpenHoldBills: () => void;
  onOpenSalesHistory: () => void;
  onOpenInventory?: () => void;
  onOpenSettings: () => void;
  onToggleSound: () => void;
  isSoundEnabled: boolean;
  isSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  heldCartsCount,
  onOpenHoldBills,
  onOpenSettings,
  onToggleSound,
  isSoundEnabled,
  isSyncing = false,
}) => {
  const rawStoreName = settings.storeName || 'Cards Crafted';
  const cleanStoreName = rawStoreName.replace(/by\s+shivani/gi, '').trim() || 'Cards Crafted';

  return (
    <header id="pos-header" className="px-4 sm:px-5 pt-3.5 pb-2.5 flex flex-col gap-2 shrink-0 select-none bg-[#0a1224] border-b border-[#1b2b48]/80 paper-sheet-2">
      {/* Top row: Brand Title matching sketch + Setting Button */}
      <div className="flex items-center justify-between gap-2">
        {/* Brand Lockup: Cards Crafted By Shivani */}
        <div className="min-w-0">
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 font-cursive tracking-wide leading-tight truncate flex items-center gap-1.5 drop-shadow-sm">
              <span>{cleanStoreName}</span>
              <span className="text-blue-400 text-sm font-sans font-semibold animate-pulse">✨</span>
            </h1>
            <span className="text-[11px] sm:text-xs text-blue-300/90 font-cursive tracking-wider font-semibold">
              By Shivani
            </span>
          </div>
        </div>

        {/* Right side controls: Settings button (* Setting Button) + Auxiliary tools */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Sound toggle */}
          <button
            type="button"
            onClick={onToggleSound}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#131e38] transition-all cursor-pointer active:scale-95 paper-card"
            title={isSoundEnabled ? 'Scan audio on' : 'Scan audio muted'}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Held Bills if any */}
          {heldCartsCount > 0 && (
            <button
              type="button"
              onClick={onOpenHoldBills}
              className="p-2 rounded-xl text-xs font-semibold flex items-center gap-1 text-amber-400 bg-amber-500/15 border border-amber-500/30 transition-all cursor-pointer active:scale-95 paper-card shadow-amber-950/30"
              title="Parked Bills"
            >
              <PauseCircle className="w-4 h-4" />
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center font-mono">
                {heldCartsCount}
              </span>
            </button>
          )}

          {/* Primary Setting Button with star glow matching sketch */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2.5 rounded-2xl bg-[#142343] hover:bg-blue-600 text-blue-300 hover:text-white border border-[#233d6d] hover:border-blue-400 transition-all cursor-pointer flex items-center justify-center group paper-card active:scale-95"
            title="Settings & Cloud Database"
          >
            <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
          </button>
        </div>
      </div>

      {/* Cloud Status Sub-bar: Recessed Paper Strip */}
      <div className="w-full bg-[#060b17] border border-[#16233a] rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-slate-300 font-medium paper-recessed">
        <span className="font-semibold text-slate-300 text-[10.5px] sm:text-[11px] font-mono">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={onOpenSettings}
          className="text-slate-400 text-[10px] font-medium flex items-center gap-1.5 hover:text-emerald-300 transition-colors cursor-pointer"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-400 animate-spin' : 'bg-emerald-400 animate-pulse'}`}></span>
          <span className="text-emerald-400 font-bold font-mono tracking-wider">
            {isSyncing ? 'SYNCING...' : 'LIVE CLOUD POS'}
          </span>
        </button>
      </div>
    </header>
  );
};
