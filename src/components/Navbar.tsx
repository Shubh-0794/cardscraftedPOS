import React from 'react';
import { StoreSettings } from '../types/pos';
import {
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Settings,
  PauseCircle,
  Package,
  Database,
} from 'lucide-react';

interface NavbarProps {
  settings: StoreSettings;
  cashierName?: string;
  heldCartsCount: number;
  todaySalesCount: number;
  onOpenHoldBills: () => void;
  onOpenSalesHistory: () => void;
  onOpenInventory: () => void;
  onOpenSettings: () => void;
  onToggleSound: () => void;
  isSoundEnabled: boolean;
  isSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  heldCartsCount,
  onOpenHoldBills,
  onOpenInventory,
  onOpenSettings,
  onToggleSound,
  isSoundEnabled,
  isSyncing = false,
}) => {
  const rawStoreName = settings.storeName || 'Cardcrafted';
  const cleanStoreName = rawStoreName.replace(/by\s+shivani/gi, '').trim() || 'Cardcrafted';

  return (
    <header id="pos-header" className="px-5 pt-4 pb-2 flex flex-col gap-3">
      {/* Top row: Title + Green sync status + Controls */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex flex-col">
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-400 font-cursive tracking-wide leading-tight">
              {cleanStoreName}
            </h1>
            <span className="text-[11px] sm:text-xs text-blue-300/85 font-cursive tracking-wider">
              By Shivani
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 mt-1 hover:opacity-80 transition-opacity text-left"
            title="Supabase Database Connected - Click to manage"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-400 animate-spin' : 'bg-emerald-400 animate-pulse'}`}></span>
            <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase font-mono flex items-center gap-1">
              <span>SUPABASE CLOUD SYNC</span>
              {isSyncing && <span className="text-[9px] text-amber-300">(SYNCING...)</span>}
            </span>
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Sound / Theme toggles */}
          <button
            type="button"
            onClick={onToggleSound}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#131e38] transition-colors"
            title={isSoundEnabled ? 'Scan audio on' : 'Scan audio muted'}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Held Bills */}
          <button
            type="button"
            onClick={onOpenHoldBills}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
              heldCartsCount > 0
                ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#131e38]'
            }`}
            title="Held / Parked Bills"
          >
            <PauseCircle className="w-4 h-4" />
            {heldCartsCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center font-mono">
                {heldCartsCount}
              </span>
            )}
          </button>

          {/* Products inventory */}
          <button
            type="button"
            onClick={onOpenInventory}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#131e38] transition-colors"
            title="Manage Products"
          >
            <Package className="w-4 h-4" />
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#131e38] transition-colors"
            title="Store Settings & Database"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inset Sub-header input box matching reference UI */}
      <div className="w-full bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 py-2 flex items-center justify-between text-xs text-slate-300 font-medium">
        <span className="font-semibold text-slate-200">
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-slate-300">Terminal Ready</span>
        </span>
      </div>
    </header>
  );
};

