import { Invoice, StoreSettings } from '../types/pos';
import { formatCurrency } from './taxCalculator';
import { buildUPIDeepLink } from './upi';

export interface WhatsAppMessagePayloads {
  plainTextMessage: string;
  waMeLink: string;
  whatsappCloudApiPayload: Record<string, unknown>;
  twilioApiPayload: Record<string, unknown>;
  digitalInvoiceLink: string;
  onlinePaymentLink: string;
}

/**
 * Resolves current live app URL for shareable links
 */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'https://ais-pre-nk3zba2uefglvmyo5ufj6m-29826142568.asia-east1.run.app';
}

/**
 * Builds a beautifully structured WhatsApp message for retail customers
 * Note: E-bill link removed as requested, providing clean itemized invoice with PDF reference
 */
export function buildWhatsAppInvoiceMessage(invoice: Invoice, settings: StoreSettings): string {
  const symbol = settings.currencySymbol || '₹';
  const cleanPhone = invoice.customer.phone.replace(/\D/g, '');

  const paymentMethodLabel = {
    upi: '⚡ UPI / QR',
    cash: '💵 Cash Counter',
    whatsapp: '💬 WhatsApp Payment',
    split: '🔄 Split Payment',
  }[invoice.paymentMethod] || 'Digital Payment';

  const paymentStatusLabel = {
    success: '✅ PAID',
    pending: '⏳ PAYMENT PENDING',
    failed: '❌ PAYMENT FAILED',
    completed: '✅ COMPLETED',
  }[invoice.paymentStatus] || 'PAID';

  // Build itemized list
  const itemsText = invoice.items
    .map((item, index) => {
      const discText =
        item.discountValue > 0
          ? ` _(Saved ${item.discountType === 'percent' ? `${item.discountValue}%` : formatCurrency(item.discountValue, symbol)})_`
          : '';
      return `${index + 1}. *${item.product.name}*\n   Qty: ${item.quantity} ${item.product.unit || 'pcs'} × ${formatCurrency(item.unitPrice, symbol)} = *${formatCurrency(item.totalAmount, symbol)}*${discText}`;
    })
    .join('\n');

  let message = `🧾 *TAX INVOICE - ${settings.storeName.toUpperCase()}*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📍 *${settings.storeName}*\n`;
  if (settings.phone) {
    message += `📞 Support: ${settings.phone}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  message += `👤 *Customer:* ${invoice.customer.name || 'Valued Customer'}\n`;
  if (cleanPhone) {
    message += `📱 *Phone:* ${invoice.customer.countryCode || '+91'} ${cleanPhone}\n`;
  }
  message += `📄 *Invoice No:* #${invoice.invoiceNumber}\n`;
  message += `📅 *Date & Time:* ${new Date(invoice.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}\n`;
  if (invoice.cashierName) {
    message += `👤 *Cashier:* ${invoice.cashierName}\n`;
  }
  message += `\n`;

  message += `🛍️ *PURCHASED ITEMS:*\n`;
  message += `─────────────────────\n`;
  message += `${itemsText}\n`;
  message += `─────────────────────\n\n`;

  message += `📊 *BILL SUMMARY:*\n`;
  message += `• Subtotal: ${formatCurrency(invoice.subtotal, symbol)}\n`;
  if (invoice.itemDiscountsTotal > 0) {
    message += `• Item Discounts: -${formatCurrency(invoice.itemDiscountsTotal, symbol)}\n`;
  }
  if (invoice.billDiscountAmount > 0) {
    message += `• Bill Discount: -${formatCurrency(invoice.billDiscountAmount, symbol)}\n`;
  }
  if (invoice.totalTax > 0) {
    message += `• GST (Tax): ${formatCurrency(invoice.totalTax, symbol)}\n`;
  }
  if (invoice.roundOff !== 0) {
    message += `• Round-off: ${invoice.roundOff > 0 ? '+' : ''}${formatCurrency(invoice.roundOff, symbol)}\n`;
  }
  message += `\n💰 *TOTAL AMOUNT: ${formatCurrency(invoice.grandTotal, symbol)}*\n`;
  message += `💳 *Payment Method:* ${paymentMethodLabel}\n`;
  message += `📌 *Payment Status:* ${paymentStatusLabel}\n\n`;

  // Note: E-bill link removed per request. Reference to attached official PDF bill
  message += `📎 *Official PDF Tax Invoice attached.*\n\n`;
  message += `✨ _${settings.invoiceFooterNote || 'Thank you for shopping with us! Visit again.'}_`;

  return message;
}

/**
 * Builds all integration payloads (Direct wa.me link, Meta WhatsApp Cloud API JSON, Twilio API JSON)
 */
export function generateWhatsAppPayloads(
  invoice: Invoice,
  settings: StoreSettings,
  overridePhone?: string,
  overrideCountryCode?: string
): WhatsAppMessagePayloads {
  const plainTextMessage = buildWhatsAppInvoiceMessage(invoice, settings);
  const baseUrl = getAppBaseUrl();
  const onlinePaymentLink = `${baseUrl}/?pay=${encodeURIComponent(invoice.invoiceNumber)}&amt=${invoice.grandTotal}`;
  const digitalInvoiceLink = `${baseUrl}/?view_invoice=${encodeURIComponent(invoice.invoiceNumber)}`;

  // Phone number normalization strictly targeting customer
  const targetCountry = overrideCountryCode || invoice.customer.countryCode || '+91';
  const targetPhoneNum = overridePhone !== undefined ? overridePhone : invoice.customer.phone;

  const cleanCountryCode = targetCountry.replace(/\D/g, '') || '91';
  const cleanPhone = (targetPhoneNum || '').replace(/\D/g, '');
  const fullRecipientNumber = cleanPhone ? `${cleanCountryCode}${cleanPhone}` : '';

  // 1. Direct Web WhatsApp link strictly to customer's WhatsApp chat
  const encodedText = encodeURIComponent(plainTextMessage);
  const waMeLink = fullRecipientNumber
    ? `https://wa.me/${fullRecipientNumber}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  // 2. Meta WhatsApp Business Cloud API JSON payload
  const whatsappCloudApiPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: fullRecipientNumber,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: {
        type: 'text',
        text: `Tax Invoice #${invoice.invoiceNumber}`,
      },
      body: {
        text: `Hello ${invoice.customer.name || 'Customer'},\nThank you for shopping at *${settings.storeName}*! Your total bill is *${formatCurrency(invoice.grandTotal, settings.currencySymbol)}* (${invoice.paymentStatus.toUpperCase()}).\nOfficial PDF Tax Invoice attached.`,
      },
      footer: {
        text: settings.tagline || 'Retail Billing System',
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: `view_inv_${invoice.invoiceNumber}`,
              title: '🧾 Invoice Receipt',
            },
          },
        ],
      },
    },
  };

  // 3. Twilio Programmable Messaging API payload
  const twilioApiPayload = {
    To: fullRecipientNumber ? `whatsapp:+${fullRecipientNumber}` : '',
    From: `whatsapp:${settings.twilioFromNumber || '+14155238886'}`,
    Body: plainTextMessage,
  };

  return {
    plainTextMessage,
    waMeLink,
    whatsappCloudApiPayload,
    twilioApiPayload,
    digitalInvoiceLink,
    onlinePaymentLink,
  };
}

/**
 * Builds direct payment request link and message for customer WhatsApp
 */
export function buildWhatsAppPaymentLinkMessage(params: {
  customerName?: string;
  amount: number;
  currencySymbol: string;
  storeName: string;
  upiId: string;
  upiDeepLink: string;
  invoiceNumber?: string;
}): string {
  const {
    customerName = 'Customer',
    amount,
    currencySymbol,
    storeName,
    upiId,
    upiDeepLink,
    invoiceNumber = `INV-${Date.now().toString().slice(-6)}`,
  } = params;

  const baseUrl = getAppBaseUrl();
  const webPaymentLink = `${baseUrl}/?pay=${encodeURIComponent(invoiceNumber)}&amt=${amount}`;

  let msg = `💳 *PAYMENT REQUEST - ${storeName.toUpperCase()}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `Hello ${customerName},\n`;
  msg += `Please complete your payment of *${currencySymbol}${amount.toFixed(2)}*:\n\n`;
  msg += `🌐 *Click to Pay ${currencySymbol}${amount.toFixed(2)} (Online / QR):*\n${webPaymentLink}\n\n`;
  msg += `📲 *1-Tap UPI Intent (Google Pay / PhonePe / Paytm / BHIM):*\n${upiDeepLink}\n\n`;
  msg += `🏦 *UPI ID (VPA):* \`${upiId}\`\n\n`;
  msg += `💰 *Exact Amount to Pay:* *${currencySymbol}${amount.toFixed(2)}*\n\n`;
  msg += `Thank you for shopping with ${storeName}! 🙏`;
  return msg;
}

export function getWhatsAppPaymentDirectUrl(
  phone: string,
  countryCode: string = '+91',
  params: {
    customerName?: string;
    amount: number;
    currencySymbol: string;
    storeName: string;
    upiId: string;
    upiDeepLink: string;
    invoiceNumber?: string;
  }
): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const cleanCountryCode = countryCode.replace(/\D/g, '') || '91';
  const fullPhone = `${cleanCountryCode}${cleanPhone}`;
  const message = buildWhatsAppPaymentLinkMessage(params);
  return cleanPhone
    ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}
