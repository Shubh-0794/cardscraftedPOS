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
import { EditCustomerModal } from './components/EditCustomerModal';
import { Trash2, Edit2, Crown, Calendar, TrendingUp, ArrowUpDown, History, ExternalLink, AlertTriangle, X } from 'lucide-react';
import {
  supabase,
  syncAllDataToSupabase,
  fetchAllDataFromSupabase,
  syncSingleInvoiceToSupabase,
  syncSingleProductToSupabase,
  syncSingleCustomerToSupabase,
  deleteCustomerFromSupabase,
  deleteProductFromSupabase,
  saveAppDataToSupabase,
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
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [barcodeViewerData, setBarcodeViewerData] = useState<QrCodeViewerData | null>(null);
  const [customerPaymentData, setCustomerPaymentData] = useState<{
    invoiceNumber: string;
    amount: number;
  } | null>(null);

  // History tab filtering and sorting
  const [historyTabRange, setHistoryTabRange] = useState<'today' | 'weekly' | 'monthly' | 'yearly' | 'all'>('today');
  const [historyTabSort, setHistoryTabSort] = useState<'date-desc' | 'amount-desc'>('date-desc');

  // Identify highest purchase customer for People tab
  const highestSpenderCustomer = useMemo(() => {
    const eligible = customers.filter(
      (c) => c.id !== 'walk-in' && (c.totalSpent || 0) > 0
    );
    if (eligible.length === 0) return null;
    return eligible.reduce(
      (prev, curr) => ((curr.totalSpent || 0) > (prev.totalSpent || 0) ? curr : prev),
      eligible[0]
    );
  }, [customers]);

  // Compute Today's Daily Sale metrics
  const todaySalesMetrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayInvoices = invoices.filter(
      (inv) => new Date(inv.timestamp).getTime() >= todayStart
    );
    const total = todayInvoices.reduce((acc, inv) => acc + inv.grandTotal, 0);
    return {
      total,
      count: todayInvoices.length,
    };
  }, [invoices]);

  // Filtered invoices for the History Tab
  const filteredHistoryInvoices = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const oneYearAgo = now.getTime() - 365 * 24 * 60 * 60 * 1000;

    const list = invoices.filter((inv) => {
      const invTime = new Date(inv.timestamp).getTime();
      if (historyTabRange === 'today' && invTime < todayStart) return false;
      if (historyTabRange === 'weekly' && invTime < oneWeekAgo) return false;
      if (historyTabRange === 'monthly' && invTime < oneMonthAgo) return false;
      if (historyTabRange === 'yearly' && invTime < oneYearAgo) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (historyTabSort === 'amount-desc') {
        return b.grandTotal - a.grandTotal;
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [invoices, historyTabRange, historyTabSort]);

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
          // Intelligently preserve held carts on reload
          const localSavedHold = localStorage.getItem('nexus_pos_hold_carts');
          const localHoldList: HoldCart[] = localSavedHold ? JSON.parse(localSavedHold) : [];
          const mergedHoldCarts =
            cloudData.holdCarts && cloudData.holdCarts.length > 0
              ? cloudData.holdCarts
              : localHoldList;
          setHoldCarts(mergedHoldCarts);
          localStorage.setItem('nexus_pos_hold_carts', JSON.stringify(mergedHoldCarts));

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


  // Stock alert toast state
  const [stockAlert, setStockAlert] = useState<{
    message: string;
    productName?: string;
    maxStock?: number;
    requested?: number;
  } | null>(null);

  const triggerStockAlert = useCallback(
    (message: string, productName?: string, maxStock?: number, requested?: number) => {
      posAudio.playStockAlertSound();
      setStockAlert({ message, productName, maxStock, requested });
      setTimeout(() => {
        setStockAlert((current) => (current?.message === message ? null : current));
      }, 4500);
    },
    []
  );

  // Audio initialization
  useEffect(() => {
    posAudio.setEnabled(isSoundEnabled);
  }, [isSoundEnabled]);

  // Financial calculations
  const calculation = useMemo(() => {
    return calculateCartTotals(cart, billDiscount, false);
  }, [cart, billDiscount]);

  // Add item to cart with strict stock limit validation & audio alert
  const handleAddToCart = useCallback(
    (product: Product, quantity: number = 1) => {
      const maxStock = typeof product.stock === 'number' ? Math.max(0, product.stock) : 999;

      if (maxStock <= 0) {
        triggerStockAlert(
          `Out of Stock: "${product.name}" has 0 units in stock! Cannot add to bill.`,
          product.name,
          0,
          quantity
        );
        return;
      }

      setCart((prevCart) => {
        const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);

        if (existingIndex > -1) {
          const existing = prevCart[existingIndex];
          const requestedTotal = existing.quantity + quantity;

          if (requestedTotal > maxStock) {
            const availableRemaining = Math.max(0, maxStock - existing.quantity);
            if (availableRemaining <= 0) {
              triggerStockAlert(
                `Stock limit reached! Only ${maxStock} units of "${product.name}" available. All ${maxStock} units are already in your cart.`,
                product.name,
                maxStock,
                requestedTotal
              );
              return prevCart;
            }

            triggerStockAlert(
              `Cannot add ${quantity} more units! Only ${maxStock} units of "${product.name}" in stock (${existing.quantity} in cart). Added remaining ${availableRemaining}.`,
              product.name,
              maxStock,
              requestedTotal
            );

            const newQty = maxStock;
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
          }

          const newQty = requestedTotal;
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
          if (quantity > maxStock) {
            triggerStockAlert(
              `Cannot select ${quantity} units! Only ${maxStock} in stock for "${product.name}". Added ${maxStock} max units.`,
              product.name,
              maxStock,
              quantity
            );
          }

          const allowedQty = Math.min(quantity, maxStock);
          const financials = calculateItemFinancials(
            product.unitPrice,
            allowedQty,
            product.gstRate,
            'percent',
            0
          );

          const newItem: CartItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            product,
            quantity: allowedQty,
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
    },
    [triggerStockAlert]
  );

  // Remove single item
  const handleRemoveItem = useCallback((itemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  }, []);

  // Update item quantity with strict stock limit validation & audio alert
  const handleUpdateQuantity = useCallback(
    (itemId: string, newQty: number) => {
      if (newQty <= 0) {
        handleRemoveItem(itemId);
        return;
      }

      setCart((prevCart) =>
        prevCart.map((item) => {
          if (item.id === itemId) {
            const maxStock = typeof item.product.stock === 'number' ? Math.max(0, item.product.stock) : 999;
            let validatedQty = newQty;

            if (newQty > maxStock) {
              triggerStockAlert(
                `Stock limit exceeded! Cannot select ${newQty} units. Only ${maxStock} units of "${item.product.name}" are in stock!`,
                item.product.name,
                maxStock,
                newQty
              );
              validatedQty = maxStock;
            }

            const financials = calculateItemFinancials(
              item.unitPrice,
              validatedQty,
              item.product.gstRate,
              item.discountType,
              item.discountValue
            );
            return {
              ...item,
              quantity: validatedQty,
              taxableAmount: financials.taxableAmount,
              gstAmount: financials.gstAmount,
              totalAmount: financials.totalAmount,
            };
          }
          return item;
        })
      );
    },
    [handleRemoveItem, triggerStockAlert]
  );

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

    const nextHoldCarts = [newHoldCart, ...holdCarts];
    setHoldCarts(nextHoldCarts);
    localStorage.setItem('nexus_pos_hold_carts', JSON.stringify(nextHoldCarts));
    saveAppDataToSupabase('hold_carts', nextHoldCarts).catch((err) =>
      console.warn('[Supabase] Hold carts save note:', err)
    );

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

    const nextHoldCarts = holdCarts.filter((c) => c.id !== holdCartId);
    setHoldCarts(nextHoldCarts);
    localStorage.setItem('nexus_pos_hold_carts', JSON.stringify(nextHoldCarts));
    saveAppDataToSupabase('hold_carts', nextHoldCarts).catch((err) =>
      console.warn('[Supabase] Hold carts save note:', err)
    );

    setActiveTab('total');
  };

  // Delete held cart
  const handleDeleteHoldCart = (holdCartId: string) => {
    const nextHoldCarts = holdCarts.filter((c) => c.id !== holdCartId);
    setHoldCarts(nextHoldCarts);
    localStorage.setItem('nexus_pos_hold_carts', JSON.stringify(nextHoldCarts));
    saveAppDataToSupabase('hold_carts', nextHoldCarts).catch((err) =>
      console.warn('[Supabase] Hold carts save note:', err)
    );
  };

  // Save new customer
  const handleSaveNewCustomer = (newCustomer: Customer) => {
    let nextCustomers: Customer[] = [];
    setCustomers((prev) => {
      const exists = prev.some((c) => c.phone === newCustomer.phone || c.id === newCustomer.id);
      if (exists) {
        nextCustomers = prev.map((c) => (c.phone === newCustomer.phone || c.id === newCustomer.id ? newCustomer : c));
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

  // Update existing customer details
  const handleUpdateCustomer = (updatedCustomer: Customer) => {
    let nextCustomers: Customer[] = [];
    setCustomers((prev) => {
      nextCustomers = prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c));
      return nextCustomers;
    });

    if (selectedCustomer && selectedCustomer.id === updatedCustomer.id) {
      setSelectedCustomer(updatedCustomer);
    }

    // Immediately persist to Supabase relational table and app_data snapshot
    syncSingleCustomerToSupabase(updatedCustomer, nextCustomers).catch((err) =>
      console.warn('[Supabase] Direct customer update note:', err)
    );
  };

  // Delete customer from state and Supabase DB
  const handleDeleteCustomer = (customerId: string) => {
    let nextCustomers: Customer[] = [];
    setCustomers((prev) => {
      nextCustomers = prev.filter((c) => c.id !== customerId);
      return nextCustomers;
    });

    if (selectedCustomer && selectedCustomer.id === customerId) {
      setSelectedCustomer(null);
    }

    // Call dedicated Supabase delete function
    deleteCustomerFromSupabase(customerId, nextCustomers).catch((err) =>
      console.warn('[Supabase] Direct customer delete note:', err)
    );
  };

  // Delete product from state, cart and Supabase DB
  const handleDeleteProduct = (productId: string) => {
    let nextProducts: Product[] = [];
    setProducts((prev) => {
      nextProducts = prev.filter((p) => p.id !== productId);
      return nextProducts;
    });

    setCart((prev) => prev.filter((item) => item.product.id !== productId));

    // Call dedicated Supabase delete function
    deleteProductFromSupabase(productId, nextProducts).catch((err) =>
      console.warn('[Supabase] Direct product delete note:', err)
    );
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
    <div id="quickpos-app-root" className="min-h-screen p-0 sm:py-6 sm:px-4 flex items-center justify-center font-sans bg-[#060b16] relative">
      {/* Floating Stock Alert Toast */}
      {stockAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-linear-to-r from-rose-950 via-rose-900 to-amber-950 border-2 border-rose-500 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-rose-600/40 border border-rose-400/60 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-rose-300 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h5 className="font-bold text-xs text-rose-200 uppercase tracking-wide font-mono">Stock Limit Alert</h5>
              <p className="text-xs text-slate-100 font-medium truncate sm:whitespace-normal">
                {stockAlert.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStockAlert(null)}
            className="p-1 rounded-lg text-rose-300 hover:text-white hover:bg-rose-800/60 transition-colors shrink-0 cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Centered Mobile/Compact Card Container matching the Reference UI Screenshot */}
      <div className="w-full sm:max-w-xl bg-[#0c1427] sm:border sm:border-[#1b2b48] sm:rounded-3xl rounded-none border-0 shadow-2xl overflow-hidden flex flex-col min-h-screen sm:min-h-0">
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

        {/* 4 Segmented Tabs: ADD, TOTAL, PEOPLE, HISTORY */}
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          cartItemCount={cart.reduce((acc, it) => acc + it.quantity, 0)}
          customerSelected={Boolean(selectedCustomer)}
        />

        {/* Tab Body View */}
        <main className="p-3.5 sm:p-5 flex-1 min-h-[460px] flex flex-col justify-between">
          {activeTab === 'add' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Customer quick select bar */}
              <CustomerInput
                customer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
                customersList={customers}
                onSaveNewCustomer={handleSaveNewCustomer}
                onUpdateCustomer={handleUpdateCustomer}
                onDeleteCustomer={handleDeleteCustomer}
              />

              {/* Barcode / QR scanner & Product Catalog */}
              <BarcodeScanner
                products={products}
                cart={cart}
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
                onStockAlert={(msg) => triggerStockAlert(msg)}
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
                onStockAlert={(msg) => triggerStockAlert(msg)}
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
                onUpdateCustomer={handleUpdateCustomer}
                onDeleteCustomer={handleDeleteCustomer}
              />

              {/* Customers History List */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase font-mono block">
                    SAVED CUSTOMERS ({customers.length})
                  </span>
                  {highestSpenderCustomer && (
                    <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1">
                      <Crown className="w-3 h-3 fill-amber-400/40" /> Top Spender: {highestSpenderCustomer.name}
                    </span>
                  )}
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {customers.map((c) => {
                    const isTopCustomer = highestSpenderCustomer && c.id === highestSpenderCustomer.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCustomer(c)}
                        className={`border rounded-2xl p-3 flex items-center justify-between cursor-pointer transition-all group ${
                          isTopCustomer
                            ? 'bg-linear-to-r from-amber-950/30 via-[#0d1629] to-[#0b1325] border-amber-500/40 hover:border-amber-400/70 shadow-sm shadow-amber-950/20'
                            : 'bg-[#0b1325] hover:bg-[#101b33] border-[#1a2b47] hover:border-blue-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center font-mono shrink-0 ${
                              isTopCustomer
                                ? 'bg-linear-to-tr from-amber-600 to-yellow-400 text-slate-950 ring-2 ring-amber-400/60 shadow-md shadow-amber-500/20'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-xs text-slate-100 truncate">{c.name}</h4>
                              {isTopCustomer && (
                                <span className="text-[9px] text-amber-300 font-mono font-bold bg-amber-950/80 border border-amber-400/50 px-1.5 py-0.2 rounded-md flex items-center gap-0.5 shadow-xs">
                                  <Crown className="w-2.5 h-2.5 text-amber-400 fill-amber-400/40" />
                                  Top Customer
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{c.phone}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right mr-1 hidden xs:block">
                            <span className={`text-[11px] font-mono font-bold block ${
                              isTopCustomer ? 'text-amber-400' : 'text-blue-400'
                            }`}>
                              {settings.currencySymbol}
                              {c.totalSpent}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {c.ordersCount} visits
                            </span>
                          </div>
                          {c.id !== 'walk-in' && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCustomerToEdit(c);
                                }}
                                title="Edit Customer Details"
                                className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-blue-500/10 transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
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
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              {/* Daily Sale Stat Banner */}
              <div className="bg-linear-to-br from-blue-950/70 via-[#0d1c38] to-[#071124] border border-blue-500/40 rounded-2xl p-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300 font-mono flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    TODAY'S DAILY SALE
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="text-xl font-black text-slate-100 font-mono">
                    {settings.currencySymbol}
                    {todaySalesMetrics.total.toFixed(2)}
                  </div>
                  <div className="text-xs font-mono text-blue-300 font-bold bg-blue-600/30 px-2.5 py-0.5 rounded-lg border border-blue-400/30">
                    {todaySalesMetrics.count} {todaySalesMetrics.count === 1 ? 'Bill' : 'Bills'} Today
                  </div>
                </div>
              </div>

              {/* Time Range Filter & Sort Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-1 bg-[#090f1d] p-1 rounded-xl border border-[#1b2b48] text-xs">
                  {(['today', 'weekly', 'monthly', 'yearly', 'all'] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setHistoryTabRange(period)}
                      className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                        historyTabRange === period
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#13223f]'
                      }`}
                    >
                      {period === 'all' ? 'All Time' : period}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">Sort:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setHistoryTabSort(
                          historyTabSort === 'date-desc' ? 'amount-desc' : 'date-desc'
                        )
                      }
                      className="px-2 py-1 bg-[#090f1d] hover:bg-[#121f3b] border border-[#1b2b48] rounded-lg text-[10px] font-mono font-bold text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <ArrowUpDown className="w-3 h-3 text-blue-400" />
                      {historyTabSort === 'date-desc' ? 'Time (Newest)' : 'Amount (Highest)'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSalesHistoryModalOpen(true)}
                    className="px-2.5 py-1 bg-[#12203d] hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg text-[10px] font-bold font-mono flex items-center gap-1 border border-blue-500/30 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" /> Full Ledger
                  </button>
                </div>
              </div>

              {/* Invoices List */}
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {filteredHistoryInvoices.length > 0 ? (
                  filteredHistoryInvoices.map((inv) => {
                    const invDate = new Date(inv.timestamp);
                    const isToday =
                      invDate.toDateString() === new Date().toDateString();

                    return (
                      <div
                        key={inv.id}
                        onClick={() => {
                          setCurrentInvoice(inv);
                          setIsInvoiceModalOpen(true);
                        }}
                        className="bg-[#0b1325] hover:bg-[#101b33] border border-[#1a2b47] hover:border-blue-500/50 rounded-2xl p-3 flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs font-mono text-blue-400">
                              #{inv.invoiceNumber}
                            </span>
                            <span className="text-xs font-medium text-slate-200 truncate">
                              {inv.customer.name}
                            </span>
                            {isToday && (
                              <span className="px-1 py-0.2 bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold rounded">
                                TODAY
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>
                              {invDate.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span>•</span>
                            <span className="uppercase">{inv.paymentMethod}</span>
                            <span>•</span>
                            <span>{inv.items.length} items</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-xs font-mono text-slate-100 block">
                            {settings.currencySymbol}
                            {inv.grandTotal.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-blue-400 font-semibold group-hover:underline">
                            View Receipt &rarr;
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-10 text-center text-slate-500 text-xs bg-[#090f1d] rounded-2xl border border-[#1b2b48]">
                    <p className="font-semibold text-slate-400">No sales recorded for this period</p>
                    <button
                      type="button"
                      onClick={() => setHistoryTabRange('all')}
                      className="mt-2 text-blue-400 hover:underline text-[11px] font-bold"
                    >
                      Show All Time Invoices
                    </button>
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
        onDeleteProduct={handleDeleteProduct}
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

      {/* 10. Edit Customer Profile Modal */}
      <EditCustomerModal
        isOpen={Boolean(customerToEdit)}
        onClose={() => setCustomerToEdit(null)}
        customer={customerToEdit}
        onSave={(updated) => {
          handleUpdateCustomer(updated);
          setCustomerToEdit(null);
        }}
      />

      {/* 11. Customer Interactive Online Payment Portal (for ?pay=INV-...&amt=120) */}
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
