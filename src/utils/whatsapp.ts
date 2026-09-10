import { Invoice, StoreSettings } from '../types/pos';
import { formatCurrency } from './taxCalculator';
import { buildUPIDeepLink } from './upi';

export interface WhatsAppMessagePayloads {
  plainTextMessage: string;
  waMeLink: string;
  whatsappCloudApiPayload: Record<string, unknown>;
  twilioApiPayload: Record<string, unknown>;
}

/**
 * Builds a beautifully structured, emoji-rich WhatsApp message for retail customers
 */
export function buildWhatsAppInvoiceMessage(invoice: Invoice, settings: StoreSettings): string {
  const symbol = settings.currencySymbol || '₹';
  const cleanPhone = invoice.customer.phone.replace(/\D/g, '');
  const paymentMethodLabel = {
    upi: '⚡ UPI / QR',
    cash: '💵 Cash Counter',
    whatsapp: '💬 WhatsApp Payment Link',
    split: '🔄 Split Payment',
  }[invoice.paymentMethod] || 'Digital Payment';

  const paymentStatusLabel = {
    success: '✅ PAID',
    pending: '⏳ PENDING',
    failed: '❌ FAILED',
  }[invoice.paymentStatus];

  // Build itemized list
  const itemsText = invoice.items
    .map((item, index) => {
      const discText =
        item.discountValue > 0
          ? ` _(Saved ${item.discountType === 'percent' ? `${item.discountValue}%` : formatCurrency(item.discountValue, symbol)})_`
          : '';
      return `${index + 1}. *${item.product.name}*\n   Qty: ${item.quantity} ${item.product.unit} × ${formatCurrency(item.unitPrice, symbol)} = *${formatCurrency(item.totalAmount, symbol)}*${discText}`;
    })
    .join('\n');

  // UPI / Payment Link if pending or for customer reference
  const upiUri = buildUPIDeepLink({
    upiId: settings.upiId,
    payeeName: settings.upiPayeeName || settings.storeName,
    amount: invoice.grandTotal,
    currency: settings.currencyCode || 'INR',
    transactionNote: `Inv #${invoice.invoiceNumber}`,
    transactionRef: invoice.invoiceNumber,
  });

  const onlinePaymentLink = `https://pay.pos.app/pay/${invoice.invoiceNumber}?amt=${invoice.grandTotal}`;
  const digitalInvoiceLink = `https://pos.app/invoice/view/${invoice.invoiceNumber}`;

  let message = `🧾 *INVOICE - ${settings.storeName.toUpperCase()}*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📍 *${settings.storeName}*\n`;
  message += `📞 Support: ${settings.phone}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  message += `👤 *Customer:* ${invoice.customer.name || 'Valued Customer'}\n`;
  message += `📱 *Phone:* ${invoice.customer.countryCode} ${cleanPhone}\n`;
  message += `📄 *Invoice No:* #${invoice.invoiceNumber}\n`;
  message += `📅 *Date & Time:* ${new Date(invoice.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}\n`;
  message += `👤 *Cashier:* ${invoice.cashierName}\n\n`;

  message += `🛍️ *PURCHASED ITEMS:*\n`;
  message += `─────────────────────\n`;
  message += `${itemsText}\n`;
  message += `─────────────────────\n\n`;

  message += `📊 *SUMMARY:*\n`;
  message += `• Subtotal: ${formatCurrency(invoice.subtotal, symbol)}\n`;
  if (invoice.itemDiscountsTotal > 0) {
    message += `• Item Discounts: -${formatCurrency(invoice.itemDiscountsTotal, symbol)}\n`;
  }
  if (invoice.billDiscountAmount > 0) {
    message += `• Bill Discount (${invoice.billDiscount.type === 'percent' ? `${invoice.billDiscount.value}%` : 'Special'}): -${formatCurrency(invoice.billDiscountAmount, symbol)}\n`;
  }
  if (invoice.roundOff !== 0) {
    message += `• Round-off: ${invoice.roundOff > 0 ? '+' : ''}${formatCurrency(invoice.roundOff, symbol)}\n`;
  }
  message += `\n💰 *GRAND TOTAL: ${formatCurrency(invoice.grandTotal, symbol)}*\n`;
  message += `💳 *Payment Method:* ${paymentMethodLabel}\n`;
  message += `📌 *Payment Status:* ${paymentStatusLabel}\n\n`;

  if (invoice.paymentStatus === 'pending') {
    message += `⚡ *Quick Pay Link (UPI / Card):*\n${onlinePaymentLink}\n\n`;
    message += `📲 *Direct UPI Intent:*\n${upiUri}\n\n`;
  }

  message += `📄 *View / Download E-Invoice:*\n${digitalInvoiceLink}\n\n`;
  message += `✨ _${settings.invoiceFooterNote}_\n`;
  message += `💬 _Reply to this message for any queries or returns!_`;

  return message;
}

/**
 * Builds all integration payloads (Direct wa.me link, Meta WhatsApp Cloud API JSON, Twilio API JSON)
 */
export function generateWhatsAppPayloads(invoice: Invoice, settings: StoreSettings): WhatsAppMessagePayloads {
  const plainTextMessage = buildWhatsAppInvoiceMessage(invoice, settings);

  // Phone number normalization
  const cleanCountryCode = invoice.customer.countryCode.replace(/\D/g, '') || '91';
  const cleanPhone = invoice.customer.phone.replace(/\D/g, '');
  const fullRecipientNumber = `${cleanCountryCode}${cleanPhone}`;

  // 1. Direct Web WhatsApp link
  const encodedText = encodeURIComponent(plainTextMessage);
  const waMeLink = `https://wa.me/${fullRecipientNumber}?text=${encodedText}`;

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
        text: `Hello ${invoice.customer.name || 'Customer'},\nThank you for shopping at *${settings.storeName}*! Your total bill is *${formatCurrency(invoice.grandTotal, settings.currencySymbol)}* (${invoice.paymentStatus.toUpperCase()}).`,
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
              title: '📄 View E-Receipt',
            },
          },
          {
            type: 'reply',
            reply: {
              id: `track_points_${invoice.customer.id}`,
              title: '⭐ Loyalty Balance',
            },
          },
        ],
      },
    },
    // Also include template alternative payload for verified WABA
    _templatePayloadExample: {
      messaging_product: 'whatsapp',
      to: fullRecipientNumber,
      type: 'template',
      template: {
        name: 'retail_invoice_v2',
        language: { code: 'en' },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'text',
                text: invoice.invoiceNumber,
              },
            ],
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: invoice.customer.name || 'Valued Customer' },
              { type: 'text', text: formatCurrency(invoice.grandTotal, settings.currencySymbol) },
              { type: 'text', text: invoice.paymentMethod.toUpperCase() },
              { type: 'text', text: settings.storeName },
            ],
          },
        ],
      },
    },
  };

  // 3. Twilio Programmable Messaging API payload
  const twilioApiPayload = {
    To: `whatsapp:+${fullRecipientNumber}`,
    From: `whatsapp:${settings.twilioFromNumber || '+14155238886'}`,
    Body: plainTextMessage,
    StatusCallback: 'https://nexusmart.pos/api/webhooks/twilio/whatsapp-status',
  };

  return {
    plainTextMessage,
    waMeLink,
    whatsappCloudApiPayload,
    twilioApiPayload,
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
}): string {
  const { customerName = 'Customer', amount, currencySymbol, storeName, upiId, upiDeepLink } = params;
  let msg = `💳 *Payment Request from ${storeName}*\n\n`;
  msg += `Hello ${customerName},\n`;
  msg += `Please complete your payment of *${currencySymbol}${amount.toFixed(2)}* using any UPI app:\n\n`;
  msg += `📲 *Pay via UPI Intent / Link:*\n${upiDeepLink}\n\n`;
  msg += `🏦 *UPI ID (VPA):* \`${upiId}\`\n\n`;
  msg += `Thank you for shopping with us! 🙏`;
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
  }
): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const cleanCountryCode = countryCode.replace(/\D/g, '') || '91';
  const fullPhone = `${cleanCountryCode}${cleanPhone}`;
  const message = buildWhatsAppPaymentLinkMessage(params);
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}

