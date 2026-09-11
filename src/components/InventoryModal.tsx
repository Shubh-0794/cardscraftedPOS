import React, { useState } from 'react';
import { Product, StoreSettings } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import { generate24QrLabelsA4Pdf } from '../utils/qrPdfGenerator';
import { posAudio } from '../utils/audio';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  QrCode,
  FileDown,
  RefreshCw,
  Check,
} from 'lucide-react';
import { ProductFormModal } from './ProductFormModal';
import { ProductQrBadge } from './ProductQrBadge';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  currencySymbol: string;
  settings?: StoreSettings;
  onViewBarcode?: (barcode: string, name: string, price?: number, sku?: string, category?: string) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  products,
  onSaveProduct,
  onDeleteProduct,
  currencySymbol,
  settings,
  onViewBarcode,
}) => {
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isExportingLabels, setIsExportingLabels] = useState(false);
  const [labelsDownloaded, setLabelsDownloaded] = useState(false);

  if (!isOpen) return null;

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const handleDownload24QrSheet = async () => {
    setIsExportingLabels(true);
    try {
      const fallbackSettings: StoreSettings = settings || {
        storeName: 'Cardcrafted',
        tagline: 'Retail POS',
        gstin: '',
        address: 'Shop #14-16, Commercial Hub',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
        phone: '+91 98201 54321',
        email: 'billing@pos.com',
        upiId: 'store@upi',
        upiPayeeName: 'Cardcrafted POS',
        currencySymbol,
        currencyCode: 'INR',
        taxType: 'none',
        whatsappApiProvider: 'direct_wa_me',
        invoiceFooterNote: 'Thank you for shopping!',
        termsAndConditions: '',
        thermalPaperWidth: '80mm',
        enableBeepSound: true,
        autoOpenWhatsApp: true,
      };

      await generate24QrLabelsA4Pdf(products, fallbackSettings);
      setLabelsDownloaded(true);
      posAudio.playSuccessChime();
      setTimeout(() => setLabelsDownloaded(false), 3500);
    } catch (err) {
      console.error('Failed to generate 24 QR Label sheet PDF:', err);
      alert('Could not generate QR PDF.');
    } finally {
      setIsExportingLabels(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0a101d] border border-[#1b2b48] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#1b2b48] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <span>Inventory & QR Master</span>
              <span className="text-[10px] bg-blue-950 text-blue-400 px-2 py-0.5 rounded-full font-mono border border-blue-500/30">
                {products.length} Products
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Manage stock, pricing, SKUs, and export printable QR label sheets (up to 24 per A4 page)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload24QrSheet}
              disabled={isExportingLabels || products.length === 0}
              className="px-3 py-1.5 bg-[#142340] hover:bg-[#1a2e54] text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download printable A4 sheet with product QR labels (24 per page, no repeat)"
            >
              {labelsDownloaded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">PDF Ready!</span>
                </>
              ) : isExportingLabels ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Export QR Labels (A4 PDF)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setIsAddingNew(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md shadow-blue-900/30 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[#1b2b48] bg-[#070c17]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name, QR code, SKU, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0c1427] border border-[#1b2b48] text-slate-100 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Products List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="bg-[#0b1325] border border-[#1a2b47] rounded-2xl p-3 flex items-center justify-between gap-3 hover:border-blue-500/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl object-cover border border-[#1b2b48] shrink-0 bg-[#15233f] shadow-xs"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-[#13223f] border border-[#1b2b48] text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 font-mono shadow-xs">
                    {product.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-slate-100 truncate">{product.name}</h4>
                    <span className="text-[10px] font-mono text-slate-400 bg-[#121e38] px-1.5 py-0.5 rounded-md">
                      {product.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[11px] text-slate-400 font-mono mt-0.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        onViewBarcode?.(
                          product.barcode,
                          product.name,
                          product.unitPrice,
                          product.sku,
                          product.category
                        )
                      }
                      className="text-slate-300 font-mono hover:text-blue-400 hover:underline transition-colors cursor-pointer"
                      title="Click to view & download large QR Code"
                    >
                      QR: {product.barcode}
                    </button>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span>Stock: {product.stock}</span>
                      <ProductQrBadge
                        code={product.barcode}
                        size={15}
                        clickable={true}
                        onClick={() =>
                          onViewBarcode?.(
                            product.barcode,
                            product.name,
                            product.unitPrice,
                            product.sku,
                            product.category
                          )
                        }
                      />
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-xs font-mono text-blue-400 pr-1">
                  {formatCurrency(product.unitPrice, currencySymbol)}
                </span>

                {/* View Big QR Code Button */}
                <button
                  type="button"
                  onClick={() =>
                    onViewBarcode?.(
                      product.barcode,
                      product.name,
                      product.unitPrice,
                      product.sku,
                      product.category
                    )
                  }
                  className="p-1.5 text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/30 rounded-lg transition-colors cursor-pointer"
                  title="View Big QR Code & Download PNG"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingProduct(product);
                  }}
                  className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-[#152340] transition-colors cursor-pointer"
                  title="Edit Product"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteProduct(product.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-[#152340] transition-colors cursor-pointer"
                  title="Delete Product"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-xs">
              No products matching "{search}"
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[#1b2b48] bg-[#070c17] text-[11px] text-slate-400 flex items-center justify-between">
          <span>Click any QR badge to expand & download high-res PNG</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload24QrSheet}
              className="px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Download QR Labels (A4 PDF)</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#14223d] hover:bg-[#1c2e50] text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Product Form Modal (Add / Edit) */}
      {(isAddingNew || editingProduct) && (
        <ProductFormModal
          isOpen={true}
          product={editingProduct}
          onClose={() => {
            setIsAddingNew(false);
            setEditingProduct(null);
          }}
          onSaveProduct={(saved) => {
            onSaveProduct(saved);
            setIsAddingNew(false);
            setEditingProduct(null);
          }}
          currencySymbol={currencySymbol}
        />
      )}
    </div>
  );
};
