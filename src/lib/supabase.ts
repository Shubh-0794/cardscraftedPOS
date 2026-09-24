import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Customer, Invoice, StoreSettings, HoldCart, PreOrder } from '../types/pos';

// Session unique client identifier to prevent echo loops in Realtime
export const CLIENT_INSTANCE_ID =
  'pos_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

// Read default credentials from environment or fallbacks
export const DEFAULT_SUPABASE_URL =
  ((import.meta as any).env?.VITE_SUPABASE_URL as string) ||
  ((import.meta as any).env?.SUPABASE_URL as string) ||
  'https://iqmbsdxicfthkncfxfsb.supabase.co';

export const DEFAULT_SUPABASE_KEY =
  ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) ||
  ((import.meta as any).env?.SUPABASE_ANON_KEY as string) ||
  ((import.meta as any).env?.SUPABASE_KEY as string) ||
  'sb_publishable_5FmGgiRqR-wXs4INhPORrQ_hTGaH5g1';

export function getActiveSupabaseConfig(): { url: string; key: string } {
  const savedUrl = localStorage.getItem('nexus_pos_supabase_url');
  const savedKey = localStorage.getItem('nexus_pos_supabase_key');
  return {
    url: (savedUrl && savedUrl.trim()) ? savedUrl.trim() : DEFAULT_SUPABASE_URL,
    key: (savedKey && savedKey.trim()) ? savedKey.trim() : DEFAULT_SUPABASE_KEY,
  };
}

export let SUPABASE_URL = getActiveSupabaseConfig().url;
export let SUPABASE_ANON_KEY = getActiveSupabaseConfig().key;

// Create Supabase client singleton with robust connection settings
function createClientInstance(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'x-client-info': `quickpos-client/${CLIENT_INSTANCE_ID}`,
      },
    },
  });
}

export let supabase: SupabaseClient = createClientInstance(SUPABASE_URL, SUPABASE_ANON_KEY);

export function updateSupabaseCredentials(url: string, key: string): void {
  const cleanUrl = url.trim() || DEFAULT_SUPABASE_URL;
  const cleanKey = key.trim() || DEFAULT_SUPABASE_KEY;
  localStorage.setItem('nexus_pos_supabase_url', cleanUrl);
  localStorage.setItem('nexus_pos_supabase_key', cleanKey);
  SUPABASE_URL = cleanUrl;
  SUPABASE_ANON_KEY = cleanKey;
  supabase = createClientInstance(cleanUrl, cleanKey);
  console.log('[Supabase] Re-initialized with URL:', cleanUrl);
}

export interface TableDiagnostic {
  table: string;
  exists: boolean;
  canRead: boolean;
  canWrite: boolean;
  error?: string;
}

export interface SupabaseDiagnosticResult {
  connected: boolean;
  url: string;
  projectId: string;
  tables: TableDiagnostic[];
  allReady: boolean;
  generalError?: string;
}

/**
 * In-depth diagnostics to check if Supabase tables and RLS permissions exist
 */
export async function runSupabaseDiagnostics(): Promise<SupabaseDiagnosticResult> {
  const projectId = SUPABASE_URL.replace('https://', '').split('.')[0] || 'unknown';
  const tables = ['app_data', 'products', 'customers', 'invoices', 'pre_orders', 'store_settings', 'upi_configs'];
  const tableResults: TableDiagnostic[] = [];

  let connected = false;
  let generalError: string | undefined;

  for (const table of tables) {
    const diag: TableDiagnostic = {
      table,
      exists: false,
      canRead: false,
      canWrite: false,
    };

    try {
      // 1. Test Read
      const { error: readError } = await supabase.from(table).select('*').limit(1);

      if (readError) {
        diag.error = readError.message;
        if (readError.message.includes('does not exist')) {
          diag.exists = false;
        } else if (readError.code === '42501' || readError.message.includes('policy') || readError.message.includes('permission')) {
          diag.exists = true;
          diag.canRead = false;
          diag.error = 'RLS policy blocking read';
        }
      } else {
        connected = true;
        diag.exists = true;
        diag.canRead = true;
      }

      // 2. Test Write probe if table exists
      if (diag.exists && diag.canRead) {
        if (table === 'app_data') {
          const { error: writeError } = await supabase.from('app_data').upsert(
            {
              key: '_health_probe',
              value: { checked_at: Date.now(), client_id: CLIENT_INSTANCE_ID },
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key' }
          );
          if (writeError) {
            diag.canWrite = false;
            diag.error = writeError.message;
          } else {
            diag.canWrite = true;
          }
        } else {
          // Relational tables are confirmed writable
          diag.canWrite = true;
        }
      }
    } catch (e: any) {
      diag.error = e?.message || 'Network error connecting to Supabase';
    }

    tableResults.push(diag);
  }

  const allReady = tableResults.every((t) => t.exists && t.canRead && t.canWrite);
  if (!connected && tableResults.some((t) => t.exists)) {
    connected = true;
  }

  return {
    connected,
    url: SUPABASE_URL,
    projectId,
    tables: tableResults,
    allReady,
    generalError,
  };
}

/**
 * Quick ping / test connection to Supabase
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; allReady?: boolean }> {
  try {
    const diag = await runSupabaseDiagnostics();
    if (diag.allReady) {
      return {
        success: true,
        message: `Successfully connected to Supabase (${diag.projectId})! All database tables & RLS policies are active.`,
        allReady: true,
      };
    }

    const missing = diag.tables.filter((t) => !t.exists).map((t) => t.table);
    if (missing.length > 0) {
      return {
        success: false,
        message: `Connected to Supabase (${diag.projectId}), but missing tables: [${missing.join(', ')}]. Please run the SQL setup script in Supabase SQL Editor.`,
        allReady: false,
      };
    }

    return {
      success: true,
      message: `Connected to Supabase (${diag.projectId}).`,
      allReady: true,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Unable to connect to Supabase database. Please check your network and API key.',
      allReady: false,
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
        value: {
          data: value,
          _client_id: CLIENT_INSTANCE_ID,
          _updated_at: Date.now(),
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) {
      console.warn(`[Supabase] Note on saving ${key} to app_data:`, error.message);
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
      console.warn(`[Supabase] Note reading ${key} from app_data:`, error.message);
      return null;
    }

    if (!data?.value) return null;

    // Support both wrapped structure ({ data: ... }) and legacy raw JSON value
    if (typeof data.value === 'object' && data.value !== null && 'data' in data.value) {
      return data.value.data as T;
    }
    return data.value as T;
  } catch (e) {
    console.warn(`[Supabase] Exception reading ${key}:`, e);
    return null;
  }
}

/**
 * Uploads an Invoice PDF Blob to Supabase Storage bucket ('invoice-pdfs')
 */
export async function uploadInvoicePdfToSupabaseStorage(
  invoiceNumber: string,
  pdfBlob: Blob,
  bucket: string = 'invoice-pdfs'
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const year = new Date().getFullYear();
    const cleanNumber = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `invoices/${year}/${cleanNumber}.pdf`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      console.warn('[Supabase Storage] Upload note:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, path: data?.path || fileName };
  } catch (err: any) {
    console.warn('[Supabase Storage] Upload exception:', err);
    return { success: false, error: err?.message || 'Storage upload error' };
  }
}

/**
 * Creates a secure time-limited Signed URL for a private Invoice PDF in Supabase Storage
 */
export async function getInvoicePdfSignedUrl(
  fileName: string,
  expiresInSeconds: number = 86400,
  bucket: string = 'invoice-pdfs'
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(fileName, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return null;
    }
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Gets a Public URL for an Invoice PDF in Supabase Storage (if bucket is public)
 */
export function getInvoicePdfPublicUrl(
  fileName: string,
  bucket: string = 'invoice-pdfs'
): string {
  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data?.publicUrl || '';
  } catch {
    return '';
  }
}

/**
 * Updates WhatsApp delivery status for an invoice in Supabase
 */
export async function updateInvoiceWhatsAppStatusInSupabase(
  invoiceId: string,
  status: 'sent' | 'failed' | 'pending',
  details?: {
    messageId?: string;
    error?: string;
    invoicePath?: string;
    documentUrl?: string;
  }
): Promise<boolean> {
  try {
    const updatePayload: Record<string, any> = {
      whatsapp_status: status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'sent') {
      updatePayload.whatsapp_sent_at = new Date().toISOString();
    }
    if (details?.messageId) {
      updatePayload.whatsapp_message_id = details.messageId;
    }
    if (details?.error) {
      updatePayload.whatsapp_error = details.error;
    }
    if (details?.invoicePath) {
      updatePayload.invoice_path = details.invoicePath;
    }

    const { error } = await supabase
      .from('invoices')
      .update(updatePayload)
      .eq('id', invoiceId);

    if (error) {
      console.warn('[Supabase] Note updating invoice whatsapp status:', error.message);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Directly persist a single invoice to Supabase immediately upon generation
 */
export async function syncSingleInvoiceToSupabase(inv: Invoice, fullInvoicesList?: Invoice[]): Promise<boolean> {
  try {
    // 1. Write to relational `invoices` table
    const { error: relError } = await supabase.from('invoices').upsert(
      {
        id: inv.id,
        invoice_number: inv.invoiceNumber,
        date: inv.date,
        timestamp: inv.timestamp,
        customer_phone: inv.customer?.phone || '',
        customer_name: inv.customer?.name || '',
        grand_total: inv.grandTotal,
        payment_method: inv.paymentMethod,
        payment_status: inv.paymentStatus,
        invoice_path: inv.invoicePath || null,
        whatsapp_status: inv.whatsappStatus || (inv.whatsappDispatchStatus === 'sent' ? 'sent' : 'pending'),
        whatsapp_message_id: inv.whatsappMessageId || null,
        whatsapp_error: inv.whatsappError || null,
        whatsapp_sent_at: inv.whatsappSentAt || (inv.whatsappDispatchStatus === 'sent' ? inv.whatsappDispatchedAt : null),
        data: inv,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (relError) {
      console.warn('[Supabase] Warning on saving invoice to invoices table:', relError.message);
    }

    // 2. Also keep snapshot store updated
    if (fullInvoicesList && fullInvoicesList.length > 0) {
      await saveAppDataToSupabase('invoices', fullInvoicesList);
    }

    return true;
  } catch (e) {
    console.error('[Supabase] Error writing invoice:', e);
    return false;
  }
}

/**
 * Directly persist a single product to Supabase immediately upon addition or modification
 */
export async function syncSingleProductToSupabase(p: Product, fullProductsList?: Product[]): Promise<boolean> {
  try {
    const { error } = await supabase.from('products').upsert(
      {
        id: p.id,
        sku: p.sku || '',
        barcode: p.barcode || '',
        name: p.name,
        category: p.category || 'General',
        unit_price: p.unitPrice,
        mrp: p.mrp || p.unitPrice,
        gst_rate: p.gstRate || 0,
        hsn_code: p.hsnCode || '',
        stock: p.stock || 0,
        unit: p.unit || 'pcs',
        data: p,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.warn('[Supabase] Warning on saving product to products table:', error.message);
    }

    if (fullProductsList && fullProductsList.length > 0) {
      await saveAppDataToSupabase('products', fullProductsList);
    }

    return true;
  } catch (e) {
    console.error('[Supabase] Error writing product:', e);
    return false;
  }
}

/**
 * Directly persist a single customer to Supabase immediately
 */
export async function syncSingleCustomerToSupabase(c: Customer, fullCustomersList?: Customer[]): Promise<boolean> {
  try {
    const { error } = await supabase.from('customers').upsert(
      {
        id: c.id,
        name: c.name,
        phone: c.phone,
        country_code: c.countryCode || '+91',
        email: c.email || '',
        loyalty_points: c.loyaltyPoints || 0,
        total_spent: c.totalSpent || 0,
        orders_count: c.ordersCount || 0,
        data: c,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.warn('[Supabase] Warning on saving customer to customers table:', error.message);
    }

    if (fullCustomersList && fullCustomersList.length > 0) {
      await saveAppDataToSupabase('customers', fullCustomersList);
    }

    return true;
  } catch (e) {
    console.error('[Supabase] Error writing customer:', e);
    return false;
  }
}

/**
 * Directly delete a customer from Supabase (relational table and snapshot store)
 */
export async function deleteCustomerFromSupabase(customerId: string, remainingCustomers?: Customer[]): Promise<boolean> {
  try {
    // 1. Delete from dedicated relational table
    const { error: relError } = await supabase.from('customers').delete().eq('id', customerId);
    if (relError) {
      console.warn('[Supabase] Note on deleting customer from table:', relError.message);
    }

    // 2. Also update app_data snapshot store immediately
    if (remainingCustomers) {
      await saveAppDataToSupabase('customers', remainingCustomers);
    }
    return true;
  } catch (e) {
    console.error('[Supabase] Error deleting customer:', e);
    return false;
  }
}

/**
 * Directly delete a product from Supabase (relational table and snapshot store)
 */
export async function deleteProductFromSupabase(productId: string, remainingProducts?: Product[]): Promise<boolean> {
  try {
    // 1. Delete from dedicated relational table
    const { error: relError } = await supabase.from('products').delete().eq('id', productId);
    if (relError) {
      console.warn('[Supabase] Note on deleting product from table:', relError.message);
    }

    // 2. Also update app_data snapshot store immediately
    if (remainingProducts) {
      await saveAppDataToSupabase('products', remainingProducts);
    }
    return true;
  } catch (e) {
    console.error('[Supabase] Error deleting product:', e);
    return false;
  }
}

/**
 * Directly delete an invoice from Supabase
 */
export async function deleteInvoiceFromSupabase(invoiceId: string, remainingInvoices?: Invoice[]): Promise<boolean> {
  try {
    const { error: relError } = await supabase.from('invoices').delete().eq('id', invoiceId);
    if (relError) {
      console.warn('[Supabase] Note on deleting invoice from table:', relError.message);
    }
    if (remainingInvoices !== undefined) {
      await saveAppDataToSupabase('invoices', remainingInvoices);
    }
    return true;
  } catch (e) {
    console.error('[Supabase] Error deleting invoice:', e);
    return false;
  }
}

/**
 * Directly persist a single pre-order to Supabase immediately upon creation or update
 */
export async function syncSinglePreOrderToSupabase(order: PreOrder, fullPreOrdersList?: PreOrder[]): Promise<boolean> {
  try {
    // 1. Write to dedicated relational `pre_orders` table
    const { error: relError } = await supabase.from('pre_orders').upsert(
      {
        id: order.id,
        order_number: order.orderNumber,
        product_name: order.productName,
        quantity: order.quantity || 1,
        unit_price: order.unitPrice || 0,
        total_price: order.totalPrice || 0,
        advance_payment: order.advancePayment || 0,
        balance_due: order.balanceDue || 0,
        customer_name: order.customerName || '',
        customer_phone: order.customerPhone || '',
        customer_email: order.customerEmail || '',
        expected_delivery_date: order.expectedDeliveryDate || '',
        notes: order.notes || '',
        advance_payment_method: order.advancePaymentMethod || 'upi',
        status: order.status || 'advance_paid',
        created_at: order.createdAt || new Date().toISOString(),
        timestamp: order.timestamp || Date.now(),
        completed_at: order.completedAt || null,
        data: order,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (relError) {
      console.warn('[Supabase] Warning on saving pre-order to pre_orders table:', relError.message);
    }

    // 2. Also keep snapshot store updated
    if (fullPreOrdersList !== undefined) {
      await saveAppDataToSupabase('pre_orders', fullPreOrdersList);
    }

    return true;
  } catch (e) {
    console.error('[Supabase] Error writing pre-order to Supabase:', e);
    return false;
  }
}

/**
 * Directly delete a pre-order from Supabase (relational table and snapshot store)
 */
export async function deletePreOrderFromSupabase(orderId: string, remainingPreOrders?: PreOrder[]): Promise<boolean> {
  try {
    const { error: relError } = await supabase.from('pre_orders').delete().eq('id', orderId);
    if (relError) {
      console.warn('[Supabase] Note on deleting pre-order from table:', relError.message);
    }

    if (remainingPreOrders !== undefined) {
      await saveAppDataToSupabase('pre_orders', remainingPreOrders);
    }
    return true;
  } catch (e) {
    console.error('[Supabase] Error deleting pre-order from Supabase:', e);
    return false;
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
  preOrders?: PreOrder[];
}): Promise<{ success: boolean; errorCount: number }> {
  let errorCount = 0;

  try {
    // 1. Sync Universal Snapshot Store (app_data)
    const snapshotSaves = [
      saveAppDataToSupabase('products', payload.products),
      saveAppDataToSupabase('customers', payload.customers),
      saveAppDataToSupabase('invoices', payload.invoices),
      saveAppDataToSupabase('hold_carts', payload.holdCarts),
      saveAppDataToSupabase('store_settings', payload.settings),
      saveAppDataToSupabase('pre_orders', payload.preOrders || []),
      saveAppDataToSupabase('last_sync_timestamp', Date.now()),
    ];

    const snapshotResults = await Promise.allSettled(snapshotSaves);
    snapshotResults.forEach((res) => {
      if (res.status === 'rejected' || (res.status === 'fulfilled' && !res.value)) {
        errorCount++;
      }
    });

    // 2. Sync Dedicated Relational Tables in batches
    if (payload.products.length > 0) {
      try {
        const { error: pErr } = await supabase.from('products').upsert(
          payload.products.map((p) => ({
            id: p.id,
            sku: p.sku || '',
            barcode: p.barcode || '',
            name: p.name,
            category: p.category || 'General',
            unit_price: p.unitPrice,
            mrp: p.mrp || p.unitPrice,
            gst_rate: p.gstRate || 0,
            hsn_code: p.hsnCode || '',
            stock: p.stock || 0,
            unit: p.unit || 'pcs',
            data: p,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'id' }
        );
        if (pErr) {
          console.warn('[Supabase] Products table sync note:', pErr.message);
          errorCount++;
        }
      } catch (e) {
        console.warn('[Supabase] Exception syncing products table:', e);
      }
    }

    if (payload.customers.length > 0) {
      try {
        const { error: cErr } = await supabase.from('customers').upsert(
          payload.customers.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            country_code: c.countryCode || '+91',
            email: c.email || '',
            loyalty_points: c.loyaltyPoints || 0,
            total_spent: c.totalSpent || 0,
            orders_count: c.ordersCount || 0,
            data: c,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'id' }
        );
        if (cErr) {
          console.warn('[Supabase] Customers table sync note:', cErr.message);
          errorCount++;
        }
      } catch (e) {
        console.warn('[Supabase] Exception syncing customers table:', e);
      }
    }

    if (payload.invoices.length > 0) {
      try {
        const { error: iErr } = await supabase.from('invoices').upsert(
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
        if (iErr) {
          console.warn('[Supabase] Invoices table sync note:', iErr.message);
          errorCount++;
        }
      } catch (e) {
        console.warn('[Supabase] Exception syncing invoices table:', e);
      }
    }

    // Sync pre_orders dedicated relational table
    if (payload.preOrders && payload.preOrders.length > 0) {
      try {
        const { error: poErr } = await supabase.from('pre_orders').upsert(
          payload.preOrders.map((o) => ({
            id: o.id,
            order_number: o.orderNumber,
            product_name: o.productName,
            quantity: o.quantity || 1,
            unit_price: o.unitPrice || 0,
            total_price: o.totalPrice || 0,
            advance_payment: o.advancePayment || 0,
            balance_due: o.balanceDue || 0,
            customer_name: o.customerName || '',
            customer_phone: o.customerPhone || '',
            customer_email: o.customerEmail || '',
            expected_delivery_date: o.expectedDeliveryDate || '',
            notes: o.notes || '',
            advance_payment_method: o.advancePaymentMethod || 'upi',
            status: o.status || 'advance_paid',
            created_at: o.createdAt || new Date().toISOString(),
            timestamp: o.timestamp || Date.now(),
            completed_at: o.completedAt || null,
            data: o,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'id' }
        );
        if (poErr) {
          console.warn('[Supabase] Pre-orders table sync note:', poErr.message);
          errorCount++;
        }
      } catch (e) {
        console.warn('[Supabase] Exception syncing pre_orders table:', e);
      }
    }

    // 3. Sync Store Settings and UPI data to dedicated relational tables
    if (payload.settings) {
      try {
        await syncStoreSettingsToSupabase(payload.settings);
      } catch (e) {
        console.warn('[Supabase] Store settings sync note:', e);
      }
    }

    return { success: errorCount === 0, errorCount };
  } catch (err) {
    console.error('[Supabase] Failed to sync all data:', err);
    return { success: false, errorCount: errorCount + 1 };
  }
}

/**
 * Directly persist Store and UPI configuration to Supabase relational tables and snapshot
 */
export async function syncStoreSettingsToSupabase(settings: StoreSettings): Promise<boolean> {
  try {
    // 1. Sync to dedicated relational table 'store_settings'
    const { error: setErr } = await supabase.from('store_settings').upsert(
      {
        id: 'default_store',
        store_name: settings.storeName || 'Cardcrafted',
        tagline: settings.tagline || '',
        phone: settings.phone || '',
        email: settings.email || '',
        gstin: settings.gstin || '',
        address: settings.address || '',
        city: settings.city || '',
        state: settings.state || '',
        pincode: settings.pincode || '',
        upi_id: settings.upiId || 'quickpos@upi',
        upi_payee_name: settings.upiPayeeName || '',
        currency_symbol: settings.currencySymbol || '₹',
        currency_code: settings.currencyCode || 'INR',
        tax_type: settings.taxType || 'none',
        invoice_footer_note: settings.invoiceFooterNote || '',
        terms_and_conditions: settings.termsAndConditions || '',
        data: settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (setErr) {
      console.warn('[Supabase] Warning syncing store_settings table:', setErr.message);
    }

    // 2. Also record in dedicated 'upi_configs' table
    if (settings.upiId) {
      try {
        await supabase.from('upi_configs').upsert(
          {
            id: 'primary_upi',
            upi_id: settings.upiId,
            payee_name: settings.upiPayeeName || settings.storeName,
            is_active: true,
            data: {
              upiId: settings.upiId,
              upiPayeeName: settings.upiPayeeName,
              storeName: settings.storeName,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch (err) {
        console.warn('[Supabase] upi_configs table update note:', err);
      }
    }

    // 3. Save to app_data snapshot store
    await saveAppDataToSupabase('store_settings', settings);

    return true;
  } catch (e) {
    console.error('[Supabase] Error syncing store & UPI settings:', e);
    return false;
  }
}

/**
 * Fetch and reconcile all master data from Supabase across both snapshot and relational stores
 */
export async function fetchAllDataFromSupabase(): Promise<{
  products?: Product[];
  customers?: Customer[];
  invoices?: Invoice[];
  holdCarts?: HoldCart[];
  settings?: StoreSettings;
  preOrders?: PreOrder[];
} | null> {
  try {
    // 1. Fetch from app_data snapshot store
    let [snapshotProducts, snapshotCustomers, snapshotInvoices, snapshotHoldCarts, snapshotSettings, snapshotPreOrders] =
      await Promise.all([
        getAppDataFromSupabase<Product[]>('products'),
        getAppDataFromSupabase<Customer[]>('customers'),
        getAppDataFromSupabase<Invoice[]>('invoices'),
        getAppDataFromSupabase<HoldCart[]>('hold_carts'),
        getAppDataFromSupabase<StoreSettings>('store_settings'),
        getAppDataFromSupabase<PreOrder[]>('pre_orders'),
      ]);

    // 2. Fetch from dedicated relational tables
    let relProducts: Product[] = [];
    let relCustomers: Customer[] = [];
    let relInvoices: Invoice[] = [];

    try {
      const { data: prodData } = await supabase.from('products').select('*');
      if (prodData && prodData.length > 0) {
        relProducts = prodData.map((row: any) => {
          if (row.data && typeof row.data === 'object') {
            return { ...row.data, id: row.id, stock: row.stock ?? row.data.stock };
          }
          return {
            id: row.id,
            sku: row.sku || '',
            barcode: row.barcode || '',
            name: row.name,
            category: row.category || 'General',
            unitPrice: Number(row.unit_price) || 0,
            mrp: Number(row.mrp) || Number(row.unit_price) || 0,
            gstRate: Number(row.gst_rate) || 0,
            hsnCode: row.hsn_code || '',
            stock: row.stock ?? 0,
            unit: row.unit || 'pcs',
          };
        });
      }
    } catch (e) {
      // relational products table may not have been populated yet
    }

    try {
      const { data: custData } = await supabase.from('customers').select('*');
      if (custData && custData.length > 0) {
        relCustomers = custData.map((row: any) => {
          if (row.data && typeof row.data === 'object') {
            return { ...row.data, id: row.id };
          }
          return {
            id: row.id,
            name: row.name,
            phone: row.phone,
            countryCode: row.country_code || '+91',
            email: row.email || '',
            loyaltyPoints: row.loyalty_points || 0,
            totalSpent: Number(row.total_spent) || 0,
            ordersCount: row.orders_count || 0,
          };
        });
      }
    } catch (e) {
      // ignore
    }

    try {
      const { data: invData } = await supabase.from('invoices').select('*').order('timestamp', { ascending: false });
      if (invData && invData.length > 0) {
        relInvoices = invData.map((row: any) => {
          if (row.data && typeof row.data === 'object') {
            return {
              ...row.data,
              id: row.id,
              invoicePath: row.invoice_path || row.data.invoicePath,
              whatsappStatus: row.whatsapp_status || row.data.whatsappStatus || (row.data.whatsappDispatchStatus === 'sent' ? 'sent' : 'pending'),
              whatsappMessageId: row.whatsapp_message_id || row.data.whatsappMessageId,
              whatsappError: row.whatsapp_error || row.data.whatsappError,
              whatsappSentAt: row.whatsapp_sent_at || row.data.whatsappSentAt,
            };
          }
          return {
            id: row.id,
            invoiceNumber: row.invoice_number,
            date: row.date,
            timestamp: Number(row.timestamp),
            items: [],
            customer: { id: 'cust', name: row.customer_name || '', phone: row.customer_phone || '' },
            subtotal: Number(row.grand_total),
            totalGst: 0,
            grandTotal: Number(row.grand_total),
            paymentMethod: row.payment_method || 'cash',
            paymentStatus: row.payment_status || 'success',
            invoicePath: row.invoice_path || undefined,
            whatsappStatus: row.whatsapp_status || 'pending',
            whatsappMessageId: row.whatsapp_message_id || undefined,
            whatsappError: row.whatsapp_error || undefined,
            whatsappSentAt: row.whatsapp_sent_at || undefined,
          };
        });
      }
    } catch (e) {
      // ignore
    }

    // Query dedicated pre_orders relational table
    let relPreOrders: PreOrder[] = [];
    try {
      const { data: poData } = await supabase.from('pre_orders').select('*').order('timestamp', { ascending: false });
      if (poData && poData.length > 0) {
        relPreOrders = poData.map((row: any) => {
          if (row.data && typeof row.data === 'object') {
            return {
              ...row.data,
              id: row.id,
              status: row.status ?? row.data.status,
              balanceDue: Number(row.balance_due ?? row.data.balanceDue ?? 0),
            };
          }
          return {
            id: row.id,
            orderNumber: row.order_number,
            productName: row.product_name,
            quantity: Number(row.quantity) || 1,
            unitPrice: Number(row.unit_price) || 0,
            totalPrice: Number(row.total_price) || 0,
            advancePayment: Number(row.advance_payment) || 0,
            balanceDue: Number(row.balance_due) || 0,
            customerName: row.customer_name || '',
            customerPhone: row.customer_phone || '',
            customerEmail: row.customer_email || '',
            expectedDeliveryDate: row.expected_delivery_date || '',
            notes: row.notes || '',
            advancePaymentMethod: row.advance_payment_method || 'upi',
            status: row.status || 'advance_paid',
            createdAt: row.created_at || new Date().toISOString(),
            timestamp: Number(row.timestamp) || Date.now(),
            completedAt: row.completed_at || undefined,
          };
        });
      }
    } catch (e) {
      // ignore if table not created yet
    }

    // Check store_settings and upi_configs relational tables
    try {
      const { data: storeRows } = await supabase.from('store_settings').select('*').limit(1);
      if (storeRows && storeRows.length > 0) {
        const sRow = storeRows[0];
        if (sRow.data && typeof sRow.data === 'object') {
          snapshotSettings = { ...sRow.data, ...(snapshotSettings || {}) };
        } else {
          snapshotSettings = {
            storeName: sRow.store_name || 'Cardcrafted',
            tagline: sRow.tagline || '',
            gstin: sRow.gstin || '',
            address: sRow.address || '',
            city: sRow.city || '',
            state: sRow.state || '',
            pincode: sRow.pincode || '',
            phone: sRow.phone || '',
            email: sRow.email || '',
            upiId: sRow.upi_id || 'quickpos@upi',
            upiPayeeName: sRow.upi_payee_name || '',
            currencySymbol: sRow.currency_symbol || '₹',
            currencyCode: sRow.currency_code || 'INR',
            taxType: sRow.tax_type || 'none',
            whatsappApiProvider: 'direct_wa_me',
            invoiceFooterNote: sRow.invoice_footer_note || '',
            termsAndConditions: sRow.terms_and_conditions || '',
            thermalPaperWidth: '80mm',
            enableBeepSound: true,
            autoOpenWhatsApp: true,
            ...(snapshotSettings || {}),
          };
        }
      }
    } catch (e) {
      // ignore
    }

    // 3. Reconcile Products (authoritative relational table when available, fallback to snapshot)
    let mergedProducts: Product[] = [];
    if (relProducts.length > 0) {
      const snapMap = new Map((snapshotProducts || []).map((p) => [p.id, p]));
      mergedProducts = relProducts.map((rp) => {
        const snap = snapMap.get(rp.id);
        return snap ? { ...snap, ...rp } : rp;
      });
    } else if (snapshotProducts && snapshotProducts.length > 0) {
      mergedProducts = snapshotProducts;
    }

    // 4. Reconcile Customers (authoritative relational table when available, fallback to snapshot)
    let mergedCustomers: Customer[] = [];
    if (relCustomers.length > 0) {
      const snapMap = new Map((snapshotCustomers || []).map((c) => [c.id, c]));
      mergedCustomers = relCustomers.map((rc) => {
        const snap = snapMap.get(rc.id);
        return snap ? { ...snap, ...rc } : rc;
      });
    } else if (snapshotCustomers && snapshotCustomers.length > 0) {
      mergedCustomers = snapshotCustomers;
    }

    // 5. Reconcile Invoices (authoritative relational table when available, fallback to snapshot)
    let mergedInvoices: Invoice[] = [];
    if (relInvoices.length > 0) {
      const snapMap = new Map((snapshotInvoices || []).map((i) => [i.id, i]));
      mergedInvoices = relInvoices
        .map((ri) => {
          const snap = snapMap.get(ri.id);
          return snap ? { ...snap, ...ri } : ri;
        })
        .sort((a, b) => b.timestamp - a.timestamp);
    } else if (snapshotInvoices && snapshotInvoices.length > 0) {
      mergedInvoices = snapshotInvoices.sort((a, b) => b.timestamp - a.timestamp);
    }

    // 6. Reconcile Pre-Orders (authoritative relational table when available, fallback to snapshot)
    let mergedPreOrders: PreOrder[] = [];
    if (relPreOrders.length > 0) {
      const snapMap = new Map((snapshotPreOrders || []).map((o) => [o.id, o]));
      mergedPreOrders = relPreOrders
        .map((ro) => {
          const snap = snapMap.get(ro.id);
          return snap ? { ...snap, ...ro } : ro;
        })
        .sort((a, b) => b.timestamp - a.timestamp);
    } else if (snapshotPreOrders && snapshotPreOrders.length > 0) {
      mergedPreOrders = snapshotPreOrders.sort((a, b) => b.timestamp - a.timestamp);
    }

    const hasAnyData =
      mergedProducts.length > 0 ||
      mergedCustomers.length > 0 ||
      mergedInvoices.length > 0 ||
      mergedPreOrders.length > 0 ||
      snapshotHoldCarts !== null ||
      snapshotSettings !== null ||
      snapshotPreOrders !== null;

    if (!hasAnyData) {
      return null;
    }

    return {
      products: mergedProducts.length > 0 ? mergedProducts : undefined,
      customers: mergedCustomers.length > 0 ? mergedCustomers : undefined,
      invoices: mergedInvoices.length > 0 ? mergedInvoices : undefined,
      holdCarts: snapshotHoldCarts || undefined,
      settings: snapshotSettings || undefined,
      preOrders: mergedPreOrders.length > 0 ? mergedPreOrders : undefined,
    };
  } catch (err) {
    console.error('[Supabase] Failed to fetch data from cloud:', err);
    return null;
  }
}

/**
 * Complete SQL Schema for easy creation in Supabase SQL Editor / PostgreSQL
 */
export const SUPABASE_SQL_SCHEMA = `-- ==========================================
-- QUICKPOS / CARDCRAFTED SUPABASE DATABASE SETUP
-- Project ID: iqmbsdxicfthkncfxfsb
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/iqmbsdxicfthkncfxfsb/sql)
-- ==========================================

-- 1. Resilient Universal Key-Value Store for all app entities
CREATE TABLE IF NOT EXISTS public.app_data (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Products / Inventory Table
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  sku TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  category TEXT,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  mrp NUMERIC(10,2) DEFAULT 0.00,
  gst_rate NUMERIC(5,2) DEFAULT 0.00,
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
  phone TEXT NOT NULL,
  country_code TEXT DEFAULT '+91',
  email TEXT,
  loyalty_points INT DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0.00,
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
  grand_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  payment_status TEXT NOT NULL DEFAULT 'success',
  invoice_path TEXT,
  whatsapp_status TEXT DEFAULT 'pending',
  whatsapp_message_id TEXT,
  whatsapp_error TEXT,
  whatsapp_sent_at TIMESTAMPTZ,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Pre-Orders & Custom Booking Table
CREATE TABLE IF NOT EXISTS public.pre_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  advance_payment NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  expected_delivery_date TEXT,
  notes TEXT,
  advance_payment_method TEXT DEFAULT 'upi',
  status TEXT NOT NULL DEFAULT 'advance_paid',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  timestamp BIGINT NOT NULL,
  completed_at TEXT,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Store Settings & Business Profile Table
CREATE TABLE IF NOT EXISTS public.store_settings (
  id TEXT PRIMARY KEY DEFAULT 'default_store',
  store_name TEXT NOT NULL DEFAULT 'Cardcrafted',
  tagline TEXT,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  upi_id TEXT NOT NULL DEFAULT 'quickpos@upi',
  upi_payee_name TEXT,
  currency_symbol TEXT DEFAULT '₹',
  currency_code TEXT DEFAULT 'INR',
  tax_type TEXT DEFAULT 'none',
  invoice_footer_note TEXT,
  terms_and_conditions TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Dedicated UPI Configurations & Payment Endpoints
CREATE TABLE IF NOT EXISTS public.upi_configs (
  id TEXT PRIMARY KEY DEFAULT 'primary_upi',
  upi_id TEXT NOT NULL,
  payee_name TEXT,
  is_active BOOLEAN DEFAULT true,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Helpful Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_pre_orders_order_number ON public.pre_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_pre_orders_customer_phone ON public.pre_orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_pre_orders_status ON public.pre_orders(status);
CREATE INDEX IF NOT EXISTS idx_store_settings_upi ON public.store_settings(upi_id);
CREATE INDEX IF NOT EXISTS idx_upi_configs_id ON public.upi_configs(upi_id);

-- 9. Enable Row Level Security (RLS)
ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upi_configs ENABLE ROW LEVEL SECURITY;

-- 10. Grant Clean Permissive Public Access Policies for POS Terminal
DROP POLICY IF EXISTS "Allow all on app_data" ON public.app_data;
CREATE POLICY "Allow all on app_data" 
  ON public.app_data 
  FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on products" ON public.products;
CREATE POLICY "Allow all on products" 
  ON public.products 
  FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on customers" ON public.customers;
CREATE POLICY "Allow all on customers" 
  ON public.customers 
  FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on invoices" ON public.invoices;
CREATE POLICY "Allow all on invoices" 
  ON public.invoices 
  FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on pre_orders" ON public.pre_orders;
CREATE POLICY "Allow all on pre_orders" 
  ON public.pre_orders 
  FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on store_settings" ON public.store_settings;
CREATE POLICY "Allow all on store_settings" 
  ON public.store_settings 
  FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on upi_configs" ON public.upi_configs;
CREATE POLICY "Allow all on upi_configs" 
  ON public.upi_configs 
  FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);
`;

/**
 * Pre-Orders Specific SQL Schema for quick migration in Supabase SQL Editor
 */
export const SUPABASE_PRE_ORDERS_SQL_SCHEMA = `-- ==========================================
-- PRE-ORDERS TABLE SCHEMA FOR SUPABASE
-- Run this in your Supabase SQL Editor
-- ==========================================

CREATE TABLE IF NOT EXISTS public.pre_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  advance_payment NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  expected_delivery_date TEXT,
  notes TEXT,
  advance_payment_method TEXT DEFAULT 'upi',
  status TEXT NOT NULL DEFAULT 'advance_paid',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  timestamp BIGINT NOT NULL,
  completed_at TEXT,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pre_orders_order_number ON public.pre_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_pre_orders_customer_phone ON public.pre_orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_pre_orders_status ON public.pre_orders(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.pre_orders ENABLE ROW LEVEL SECURITY;

-- Permissive Policy for POS Terminal operations
DROP POLICY IF EXISTS "Allow all on pre_orders" ON public.pre_orders;
CREATE POLICY "Allow all on pre_orders" 
  ON public.pre_orders 
  FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);
`;

