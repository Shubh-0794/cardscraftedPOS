import QRCode from 'qrcode';
import { Invoice, StoreSettings } from '../types/pos';

export interface UPILinkParams {
  upiId: string;
  payeeName: string;
  amount: number;
  currency?: string;
  transactionNote?: string;
  transactionRef?: string;
}

/**
 * Builds standard NPCI UPI URI string for scanning in GPay, PhonePe, Paytm, BHIM, Cred, etc.
 */
export function buildUPIDeepLink(params: UPILinkParams): string {
  const {
    upiId,
    payeeName,
    amount,
    currency = 'INR',
    transactionNote = 'POS Retail Invoice',
    transactionRef = `TXN${Date.now().toString().slice(-8)}`,
  } = params;

  const cleanPayee = encodeURIComponent(payeeName.trim());
  const cleanNote = encodeURIComponent(transactionNote.trim());
  const formattedAmount = amount.toFixed(2);

  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${cleanPayee}&am=${formattedAmount}&cu=${currency}&tn=${cleanNote}&tr=${transactionRef}`;
}

/**
 * Generate a high quality QR code data URL (PNG)
 */
export async function generateQRCodeDataURL(
  text: string,
  options?: QRCode.QRCodeToDataURLOptions
): Promise<string> {
  const defaultOptions: QRCode.QRCodeToDataURLOptions = {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
    color: {
      dark: '#0f172a', // slate-900
      light: '#ffffff',
    },
    ...options,
  };

  try {
    return await QRCode.toDataURL(text, defaultOptions);
  } catch (err) {
    console.error('Failed to generate QR Code:', err);
    throw err;
  }
}

/**
 * Mock Razorpay / Gateway order generator
 */
export function generateGatewayPaymentPayload(invoice: Invoice, settings: StoreSettings) {
  const orderId = `order_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const shortUrl = `https://pay.nexusmart.pos/inv/${invoice.invoiceNumber.toLowerCase()}?amt=${invoice.grandTotal}`;

  return {
    gateway: 'Razorpay / UPI Payment Gateway',
    orderId,
    amountInSubunits: Math.round(invoice.grandTotal * 100),
    currency: settings.currencyCode || 'INR',
    customer: {
      name: invoice.customer.name,
      contact: `${invoice.customer.countryCode}${invoice.customer.phone}`,
      email: invoice.customer.email,
    },
    notes: {
      invoice_number: invoice.invoiceNumber,
      store_name: settings.storeName,
    },
    paymentLink: shortUrl,
    upiIntentString: buildUPIDeepLink({
      upiId: settings.upiId,
      payeeName: settings.upiPayeeName || settings.storeName,
      amount: invoice.grandTotal,
      currency: settings.currencyCode || 'INR',
      transactionNote: `Invoice #${invoice.invoiceNumber}`,
      transactionRef: invoice.invoiceNumber,
    }),
  };
}
