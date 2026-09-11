import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types/pos';
import { X, Sparkles, RefreshCw, Check, QrCode, Upload, Image as ImageIcon, Link2, Trash2 } from 'lucide-react';
import { posAudio } from '../utils/audio';
import { ProductQrBadge } from './ProductQrBadge';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null; // If null, mode is Add New, else Edit
  initialBarcode?: string;
  onSaveProduct: (product: Product) => void;
  currencySymbol: string;
}

const PRESET_IMAGES = [
  { name: 'Coffee', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80', cat: 'Beverages' },
  { name: 'Snacks', url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80', cat: 'Snacks' },
  { name: 'Dairy / Butter', url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=400&q=80', cat: 'Dairy' },
  { name: 'Cooking Oil', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80', cat: 'Groceries' },
  { name: 'Rice / Grain', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80', cat: 'Groceries' },
  { name: 'Personal Care', url: 'https://images.unsplash.com/photo-1608248597359-25f0a4f5f5c0?auto=format&fit=crop&w=400&q=80', cat: 'Personal Care' },
  { name: 'Beverage / Drink', url: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=400&q=80', cat: 'Beverages' },
  { name: 'Bakery Bread', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80', cat: 'Bakery' },
  { name: 'Tea', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80', cat: 'Beverages' },
  { name: 'Handmade Card / Gift', url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80', cat: 'Cards & Crafts' },
];

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
  const [image, setImage] = useState<string>('');
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url' | 'presets'>('upload');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setImage(product.image || '');
        setCustomImageUrl(product.image || '');
      } else {
        setName('');
        setBarcode(initialBarcode || `890${Date.now().toString().slice(-8)}`);
        setSku(`SKU-${Date.now().toString().slice(-4)}`);
        setCategory('Groceries');
        setUnitPrice('50');
        setMrp('60');
        setStock('50');
        setUnit('pcs');
        setImage('');
        setCustomImageUrl('');
      }
    }
  }, [isOpen, product, initialBarcode]);

  if (!isOpen) return null;

  const handleGenerateBarcode = () => {
    setBarcode(`890${Date.now().toString().slice(-8)}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Compress using canvas to ensure lightweight footprint
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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setImage(compressedDataUrl);
          setError(null);
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
      gstRate: product?.gstRate || 0,
      hsnCode: product?.hsnCode || '9999',
      stock: parseInt(stock) || 0,
      unit: unit || 'pcs',
      image: image.trim() || undefined,
    };

    posAudio.playScanBeep();
    onSaveProduct(saved);
    onClose();
  };

  return (
    <div id="modal-product-form" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c1427] border border-[#1b2b48] rounded-3xl w-full max-w-md shadow-2xl p-5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1b2b48] mb-3 shrink-0">
          <div>
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>{product ? 'Edit Product Details' : 'Add New Product'}</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {product ? 'Modify catalog item image, price, and details' : 'Add item with photo to instant checkout catalog'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-[#152340] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs shrink-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs overflow-y-auto pr-1 flex-1">
          {/* PRODUCT IMAGE SECTION */}
          <div className="bg-[#0a101d] border border-[#1b2b48] rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono flex items-center gap-1.5">
                <ImageIcon className="w-3 h-3 text-blue-400" />
                <span>PRODUCT IMAGE</span>
              </label>

              <div className="flex items-center gap-1 bg-[#121e38] p-0.5 rounded-lg border border-[#1b2b48]">
                <button
                  type="button"
                  onClick={() => setImageInputMode('upload')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                    imageInputMode === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setImageInputMode('url')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                    imageInputMode === 'url' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  URL
                </button>
                <button
                  type="button"
                  onClick={() => setImageInputMode('presets')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                    imageInputMode === 'presets' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Presets
                </button>
              </div>
            </div>

            {/* Image Preview & Upload Container */}
            <div className="flex items-center gap-3">
              {/* Thumbnail preview box */}
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-[#121e38] border border-[#1b2b48] shrink-0 flex items-center justify-center group">
                {image ? (
                  <>
                    <img
                      src={image}
                      alt="Product preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImage('');
                        setCustomImageUrl('');
                      }}
                      title="Remove image"
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="text-center p-1">
                    <ImageIcon className="w-6 h-6 text-slate-500 mx-auto" />
                    <span className="text-[9px] text-slate-500 font-mono block mt-0.5">NO PHOTO</span>
                  </div>
                )}
              </div>

              {/* Input Modes */}
              <div className="flex-1 min-w-0">
                {imageInputMode === 'upload' && (
                  <div>
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
                      className="w-full py-2 px-3 bg-[#13223f] hover:bg-[#1a2d52] border border-blue-500/30 hover:border-blue-500/50 rounded-xl text-blue-300 font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{image ? 'Change Photo from Device' : 'Choose Photo / Capture'}</span>
                    </button>
                    <p className="text-[10px] text-slate-500 mt-1">Supports PNG, JPG, WebP from phone or computer</p>
                  </div>
                )}

                {imageInputMode === 'url' && (
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Link2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        value={customImageUrl}
                        onChange={(e) => {
                          setCustomImageUrl(e.target.value);
                          setImage(e.target.value);
                        }}
                        className="w-full bg-[#121e38] border border-[#1b2b48] rounded-xl pl-8 pr-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {imageInputMode === 'presets' && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {PRESET_IMAGES.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setImage(preset.url);
                          setCustomImageUrl(preset.url);
                        }}
                        className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 border transition-all cursor-pointer relative ${
                          image === preset.url ? 'border-blue-400 ring-2 ring-blue-500/50 scale-105' : 'border-[#1b2b48] opacity-70 hover:opacity-100'
                        }`}
                        title={preset.name}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

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
              autoFocus={!product}
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

          {/* QR Code and Category */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-3 pt-2 pb-1.5 focus-within:border-blue-500 transition-colors">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono flex items-center gap-1">
                  <QrCode className="w-2.5 h-2.5 text-blue-400" />
                  <span>QR CODE</span>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  title="Generate unique QR Code"
                  className="text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <input
                  type="text"
                  placeholder="8901234567"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full bg-transparent text-slate-100 font-mono text-xs focus:outline-none"
                />
                {barcode && <ProductQrBadge code={barcode} size={15} />}
              </div>
            </div>

            <div className="bg-[#0a101d] border border-[#1b2b48] rounded-xl px-3 pt-2 pb-1.5 focus-within:border-blue-500 transition-colors">
              <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
                CATEGORY
              </label>
              <input
                type="text"
                placeholder="Groceries, Bakery, Crafts..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-transparent text-slate-100 text-xs focus:outline-none mt-0.5"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-[#121e38] hover:bg-[#18284c] text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
