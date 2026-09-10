import React, { useState } from 'react';
import { Product } from '../types/pos';
import { formatCurrency } from '../utils/taxCalculator';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { ProductFormModal } from './ProductFormModal';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  currencySymbol: string;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  products,
  onSaveProduct,
  onDeleteProduct,
  currencySymbol,
}) => {
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  if (!isOpen) return null;

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  return (
    <div id="modal-inventory-management" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1b2b48] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-100">Product Inventory</h3>
            <p className="text-xs text-slate-400">{products.length} catalog items</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-inventory-add-product"
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setIsAddingNew(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-900/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Product
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 bg-[#090f1c] border-b border-[#1b2b48]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name, barcode, SKU, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0c1427] border border-[#1b2b48] text-slate-100 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Products List matching cards */}
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
                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
                  <span>BC: {product.barcode}</span>
                  <span>•</span>
                  <span>Stock: {product.stock}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-xs font-mono text-blue-400">
                  {formatCurrency(product.unitPrice, currencySymbol)}
                </span>
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
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                  title="Delete Product"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Edit / Add Modal */}
        <ProductFormModal
          isOpen={isAddingNew || Boolean(editingProduct)}
          product={editingProduct}
          onClose={() => {
            setIsAddingNew(false);
            setEditingProduct(null);
          }}
          onSaveProduct={(prod) => {
            onSaveProduct(prod);
            setIsAddingNew(false);
            setEditingProduct(null);
          }}
          currencySymbol={currencySymbol}
        />
      </div>
    </div>
  );
};

