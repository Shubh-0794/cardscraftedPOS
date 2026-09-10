import React, { useState } from 'react';
import { Product } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Barcode,
  Sparkles,
} from 'lucide-react';
import { ProductFormModal } from './ProductFormModal';
import { ProductBarcodeBadge } from './ProductBarcodeBadge';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  currencySymbol: string;
  onViewBarcode?: (barcode: string, name: string, price?: number, sku?: string, category?: string) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  products,
  onSaveProduct,
  onDeleteProduct,
  currencySymbol,
  onViewBarcode,
}) => {
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0a101d] border border-[#1b2b48] rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#1b2b48] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <span>Inventory & Barcode Master</span>
              <span className="text-[10px] bg-blue-950 text-blue-400 px-2 py-0.5 rounded-full font-mono border border-blue-500/30">
                {products.length} Products
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Manage stock, prices, SKUs, and view or export high-resolution barcodes
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
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
              placeholder="Search product name, barcode, SKU, category..."
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
                    title="Click to view & download large barcode"
                  >
                    BC: {product.barcode}
                  </button>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span>Stock: {product.stock}</span>
                    <ProductBarcodeBadge
                      code={product.barcode}
                      width={42}
                      height={13}
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

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-xs font-mono text-blue-400 pr-1">
                  {formatCurrency(product.unitPrice, currencySymbol)}
                </span>

                {/* View Big Barcode Button */}
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
                  title="View Big Barcode & Download PNG"
                >
                  <Barcode className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingProduct(product);
                  }}
                  className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-[#152340] transition-colors"
                  title="Edit Product"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteProduct(product.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-[#152340] transition-colors"
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
          <span>Click any barcode badge to expand & download high-res PNG</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#14223d] hover:bg-[#1c2e50] text-slate-300 rounded-xl font-bold transition-colors"
          >
            Close
          </button>
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
