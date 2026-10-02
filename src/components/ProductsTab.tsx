import React, { useState, useMemo } from 'react';
import { Product, StoreSettings } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import { generate24QrLabelsA4Pdf } from '../utils/qrPdfGenerator';
import { posAudio } from '../utils/audio';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  QrCode,
  FileDown,
  RefreshCw,
  Check,
  Package,
  Layers,
  AlertTriangle,
  Minus,
  CheckCircle2,
  X,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { ProductFormModal } from './ProductFormModal';
import { ProductQrBadge } from './ProductQrBadge';

interface ProductsTabProps {
  products: Product[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  currencySymbol: string;
  settings: StoreSettings;
  onViewBarcode?: (barcode: string, name: string, price?: number, sku?: string, category?: string) => void;
  onQuickNewSale?: () => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  products,
  onSaveProduct,
  onDeleteProduct,
  currencySymbol,
  settings,
  onViewBarcode,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isExportingLabels, setIsExportingLabels] = useState(false);
  const [labelsDownloaded, setLabelsDownloaded] = useState(false);

  // Extract unique categories
  const categories: string[] = ['All', ...Array.from(new Set(products.map((p) => p.category))).map(String)];

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q);

      let matchesStock = true;
      if (stockFilter === 'in_stock') matchesStock = p.stock > 5;
      else if (stockFilter === 'low_stock') matchesStock = p.stock > 0 && p.stock <= 5;
      else if (stockFilter === 'out_of_stock') matchesStock = p.stock <= 0;

      return matchesCategory && matchesSearch && matchesStock;
    });
  }, [products, search, selectedCategory, stockFilter]);

  // Stock counts summary
  const outOfStockCount = useMemo(() => products.filter((p) => p.stock <= 0).length, [products]);
  const lowStockCount = useMemo(() => products.filter((p) => p.stock > 0 && p.stock <= 5).length, [products]);

  // Quick Stock Adjustment (+1 / -1)
  const handleQuickStockChange = (product: Product, delta: number) => {
    const newStock = Math.max(0, (product.stock || 0) + delta);
    if (newStock === product.stock) return;
    const updated = { ...product, stock: newStock };
    onSaveProduct(updated);
    posAudio.playScanBeep();
  };

  const handleDownload24QrSheet = async () => {
    setIsExportingLabels(true);
    try {
      await generate24QrLabelsA4Pdf(products, settings);
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
    <div className="space-y-3.5 pb-4 animate-in fade-in duration-200">
      {/* Mobile Top Header: Title & Action Bar */}
      <div className="bg-[#091224] border border-[#1d3154] rounded-2xl p-3.5 paper-sheet-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 paper-card">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-slate-100 tracking-tight flex items-center gap-2">
                <span>Products &amp; Inventory</span>
                <span className="text-[11px] bg-blue-950 text-blue-300 font-mono px-2 py-0.5 rounded-full border border-blue-500/40 shadow-xs">
                  {products.length} Items
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Manage stock, edit prices, view QRs &amp; export labels
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto pt-1 sm:pt-0">
            {/* Download A4 PDF Labels */}
            <button
              type="button"
              onClick={handleDownload24QrSheet}
              disabled={isExportingLabels || products.length === 0}
              className="flex-1 sm:flex-initial py-2.5 px-3 bg-[#13223f] hover:bg-[#1a2e54] text-blue-300 hover:text-white border border-blue-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer paper-card active:scale-95 disabled:opacity-50"
              title="Download 24 QR Labels per A4 Sheet"
            >
              {labelsDownloaded ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">PDF Ready!</span>
                </>
              ) : isExportingLabels ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 text-blue-400" />
                  <span className="hidden sm:inline">Export QR Sheet (PDF)</span>
                  <span className="sm:hidden">QR PDF</span>
                </>
              )}
            </button>

            {/* + Add New Product Button */}
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setIsAddingNew(true);
              }}
              className="flex-1 sm:flex-initial py-2.5 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer paper-btn-primary"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Product</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative bg-[#060c18] border border-[#182a4a] rounded-2xl px-3.5 py-2.5 focus-within:border-blue-500 transition-all paper-recessed">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by product name, SKU, QR number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-slate-100 text-xs sm:text-sm placeholder:text-slate-500 focus:outline-none font-mono"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs: Category Pills + Quick Stock Filters */}
      <div className="space-y-2">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer paper-card ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white border border-blue-400/50 shadow-blue-900/40'
                  : 'bg-[#091224] border border-[#1b2f52] text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Quick Stock Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setStockFilter('all')}
            className={`px-2.5 py-1 rounded-xl border transition-all cursor-pointer paper-card ${
              stockFilter === 'all'
                ? 'bg-[#142340] border-blue-500/50 text-blue-300 font-bold'
                : 'bg-[#091224] border-[#1b2f52] text-slate-400 hover:text-slate-200'
            }`}
          >
            All Stock ({products.length})
          </button>

          <button
            type="button"
            onClick={() => setStockFilter('in_stock')}
            className={`px-2.5 py-1 rounded-xl border transition-all cursor-pointer paper-card ${
              stockFilter === 'in_stock'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 font-bold'
                : 'bg-[#091224] border-[#1b2f52] text-slate-400 hover:text-slate-200'
            }`}
          >
            In Stock ({products.filter((p) => p.stock > 5).length})
          </button>

          {lowStockCount > 0 && (
            <button
              type="button"
              onClick={() => setStockFilter('low_stock')}
              className={`px-2.5 py-1 rounded-xl border transition-all cursor-pointer paper-card ${
                stockFilter === 'low_stock'
                  ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 font-bold'
                  : 'bg-[#091224] border-[#1b2f52] text-amber-400/80 hover:text-amber-300'
              }`}
            >
              Low Stock ({lowStockCount})
            </button>
          )}

          {outOfStockCount > 0 && (
            <button
              type="button"
              onClick={() => setStockFilter('out_of_stock')}
              className={`px-2.5 py-1 rounded-xl border transition-all cursor-pointer paper-card ${
                stockFilter === 'out_of_stock'
                  ? 'bg-rose-950/70 border-rose-500/50 text-rose-300 font-bold'
                  : 'bg-[#091224] border-[#1b2f52] text-rose-400/80 hover:text-rose-300'
              }`}
            >
              Out of Stock ({outOfStockCount})
            </button>
          )}
        </div>
      </div>

      {/* Products List (Mobile friendly Card Layout) */}
      <div className="space-y-2.5">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => {
            const isOutOfStock = product.stock <= 0;
            const isLowStock = product.stock > 0 && product.stock <= 5;

            return (
              <div
                key={product.id}
                className={`bg-[#0b1428] border rounded-2xl p-3 sm:p-3.5 transition-all space-y-2.5 paper-card ${
                  isOutOfStock
                    ? 'border-rose-950/60 bg-[#0c101c]'
                    : isLowStock
                    ? 'border-amber-500/40'
                    : 'border-[#1b2e50] hover:border-blue-500/50'
                }`}
              >
                {/* Main Product Info Row */}
                <div className="flex items-start justify-between gap-2.5">
                  {/* Image & Title */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl object-cover border border-[#1e2f4f] bg-[#14203a] shadow-xs"
                        />
                      ) : (
                        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center justify-center font-bold text-base font-mono shadow-xs">
                          {product.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                          {product.name}
                        </h3>
                        <span className="text-[10px] font-mono text-slate-400 bg-[#121e38] px-1.5 py-0.2 rounded-md">
                          {product.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mt-1 flex-wrap">
                        <span className="text-slate-300 font-bold">
                          SKU: {product.sku || 'N/A'}
                        </span>
                        <span>•</span>
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
                          className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 cursor-pointer"
                          title="Click to view QR code"
                        >
                          <QrCode className="w-3 h-3" />
                          <span>QR: {product.barcode}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Price Block */}
                  <div className="text-right shrink-0">
                    <div className="font-extrabold text-sm sm:text-base text-blue-400 font-mono">
                      {formatCurrency(product.unitPrice, currencySymbol)}
                    </div>
                    {product.mrp && product.mrp > product.unitPrice && (
                      <div className="text-[10px] font-mono text-slate-500 line-through">
                        {formatCurrency(product.mrp, currencySymbol)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Stock Stepper & Edit/Delete Action Buttons */}
                <div className="pt-2 border-t border-[#16243f] flex items-center justify-between gap-2 flex-wrap">
                  {/* Stock Stepper */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-[#070e1c] border border-[#1b2b48] rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={() => handleQuickStockChange(product, -1)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-[#14203a] rounded-lg transition-colors cursor-pointer"
                        title="Decrease Stock by 1"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <div className="px-2.5 text-center">
                        <span
                          className={`font-mono text-xs font-black ${
                            isOutOfStock
                              ? 'text-rose-400'
                              : isLowStock
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {product.stock}
                        </span>
                        <span className="text-[9px] text-slate-500 ml-1 font-mono">in stock</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickStockChange(product, 1)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-[#14203a] rounded-lg transition-colors cursor-pointer"
                        title="Increase Stock by 1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {isOutOfStock ? (
                      <span className="text-[9.5px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-800/60 px-2 py-0.5 rounded-lg">
                        OUT OF STOCK
                      </span>
                    ) : isLowStock ? (
                      <span className="text-[9.5px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-lg">
                        LOW STOCK
                      </span>
                    ) : null}
                  </div>

                  {/* Actions: View QR, Edit, Delete */}
                  <div className="flex items-center gap-1.5">
                    {/* View QR Code Button */}
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
                      className="p-2 text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/30 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                      title="View & Download QR Code"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline font-mono text-[11px]">QR Code</span>
                    </button>

                    {/* Edit Product */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNew(false);
                        setEditingProduct(product);
                      }}
                      className="p-2 text-slate-300 hover:text-white bg-[#121f3a] hover:bg-blue-600 rounded-xl border border-[#1b2b48] transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                      title="Edit Product Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>

                    {/* Delete Product */}
                    <button
                      type="button"
                      onClick={() => setProductToDelete(product)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl border border-transparent hover:border-rose-800/40 transition-colors cursor-pointer"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 px-4 text-center bg-[#070d1a] border border-[#142038] border-dashed rounded-3xl space-y-3">
            <Package className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-slate-300">No products found</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                No items match your search &quot;{search}&quot; or filter criteria.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedCategory('All');
                setStockFilter('all');
                setIsAddingNew(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-900/40"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add New Product</span>
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0c1427] border border-rose-500/40 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-100">Delete Product</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">&quot;{productToDelete.name}&quot;</strong>? This action will permanently remove it from your inventory and cloud database.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2.5 bg-[#14203a] hover:bg-[#1b2b4c] text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProduct(productToDelete.id);
                  setProductToDelete(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-rose-900/40"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
