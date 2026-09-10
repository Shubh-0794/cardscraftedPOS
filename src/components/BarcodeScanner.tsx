import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types/pos';
import { posAudio } from '../utils/audio';
import { formatCurrency } from '../utils/taxCalculator';
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
} from 'lucide-react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';

interface BarcodeScannerProps {
  products: Product[];
  onAddToCart: (product: Product, quantity?: number) => void;
  onOpenQuickAddProduct: (scannedBarcode: string) => void;
  onOpenAddProduct?: () => void;
  onEditProduct?: (product: Product) => void;
  currencySymbol: string;
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
  currencySymbol,
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
        setLastScannedInfo({ name: 'Unknown Item', barcode: cleanCode, time: Date.now() });
        onOpenQuickAddProduct(cleanCode);
        setSearchQuery('');
      }
    }
  };

  // Hardware USB/Bluetooth Barcode Wedge Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (hardwareBufferRef.current.length >= 3 && (timeDiff < 100 || !isInput)) {
          e.preventDefault();
          const scanned = hardwareBufferRef.current;
          hardwareBufferRef.current = '';
          handleProcessBarcode(scanned);
        } else {
          hardwareBufferRef.current = '';
        }
      } else if (e.key.length === 1) {
        if (timeDiff > 180) {
          hardwareBufferRef.current = e.key;
        } else {
          hardwareBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  // Cleanly stop any active scanner
  const stopCurrentScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        console.warn('Silent scanner cleanup exception:', e);
      }
      scannerRef.current = null;
    }
  };

  // Handle camera start/stop when isCameraActive, selectedCameraId, or retryNonce changes
  useEffect(() => {
    let isMounted = true;

    const startCamera = async () => {
      if (!isCameraActive) {
        await stopCurrentScanner();
        return;
      }

      setIsInitializingCamera(true);
      setCameraError(null);

      // Stop any lingering scanner instance first
      await stopCurrentScanner();

      // Small pause to allow hardware/browser video tracks to fully unlock
      await new Promise((resolve) => setTimeout(resolve, 200));

      if (!isMounted) return;

      const viewportEl = document.getElementById('camera-reader-viewport');
      if (!viewportEl) {
        if (isMounted) {
          setCameraError('Camera display element is mounting, please try again.');
          setIsInitializingCamera(false);
        }
        return;
      }

      try {
        // Enumerate video devices if not already loaded
        let cameras = availableCameras;
        try {
          const fetchedCameras = await Html5Qrcode.getCameras();
          if (fetchedCameras && fetchedCameras.length > 0) {
            cameras = fetchedCameras;
            if (isMounted) {
              setAvailableCameras(fetchedCameras);
            }
          }
        } catch (deviceEnumError) {
          console.warn('Could not enumerate cameras, will try direct constraints', deviceEnumError);
        }

        const html5QrCode = new Html5Qrcode('camera-reader-viewport');
        scannerRef.current = html5QrCode;

        const scanConfig = {
          fps: 15,
          qrbox: { width: 250, height: 180 },
          aspectRatio: 1.3333,
        };

        const onDecodeSuccess = (decodedText: string) => {
          handleProcessBarcode(decodedText);
        };

        let isStarted = false;

        // Strategy 1: If user explicitly selected a camera ID or devices list is populated
        const targetCamId =
          selectedCameraId ||
          cameras.find((c) => /back|rear|environment/i.test(c.label))?.id ||
          cameras[0]?.id;

        if (targetCamId) {
          try {
            await html5QrCode.start(targetCamId, scanConfig, onDecodeSuccess, () => {});
            isStarted = true;
            if (isMounted && !selectedCameraId) {
              setSelectedCameraId(targetCamId);
            }
          } catch (idErr: any) {
            console.warn('Failed starting with targetCamId, falling back to facingMode:', idErr);
          }
        }

        // Strategy 2: Fallback to environment facingMode
        if (!isStarted) {
          try {
            await html5QrCode.start({ facingMode: 'environment' }, scanConfig, onDecodeSuccess, () => {});
            isStarted = true;
          } catch (envErr) {
            console.warn('Environment facingMode failed, falling back to user facing camera:', envErr);
          }
        }

        // Strategy 3: Fallback to user facing camera
        if (!isStarted) {
          try {
            await html5QrCode.start({ facingMode: 'user' }, scanConfig, onDecodeSuccess, () => {});
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
              'Camera hardware is currently busy or in use by another tab/app. Please close other camera apps, or click "Retry Camera" below.'
            );
          } else if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission')) {
            setCameraError(
              'Camera permission was not granted. Please allow camera access in your browser address bar.'
            );
          } else if (errMsg.includes('NotFoundError') || errMsg.includes('DevicesNotFoundError')) {
            setCameraError(
              'No active camera was detected on this device. You can upload barcode images or use 1-click Test Barcodes.'
            );
          } else {
            setCameraError(
              'Could not start camera feed. You can retry, select another camera, or use Image Upload / Test Barcodes.'
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

  // Handle Image File Scanning
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
      console.warn('Barcode not found in uploaded image:', err);
      posAudio.playErrorBuzz();
      alert('No barcode or QR code detected in the selected image. Please try another clear photo.');
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
            <label className="block text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono">
              DESCRIPTION / BARCODE SCANNER
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowQuickTestBarcodes(!showQuickTestBarcodes)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors ${
                  showQuickTestBarcodes
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-amber-300 hover:bg-[#15233f]'
                }`}
                title="Quick Barcode Test Simulation"
              >
                <Zap className="w-3 h-3" />
                <span>Test Barcodes</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <input
              ref={searchInputRef}
              type="text"
              id="barcode-search-input"
              placeholder="Scan barcode, SKU or search item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none font-medium font-mono"
            />

            {/* Upload image button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-[#15233f] transition-colors shrink-0"
              title="Upload barcode image to scan"
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
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 ${
                isCameraActive
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                  : 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30'
              }`}
              title={isCameraActive ? 'Turn off camera scanner' : 'Turn on camera barcode scanner'}
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
              <span className="font-bold text-emerald-400">Live Camera Barcode Scanner</span>
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
                onClick={() => setIsCameraActive(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono"
              >
                Close Camera [✕]
              </button>
            </div>
          </div>

          <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-xl bg-black min-h-[190px] border border-[#1b2b48]">
            <div id="camera-reader-viewport" className="w-full h-full min-h-[190px]" />

            {/* Animated Laser Reticle */}
            {!cameraError && !isInitializingCamera && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-48 h-32 border-2 border-dashed border-blue-400/60 rounded-xl relative">
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-blue-400" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-blue-400" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-blue-400" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-blue-400" />
                  <div className="w-full h-0.5 bg-rose-500 shadow-md shadow-rose-500 animate-bounce absolute top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[10px] text-white/80 bg-black/60 px-2 py-0.5 rounded-full mt-2 font-mono">
                  Align Barcode or QR Code Inside Box
                </p>
              </div>
            )}

            {isInitializingCamera && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center gap-2 text-xs text-blue-300">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                <span>Starting camera...</span>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-200 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="font-medium">{cameraError}</p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRetryNonce((prev) => prev + 1)}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-[#182848] hover:bg-[#203662] text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickTestBarcodes(true)}
                  className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                >
                  <Zap className="w-3 h-3" />
                  <span>Test Barcodes</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Test Barcode Drawer / Chips */}
      {showQuickTestBarcodes && (
        <div className="p-3 bg-[#081020] border border-amber-500/30 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5 font-mono">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              1-CLICK TEST BARCODE SCANS
            </span>
            <span className="text-[10px] text-slate-400">Click any barcode to test auto-add</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {products.slice(0, 6).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleProcessBarcode(item.barcode)}
                className="p-2 bg-[#0e1a33] hover:bg-[#172b54] border border-[#1b2e54] hover:border-amber-400/50 rounded-xl text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-slate-200 truncate group-hover:text-amber-300">
                  {item.name}
                </div>
                <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between mt-0.5">
                  <span className="text-amber-400/90">{item.barcode}</span>
                  <span className="font-bold text-slate-300">{formatCurrency(item.unitPrice, currencySymbol)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scanned Feedback Notification Banner */}
      {lastScannedInfo && (
        <div className="px-3 py-2 bg-blue-950/60 border border-blue-500/30 rounded-xl flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2 text-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="font-mono text-[11px] text-slate-300">Scanned [{lastScannedInfo.barcode}]:</span>
            <span className="font-bold text-white truncate max-w-[170px]">{lastScannedInfo.name}</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold uppercase font-mono">+ Added</span>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white'
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
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md shadow-blue-900/30 transition-colors"
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
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {product.category} • <span className="text-slate-300 font-mono">{product.barcode}</span> • {product.stock} in stock
                    </p>
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
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-[#152445] transition-colors"
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
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Product
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
