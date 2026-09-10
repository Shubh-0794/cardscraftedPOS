import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CartItem,
  Customer,
  Invoice,
  PaymentMethod,
  PaymentStatus,
  Product,
  StoreSettings,
  HoldCart,
  BillDiscount,
} from './types/pos';
import { INITIAL_PRODUCTS, INITIAL_STORE_SETTINGS, INITIAL_CUSTOMERS } from './data/sampleData';
import { calculateCartTotals, calculateItemFinancials } from './utils/taxCalculator';
import { posAudio } from './utils/audio';

import { Navbar } from './components/Navbar';
import { TabBar, ActiveTab } from './components/TabBar';
import { CustomerInput } from './components/CustomerInput';
import { BarcodeScanner } from './components/BarcodeScanner';
import { CartSummary } from './components/CartSummary';
import { PaymentModal } from './components/PaymentModal';
import { InvoiceModal } from './components/InvoiceModal';
import { HoldBillsModal } from './components/HoldBillsModal';
import { SalesHistoryModal } from './components/SalesHistoryModal';
import { InventoryModal } from './components/InventoryModal';
import { SettingsModal } from './components/SettingsModal';
import { QuickAddProductModal } from './components/QuickAddProductModal';
import { ProductFormModal } from './components/ProductFormModal';
import { BarcodeViewerModal, BarcodeViewerData } from './components/BarcodeViewerModal';
import { Trash2 } from 'lucide-react';

export default function App() {
  // Master State
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('nexus_pos_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [settings, setSettings] = useState<StoreSettings>(() => {
    const saved = localStorage.getItem('nexus_pos_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.storeName || parsed.storeName.includes('NEXUS') || parsed.storeName.includes('SUPERMART') || parsed.storeName === 'QUICKPOS RETAIL') {
        return INITIAL_STORE_SETTINGS;
      }
      return parsed;
    }
    return INITIAL_STORE_SETTINGS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('nexus_pos_customers');
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('nexus_pos_invoices');
    return saved ? JSON.parse(saved) : [];
  });

  const [holdCarts, setHoldCarts] = useState<HoldCart[]>(() => {
    const saved = localStorage.getItem('nexus_pos_hold_carts');
    return saved ? JSON.parse(saved) : [];
  });

  // Active Transaction State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [billDiscount, setBillDiscount] = useState<BillDiscount>({
    type: 'percent',
    value: 0,
    reason: '',
  });

  // Active Tab navigation matching the reference UI
  const [activeTab, setActiveTab] = useState<ActiveTab>('add');

  // Modals & Active Overlays
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [isHoldBillsModalOpen, setIsHoldBillsModalOpen] = useState(false);
  const [isSalesHistoryModalOpen, setIsSalesHistoryModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [quickAddBarcode, setQuickAddBarcode] = useState<string | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [barcodeViewerData, setBarcodeViewerData] = useState<BarcodeViewerData | null>(null);

  const handleOpenBarcodeViewer = useCallback(
    (barcode: string, name?: string, price?: number, sku?: string, category?: string) => {
      setBarcodeViewerData({
        barcode,
        name: name || 'Item Code',
        price,
        sku,
        category,
        storeName: settings.storeName || 'Cardcrafted by Shivani',
      });
    },
    [settings.storeName]
  );

  // Sound settings
  const [cashierName] = useState<string>('');
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('nexus_pos_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('nexus_pos_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('nexus_pos_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('nexus_pos_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('nexus_pos_hold_carts', JSON.stringify(holdCarts));
  }, [holdCarts]);

  // Audio initialization
  useEffect(() => {
    posAudio.setEnabled(isSoundEnabled);
  }, [isSoundEnabled]);

  // Financial calculations
  const calculation = useMemo(() => {
    return calculateCartTotals(cart, billDiscount, false);
  }, [cart, billDiscount]);

  // Add item to cart
  const handleAddToCart = useCallback((product: Product, quantity: number = 1) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);

      if (existingIndex > -1) {
        const existing = prevCart[existingIndex];
        const newQty = existing.quantity + quantity;
        const financials = calculateItemFinancials(
          existing.unitPrice,
          newQty,
          product.gstRate,
          existing.discountType,
          existing.discountValue
        );

        const updated = [...prevCart];
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          taxableAmount: financials.taxableAmount,
          gstAmount: financials.gstAmount,
          totalAmount: financials.totalAmount,
        };
        return updated;
      } else {
        const financials = calculateItemFinancials(
          product.unitPrice,
          quantity,
          product.gstRate,
          'percent',
          0
        );

        const newItem: CartItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          product,
          quantity,
          unitPrice: product.unitPrice,
          discountType: 'percent',
          discountValue: 0,
          taxableAmount: financials.taxableAmount,
          gstAmount: financials.gstAmount,
          totalAmount: financials.totalAmount,
        };
        return [...prevCart, newItem];
      }
    });
  }, []);

  // Update item quantity
  const handleUpdateQuantity = useCallback(
    (itemId: string, newQty: number) => {
      if (newQty <= 0) {
        handleRemoveItem(itemId);
        return;
      }

      setCart((prevCart) =>
        prevCart.map((item) => {
          if (item.id === itemId) {
            const financials = calculateItemFinancials(
              item.unitPrice,
              newQty,
              item.product.gstRate,
              item.discountType,
              item.discountValue
            );
            return {
              ...item,
              quantity: newQty,
              taxableAmount: financials.taxableAmount,
              gstAmount: financials.gstAmount,
              totalAmount: financials.totalAmount,
            };
          }
          return item;
        })
      );
    },
    [cart]
  );

  // Remove single item
  const handleRemoveItem = useCallback((itemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  }, []);

  // Update item discount
  const handleUpdateItemDiscount = useCallback(
    (itemId: string, type: 'percent' | 'fixed', value: number) => {
      setCart((prevCart) =>
        prevCart.map((item) => {
          if (item.id === itemId) {
            const financials = calculateItemFinancials(
              item.unitPrice,
              item.quantity,
              item.product.gstRate,
              type,
              value
            );
            return {
              ...item,
              discountType: type,
              discountValue: value,
              taxableAmount: financials.taxableAmount,
              gstAmount: financials.gstAmount,
              totalAmount: financials.totalAmount,
            };
          }
          return item;
        })
      );
    },
    []
  );

  // Clear active cart
  const handleClearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setBillDiscount({ type: 'percent', value: 0, reason: '' });
  };

  // Hold active cart
  const handleHoldCart = () => {
    if (cart.length === 0) return;

    const newHoldCart: HoldCart = {
      id: `hold-${Date.now()}`,
      name: selectedCustomer?.name
        ? `${selectedCustomer.name} (${cart.length} items)`
        : `Bill #${holdCarts.length + 1} (${cart.length} items)`,
      items: [...cart],
      customer: selectedCustomer,
      billDiscount: { ...billDiscount },
      timestamp: Date.now(),
      totalAmount: calculation.grandTotal,
      itemCount: cart.reduce((acc, it) => acc + it.quantity, 0),
    };

    setHoldCarts((prev) => [newHoldCart, ...prev]);
    posAudio.playScanBeep();
    handleClearCart();
  };

  // Resume a held cart
  const handleResumeCart = (holdCartId: string) => {
    const target = holdCarts.find((c) => c.id === holdCartId);
    if (!target) return;

    setCart(target.items);
    setSelectedCustomer(target.customer);
    setBillDiscount(target.billDiscount);
    setHoldCarts((prev) => prev.filter((c) => c.id !== holdCartId));
    setActiveTab('list');
  };

  // Delete held cart
  const handleDeleteHoldCart = (holdCartId: string) => {
    setHoldCarts((prev) => prev.filter((c) => c.id !== holdCartId));
  };

  // Save new customer
  const handleSaveNewCustomer = (newCustomer: Customer) => {
    setCustomers((prev) => {
      const exists = prev.some((c) => c.phone === newCustomer.phone);
      if (exists) {
        return prev.map((c) => (c.phone === newCustomer.phone ? newCustomer : c));
      }
      return [newCustomer, ...prev];
    });
  };

  // Delete customer
  const handleDeleteCustomer = (customerId: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    if (selectedCustomer && selectedCustomer.id === customerId) {
      setSelectedCustomer(null);
    }
  };

  // Save or update product in catalog & synchronize cart
  const handleSaveProduct = (savedProd: Product) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === savedProd.id);
      if (exists) {
        return prev.map((p) => (p.id === savedProd.id ? savedProd : p));
      }
      return [savedProd, ...prev];
    });

    // Synchronize active cart item if this product was updated
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === savedProd.id) {
          const financials = calculateItemFinancials(
            savedProd.unitPrice,
            item.quantity,
            savedProd.gstRate,
            item.discountType,
            item.discountValue
          );
          return {
            ...item,
            product: savedProd,
            unitPrice: savedProd.unitPrice,
            taxableAmount: financials.taxableAmount,
            gstAmount: financials.gstAmount,
            totalAmount: financials.totalAmount,
          };
        }
        return item;
      })
    );
  };

  // Complete payment and generate digital invoice
  const handleCompletePayment = (paymentData: {
    method: PaymentMethod;
    status: PaymentStatus;
    details: Invoice['paymentDetails'];
  }) => {
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      customer: selectedCustomer || {
        id: 'walk-in',
        name: 'Walk-in Customer',
        phone: '9999999999',
        countryCode: '+91',
        loyaltyPoints: 0,
        totalSpent: 0,
        ordersCount: 0,
      },
      items: [...cart],
      subtotal: calculation.subtotal,
      totalTax: calculation.totalTax,
      totalTaxable: calculation.totalTaxable,
      cgst: calculation.cgst,
      sgst: calculation.sgst,
      igst: calculation.igst,
      billDiscount: { ...billDiscount },
      billDiscountAmount: calculation.billDiscountAmount,
      itemDiscountsTotal: calculation.itemDiscountsTotal,
      roundOff: calculation.roundOff,
      grandTotal: calculation.grandTotal,
      paymentMethod: paymentData.method,
      paymentStatus: paymentData.status,
      paymentDetails: paymentData.details,
      cashierName,
      whatsappDispatchStatus: 'not_sent',
    };

    setInvoices((prev) => [newInvoice, ...prev]);

    // Update customer spend & loyalty
    if (selectedCustomer && selectedCustomer.id !== 'walk-in') {
      const pointsEarned = Math.floor(calculation.grandTotal / 100);
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === selectedCustomer.id) {
            return {
              ...c,
              totalSpent: c.totalSpent + calculation.grandTotal,
              ordersCount: c.ordersCount + 1,
              loyaltyPoints: c.loyaltyPoints + pointsEarned,
            };
          }
          return c;
        })
      );
    }

    // Decrement stock in catalog
    setProducts((prev) =>
      prev.map((p) => {
        const cartMatch = cart.find((item) => item.product.id === p.id);
        if (cartMatch) {
          return {
            ...p,
            stock: Math.max(0, p.stock - cartMatch.quantity),
          };
        }
        return p;
      })
    );

    setIsPaymentModalOpen(false);
    setCurrentInvoice(newInvoice);
    setIsInvoiceModalOpen(true);
    handleClearCart();
  };

  // Update WhatsApp status
  const handleUpdateWhatsAppStatus = (invoiceId: string, status: 'sent' | 'failed') => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? { ...inv, whatsappDispatchStatus: status } : inv))
    );
    if (currentInvoice && currentInvoice.id === invoiceId) {
      setCurrentInvoice({ ...currentInvoice, whatsappDispatchStatus: status });
    }
  };

  // Hotkeys handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('add');
      } else if (e.key === 'F4' && cart.length > 0) {
        e.preventDefault();
        setIsPaymentModalOpen(true);
      } else if (e.key === 'Escape') {
        setIsPaymentModalOpen(false);
        setIsInvoiceModalOpen(false);
        setIsHoldBillsModalOpen(false);
        setIsSalesHistoryModalOpen(false);
        setIsInventoryModalOpen(false);
        setIsSettingsModalOpen(false);
        setQuickAddBarcode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  return (
    <div id="quickpos-app-root" className="min-h-screen py-4 sm:py-8 px-2 sm:px-4 flex items-center justify-center font-sans">
      {/* Main Centered Mobile/Compact Card Container matching the Reference UI Screenshot */}
      <div className="w-full max-w-xl bg-[#0c1427] border border-[#1b2b48] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <Navbar
          settings={settings}
          cashierName={cashierName}
          heldCartsCount={holdCarts.length}
          todaySalesCount={invoices.length}
          onOpenHoldBills={() => setIsHoldBillsModalOpen(true)}
          onOpenSalesHistory={() => setIsSalesHistoryModalOpen(true)}
          onOpenInventory={() => setIsInventoryModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onToggleSound={() => setIsSoundEnabled(!isSoundEnabled)}
          isSoundEnabled={isSoundEnabled}
        />

        {/* 5 Segmented Tabs matching Reference UI */}
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          cartItemCount={cart.reduce((acc, it) => acc + it.quantity, 0)}
          customerSelected={Boolean(selectedCustomer)}
        />

        {/* Tab Body View */}
        <main className="p-4 sm:p-5 flex-1 min-h-[460px] flex flex-col justify-between">
          {activeTab === 'add' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Customer quick select bar */}
              <CustomerInput
                customer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
                customersList={customers}
                onSaveNewCustomer={handleSaveNewCustomer}
                onDeleteCustomer={handleDeleteCustomer}
              />

              {/* Barcode scanner & Product Catalog */}
              <BarcodeScanner
                products={products}
                onAddToCart={(prod, qty) => {
                  handleAddToCart(prod, qty);
                }}
                onOpenQuickAddProduct={(code) => setQuickAddBarcode(code)}
                onOpenAddProduct={() => {
                  setProductToEdit(null);
                  setIsProductFormOpen(true);
                }}
                onEditProduct={(prod) => {
                  setProductToEdit(prod);
                  setIsProductFormOpen(true);
                }}
                onViewBarcode={handleOpenBarcodeViewer}
                currencySymbol={settings.currencySymbol}
              />
            </div>
          )}

          {activeTab === 'list' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <CartSummary
                cart={cart}
                customer={selectedCustomer}
                billDiscount={billDiscount}
                calculation={calculation}
                currencySymbol={settings.currencySymbol}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onUpdateItemDiscount={handleUpdateItemDiscount}
                onUpdateBillDiscount={setBillDiscount}
                onClearCart={handleClearCart}
                onHoldCart={handleHoldCart}
                onProceedToPayment={() => setIsPaymentModalOpen(true)}
              />
            </div>
          )}

          {activeTab === 'total' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center pb-2">
                <h3 className="font-extrabold text-base text-slate-100">Checkout &amp; Billing</h3>
                <p className="text-xs text-slate-400">Review total amounts &amp; finalize transaction</p>
              </div>

              <CartSummary
                cart={cart}
                customer={selectedCustomer}
                billDiscount={billDiscount}
                calculation={calculation}
                currencySymbol={settings.currencySymbol}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onUpdateItemDiscount={handleUpdateItemDiscount}
                onUpdateBillDiscount={setBillDiscount}
                onClearCart={handleClearCart}
                onHoldCart={handleHoldCart}
                onProceedToPayment={() => setIsPaymentModalOpen(true)}
              />
            </div>
          )}

          {activeTab === 'people' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center pb-1">
                <h3 className="font-extrabold text-base text-slate-100">Customer Identification</h3>
                <p className="text-xs text-slate-400">Link customer phone for WhatsApp receipt</p>
              </div>

              <CustomerInput
                customer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
                customersList={customers}
                onSaveNewCustomer={handleSaveNewCustomer}
                onDeleteCustomer={handleDeleteCustomer}
              />

              {/* Customers History List */}
              <div className="pt-2">
                <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono block mb-2">
                  SAVED CUSTOMERS ({customers.length})
                </span>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {customers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCustomer(c)}
                      className="bg-[#0b1325] hover:bg-[#101b33] border border-[#1a2b47] hover:border-blue-500/50 rounded-2xl p-3 flex items-center justify-between cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center font-mono shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-100 truncate">{c.name}</h4>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{c.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-[11px] font-mono text-blue-400 font-bold block">
                            {settings.currencySymbol}
                            {c.totalSpent}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {c.ordersCount} visits
                          </span>
                        </div>
                        {c.id !== 'walk-in' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCustomer(c.id);
                            }}
                            title="Delete Customer Details"
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center pb-1">
                <h3 className="font-extrabold text-base text-slate-100">Recent Sales Ledger</h3>
                <p className="text-xs text-slate-400">View and resend digital receipts</p>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {invoices.length > 0 ? (
                  invoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => {
                        setCurrentInvoice(inv);
                        setIsInvoiceModalOpen(true);
                      }}
                      className="bg-[#0b1325] hover:bg-[#101b33] border border-[#1a2b47] hover:border-blue-500/50 rounded-2xl p-3 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs font-mono text-blue-400">
                            #{inv.invoiceNumber}
                          </span>
                          <span className="text-xs font-medium text-slate-200">
                            {inv.customer.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {new Date(inv.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          • <span className="uppercase">{inv.paymentMethod}</span>
                        </div>
                      </div>
                      <span className="font-bold text-xs font-mono text-slate-100">
                        {settings.currencySymbol}
                        {inv.grandTotal.toFixed(2)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    No sales recorded yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Footer matching the Reference UI */}
          <footer className="mt-5 pt-3 border-t border-[#1b2b48] text-center">
            <p className="text-[11px] font-bold text-slate-500 tracking-wider font-mono">
              SYNCED WITH UPI &amp; WHATSAPP • MADE WITH <span className="text-rose-500">❤️</span>
            </p>
          </footer>
        </main>
      </div>

      {/* MODALS */}
      {/* 1. Payment Modal with Dynamic UPI QR & Multi-modes */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        calculation={calculation}
        customer={selectedCustomer}
        settings={settings}
        onCompletePayment={handleCompletePayment}
      />

      {/* 2. Digital Tax Invoice & WhatsApp Dispatch Modal */}
      <InvoiceModal
        invoice={currentInvoice}
        settings={settings}
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onUpdateWhatsAppStatus={handleUpdateWhatsAppStatus}
        onViewBarcode={handleOpenBarcodeViewer}
      />

      {/* 3. Parked / Held Bills Queue Modal */}
      <HoldBillsModal
        isOpen={isHoldBillsModalOpen}
        onClose={() => setIsHoldBillsModalOpen(false)}
        holdCarts={holdCarts}
        onResumeCart={handleResumeCart}
        onDeleteHoldCart={handleDeleteHoldCart}
        currencySymbol={settings.currencySymbol}
      />

      {/* 4. Sales History & WhatsApp Ledger Modal */}
      <SalesHistoryModal
        isOpen={isSalesHistoryModalOpen}
        onClose={() => setIsSalesHistoryModalOpen(false)}
        invoices={invoices}
        settings={settings}
        onSelectInvoice={(inv) => {
          setCurrentInvoice(inv);
          setIsInvoiceModalOpen(true);
        }}
      />

      {/* 5. Inventory & Barcode Master Modal */}
      <InventoryModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        products={products}
        onSaveProduct={handleSaveProduct}
        onDeleteProduct={(prodId) => {
          setProducts((prev) => prev.filter((p) => p.id !== prodId));
          setCart((prev) => prev.filter((item) => item.product.id !== prodId));
        }}
        currencySymbol={settings.currencySymbol}
        onViewBarcode={handleOpenBarcodeViewer}
      />

      {/* 6. Settings Modal (Store Profile, UPI ID, WhatsApp API keys) */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          setIsSoundEnabled(newSettings.enableBeepSound);
        }}
      />

      {/* 7. Quick Add Product for Unrecognized Barcode */}
      <QuickAddProductModal
        isOpen={Boolean(quickAddBarcode)}
        onClose={() => setQuickAddBarcode(null)}
        barcode={quickAddBarcode || ''}
        currencySymbol={settings.currencySymbol}
        onSaveProduct={(newProd) => {
          handleSaveProduct(newProd);
          handleAddToCart(newProd, 1);
          setQuickAddBarcode(null);
        }}
      />

      {/* 8. Full Product Add / Edit Modal */}
      <ProductFormModal
        isOpen={isProductFormOpen}
        product={productToEdit}
        onClose={() => {
          setIsProductFormOpen(false);
          setProductToEdit(null);
        }}
        onSaveProduct={(prod) => {
          handleSaveProduct(prod);
          setIsProductFormOpen(false);
          setProductToEdit(null);
        }}
        currencySymbol={settings.currencySymbol}
      />

      {/* 9. HD Barcode Viewer & PNG Downloader Modal */}
      <BarcodeViewerModal
        isOpen={Boolean(barcodeViewerData)}
        onClose={() => setBarcodeViewerData(null)}
        data={barcodeViewerData}
        currencySymbol={settings.currencySymbol}
      />
    </div>
  );
}
