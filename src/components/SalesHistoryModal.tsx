import React, { useState, useMemo } from 'react';
import { Invoice, StoreSettings } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import { generateWhatsAppPayloads } from '../utils/whatsapp';
import {
  History,
  Search,
  FileText,
  Send,
  X,
  Calendar,
  CalendarDays,
  ArrowUpDown,
  TrendingUp,
  Receipt,
  Sparkles,
  ChevronDown,
  Clock,
  IndianRupee,
} from 'lucide-react';

export type TimeRangeFilter = 'today' | 'weekly' | 'monthly' | 'yearly' | 'all';
export type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

interface SalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  settings: StoreSettings;
  onSelectInvoice: (invoice: Invoice) => void;
}

export const SalesHistoryModal: React.FC<SalesHistoryModalProps> = ({
  isOpen,
  onClose,
  invoices,
  settings,
  onSelectInvoice,
}) => {
  const [search, setSearch] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('today');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [filterMethod, setFilterMethod] = useState<string>('all');

  // Compute Today's Daily Sale
  const todayMetrics = useMemo(() => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    const todayInvoices = invoices.filter((inv) => {
      const d = new Date(inv.timestamp);
      return (
        d.getFullYear() === todayYear &&
        d.getMonth() === todayMonth &&
        d.getDate() === todayDate
      );
    });

    const total = todayInvoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
    return {
      total,
      count: todayInvoices.length,
      avg: todayInvoices.length > 0 ? total / todayInvoices.length : 0,
    };
  }, [invoices]);

  // Filter and sort invoices
  const filteredAndSortedInvoices = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const oneYearAgo = now.getTime() - 365 * 24 * 60 * 60 * 1000;

    let list = invoices.filter((inv) => {
      const invTime = new Date(inv.timestamp).getTime();

      // 1. Time Range
      if (timeRange === 'today' && invTime < todayStart) return false;
      if (timeRange === 'weekly' && invTime < oneWeekAgo) return false;
      if (timeRange === 'monthly' && invTime < oneMonthAgo) return false;
      if (timeRange === 'yearly' && invTime < oneYearAgo) return false;

      // 2. Search Query
      const q = search.toLowerCase().trim();
      if (q) {
        const matchesInv = inv.invoiceNumber.toLowerCase().includes(q);
        const matchesName = (inv.customer.name || '').toLowerCase().includes(q);
        const matchesPhone = (inv.customer.phone || '').includes(q);
        const matchesItem = inv.items.some((item) =>
          item.product.name.toLowerCase().includes(q)
        );
        if (!matchesInv && !matchesName && !matchesPhone && !matchesItem) return false;
      }

      // 3. Payment Method
      if (filterMethod !== 'all' && inv.paymentMethod !== filterMethod) return false;

      return true;
    });

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      if (sortBy === 'date-asc') {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      }
      if (sortBy === 'amount-desc') {
        return b.grandTotal - a.grandTotal;
      }
      if (sortBy === 'amount-asc') {
        return a.grandTotal - b.grandTotal;
      }
      return 0;
    });

    return list;
  }, [invoices, timeRange, search, filterMethod, sortBy]);

  // Metrics for the currently filtered view
  const periodMetrics = useMemo(() => {
    const total = filteredAndSortedInvoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
    const count = filteredAndSortedInvoices.length;
    const avg = count > 0 ? total / count : 0;
    return { total, count, avg };
  }, [filteredAndSortedInvoices]);

  if (!isOpen) return null;

  const handleQuickSendWA = (invoice: Invoice) => {
    const payloads = generateWhatsAppPayloads(invoice, settings);
    window.open(payloads.waMeLink, '_blank', 'noopener,noreferrer');
  };

  const timeRangeLabels: Record<TimeRangeFilter, string> = {
    today: 'Today',
    weekly: 'Weekly (7D)',
    monthly: 'Monthly (30D)',
    yearly: 'Yearly (365D)',
    all: 'All Time',
  };

  return (
    <div
      id="modal-sales-history"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 animate-fadeIn"
    >
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#1b2b48] flex items-center justify-between bg-[#080e1b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <span>Sales Ledger &amp; History</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded-full border border-blue-400/30">
                  {invoices.length} Total Records
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Filter and sort sales by today, weekly, monthly, or yearly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-[#142340] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Summary Cards: Daily Sale & Filtered Period Sale */}
        <div className="p-3 bg-[#070c17] border-b border-[#1b2b48] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Daily Sale Card */}
          <div className="bg-linear-to-br from-blue-950/60 via-[#0c1933] to-[#070f22] border border-blue-500/40 rounded-2xl p-3 shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300 font-mono flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-blue-400" />
                TODAY'S DAILY SALE
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="text-lg font-black text-slate-100 font-mono">
                {formatCurrency(todayMetrics.total, settings.currencySymbol)}
              </div>
              <div className="text-[11px] font-mono text-blue-300 font-bold bg-blue-600/30 px-2 py-0.5 rounded-lg border border-blue-400/30">
                {todayMetrics.count} {todayMetrics.count === 1 ? 'Bill' : 'Bills'}
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
              Avg Ticket: {formatCurrency(todayMetrics.avg, settings.currencySymbol)}
            </div>
          </div>

          {/* Filtered Range Revenue Card */}
          <div className="bg-linear-to-br from-[#0c1b36] via-[#0b162c] to-[#060c1a] border border-[#1d3257] rounded-2xl p-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                {timeRangeLabels[timeRange].toUpperCase()} REVENUE
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {periodMetrics.count} {periodMetrics.count === 1 ? 'Bill' : 'Bills'}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="text-lg font-black text-emerald-400 font-mono">
                {formatCurrency(periodMetrics.total, settings.currencySymbol)}
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                Avg: {formatCurrency(periodMetrics.avg, settings.currencySymbol)}
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">
              Showing matching invoices for selected timeframe
            </div>
          </div>
        </div>

        {/* Time Filter & Sorting Controls */}
        <div className="p-3 bg-[#090f1c] border-b border-[#1b2b48] space-y-2.5">
          {/* Time Range Selector Buttons (Today / Weekly / Monthly / Yearly / All) */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
            <div className="flex items-center gap-1 bg-[#060b16] p-1 rounded-2xl border border-[#1b2b48] text-xs shrink-0 w-full sm:w-auto">
              {(['today', 'weekly', 'monthly', 'yearly', 'all'] as TimeRangeFilter[]).map((period) => {
                const isActive = timeRange === period;
                return (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setTimeRange(period)}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#111e38]'
                    }`}
                  >
                    {timeRangeLabels[period]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search, Sort Dropdown & Payment Mode Filter */}
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            {/* Search Input */}
            <div className="relative w-full sm:flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search bill #, customer, phone, item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0c1427] border border-[#1b2b48] text-slate-100 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort By Dropdown */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full sm:w-auto appearance-none bg-[#0c1427] border border-[#1b2b48] text-slate-200 rounded-xl pl-3 pr-8 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="date-desc">Newest First (Time ↓)</option>
                  <option value="date-asc">Oldest First (Time ↑)</option>
                  <option value="amount-desc">Highest Amount (₹ ↓)</option>
                  <option value="amount-asc">Lowest Amount (₹ ↑)</option>
                </select>
                <ArrowUpDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Payment Mode Pills */}
              <div className="flex gap-1 bg-[#060b16] p-0.5 rounded-xl border border-[#1b2b48] text-xs">
                {['all', 'upi', 'cash', 'whatsapp'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFilterMethod(mode)}
                    className={`px-2 py-1 rounded-lg uppercase text-[10px] font-bold transition-colors ${
                      filterMethod === mode
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode === 'whatsapp' ? 'WApp' : mode}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#080d19]">
          {filteredAndSortedInvoices.length > 0 ? (
            filteredAndSortedInvoices.map((inv) => {
              const invDate = new Date(inv.timestamp);
              const isToday =
                invDate.toDateString() === new Date().toDateString();

              return (
                <div
                  key={inv.id}
                  className="bg-[#0b1325] border border-[#1a2b47] hover:border-blue-500/50 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors group shadow-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs font-mono text-blue-400">
                        #{inv.invoiceNumber}
                      </span>
                      <span className="text-xs text-slate-200 font-semibold truncate">
                        {inv.customer.name || 'Walk-in Customer'}
                      </span>
                      {isToday && (
                        <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold rounded border border-emerald-500/30">
                          TODAY
                        </span>
                      )}
                      {inv.customer.phone && (
                        <span className="text-[11px] text-slate-500 font-mono">
                          ({inv.customer.phone})
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1 font-mono flex-wrap">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {invDate.toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year:
                            invDate.getFullYear() !== new Date().getFullYear()
                              ? 'numeric'
                              : undefined,
                        })}{' '}
                        {invDate.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>•</span>
                      <span className="uppercase font-bold px-1.5 py-0.2 bg-[#142340] rounded text-slate-300 text-[10px]">
                        {inv.paymentMethod}
                      </span>
                      <span>•</span>
                      <span>
                        {inv.items.length}{' '}
                        {inv.items.length === 1 ? 'item' : 'items'} (
                        {inv.items.reduce((acc, it) => acc + it.quantity, 0)} qty)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#15233e]">
                    <div className="text-left sm:text-right">
                      <span className="font-bold text-sm font-mono text-slate-100 block">
                        {formatCurrency(inv.grandTotal, settings.currencySymbol)}
                      </span>
                      {inv.taxBreakdown && inv.taxBreakdown.taxAmount > 0 && (
                        <span className="text-[10px] text-slate-500 font-mono block">
                          incl. {formatCurrency(inv.taxBreakdown.taxAmount, settings.currencySymbol)} tax
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuickSendWA(inv)}
                        className="p-2 rounded-xl bg-[#101d36] hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 border border-[#1b2b48] hover:border-emerald-500/30 transition-all cursor-pointer"
                        title="Send Receipt via WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectInvoice(inv);
                          onClose();
                        }}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-900/30 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" /> View Receipt
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">
              <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
              <p className="font-semibold text-slate-400">No sales invoices found for this timeframe</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Try selecting &quot;All Time&quot; or changing the search filter.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#1b2b48] bg-[#080e1b] flex items-center justify-between text-xs">
          <span className="text-slate-400 font-mono text-[11px]">
            Showing <strong className="text-slate-200">{filteredAndSortedInvoices.length}</strong> of {invoices.length} invoices
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#142340] hover:bg-[#1a2e54] text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
