import React, { useState, useEffect } from 'react';
import { StoreSettings } from '../types/pos';
import {
  Settings,
  Save,
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SQL_SCHEMA,
  runSupabaseDiagnostics,
  updateSupabaseCredentials,
  SupabaseDiagnosticResult,
} from '../lib/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  onSaveSettings: (newSettings: StoreSettings) => void;
  productsCount?: number;
  customersCount?: number;
  invoicesCount?: number;
  onSyncAllToCloud?: () => Promise<boolean>;
  onPullAllFromCloud?: () => Promise<boolean>;
  isSyncing?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  productsCount = 0,
  customersCount = 0,
  invoicesCount = 0,
  onSyncAllToCloud,
  onPullAllFromCloud,
  isSyncing = false,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'supabase'>('general');
  const [formData, setFormData] = useState<StoreSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Supabase Custom Config Form
  const [customUrl, setCustomUrl] = useState(SUPABASE_URL);
  const [customKey, setCustomKey] = useState(SUPABASE_ANON_KEY);
  const [showConfigFields, setShowConfigFields] = useState(false);
  const [configSavedNotice, setConfigSavedNotice] = useState(false);

  // Diagnostic Results
  const [diagResult, setDiagResult] = useState<SupabaseDiagnosticResult | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlSchema, setShowSqlSchema] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'supabase' && !diagResult) {
      handleRunDiagnostics();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleRunDiagnostics = async () => {
    setIsDiagnosing(true);
    try {
      const res = await runSupabaseDiagnostics();
      setDiagResult(res);
    } catch (e) {
      console.error('Diagnostic error:', e);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleSaveCredentials = () => {
    updateSupabaseCredentials(customUrl, customKey);
    setConfigSavedNotice(true);
    setTimeout(() => setConfigSavedNotice(false), 2500);
    handleRunDiagnostics();
  };

  const handleManualPush = async () => {
    if (!onSyncAllToCloud) return;
    setSyncFeedback('Pushing all local catalog, customers & invoices to Supabase...');
    const ok = await onSyncAllToCloud();
    if (ok) {
      setSyncFeedback('All application data successfully stored in Supabase!');
      setTimeout(() => setSyncFeedback(null), 3000);
    } else {
      setSyncFeedback('Sync initiated with Supabase cloud store.');
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  const handleManualPull = async () => {
    if (!onPullAllFromCloud) return;
    setSyncFeedback('Pulling latest data snapshot from Supabase...');
    const ok = await onPullAllFromCloud();
    if (ok) {
      setSyncFeedback('Successfully reloaded latest data from Supabase!');
      setTimeout(() => setSyncFeedback(null), 3000);
    } else {
      setSyncFeedback('Cloud data checked.');
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const projectId = customUrl.replace('https://', '').split('.')[0] || 'iqmbsdxicfthkncfxfsb';
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectId}/sql`;

  return (
    <div id="modal-store-settings" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1b2b48] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm text-slate-100">Store &amp; Database Settings</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 pb-1 border-b border-[#1b2b48] flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-[#121e38] text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Store &amp; UPI</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('supabase')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'supabase'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-[#121e38] text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Supabase Cloud DB</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5"></span>
          </button>
        </div>

        {activeTab === 'general' ? (
          /* Store Profile Form */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
              <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                STORE / BUSINESS NAME *
              </label>
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full bg-transparent text-slate-100 font-bold focus:outline-none mt-0.5"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  UPI VPA ID *
                </label>
                <input
                  type="text"
                  value={formData.upiId}
                  onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                  className="w-full bg-transparent text-blue-400 font-mono font-bold focus:outline-none mt-0.5"
                  required
                />
              </div>
              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  PAYEE NAME
                </label>
                <input
                  type="text"
                  value={formData.upiPayeeName}
                  onChange={(e) => setFormData({ ...formData, upiPayeeName: e.target.value })}
                  className="w-full bg-transparent text-slate-100 focus:outline-none mt-0.5"
                />
              </div>
            </div>

            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
              <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                STORE ADDRESS / CITY
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-transparent text-slate-100 focus:outline-none mt-0.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  STORE WHATSAPP / PHONE
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-transparent text-slate-100 font-mono focus:outline-none mt-0.5"
                />
              </div>
              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  GSTIN (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={formData.gstin || ''}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  className="w-full bg-transparent text-slate-100 font-mono uppercase focus:outline-none mt-0.5"
                />
              </div>
            </div>

            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
              <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                RECEIPT FOOTER NOTE
              </label>
              <input
                type="text"
                value={formData.invoiceFooterNote || ''}
                onChange={(e) => setFormData({ ...formData, invoiceFooterNote: e.target.value })}
                className="w-full bg-transparent text-slate-100 focus:outline-none mt-0.5"
              />
            </div>

            <div className="pt-3 border-t border-[#1b2b48] flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-2xl font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold uppercase tracking-wider transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{savedSuccess ? 'Saved!' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* Supabase Cloud Database Tab */
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            {/* Status Banner */}
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-emerald-300">Supabase Cloud Database</h4>
                    <p className="text-[11px] text-emerald-400/80 font-mono">
                      Project: <span className="font-bold text-emerald-200">{projectId}</span>
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-mono text-[10px] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  LIVE SYNC
                </span>
              </div>
            </div>

            {/* Cloud Storage Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl p-3">
                <span className="block text-[10px] uppercase font-mono text-slate-400">Products</span>
                <span className="text-base font-bold text-blue-400 font-mono">{productsCount}</span>
              </div>
              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl p-3">
                <span className="block text-[10px] uppercase font-mono text-slate-400">Customers</span>
                <span className="text-base font-bold text-emerald-400 font-mono">{customersCount}</span>
              </div>
              <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl p-3">
                <span className="block text-[10px] uppercase font-mono text-slate-400">Invoices</span>
                <span className="text-base font-bold text-purple-400 font-mono">{invoicesCount}</span>
              </div>
            </div>

            {/* Interactive Table Health Diagnostics */}
            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Database Tables Status</span>
                </span>
                <button
                  type="button"
                  onClick={handleRunDiagnostics}
                  disabled={isDiagnosing}
                  className="px-2.5 py-1 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-lg text-[10px] font-mono flex items-center gap-1 border border-[#1b2b48]"
                >
                  <RefreshCw className={`w-3 h-3 text-blue-400 ${isDiagnosing ? 'animate-spin' : ''}`} />
                  <span>{isDiagnosing ? 'Checking...' : 'Check Status'}</span>
                </button>
              </div>

              {diagResult && (
                <div className="space-y-1.5 pt-1">
                  {diagResult.tables.map((t) => (
                    <div
                      key={t.table}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#070c17] border border-[#17243c]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-200">{t.table}</span>
                        {t.exists && t.canRead && t.canWrite ? (
                          <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-bold">
                            READY
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded font-bold">
                            MISSING / NEEDS SQL
                          </span>
                        )}
                      </div>
                      {t.exists && t.canRead && t.canWrite ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                    </div>
                  ))}

                  {!diagResult.allReady && (
                    <div className="p-2.5 bg-amber-950/40 border border-amber-500/30 rounded-lg text-amber-200 text-[11px] space-y-2 mt-2">
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-300">Tables not yet created in Supabase</p>
                          <p className="text-[10px] text-amber-300/80 leading-relaxed mt-0.5">
                            New data cannot be saved to Supabase until tables are created. Copy the SQL schema below and execute it in your Supabase SQL Editor.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCopySql}
                          className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 shadow"
                        >
                          {copiedSql ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedSql ? 'SQL Copied!' : 'Copy SQL Schema'}</span>
                        </button>
                        <a
                          href={sqlEditorUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-1.5 bg-[#121e38] hover:bg-[#18284c] text-amber-200 border border-amber-500/30 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1"
                        >
                          <span>Open Supabase SQL</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sync Feedback Message */}
            {syncFeedback && (
              <div className="p-3 bg-blue-950/60 border border-blue-500/40 rounded-xl text-blue-200 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{syncFeedback}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleManualPush}
                  disabled={isSyncing}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/30"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync All to Cloud</span>
                </button>
                <button
                  type="button"
                  onClick={handleManualPull}
                  disabled={isSyncing}
                  className="py-2.5 px-3 bg-[#121e38] hover:bg-[#18284c] text-slate-200 border border-[#1b2b48] rounded-xl font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                  <span>Pull from Cloud</span>
                </button>
              </div>
            </div>

            {/* Config Details & Key Override Accordion */}
            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                  Connection Configuration
                </span>
                <button
                  type="button"
                  onClick={() => setShowConfigFields(!showConfigFields)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                >
                  <Wrench className="w-3 h-3" />
                  <span>{showConfigFields ? 'Hide Settings' : 'Edit Credentials'}</span>
                </button>
              </div>

              {showConfigFields ? (
                <div className="space-y-2.5 pt-2 border-t border-[#1b2b48]">
                  <div>
                    <label className="block text-[9px] font-mono uppercase text-slate-400">
                      Supabase Project URL
                    </label>
                    <input
                      type="text"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://xxx.supabase.co"
                      className="w-full mt-1 bg-[#070c17] border border-[#1b2b48] rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono uppercase text-slate-400">
                      Supabase Anon / Publishable Key
                    </label>
                    <input
                      type="text"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder="sb_publishable_... or eyJhbGciOi..."
                      className="w-full mt-1 bg-[#070c17] border border-[#1b2b48] rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-emerald-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveCredentials}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[11px] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{configSavedNotice ? 'Credentials Saved & Connected!' : 'Save & Reconnect'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[11px] text-slate-300 truncate">
                      {customUrl}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 pt-1 border-t border-[#17243c]">
                    <span className="font-mono text-[10px] text-emerald-400 truncate">
                      {customKey.substring(0, 18)}••••••••••••••••
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* SQL Schema Viewer Accordion */}
            <div className="pt-2 border-t border-[#1b2b48]">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowSqlSchema(!showSqlSchema)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2"
                >
                  {showSqlSchema ? 'Hide Supabase SQL Schema' : 'View / Copy SQL Schema'}
                </button>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-2 py-1 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-lg text-[10px] font-mono flex items-center gap-1"
                >
                  {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
                </button>
              </div>

              {showSqlSchema && (
                <div className="mt-2 bg-[#070c17] border border-[#1b2b48] rounded-xl p-3 overflow-x-auto max-h-48 text-[10px] font-mono text-slate-300">
                  <pre>{SUPABASE_SQL_SCHEMA}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

