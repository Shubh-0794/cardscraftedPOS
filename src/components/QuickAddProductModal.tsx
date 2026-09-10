import React, { useState } from 'react';
import { Product } from '../types/pos';
import { Plus, X, Barcode } from 'lucide-react';

interface QuickAddProductModalProps {
  barcode: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveProduct: (product: Product) => void;
  currencySymbol: string;
}

export const QuickAddProductModal: React.FC<QuickAddProductModalProps> = ({
  barcode,
  isOpen,
  onClose,
  onSaveProduct,
  currencySymbol,
}) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [gstRate, setGstRate] = useState(5);

  if (!isOpen || !barcode) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      barcode: barcode.trim(),
      name: name.trim(),
      category: category.trim(),
      unitPrice: parseFloat(price) || 0,
      mrp: (parseFloat(price) || 0) * 1.1,
      gstRate: gstRate,
      hsnCode: '9999',
      stock: 50,
      unit: 'pcs',
    };

    onSaveProduct(newProd);
    setName('');
    setPrice('');
    onClose();
  };

  return (
    <div id="modal-quick-add-product" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-sm shadow-2xl p-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#1b2b48] mb-4">
          <div className="flex items-center gap-2">
            <Barcode className="w-4 h-4 text-blue-400" />
            <h4 className="font-bold text-sm text-slate-100">Unrecognized Item</h4>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-3 px-3 py-2 bg-[#090f1c] border border-[#1b2b48] rounded-xl text-xs font-mono text-slate-300">
          Barcode: <span className="text-blue-400 font-bold">{barcode}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500">
            <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
              PRODUCT NAME *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Britannia Good Day 100g"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-slate-100 focus:outline-none mt-0.5"
              autoFocus
            />
          </div>

          <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-3 pt-2 pb-1.5 focus-within:border-blue-500">
            <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
              PRICE ({currencySymbol}) *
            </label>
            <input
              type="number"
              step="0.5"
              required
              placeholder="40"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-transparent text-slate-100 font-mono font-bold focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-xl font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/30"
            >
              Save &amp; Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
