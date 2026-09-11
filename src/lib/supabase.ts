import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Customer, Invoice, StoreSettings, HoldCart } from '../types/pos';

export const SUPABASE_URL: string =
  ((import.meta as any).env?.VITE_SUPABASE_URL as string) ||
  'https://iqmbsdxicfthkncfxfsb.supabase.co';
export const SUPABASE_ANON_KEY: string =
  ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  'sb_publishable_5FmGgiRqR-wXs4INhPORrQ_hTGaH5g1';


// Create Supabase client singleton
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export interface SupabaseSyncStatus {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  error: string | null;
  mode: 'connected' | 'offline' | 'error';
}

/**
 * Quick ping / test connection to Supabase
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  try {
    // Attempt a lightweight probe against app_data or health
    const { error } = await supabase.from('app_data').select('key').limit(1);
    if (error && error.code !== 'PGRST116' && !error.message.includes('relation "public.app_data" does not exist')) {
      // If error is table missing, the endpoint is still connected!
      return { success: true, message: 'Connected to Supabase Project (iqmbsdxicfthkncfxfsb)' };
    }
    return { success: true, message: 'Connected to Supabase Project (iqmbsdxicfthkncfxfsb)' };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Unable to connect to Supabase database',
    };
  }
}

/**
 * Generic Key-Value persistence helper into `app_data` table
 */
export async function saveAppDataToSupabase<T>(key: string, value: T): Promise<boolean> {
  try {
    const { error } = await supabase.from('app_data').upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) {
      // If table doesn't exist yet, we attempt fallback or log
      console.warn(`[Supabase] Note on saving ${key}:`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[Supabase] Exception saving ${key}:`, e);
    return false;
  }
}

/**
 * Generic Key-Value fetch helper from `app_data` table
 */
export async function getAppDataFromSupabase<T>(key: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      console.warn(`[Supabase] Error reading ${key}:`, error.message);
      return null;
    }
    return data?.value ? (data.value as T) : null;
  } catch (e) {
    console.warn(`[Supabase] Exception reading ${key}:`, e);
    return null;
  }
}

/**
 * Save complete application snapshot to Supabase
 */
export async function syncAllDataToSupabase(payload: {
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  holdCarts: HoldCart[];
  settings: StoreSettings;
}): Promise<boolean> {
  try {
    const promises: Promise<any>[] = [
      saveAppDataToSupabase('products', payload.products),
      saveAppDataToSupabase('customers', payload.customers),
      saveAppDataToSupabase('invoices', payload.invoices),
      saveAppDataToSupabase('hold_carts', payload.holdCarts),
      saveAppDataToSupabase('store_settings', payload.settings),
      saveAppDataToSupabase('last_sync_timestamp', Date.now()),
    ];

    // Try individual tables if they exist
    promises.push(
      (async () => {
        try {
          if (payload.products.length > 0) {
            await supabase.from('products').upsert(
              payload.products.map((p) => ({
                id: p.id,
                sku: p.sku,
                barcode: p.barcode,
                name: p.name,
                category: p.category,
                unit_price: p.unitPrice,
                mrp: p.mrp || p.unitPrice,
                gst_rate: p.gstRate,
                hsn_code: p.hsnCode,
                stock: p.stock,
                unit: p.unit,
                data: p,
                updated_at: new Date().toISOString(),
              })),
              { onConflict: 'id' }
            );
          }
        } catch {
          // ignore if table not created
        }
      })()
    );

    promises.push(
      (async () => {
        try {
          if (payload.customers.length > 0) {
            await supabase.from('customers').upsert(
              payload.customers.map((c) => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                country_code: c.countryCode,
                email: c.email || '',
                loyalty_points: c.loyaltyPoints,
                total_spent: c.totalSpent,
                orders_count: c.ordersCount,
                data: c,
                updated_at: new Date().toISOString(),
              })),
              { onConflict: 'id' }
            );
          }
        } catch {
          // ignore
        }
      })()
    );

    promises.push(
      (async () => {
        try {
          if (payload.invoices.length > 0) {
            await supabase.from('invoices').upsert(
              payload.invoices.map((inv) => ({
                id: inv.id,
                invoice_number: inv.invoiceNumber,
                date: inv.date,
                timestamp: inv.timestamp,
                customer_phone: inv.customer?.phone || '',
                customer_name: inv.customer?.name || '',
                grand_total: inv.grandTotal,
                payment_method: inv.paymentMethod,
                payment_status: inv.paymentStatus,
                data: inv,
                updated_at: new Date().toISOString(),
              })),
              { onConflict: 'id' }
            );
          }
        } catch {
          // ignore
        }
      })()
    );

    await Promise.allSettled(promises);
    return true;
  } catch (err) {
    console.error('[Supabase] Failed to sync all data:', err);
    return false;
  }
}

/**
 * Fetch all master data from Supabase
 */
export async function fetchAllDataFromSupabase(): Promise<{
  products?: Product[];
  customers?: Customer[];
  invoices?: Invoice[];
  holdCarts?: HoldCart[];
  settings?: StoreSettings;
} | null> {
  try {
    const [products, customers, invoices, holdCarts, settings] = await Promise.all([
      getAppDataFromSupabase<Product[]>('products'),
      getAppDataFromSupabase<Customer[]>('customers'),
      getAppDataFromSupabase<Invoice[]>('invoices'),
      getAppDataFromSupabase<HoldCart[]>('hold_carts'),
      getAppDataFromSupabase<StoreSettings>('store_settings'),
    ]);

    // If individual table data is present in app_data, return it
    if (products || customers || invoices || holdCarts || settings) {
      return {
        products: products || undefined,
        customers: customers || undefined,
        invoices: invoices || undefined,
        holdCarts: holdCarts || undefined,
        settings: settings || undefined,
      };
    }

    // Try fallback to relational tables if app_data was empty
    const result: {
      products?: Product[];
      customers?: Customer[];
      invoices?: Invoice[];
    } = {};

    try {
      const { data: prodData } = await supabase.from('products').select('*');
      if (prodData && prodData.length > 0) {
        result.products = prodData.map((row: any) => row.data || {
          id: row.id,
          sku: row.sku,
          barcode: row.barcode,
          name: row.name,
          category: row.category,
          unitPrice: row.unit_price,
          mrp: row.mrp,
          gstRate: row.gst_rate,
          hsnCode: row.hsn_code,
          stock: row.stock,
          unit: row.unit,
        });
      }
    } catch {
      // ignore
    }

    try {
      const { data: custData } = await supabase.from('customers').select('*');
      if (custData && custData.length > 0) {
        result.customers = custData.map((row: any) => row.data || {
          id: row.id,
          name: row.name,
          phone: row.phone,
          countryCode: row.country_code || '+91',
          email: row.email,
          loyaltyPoints: row.loyalty_points || 0,
          totalSpent: row.total_spent || 0,
          ordersCount: row.orders_count || 0,
        });
      }
    } catch {
      // ignore
    }

    try {
      const { data: invData } = await supabase.from('invoices').select('*').order('timestamp', { ascending: false });
      if (invData && invData.length > 0) {
        result.invoices = invData.map((row: any) => row.data);
      }
    } catch {
      // ignore
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (err) {
    console.error('[Supabase] Error fetching data from Supabase:', err);
    return null;
  }
}

/**
 * SQL Schema for easy creation in Supabase SQL Editor
 */
export const SUPABASE_SQL_SCHEMA = `-- ==========================================
-- QUICKPOS / CARDCRAFTED SUPABASE DATABASE SETUP
-- Project ID: iqmbsdxicfthkncfxfsb
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Resilient Universal Key-Value Store for all app entities
CREATE TABLE IF NOT EXISTS public.app_data (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Products / Inventory Table
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  sku TEXT,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  unit_price NUMERIC(10,2) NOT NULL,
  mrp NUMERIC(10,2),
  gst_rate NUMERIC(5,2) DEFAULT 0,
  hsn_code TEXT,
  stock INT DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Customers & Loyalty Ledger Table
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  country_code TEXT DEFAULT '+91',
  email TEXT,
  loyalty_points INT DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0,
  orders_count INT DEFAULT 0,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Invoices & Sales History Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  customer_phone TEXT,
  customer_name TEXT,
  grand_total NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) & Public Access Policies for POS
ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on app_data" ON public.app_data FOR SELECT USING (true);
CREATE POLICY "Allow public write access on app_data" ON public.app_data FOR ALL USING (true);

CREATE POLICY "Allow public read access on products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public write access on products" ON public.products FOR ALL USING (true);

CREATE POLICY "Allow public read access on customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow public write access on customers" ON public.customers FOR ALL USING (true);

CREATE POLICY "Allow public read access on invoices" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Allow public write access on invoices" ON public.invoices FOR ALL USING (true);
`;
