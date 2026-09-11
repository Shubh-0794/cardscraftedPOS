import React, { useState, useEffect, useRef } from 'react';
import { Product, StoreSettings } from '../types/pos';
import { posAudio } from '../utils/audio';
import { formatCurrency } from '../utils/taxCalculator';
import { generate24QrLabelsA4Pdf } from '../utils/qrPdfGenerator';
import {
  Plus,
  Camera,
  CameraOff,
  Upload,
  CheckCircle2,
  RefreshCw,
  Zap,
  Edit2,
  Video,
  AlertCircle,
  QrCode,
  FileDown,
  Printer,
  Sparkles,
  Check,
} from 'lucide-react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
import { ProductQrBadge } from './ProductQrBadge';

interface BarcodeScannerProps {
  products: Product[];
  onAddToCart: (product: Product, quantity?: number) => void;
  onOpenQuickAddProduct: (scannedBarcode: string) => void;
  onOpenAddProduct?: () => void;
  onEditProduct?: (product: Product) => void;
  onViewBarcode?: (barcode: string, name: string, price?: number, sku?: string, category?: string) => void;
  currencySymbol: string;
  settings?: StoreSettings;
}

const AVATAR_COLORS = [
  'bg-blue-600 text-white',
  'bg-amber-600 text-white',
  'bg-emerald-600 text-white',
  'bg-purple-600 text-white',
  'bg-rose-600 text-white',
  'bg-indigo-600 text-white',
  'bg-cyan-600 text-white',
];

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  products,
  onAddToCart,
  onOpenQuickAddProduct,
  onOpenAddProduct,
  onEditProduct,
  onViewBarcode,
  currencySymbol,
  settings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [lastScannedInfo, setLastScannedInfo] = useState<{ name: string; barcode: string; time: number } | null>(null);
  const [showQuickTestBarcodes, setShowQuickTestBarcodes] = useState(false);
  const [retryNonce, setRetryNonce] = useState<number>(0);
  const [isExportingLabels, setIsExportingLabels] = useState(false);
  const [labelsDownloaded, setLabelsDownloaded] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hardwareBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastScannedBarcodeRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });

  // Extract unique categories
  const categories: string[] = ['All', ...Array.from(new Set(products.map((p) => p.category))).map(String)];

  const handleProcessBarcode = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    // Debounce identical scans within 1.5 seconds to avoid multi-fire on same camera frame
    const now = Date.now();
    if (
      lastScannedBarcodeRef.current.code === cleanCode &&
      now - lastScannedBarcodeRef.current.timestamp < 1500
    ) {
      return;
    }
    lastScannedBarcodeRef.current = { code: cleanCode, timestamp: now };

    const matched = products.find(
      (p) =>
        p.barcode.toLowerCase() === cleanCode.toLowerCase() ||
        p.sku.toLowerCase() === cleanCode.toLowerCase()
    );

    if (matched) {
      posAudio.playScanBeep();
      onAddToCart(matched, 1);
      setLastScannedInfo({ name: matched.name, barcode: cleanCode, time: Date.now() });
      setSearchQuery('');
    } else {
      const nameMatch = products.find((p) => p.name.toLowerCase() === cleanCode.toLowerCase());
      if (nameMatch) {
        posAudio.playScanBeep();
        onAddToCart(nameMatch, 1);
        setLastScannedInfo({ name: nameMatch.name, barcode: cleanCode, time: Date.now() });
        setSearchQuery('');
      } else {
        posAudio.playErrorBuzz();
        setLastScannedInfo({ name: 'New QR Code', barcode: cleanCode, time: Date.now() });
        onOpenQuickAddProduct(cleanCode);
        setSearchQuery('');
      }
    }
  };

  // Hardware USB/Bluetooth QR/Barcode Scanner Wedge Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (hardwareBufferRef.current.length >= 3 && timeDiff < 100) {
          e.preventDefault();
          const scannedCode = hardwareBufferRef.current;
          hardwareBufferRef.current = '';
          handleProcessBarcode(scannedCode);
        } else {
          hardwareBufferRef.current = '';
        }
      } else if (e.key.length === 1) {
        if (timeDiff > 120 && !isInput) {
          hardwareBufferRef.current = e.key;
        } else {
          hardwareBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  // Clean up scanner helper
  const stopCurrentScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error clearing scanner:', err);
      } finally {
        scannerRef.current = null;
      }
    }
  };

  // Camera Lifecycle
  useEffect(() => {
    let isMounted = true;

    if (!isCameraActive) {
      stopCurrentScanner();
      setCameraError(null);
      setIsInitializingCamera(false);
      return;
    }

    const startCamera = async () => {
      setIsInitializingCamera(true);
      setCameraError(null);

      try {
        await stopCurrentScanner();
        if (!isMounted) return;

        let devices: CameraDevice[] = [];
        try {
          devices = await Html5Qrcode.getCameras();
          if (isMounted) {
            setAvailableCameras(devices);
          }
        } catch (camListErr) {
          console.warn('Could not enumerate cameras, continuing with environment fallback:', camListErr);
        }

        const scannerElement = document.getElementById('camera-reader');
        if (!scannerElement) {
          throw new Error('Camera reader container element not found.');
        }

        const html5QrCode = new Html5Qrcode('camera-reader');
        scannerRef.current = html5QrCode;

        const qrConfig = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        const successCallback = (decodedText: string) => {
          if (decodedText) {
            handleProcessBarcode(decodedText);
          }
        };

        let isStarted = false;

        if (selectedCameraId) {
          try {
            await html5QrCode.start(
              selectedCameraId,
              qrConfig,
              successCallback,
              () => {} // silent scan frame error
            );
            isStarted = true;
          } catch (selErr) {
            console.warn('Failed with selectedCameraId, falling back to facingMode:', selErr);
          }
        }

        if (!isStarted) {
          try {
            await html5QrCode.start(
              { facingMode: 'environment' },
              qrConfig,
              successCallback,
              () => {}
            );
            isStarted = true;
          } catch (envErr) {
            console.warn('Failed with facingMode environment, falling back to user camera:', envErr);
          }
        }

        if (!isStarted) {
          try {
            await html5QrCode.start(
              { facingMode: 'user' },
              qrConfig,
              successCallback,
              () => {}
            );
            isStarted = true;
          } catch (userErr: any) {
            console.error('All camera start attempts failed:', userErr);
            throw userErr;
          }
        }

        if (isMounted) {
          setIsInitializingCamera(false);
        }
      } catch (err: any) {
        console.error('Camera Scanner Initialization Error:', err);
        if (isMounted) {
          setIsInitializingCamera(false);
          const errMsg = err?.message || String(err);
          if (errMsg.includes('NotReadableError') || errMsg.includes('video source')) {
            setCameraError(
              'Camera hardware is currently busy. Please close other camera tabs and click "Retry Camera".'
            );
          } else if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission')) {
            setCameraError(
              'Camera permission was not granted. Please allow camera access in your browser.'
            );
          } else if (errMsg.includes('NotFoundError') || errMsg.includes('DevicesNotFoundError')) {
            setCameraError(
              'No active camera detected. You can upload QR code images or use 1-click Test QR Codes.'
            );
          } else {
            setCameraError(
              'Could not start camera feed. You can retry, select another camera, or use Image Upload / Test QR Codes.'
            );
          }
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      stopCurrentScanner();
    };
  }, [isCameraActive, selectedCameraId, retryNonce]);

  // Handle Image File QR Scanning
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const tempScanner = new Html5Qrcode('file-scanner-temp-holder');
      const result = await tempScanner.scanFile(file, true);
      tempScanner.clear();
      if (result) {
        handleProcessBarcode(result);
      }
    } catch (err: any) {
      console.warn('QR code not found in uploaded image:', err);
      posAudio.playErrorBuzz();
      alert('No QR code detected in the selected image. Please try another clear photo.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  const handleManualFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (filteredProducts.length === 1) {
      posAudio.playScanBeep();
      onAddToCart(filteredProducts[0], 1);
      setLastScannedInfo({ name: filteredProducts[0].name, barcode: filteredProducts[0].barcode, time: Date.now() });
      setSearchQuery('');
      return;
    }

    handleProcessBarcode(searchQuery);
  };

  // Download 24 QR Labels in A4 format (Single Sheet PDF)
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
      alert('Could not generate QR PDF. Please try again.');
    } finally {
      setIsExportingLabels(false);
    }
  };

  return (
    <div id="product-catalog-panel" className="space-y-3.5">
      {/* Hidden container for file scanner processing */}
      <div id="file-scanner-temp-holder" style={{ display: 'none' }} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Search & Scanner Header Bar */}
      <form onSubmit={handleManualFormSubmit} className="space-y-2">
        <div className="relative bg-[#0a101d] border border-[#1b2b48] rounded-xl px-4 pt-2.5 pb-2 focus-within:border-blue-500 transition-colors">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono flex items-center gap-1.5">
              <QrCode className="w-3 h-3 text-blue-400" />
              <span>SEARCH / QR CODE SCANNER</span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowQuickTestBarcodes(!showQuickTestBarcodes)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                  showQuickTestBarcodes
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-amber-300 hover:bg-[#15233f]'
                }`}
                title="Quick QR Simulation Tests"
              >
                <Zap className="w-3 h-3" />
                <span>Test QRs</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <input
              ref={searchInputRef}
              type="text"
              id="barcode-search-input"
              placeholder="Scan QR code, SKU or search item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none font-medium font-mono"
            />

            {/* Upload image button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-[#15233f] transition-colors shrink-0 cursor-pointer"
              title="Upload QR Code image to scan"
            >
              <Upload className="w-4 h-4" />
            </button>

            {/* Camera scanner toggle button */}
            <button
              type="button"
              onClick={() => {
                if (isCameraActive) {
                  setIsCameraActive(false);
                } else {
                  setIsCameraActive(true);
                  setRetryNonce((prev) => prev + 1);
                }
              }}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer ${
                isCameraActive
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                  : 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30'
              }`}
              title={isCameraActive ? 'Turn off camera scanner' : 'Turn on camera QR scanner'}
            >
              {isCameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </form>

      {/* Live Camera Scanner Viewport */}
      {isCameraActive && (
        <div className="p-3 bg-[#0a101d] border border-blue-500/40 rounded-2xl shadow-xl space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-300 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-emerald-400">Live Camera QR Code Scanner</span>
            </div>

            <div className="flex items-center gap-2">
              {availableCameras.length > 1 && (
                <div className="flex items-center gap-1 bg-[#121f3a] px-2 py-0.5 rounded-lg border border-[#1b2b48]">
                  <Video className="w-3 h-3 text-blue-400" />
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      setRetryNonce((prev) => prev + 1);
                    }}
                    className="bg-transparent text-[11px] text-slate-200 font-mono focus:outline-none"
                  >
                    {availableCameras.map((cam, index) => (
                      <option key={cam.id} value={cam.id} className="bg-[#0a101d] text-slate-200">
                        {cam.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={() => setRetryNonce((prev) => prev + 1)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#15233f] transition-colors"
                title="Restart camera stream"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Camera Viewfinder Box */}
          <div className="relative w-full aspect-4/3 max-h-56 bg-black rounded-xl overflow-hidden border border-[#1b2b48] flex items-center justify-center">
            <div id="camera-reader" className="w-full h-full object-cover" />

            {/* Target Reticle Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-36 h-36 border-2 border-blue-400/80 rounded-2xl relative shadow-lg">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1" />
                {/* Center scan beam */}
                <div className="absolute inset-x-2 h-0.5 bg-linear-to-r from-transparent via-emerald-400 to-transparent animate-pulse top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {isInitializingCamera && (
              <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 text-xs text-blue-400 font-mono">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span>Starting QR Camera Lens...</span>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>{cameraError}</p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setRetryNonce((prev) => prev + 1)}
                    className="px-2.5 py-1 bg-rose-800/60 hover:bg-rose-700/80 rounded-lg text-[11px] font-bold text-white transition-colors"
                  >
                    Retry Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-[#142342] hover:bg-[#1e3463] rounded-lg text-[11px] font-bold text-slate-200 transition-colors"
                  >
                    Upload QR Image
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Test QR Badges (Expandable Panel) */}
      {showQuickTestBarcodes && (
        <div className="p-3 bg-[#0a101d] border border-amber-500/30 rounded-2xl shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-300">
            <span className="font-bold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> 1-Click Simulation QRs
            </span>
            <span className="text-[10px] text-slate-400">Click any card to simulate scan</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {products.slice(0, 6).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleProcessBarcode(item.barcode)}
                className="p-2 bg-[#0d1629] hover:bg-[#142240] border border-[#1b2b48] hover:border-amber-500/50 rounded-xl text-left transition-all group flex flex-col justify-between cursor-pointer"
              >
                <div className="text-[11px] font-bold text-slate-200 truncate group-hover:text-amber-300">
                  {item.name}
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-slate-400">
                  <span className="text-amber-400 font-bold">{formatCurrency(item.unitPrice, currencySymbol)}</span>
                  <ProductQrBadge code={item.barcode} size={14} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Last Scanned Feedback Pill */}
      {lastScannedInfo && Date.now() - lastScannedInfo.time < 4000 && (
        <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              Scanned: <strong>{lastScannedInfo.name}</strong> ({lastScannedInfo.barcode})
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400/80">Added to cart</span>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'bg-[#0a101d] border border-[#1b2b48] text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Items Section Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
            QUICK CATALOG
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#152442] text-blue-400 text-[10px] font-bold font-mono">
            {filteredProducts.length} ITEMS
          </span>
        </div>

        {onOpenAddProduct && (
          <button
            type="button"
            onClick={onOpenAddProduct}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md shadow-blue-900/30 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        )}
      </div>

      {/* Product List Cards */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product, idx) => {
            const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const initial = product.name.charAt(0).toUpperCase();

            return (
              <div
                key={product.id}
                onClick={() => {
                  posAudio.playScanBeep();
                  onAddToCart(product, 1);
                }}
                className="bg-[#0b1325] hover:bg-[#101b33] border border-[#1a2b47] hover:border-blue-500/50 rounded-2xl p-3 flex items-center justify-between cursor-pointer transition-all shadow-xs group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center font-bold text-xs shrink-0 font-mono shadow-xs`}>
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-100 truncate group-hover:text-blue-400 transition-colors">
                      {product.name}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5 flex-wrap">
                      <span>{product.category}</span>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewBarcode?.(product.barcode, product.name, product.unitPrice, product.sku, product.category);
                        }}
                        className="text-slate-300 font-mono hover:text-blue-400 hover:underline transition-colors cursor-pointer"
                        title="Click to view & download large QR Code"
                      >
                        QR: {product.barcode}
                      </button>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span>{product.stock} in stock</span>
                        <ProductQrBadge
                          code={product.barcode}
                          size={15}
                          clickable={true}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewBarcode?.(product.barcode, product.name, product.unitPrice, product.sku, product.category);
                          }}
                        />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pl-2">
                  <span className="font-bold text-xs text-slate-100 font-mono">
                    {formatCurrency(product.unitPrice, currencySymbol)}
                  </span>
                  {onEditProduct && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditProduct(product);
                      }}
                      title="Edit Product"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-[#152445] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="w-7 h-7 rounded-xl bg-[#14223d] group-hover:bg-blue-600 text-slate-300 group-hover:text-white flex items-center justify-center transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs space-y-2">
            <p>No products found matching &quot;{searchQuery}&quot;</p>
            <div className="flex items-center justify-center gap-2">
              {onOpenAddProduct && (
                <button
                  type="button"
                  onClick={onOpenAddProduct}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Product
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Button Under Product: Download QR Labels in A4 Size PDF (Exact count, 24 per page, no repeat) */}
      <div className="pt-2 border-t border-[#1b2b48]">
        <button
          type="button"
          onClick={handleDownload24QrSheet}
          disabled={isExportingLabels || products.length === 0}
          className="w-full py-2.5 px-3.5 bg-linear-to-r from-blue-900/40 via-[#132342] to-blue-900/40 hover:from-blue-800/60 hover:to-blue-800/60 border border-blue-500/40 hover:border-blue-400 text-slate-100 rounded-2xl text-xs font-bold flex items-center justify-between transition-all shadow-md group cursor-pointer"
          title="Download printable A4 sheet with product QR labels (24 per page, no repetition)"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>Download Product QR Labels (A4 PDF)</span>
                <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 text-[10px] font-mono rounded border border-blue-400/30">
                  {products.length} {products.length === 1 ? 'Label' : 'Labels'} • {Math.ceil(products.length / 24) || 1} {Math.ceil(products.length / 24) <= 1 ? 'Page' : 'Pages'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-normal">
                1 label per product • Up to 24 per A4 sheet (no repeat)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-blue-400 group-hover:text-blue-300 font-mono text-xs">
            {labelsDownloaded ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                <Check className="w-3.5 h-3.5" /> Done!
              </span>
            ) : isExportingLabels ? (
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold">
                <FileDown className="w-4 h-4" /> Download PDF
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};
