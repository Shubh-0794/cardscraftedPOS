import { Invoice, StoreSettings, PreOrder } from '../types/pos';
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
 * Accurately standardizes phone numbers with country codes for WhatsApp wa.me links
 * Prevents duplicate country codes (e.g. 91919767908425) and strips leading zeros.
 */
export function formatWhatsAppFullNumber(phone: string, countryCode: string = '+91'): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits || digits === '9999999999') return '';
  const cleanCountry = (countryCode || '+91').replace(/\D/g, '') || '91';

  // If already prefixed with 91 (e.g. 12 digits: 919767908425)
  if (digits.length === 12 && digits.startsWith(cleanCountry)) {
    return digits;
  }
  // If 11 digits starting with 0 (e.g. 09767908425)
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${cleanCountry}${digits.slice(1)}`;
  }
  // Standard 10 digit Indian mobile number
  if (digits.length === 10) {
    return `${cleanCountry}${digits}`;
  }
  // If it already starts with country code
  if (digits.startsWith(cleanCountry) && digits.length > cleanCountry.length) {
    return digits;
  }
  return `${cleanCountry}${digits}`;
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
  const fullRecipientNumber = formatWhatsAppFullNumber(targetPhoneNum, targetCountry);

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
  const fullPhone = formatWhatsAppFullNumber(phone, countryCode);
  const message = buildWhatsAppPaymentLinkMessage(params);
  return fullPhone
    ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppPreOrderMessage(
  preOrder: PreOrder,
  settings: StoreSettings,
  includePdfNotice: boolean = true
): string {
  const symbol = settings.currencySymbol || '₹';
  const cleanPhone = (preOrder.customerPhone || '').replace(/\D/g, '');
  let message = `📋 *PRE-ORDER BOOKING CONFIRMATION - ${settings.storeName.toUpperCase()}*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📍 *${settings.storeName}*\n`;
  if (settings.phone) {
    message += `📞 Support: ${settings.phone}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  message += `👤 *Customer:* ${preOrder.customerName || 'Valued Customer'}\n`;
  if (cleanPhone) {
    message += `📱 *Phone:* ${preOrder.customerPhone}\n`;
  }
  message += `🔖 *Pre-Order No:* #${preOrder.orderNumber}\n`;
  message += `📅 *Booking Date:* ${new Date(preOrder.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}\n`;
  if (preOrder.expectedDeliveryDate) {
    message += `🚚 *Expected Delivery / Pickup:* ${preOrder.expectedDeliveryDate}\n`;
  }
  message += `\n`;

  message += `🛍️ *PRE-ORDER ITEM DETAILS:*\n`;
  message += `─────────────────────\n`;
  message += `• *Product:* ${preOrder.productName}\n`;
  message += `• *Quantity:* ${preOrder.quantity}\n`;
  message += `• *Unit Price:* ${formatCurrency(preOrder.unitPrice, symbol)}\n`;
  message += `• *Total Order Price:* *${formatCurrency(preOrder.totalPrice, symbol)}*\n`;
  message += `─────────────────────\n\n`;

  message += `💵 *PAYMENT SUMMARY:*\n`;
  message += `✅ *Advance Paid:* ${formatCurrency(preOrder.advancePayment, symbol)}\n`;
  message += `⏳ *Remaining Balance Due:* *${formatCurrency(preOrder.balanceDue, symbol)}*\n`;
  message += `📌 *Status:* ${
    preOrder.status === 'completed'
      ? '✅ FULLY PAID / DELIVERED'
      : preOrder.status === 'cancelled'
      ? '❌ CANCELLED'
      : '⏳ ADVANCE RECEIVED (BALANCE PENDING)'
  }\n\n`;

  if (preOrder.notes) {
    message += `📝 *Notes/Specs:* ${preOrder.notes}\n\n`;
  }

  // Only pending balance amount has a payment URL (not other amounts, and not when fully paid)
  if (
    preOrder.balanceDue > 0 &&
    preOrder.status !== 'completed' &&
    preOrder.status !== 'cancelled' &&
    settings.upiId
  ) {
    const cleanUpiId = settings.upiId.trim();
    const payeeName = settings.upiPayeeName || settings.storeName || 'Shivani Khante';
    const cleanRef = (preOrder.orderNumber || 'PRE').replace(/[^a-zA-Z0-9]/g, '');
    const upiDeepLink = buildUPIDeepLink({
      upiId: cleanUpiId,
      payeeName: payeeName,
      amount: preOrder.balanceDue,
      currency: settings.currencyCode || 'INR',
      transactionNote: `Balance for Pre-Order #${preOrder.orderNumber}`,
      transactionRef: cleanRef,
    });

    message += `💳 *Click link to Pay Balance ${symbol}${preOrder.balanceDue.toFixed(2)} via UPI:*\n${upiDeepLink}\n\n`;
    message += `🏦 *Pay Balance via UPI:* \`${cleanUpiId}\`\n\n`;
  }

  if (includePdfNotice) {
    message += `📎 *Official Pre-Order PDF Booking Slip attached.*\n\n`;
  }

  message += `✨ _${settings.invoiceFooterNote || 'Thank you for your pre-order! We are preparing your order with care.'}_`;
  return message;
}

export function getWhatsAppPreOrderDirectUrl(
  preOrder: PreOrder,
  settings: StoreSettings,
  overridePhone?: string,
  overrideCountryCode?: string
): string {
  const targetPhone = overridePhone !== undefined ? overridePhone : (preOrder.customerPhone || '');
  const country = overrideCountryCode || '+91';
  const fullPhone = formatWhatsAppFullNumber(targetPhone, country);
  const message = buildWhatsAppPreOrderMessage(preOrder, settings, true);
  return fullPhone
    ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}
