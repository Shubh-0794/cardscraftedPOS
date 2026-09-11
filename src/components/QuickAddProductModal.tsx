import React, { useState, useRef } from 'react';
import { Product } from '../types/pos';
import { Plus, X, QrCode, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { ProductQrBadge } from './ProductQrBadge';

interface QuickAddProductModalProps {
  barcode: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveProduct: (product: Product) => void;
  currencySymbol: string;
}

const PRESET_PICS = [
  { name: 'Snacks', url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=300&q=80' },
  { name: 'Beverage', url: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=300&q=80' },
  { name: 'Coffee', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=300&q=80' },
  { name: 'Groceries', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80' },
  { name: 'Dairy', url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=300&q=80' },
  { name: 'Personal Care', url: 'https://images.unsplash.com/photo-1608248597359-25f0a4f5f5c0?auto=format&fit=crop&w=300&q=80' },
];

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
  const [gstRate, setGstRate] = useState(0);
  const [image, setImage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !barcode) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setImage(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          setImage(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

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
      image: image || undefined,
    };

    onSaveProduct(newProd);
    setName('');
    setPrice('');
    setImage('');
    onClose();
  };

  return (
    <div id="modal-quick-add-product" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-sm shadow-2xl p-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#1b2b48] mb-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-blue-400" />
            <h4 className="font-bold text-sm text-slate-100">Unrecognized QR Item</h4>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-3 px-3 py-2 bg-[#090f1c] border border-[#1b2b48] rounded-xl text-xs font-mono text-slate-300 flex items-center justify-between">
          <div>
            QR Code: <span className="text-blue-400 font-bold">{barcode}</span>
          </div>
          {barcode && <ProductQrBadge code={barcode} size={16} />}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* Image Chooser */}
          <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase font-mono flex items-center gap-1">
                <ImageIcon className="w-3 h-3 text-blue-400" /> PRODUCT PHOTO
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-2.5 h-2.5" /> Upload File
              </button>
            </div>

            <div className="flex items-center gap-2">
              {image ? (
                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-[#1b2b48] shrink-0 group">
                  <img src={image} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[#121e38] border border-[#1b2b48] flex items-center justify-center text-slate-500 shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
              )}

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin flex-1">
                {PRESET_PICS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setImage(preset.url)}
                    className={`w-9 h-9 rounded-lg overflow-hidden shrink-0 border transition-all cursor-pointer ${
                      image === preset.url ? 'border-blue-400 ring-2 ring-blue-500/40' : 'border-[#1b2b48] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

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
              className="flex-1 py-2.5 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-xl font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/30 cursor-pointer"
            >
              Save &amp; Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
