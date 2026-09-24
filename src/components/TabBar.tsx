import React from 'react';
import { Plus, IndianRupee, Users, History, ClipboardList } from 'lucide-react';

export type ActiveTab = 'add' | 'total' | 'preorder' | 'people' | 'history';

interface TabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  cartItemCount: number;
  customerSelected: boolean;
  activePreOrdersCount?: number;
}

export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onTabChange,
  cartItemCount,
  customerSelected,
  activePreOrdersCount = 0,
}) => {
  const tabs = [
    { id: 'add' as ActiveTab, label: 'ADD', icon: Plus },
    { id: 'total' as ActiveTab, label: 'TOTAL', icon: IndianRupee, badge: cartItemCount },
    { id: 'preorder' as ActiveTab, label: 'PRE ORDER', icon: ClipboardList, badge: activePreOrdersCount },
    { id: 'people' as ActiveTab, label: 'PEOPLE', icon: Users, dot: customerSelected },
    { id: 'history' as ActiveTab, label: 'HISTORY', icon: History },
  ];

  return (
    <nav aria-label="Main POS Navigation" className="flex border-b border-[#1b2b48] bg-[#0c1427] px-1 sm:px-2 overflow-x-auto no-scrollbar touch-pan-x">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 min-h-[48px] py-2 sm:py-3 px-1.5 flex flex-col items-center justify-center gap-1 text-[10px] sm:text-[11px] font-bold tracking-wider transition-all relative whitespace-nowrap cursor-pointer select-none active:scale-95 ${
              isActive
                ? 'text-blue-400 font-extrabold bg-blue-950/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#121d36]/40'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400 stroke-[2.5]' : 'text-slate-400'}`} />
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-3.5 h-3.5 px-1 rounded-full bg-blue-600 text-white font-mono text-[9px] flex items-center justify-center font-bold shadow-xs">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
              {tab.dot && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0c1427]"></span>
              )}
            </div>
            <span className="leading-tight">{tab.label}</span>

            {/* Active underline indicator */}
            {isActive && (
              <div className="absolute bottom-0 left-1 right-1 h-[2.5px] bg-blue-500 rounded-t-full shadow-xs shadow-blue-500/50" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
