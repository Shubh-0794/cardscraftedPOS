import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { QrCodeViewerModal, QrCodeViewerData } from './components/QrCodeViewerModal';
import { CustomerPaymentPortal } from './components/CustomerPaymentPortal';
import { Trash2 } from 'lucide-react';
import {
  supabase,
  syncAllDataToSupabase,
  fetchAllDataFromSupabase,
  syncSingleInvoiceToSupabase,
  syncSingleProductToSupabase,
  syncSingleCustomerToSupabase,
  CLIENT_INSTANCE_ID,
} from './lib/supabase';

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

  // Cloud Sync State & Loop Prevention Flags
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [isCloudInitialized, setIsCloudInitialized] = useState<boolean>(false);
  const isRemoteUpdateRef = useRef<boolean>(false);


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
  const [barcodeViewerData, setBarcodeViewerData] = useState<QrCodeViewerData | null>(null);
  const [customerPaymentData, setCustomerPaymentData] = useState<{
    invoiceNumber: string;
    amount: number;
  } | null>(null);

  // Listen for direct URL routing (?view_invoice=... or ?pay=...&amt=120)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const viewInv = searchParams.get('view_invoice') || searchParams.get('invoice');
      const payInv = searchParams.get('pay');
      const payAmtStr = searchParams.get('amt');
      const payAmt = payAmtStr ? parseFloat(payAmtStr) : 0;

      if (viewInv) {
        // Find existing invoice or generate viewable invoice
        const cleanInv = viewInv.trim();
        const found = invoices.find(
          (i) => i.invoiceNumber.toLowerCase() === cleanInv.toLowerCase() || i.id === cleanInv
        );

        if (found) {
          setCurrentInvoice(found);
          setIsInvoiceModalOpen(true);
        } else {
          // Construct visual invoice if viewed in external customer device
          const fallbackInvoice: Invoice = {
            id: `inv-${cleanInv}`,
            invoiceNumber: cleanInv,
            date: new Date().toISOString(),
            timestamp: Date.now(),
            cashierName: 'Online POS',
            customer: {
              id: 'c-customer',
              name: 'Customer',
              phone: '',
              countryCode: '+91',
              loyaltyPoints: 0,
              totalSpent: payAmt || 120,
              ordersCount: 1,
            },
            items: [
              {
                id: `item-${cleanInv}`,
                product: {
                  id: 'p-retail',
                  name: 'Cardcrafted Goods / Gift Item',
                  unitPrice: payAmt || 120,
                  gstRate: 0,
                  category: 'Gifts & Cards',
                  stock: 50,
                  barcode: cleanInv,
                  sku: 'CARD-01',
                  unit: 'pcs',
                  hsnCode: '4819',
                },
                quantity: 1,
                unitPrice: payAmt || 120,
                discountType: 'fixed',
                discountValue: 0,
                taxableAmount: payAmt || 120,
                gstAmount: 0,
                totalAmount: payAmt || 120,
              },
            ],
            subtotal: payAmt || 120,
            itemDiscountsTotal: 0,
            billDiscount: { type: 'percent', value: 0 },
            billDiscountAmount: 0,
            totalTaxable: payAmt || 120,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalTax: 0,
            roundOff: 0,
            grandTotal: payAmt || 120,
            paymentMethod: 'upi',
            paymentStatus: 'success',
            paymentDetails: { upiRef: `UPI-${cleanInv}` },
            whatsappDispatchStatus: 'sent',
          };
          setCurrentInvoice(fallbackInvoice);
          setIsInvoiceModalOpen(true);
        }
      } else if (payInv) {
        setCustomerPaymentData({
          invoiceNumber: payInv.trim(),
          amount: payAmt > 0 ? payAmt : 120,
        });
      }
    } catch (e) {
      console.error('Failed to parse URL query params:', e);
    }
  }, [invoices]);

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

  // Cloud Hydration from Supabase on Initial App Mount
  useEffect(() => {
    let isMounted = true;

    async function loadCloudData() {
      try {
        setIsCloudSyncing(true);
        const cloudData = await fetchAllDataFromSupabase();

        if (!isMounted) return;

        if (cloudData) {
          isRemoteUpdateRef.current = true;
          if (cloudData.products && cloudData.products.length > 0) {
            setProducts(cloudData.products);
          }
          if (cloudData.customers && cloudData.customers.length > 0) {
            setCustomers(cloudData.customers);
          }
          if (cloudData.invoices && cloudData.invoices.length > 0) {
            setInvoices(cloudData.invoices);
          }
          if (cloudData.holdCarts) {
            setHoldCarts(cloudData.holdCarts);
          }
          if (cloudData.settings) {
            setSettings(cloudData.settings);
          }
        } else {
          // Cloud database is empty or new, push current catalog/settings to Supabase
          await syncAllDataToSupabase({
            products,
            customers,
            invoices,
            holdCarts,
            settings,
          });
        }
      } catch (err) {
        console.warn('[Supabase] Initial cloud sync note:', err);
      } finally {
        if (isMounted) {
          setIsCloudSyncing(false);
          setIsCloudInitialized(true);
        }
      }
    }

    loadCloudData();

    // Supabase Realtime Channel for live multi-tab & multi-device sync
    const realtimeChannel = supabase
      .channel('pos-cloud-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_data' },
        async (payload: any) => {
          // Prevent echo loop if this client tab authored the write
          if (payload?.new?.value?._client_id === CLIENT_INSTANCE_ID) {
            return;
          }

          try {
            const fresh = await fetchAllDataFromSupabase();
            if (fresh && isMounted) {
              isRemoteUpdateRef.current = true;
              if (fresh.products) setProducts(fresh.products);
              if (fresh.customers) setCustomers(fresh.customers);
              if (fresh.invoices) setInvoices(fresh.invoices);
              if (fresh.holdCarts) setHoldCarts(fresh.holdCarts);
              if (fresh.settings) setSettings(fresh.settings);
            }
          } catch (e) {
            console.error('Error handling realtime update:', e);
          }
        }
      )
      .subscribe();

    // Auto-sync when coming back online
    const handleOnline = () => {
      syncAllDataToSupabase({
        products,
        customers,
        invoices,
        holdCarts,
        settings,
      }).catch((e) => console.warn('[Supabase] Online flush note:', e));
    };

    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      supabase.removeChannel(realtimeChannel);
    };
  }, []);

  // Persistence Effects (Local Cache)
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

  // Continuous Cloud Sync Effect (Debounced Supabase Cloud Persistence with loop protection)
  useEffect(() => {
    if (!isCloudInitialized) return;

    // If this state update was received from a remote client, skip re-pushing
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setIsCloudSyncing(true);
        await syncAllDataToSupabase({
          products,
          customers,
          invoices,
          holdCarts,
          settings,
        });
      } catch (e) {
        console.warn('[Supabase] Background sync notice:', e);
      } finally {
        setIsCloudSyncing(false);
      }
    }, 1200);

    return () => clearTimeout(timeout);
  }, [products, settings, customers, invoices, holdCarts, isCloudInitialized]);

  // Manual Trigger to Push All Data to Supabase
  const handleManualSyncToCloud = useCallback(async () => {
    try {
      setIsCloudSyncing(true);
      const res = await syncAllDataToSupabase({
        products,
        customers,
        invoices,
        holdCarts,
        settings,
      });
      return res.success;
    } catch (e) {
      console.error('Manual sync failed:', e);
      return false;
    } finally {
      setIsCloudSyncing(false);
    }
  }, [products, customers, invoices, holdCarts, settings]);

  // Manual Trigger to Pull All Data from Supabase
  const handleManualPullFromCloud = useCallback(async () => {
    try {
      setIsCloudSyncing(true);
      const fresh = await fetchAllDataFromSupabase();
      if (fresh) {
        if (fresh.products && fresh.products.length > 0) setProducts(fresh.products);
        if (fresh.customers && fresh.customers.length > 0) setCustomers(fresh.customers);
        if (fresh.invoices && fresh.invoices.length > 0) setInvoices(fresh.invoices);
        if (fresh.holdCarts) setHoldCarts(fresh.holdCarts);
        if (fresh.settings) setSettings(fresh.settings);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Manual pull failed:', e);
      return false;
    } finally {
      setIsCloudSyncing(false);
    }
  }, []);


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
    let nextCustomers: Customer[] = [];
    setCustomers((prev) => {
      const exists = prev.some((c) => c.phone === newCustomer.phone);
      if (exists) {
        nextCustomers = prev.map((c) => (c.phone === newCustomer.phone ? newCustomer : c));
      } else {
        nextCustomers = [newCustomer, ...prev];
      }
      return nextCustomers;
    });
    // Immediately persist to Supabase relational table and app_data snapshot
    syncSingleCustomerToSupabase(newCustomer, nextCustomers).catch((err) =>
      console.warn('[Supabase] Direct customer save note:', err)
    );
  };

  // Delete customer
  const handleDeleteCustomer = (customerId: string) => {
    setCustomers((prev) => {
      const filtered = prev.filter((c) => c.id !== customerId);
      syncAllDataToSupabase({
        products,
        customers: filtered,
        invoices,
        holdCarts,
        settings,
      }).catch(console.warn);
      return filtered;
    });
    if (selectedCustomer && selectedCustomer.id === customerId) {
      setSelectedCustomer(null);
    }
  };

  // Save or update product in catalog & synchronize cart
  const handleSaveProduct = (savedProd: Product) => {
    let nextProducts: Product[] = [];
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === savedProd.id);
      if (exists) {
        nextProducts = prev.map((p) => (p.id === savedProd.id ? savedProd : p));
      } else {
        nextProducts = [savedProd, ...prev];
      }
      return nextProducts;
    });

    // Immediately persist to Supabase
    syncSingleProductToSupabase(savedProd, nextProducts).catch((err) =>
      console.warn('[Supabase] Direct product save note:', err)
    );

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

    const nextInvoices = [newInvoice, ...invoices];
    setInvoices(nextInvoices);

    // Immediately persist invoice directly to Supabase
    syncSingleInvoiceToSupabase(newInvoice, nextInvoices).catch((err) =>
      console.warn('[Supabase] Direct invoice save note:', err)
    );

    // Update customer spend & loyalty
    if (selectedCustomer && selectedCustomer.id !== 'walk-in') {
      const pointsEarned = Math.floor(calculation.grandTotal / 100);
      const updatedCustomer: Customer = {
        ...selectedCustomer,
        totalSpent: selectedCustomer.totalSpent + calculation.grandTotal,
        ordersCount: selectedCustomer.ordersCount + 1,
        loyaltyPoints: selectedCustomer.loyaltyPoints + pointsEarned,
      };

      const nextCusts = customers.map((c) => (c.id === selectedCustomer.id ? updatedCustomer : c));
      setCustomers(nextCusts);

      syncSingleCustomerToSupabase(updatedCustomer, nextCusts).catch((err) =>
        console.warn('[Supabase] Direct customer update note:', err)
      );
    }

    // Decrement stock in catalog and sync updated products
    const nextProds = products.map((p) => {
      const cartMatch = cart.find((item) => item.product.id === p.id);
      if (cartMatch) {
        const updatedProd: Product = {
          ...p,
          stock: Math.max(0, p.stock - cartMatch.quantity),
        };
        syncSingleProductToSupabase(updatedProd).catch((err) =>
          console.warn('[Supabase] Direct product stock sync note:', err)
        );
        return updatedProd;
      }
      return p;
    });
    setProducts(nextProds);

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
          isSyncing={isCloudSyncing}
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

              {/* Barcode / QR scanner & Product Catalog */}
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
                settings={settings}
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

      {/* 5. Inventory & QR Master Modal */}
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
        settings={settings}
        onViewBarcode={handleOpenBarcodeViewer}
      />

      {/* 6. Settings Modal (Store Profile, UPI ID, Supabase Cloud DB) */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          setIsSoundEnabled(newSettings.enableBeepSound);
        }}
        productsCount={products.length}
        customersCount={customers.length}
        invoicesCount={invoices.length}
        onSyncAllToCloud={handleManualSyncToCloud}
        onPullAllFromCloud={handleManualPullFromCloud}
        isSyncing={isCloudSyncing}
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

      {/* 9. HD QR Code Viewer & PNG Downloader Modal */}
      <QrCodeViewerModal
        isOpen={Boolean(barcodeViewerData)}
        onClose={() => setBarcodeViewerData(null)}
        data={barcodeViewerData}
        currencySymbol={settings.currencySymbol}
      />

      {/* 10. Customer Interactive Online Payment Portal (for ?pay=INV-...&amt=120) */}
      {customerPaymentData && (
        <CustomerPaymentPortal
          invoiceNumber={customerPaymentData.invoiceNumber}
          amount={customerPaymentData.amount}
          settings={settings}
          onClose={() => setCustomerPaymentData(null)}
        />
      )}
    </div>
  );
}
