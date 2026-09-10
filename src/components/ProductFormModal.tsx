import React, { useState, useEffect } from 'react';
import { Product } from '../types/pos';
import { X, Sparkles, RefreshCw, Check } from 'lucide-react';
import { posAudio } from '../utils/audio';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null; // If null, mode is Add New, else Edit
  initialBarcode?: string;
  onSaveProduct: (product: Product) => void;
  currencySymbol: string;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  product,
  initialBarcode,
  onSaveProduct,
  currencySymbol,
}) => {
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [unitPrice, setUnitPrice] = useState<string>('100');
  const [mrp, setMrp] = useState<string>('120');
  const [stock, setStock] = useState<string>('50');
  const [unit, setUnit] = useState('pcs');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (product) {
        setName(product.name || '');
        setBarcode(product.barcode || '');
        setSku(product.sku || '');
        setCategory(product.category || 'Groceries');
        setUnitPrice(product.unitPrice ? product.unitPrice.toString() : '0');
        setMrp(product.mrp ? product.mrp.toString() : (product.unitPrice ? (product.unitPrice * 1.1).toFixed(0) : '0'));
        setStock(product.stock !== undefined ? product.stock.toString() : '50');
        setUnit(product.unit || 'pcs');
      } else {
        setName('');
        setBarcode(initialBarcode || `890${Date.now().toString().slice(-8)}`);
        setSku(`SKU-${Date.now().toString().slice(-4)}`);
        setCategory('Groceries');
        setUnitPrice('50');
        setMrp('60');
        setStock('50');
        setUnit('pcs');
      }
    }
  }, [isOpen, product, initialBarcode]);

  if (!isOpen) return null;

  const handleGenerateBarcode = () => {
    setBarcode(`890${Date.now().toString().slice(-8)}`);
  };

  const handleGenerateSku = () => {
    setSku(`SKU-${Date.now().toString().slice(-4)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }
    const parsedPrice = parseFloat(unitPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Please enter a valid price');
      return;
    }

    const saved: Product = {
      id: product?.id || `prod-${Date.now()}`,
      name: name.trim(),
      barcode: barcode.trim() || `890${Date.now().toString().slice(-8)}`,
      sku: sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      category: category.trim() || 'General',
      unitPrice: parsedPrice,
      mrp: parseFloat(mrp) || parsedPrice,
      gstRate: 0,
      hsnCode: product?.hsnCode || '9999',
      stock: parseInt(stock) || 0,
      unit: unit || 'pcs',
    };

    posAudio.playScanBeep();
    onSaveProduct(saved);
    onClose();
  };

  return (
    <div id="modal-product-form" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-md shadow-2xl p-5 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1b2b48] mb-4">
          <div>
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>{product ? 'Edit Product Details' : 'Add New Product'}</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {product ? 'Modify catalog item price and info' : 'Add item to instant checkout catalog'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-[#152340]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* Product Title */}
          <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500 transition-colors">
            <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
              PRODUCT TITLE *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Farm Fresh Milk 1L"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-slate-100 text-sm font-medium focus:outline-none mt-0.5"
              autoFocus
            />
          </div>

          {/* Price and Stock */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-3 pt-2 pb-1.5 focus-within:border-blue-500 transition-colors">
              <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                SELLING PRICE ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.5"
                required
                placeholder="60"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full bg-transparent text-slate-100 font-mono font-bold text-sm focus:outline-none mt-0.5"
              />
            </div>

            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-3 pt-2 pb-1.5 focus-within:border-blue-500 transition-colors">
              <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                STOCK QUANTITY
              </label>
              <input
                type="number"
                placeholder="50"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full bg-transparent text-slate-100 font-mono text-sm focus:outline-none mt-0.5"
              />
            </div>
          </div>

          {/* Barcode and Category */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-3 pt-2 pb-1.5 focus-within:border-blue-500 transition-colors">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                  BARCODE
                </label>
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  title="Generate unique barcode"
                  className="text-blue-400 hover:text-blue-300"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                </button>
              </div>
              <input
                type="text"
                placeholder="8901234567"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full bg-transparent text-slate-100 font-mono text-xs focus:outline-none mt-0.5"
              />
            </div>

            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-3 pt-2 pb-1.5 focus-within:border-blue-500 transition-colors">
              <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                CATEGORY
              </label>
              <input
                type="text"
                placeholder="Groceries, Bakery..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-transparent text-slate-100 text-xs focus:outline-none mt-0.5"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/30 transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{product ? 'Update Product' : 'Save Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
