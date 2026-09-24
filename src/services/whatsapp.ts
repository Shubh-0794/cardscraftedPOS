/**
 * WhatsApp Integration Service for Cards Crafted POS
 * 
 * Supports:
 * 1. Meta WhatsApp Cloud API via Netlify Serverless Function (/.netlify/functions/send-whatsapp)
 * 2. Supabase Storage PDF Invoices upload (`invoice-pdfs` bucket)
 * 3. Fallback direct WhatsApp Web/App dispatch (`wa.me`)
 */

import { Invoice, StoreSettings } from '../types/pos';
import { supabase, uploadInvoicePdfToSupabaseStorage, getInvoicePdfSignedUrl, getInvoicePdfPublicUrl } from '../lib/supabase';
import { createInvoicePdfBlob } from '../utils/qrPdfGenerator';
import { formatWhatsAppFullNumber, generateWhatsAppPayloads } from '../utils/whatsapp';

export interface SendWhatsAppInvoiceParams {
  phone: string;
  customerName?: string;
  orderNumber: string;
  total: number;
  documentUrl?: string;
  filename?: string;
  message?: string;
  useTemplate?: boolean;
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  whatsapp?: any;
  error?: string;
  method?: 'cloud_api' | 'wa_me_fallback';
  documentUrl?: string;
}

/**
 * Standardizes Indian WhatsApp number format (e.g. 9876543210 -> 919876543210)
 */
export function formatIndianWhatsAppNumber(phone: string): string {
  const cleaned = (phone || '').replace(/\D/g, '');
  if (!cleaned) {
    throw new Error('WhatsApp mobile number is required');
  }
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return cleaned;
  }
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `91${cleaned.slice(1)}`;
  }
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return cleaned;
  }
  throw new Error('Invalid Indian mobile number (must be 10 digits)');
}

/**
 * Validates checkout details prior to sending
 */
export function validateOrderForWhatsApp(order: {
  customerName?: string;
  customerPhone?: string;
  items?: any[];
  grandTotal?: number;
}): { valid: boolean; error?: string; formattedPhone?: string } {
  if (!order.customerPhone || !order.customerPhone.trim()) {
    return { valid: false, error: 'Customer phone number is required for WhatsApp invoice' };
  }
  try {
    const formattedPhone = formatIndianWhatsAppNumber(order.customerPhone);
    return { valid: true, formattedPhone };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Invalid WhatsApp number' };
  }
}

/**
 * Calls Netlify Function `/.netlify/functions/send-whatsapp`
 */
export async function sendWhatsAppInvoice(
  params: SendWhatsAppInvoiceParams
): Promise<SendWhatsAppResult> {
  const formattedPhone = formatIndianWhatsAppNumber(params.phone);

  try {
    const response = await fetch('/.netlify/functions/send-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: formattedPhone,
        customerName: params.customerName || 'Customer',
        orderNumber: params.orderNumber,
        total: params.total,
        documentUrl: params.documentUrl,
        filename: params.filename || `${params.orderNumber}.pdf`,
        message: params.message,
        useTemplate: params.useTemplate ?? false,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'WhatsApp Cloud API sending failed via Netlify function',
        whatsapp: result.details || result,
        method: 'cloud_api',
      };
    }

    return {
      success: true,
      messageId: result.messageId,
      whatsapp: result.whatsapp,
      method: 'cloud_api',
    };
  } catch (error: any) {
    console.warn('[WhatsApp Service] Netlify Function error:', error);
    return {
      success: false,
      error: error.message || 'Unable to connect to WhatsApp Cloud API serverless endpoint',
      method: 'cloud_api',
    };
  }
}

/**
 * Complete Workflow:
 * 1. Build PDF Blob
 * 2. Upload to Supabase Storage `invoice-pdfs`
 * 3. Generate Signed or Public URL
 * 4. Dispatch via Netlify WhatsApp Cloud API Function
 * 5. Returns delivery status without blocking or failing the POS order
 */
export async function executeCompleteWhatsAppDispatch(
  invoice: Invoice,
  settings: StoreSettings,
  options?: {
    customPhone?: string;
    preferDirectWaMe?: boolean;
    useTemplate?: boolean;
  }
): Promise<{
  success: boolean;
  method: 'cloud_api' | 'wa_me_fallback';
  messageId?: string;
  documentUrl?: string;
  invoicePath?: string;
  error?: string;
}> {
  const targetPhone = options?.customPhone || invoice.customer.phone || '';
  let formattedPhone = '';
  try {
    formattedPhone = formatIndianWhatsAppNumber(targetPhone);
  } catch (e: any) {
    return {
      success: false,
      method: 'cloud_api',
      error: e.message || 'Invalid customer phone number',
    };
  }

  try {
    // 1. Generate Invoice PDF Blob
    const { blob, filename, doc } = await createInvoicePdfBlob(invoice, settings);

    // 2. Upload to Supabase Storage `invoice-pdfs`
    const storageResult = await uploadInvoicePdfToSupabaseStorage(
      invoice.invoiceNumber,
      blob,
      settings.supabaseStorageBucket || 'invoice-pdfs'
    );

    let documentUrl = '';
    let invoicePath = '';

    if (storageResult.success && storageResult.path) {
      invoicePath = storageResult.path;
      // Prefer Signed URL (valid for 24 hours) or Public URL
      const signedUrl = await getInvoicePdfSignedUrl(
        storageResult.path,
        86400,
        settings.supabaseStorageBucket || 'invoice-pdfs'
      );
      documentUrl = signedUrl || getInvoicePdfPublicUrl(storageResult.path, settings.supabaseStorageBucket || 'invoice-pdfs');
    }

    // If user specifically requested wa.me or if Cloud API is not forced
    if (options?.preferDirectWaMe || settings.whatsappApiProvider === 'direct_wa_me') {
      const payloads = generateWhatsAppPayloads(invoice, settings, formattedPhone);
      if (typeof window !== 'undefined') {
        window.open(payloads.waMeLink, '_blank', 'noopener,noreferrer');
      }
      return {
        success: true,
        method: 'wa_me_fallback',
        documentUrl,
        invoicePath,
      };
    }

    // 3. Dispatch through Netlify Serverless WhatsApp Cloud API
    const result = await sendWhatsAppInvoice({
      phone: formattedPhone,
      customerName: invoice.customer.name || 'Valued Customer',
      orderNumber: invoice.invoiceNumber,
      total: invoice.grandTotal,
      documentUrl: documentUrl || undefined,
      filename: filename || `${invoice.invoiceNumber}.pdf`,
      useTemplate: options?.useTemplate ?? false,
      message: `Hi ${invoice.customer.name || 'Valued Customer'} 👋\nThank you for your order from ${settings.storeName} ❤️\n\nYour invoice is attached.\n\nOrder: ${invoice.invoiceNumber}\nAmount: ${settings.currencySymbol}${invoice.grandTotal.toFixed(2)}\n\nThank you for supporting ${settings.storeName}!`,
    });

    if (result.success) {
      return {
        success: true,
        method: 'cloud_api',
        messageId: result.messageId,
        documentUrl,
        invoicePath,
      };
    } else {
      console.warn('[WhatsApp Cloud API] Failed or not configured, opening wa.me fallback:', result.error);
      // Fallback: Open wa.me so the merchant can still send the message smoothly
      const payloads = generateWhatsAppPayloads(invoice, settings, formattedPhone);
      if (typeof window !== 'undefined' && settings.autoOpenWhatsApp !== false) {
        window.open(payloads.waMeLink, '_blank', 'noopener,noreferrer');
      }
      return {
        success: false,
        method: 'cloud_api',
        error: result.error,
        documentUrl,
        invoicePath,
      };
    }
  } catch (err: any) {
    console.error('[WhatsApp Service Execution Error]', err);
    return {
      success: false,
      method: 'cloud_api',
      error: err.message || 'WhatsApp sending flow failed',
    };
  }
}
