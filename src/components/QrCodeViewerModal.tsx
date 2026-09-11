import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Download,
  Printer,
  Copy,
  Check,
  QrCode,
  Tag,
  Sparkles,
  Layers,
} from 'lucide-react';
import QRCode from 'qrcode';
import { formatCurrency } from '../utils/taxCalculator';
import { posAudio } from '../utils/audio';

export interface QrCodeViewerData {
  barcode: string; // QR code payload / item code
  name?: string;
  price?: number;
  sku?: string;
  category?: string;
  storeName?: string;
}

interface QrCodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: QrCodeViewerData | null;
  currencySymbol?: string;
}

export const QrCodeViewerModal: React.FC<QrCodeViewerModalProps> = ({
  isOpen,
  onClose,
  data,
  currencySymbol = '₹',
}) => {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrBigUrl, setQrBigUrl] = useState<string>('');

  const rawCode = (data?.barcode || '000000000000').trim();

  useEffect(() => {
    if (isOpen && data) {
      posAudio.playScanBeep();
      QRCode.toDataURL(rawCode, {
        width: 600,
        margin: 1,
        color: {
          dark: '#0a0f1d',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      })
        .then((url) => setQrBigUrl(url))
        .catch(() => {});
    }
  }, [isOpen, rawCode, data]);

  if (!isOpen || !data) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    posAudio.playScanBeep();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadBigPNG = async () => {
    setIsGenerating(true);
    try {
      // High-resolution Canvas (1200 x 1200 px for ultra crisp 300DPI label/sticker printing)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = 1200;
      canvas.width = size;
      canvas.height = size;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      // Clean border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 12;
      ctx.strokeRect(30, 30, size - 60, size - 60);

      // Top Header: Store Brand
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 44px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      const storeTitle = data.storeName || 'Cardcrafted — Retail POS';
      ctx.fillText(storeTitle.toUpperCase(), size / 2, 110);

      // Product Name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 54px "Plus Jakarta Sans", sans-serif';
      const productName = data.name || 'Retail Product Item';
      ctx.fillText(productName, size / 2, 185);

      // Category & SKU
      if (data.category || data.sku) {
        ctx.fillStyle = '#64748b';
        ctx.font = '500 32px "JetBrains Mono", monospace';
        const sub = [data.category, data.sku ? `SKU: ${data.sku}` : ''].filter(Boolean).join(' • ');
        ctx.fillText(sub, size / 2, 235);
      }

      // Draw Big Crisp QR Code in the center
      const qrDataUrl = await QRCode.toDataURL(rawCode, {
        width: 680,
        margin: 1,
        color: {
          dark: '#080d1a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });

      const qrImg = new Image();
      await new Promise((resolve) => {
        qrImg.onload = resolve;
        qrImg.src = qrDataUrl;
      });

      const qrTop = 270;
      const qrBoxSize = 640;
      ctx.drawImage(qrImg, (size - qrBoxSize) / 2, qrTop, qrBoxSize, qrBoxSize);

      // Human-readable code below QR
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 42px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`CODE: ${rawCode}`, size / 2, qrTop + qrBoxSize + 60);

      // Price Banner at bottom
      if (typeof data.price === 'number') {
        ctx.fillStyle = '#2563eb';
        ctx.font = 'bold 56px "Plus Jakarta Sans", sans-serif';
        const priceStr = `PRICE: ${currencySymbol}${data.price.toFixed(2)}`;
        ctx.fillText(priceStr, size / 2, qrTop + qrBoxSize + 140);
      }

      // Download PNG
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      const safeName = (data.name || 'qr_code')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .slice(0, 25);
      link.download = `qrcode_${rawCode}_${safeName}_hd.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      posAudio.playSuccessChime();
    } catch (err) {
      console.error('Failed to export QR PNG:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintLabel = () => {
    window.print();
  };

  return (
    <div
      id="modal-barcode-viewer"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-[#0b1222] border border-[#1d2f52] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col my-auto transform transition-all animate-scaleUp">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1b2b48] flex items-center justify-between bg-[#080e1b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                <span>Product QR Code Viewer</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-950 text-blue-300 font-mono border border-blue-500/30">
                  HD 300DPI
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono truncate max-w-[240px]">
                {data.name || 'Product QR'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-[#15233e] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Big QR Display Card */}
        <div className="p-6 bg-[#070c17] space-y-4">
          {/* Printable Sticker Label Container */}
          <div
            id="printable-barcode-label"
            className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 text-slate-900 flex flex-col items-center justify-center space-y-3 relative overflow-hidden"
          >
            {/* Top Product Meta on Label */}
            <div className="text-center w-full">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 font-mono">
                {data.storeName || 'CARDCRAFTED • BY SHIVANI'}
              </div>
              <h2 className="text-base font-black text-slate-900 tracking-tight leading-tight mt-0.5">
                {data.name || 'Product QR Code'}
              </h2>
              {data.category && (
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{data.category}</p>
              )}
            </div>

            {/* High-Resolution Big QR Image */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-inner flex items-center justify-center">
              {qrBigUrl ? (
                <img
                  src={qrBigUrl}
                  alt={`Big QR ${rawCode}`}
                  className="w-52 h-52 object-contain rounded-lg"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center bg-slate-100 rounded-lg animate-pulse">
                  <QrCode className="w-12 h-12 text-slate-400" />
                </div>
              )}
            </div>

            {/* Human-Readable Code Number with Quick Copy */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black tracking-wider text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                {rawCode}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors shadow-2xs cursor-pointer"
                title="Copy QR code payload"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Price & SKU Footer */}
            <div className="w-full flex items-center justify-between pt-2 border-t border-slate-200 text-xs font-mono">
              <span className="text-slate-500 font-bold">
                {data.sku ? `SKU: ${data.sku}` : 'STD-QR'}
              </span>
              {typeof data.price === 'number' && (
                <span className="text-base font-black text-blue-700">
                  {formatCurrency(data.price, currencySymbol)}
                </span>
              )}
            </div>
          </div>

          {/* Quick Specs */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-blue-400" />
              Format: Standard 2D QR Matrix
            </span>
            <span>HD PNG: 1200 × 1200 px</span>
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="p-5 border-t border-[#1b2b48] bg-[#090f1c] space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            {/* Download Big PNG Button */}
            <button
              type="button"
              onClick={handleDownloadBigPNG}
              disabled={isGenerating}
              className="py-3 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Exporting...' : 'Download PNG (HD)'}</span>
            </button>

            {/* Print Sticker Label */}
            <button
              type="button"
              onClick={handlePrintLabel}
              className="py-3 px-4 bg-[#142340] hover:bg-[#1a2d52] active:scale-[0.99] text-slate-200 border border-[#233860] rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>Print Sticker</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs font-medium text-center transition-colors cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};

// Backwards compatibility alias
export const BarcodeViewerModal = QrCodeViewerModal;
export type BarcodeViewerData = QrCodeViewerData;
