import QRCode from 'qrcode';
import { Invoice, PreOrder, StoreSettings } from '../types/pos';
import { formatCurrency } from './taxCalculator';
import { buildUPIDeepLink } from './upi';

/**
 * Universal print helper for Invoices and Pre-Order Slips.
 * Injects a hidden iframe or opens a print popup window to bypass iframe print restrictions.
 */
async function triggerHtmlPrint(htmlContent: string, title: string): Promise<boolean> {
  try {
    let printIframe = document.getElementById('pos-print-sandbox-iframe') as HTMLIFrameElement | null;
    if (!printIframe) {
      printIframe = document.createElement('iframe');
      printIframe.id = 'pos-print-sandbox-iframe';
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0px';
      printIframe.style.height = '0px';
      printIframe.style.border = 'none';
      printIframe.style.zIndex = '-9999';
      document.body.appendChild(printIframe);
    }

    const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('Could not access print iframe document');
    }

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Allow resources & images (QR Code, barcode) to fully render
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      printIframe.contentWindow?.focus();
      printIframe.contentWindow?.print();
      return true;
    } catch (iframeErr) {
      console.warn('Iframe print restricted, opening dedicated print window fallback:', iframeErr);
      // Popup fallback
      const printWin = window.open('', '_blank', 'width=480,height=750,menubar=no,toolbar=no,location=no,status=no');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();
        printWin.document.title = title;
        setTimeout(() => {
          printWin.focus();
          printWin.print();
        }, 350);
        return true;
      }
    }
  } catch (err) {
    console.error('Print utility execution failed, attempting window.print:', err);
    window.print();
  }
  return false;
}

/**
 * Generates and triggers high-contrast thermal receipt print for an Invoice
 */
export async function printInvoiceReceipt(invoice: Invoice, settings: StoreSettings): Promise<void> {
  const storeDisplayName = (settings.storeName || 'Cardcrafted').replace(/by\s+shivani/gi, '').trim() || 'Cardcrafted';
  const currency = settings.currencySymbol || '₹';

  // Generate QR Code data URL for verification or UPI payment
  let qrCodeDataUrl = '';
  try {
    const upiLink = buildUPIDeepLink({
      upiId: settings.upiId || 'cardcrafted@upi',
      payeeName: settings.upiPayeeName || storeDisplayName,
      amount: invoice.grandTotal,
      transactionRef: `BILL-${invoice.invoiceNumber}`,
      transactionNote: `Invoice #${invoice.invoiceNumber} - ${storeDisplayName}`,
      currency: settings.currencyCode || 'INR',
    });
    qrCodeDataUrl = await QRCode.toDataURL(upiLink, {
      margin: 1,
      width: 130,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (e) {
    console.warn('Could not generate invoice print QR:', e);
  }

  const invoiceDate = new Date(invoice.timestamp || invoice.date);
  const formattedDate = invoiceDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = invoiceDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const itemsHtml = invoice.items
    .map((item, idx) => {
      const discountText =
        item.discountValue > 0
          ? `<div style="font-size: 10px; color: #15803d;">Disc: ${
              item.discountType === 'percent'
                ? `${item.discountValue}%`
                : `${currency}${item.discountValue.toFixed(2)}`
            }</div>`
          : '';

      return `
      <tr style="border-bottom: 1px dashed #e2e8f0;">
        <td style="padding: 5px 0; vertical-align: top; text-align: left;">
          <div style="font-weight: 700; font-size: 12px; color: #0f172a;">${item.product.name}</div>
          <div style="font-size: 10px; color: #64748b;">${item.quantity} ${item.product.unit || 'pcs'} × ${currency}${item.unitPrice.toFixed(2)}</div>
          ${discountText}
        </td>
        <td style="padding: 5px 0; vertical-align: top; text-align: right; font-weight: 700; font-size: 12px; color: #0f172a; white-space: nowrap;">
          ${currency}${item.totalAmount.toFixed(2)}
        </td>
      </tr>
    `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Invoice #${invoice.invoiceNumber} - ${settings.storeName}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 2mm 3mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
            background: #fff;
            padding: 4px;
            width: 100%;
            max-width: 320px;
            margin: 0 auto;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .store-title {
            font-size: 16px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .store-subtitle {
            font-size: 11px;
            font-weight: 700;
            color: #2563eb;
            font-family: sans-serif;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            font-size: 11px;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 6px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 4px 0;
          }
          th {
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
            border-bottom: 1px dashed #000;
            padding-bottom: 4px;
          }
          .text-right {
            text-align: right;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            font-weight: 900;
            padding-top: 4px;
            border-top: 1px solid #000;
            margin-top: 4px;
          }
          .qr-container {
            text-align: center;
            margin-top: 8px;
            padding-top: 6px;
          }
          .footer-note {
            text-align: center;
            font-size: 10px;
            margin-top: 6px;
            color: #334155;
          }
          @media print {
            body {
              width: 100%;
              max-width: 100%;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          <div class="store-title">${storeDisplayName}</div>
          <div class="store-subtitle">By Shivani</div>
          ${settings.tagline ? `<div style="font-size: 9px; text-transform: uppercase; margin-top: 2px;">${settings.tagline}</div>` : ''}
          ${settings.address ? `<div style="font-size: 9px; margin-top: 2px;">${settings.address}</div>` : ''}
          ${settings.phone ? `<div style="font-size: 10px;">Phone: ${settings.phone}</div>` : ''}
          ${settings.gstin ? `<div style="font-size: 10px; font-weight: bold;">GSTIN: ${settings.gstin}</div>` : ''}
        </div>

        <div class="meta-section">
          <div class="meta-row">
            <span><strong>INVOICE:</strong> #${invoice.invoiceNumber}</span>
            <span style="font-weight: bold; text-transform: uppercase;">PAID (${invoice.paymentMethod})</span>
          </div>
          <div class="meta-row">
            <span>DATE: ${formattedDate}</span>
            <span>${formattedTime}</span>
          </div>
          ${
            invoice.customer && invoice.customer.name
              ? `<div class="meta-row">
                  <span>CUSTOMER: <strong>${invoice.customer.name}</strong></span>
                  ${invoice.customer.phone ? `<span>${invoice.customer.phone}</span>` : ''}
                </div>`
              : ''
          }
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="calc-section">
          <div class="meta-row">
            <span>Subtotal:</span>
            <span>${currency}${invoice.subtotal.toFixed(2)}</span>
          </div>
          ${
            invoice.itemDiscountsTotal > 0
              ? `<div class="meta-row" style="color: #15803d; font-weight: bold;">
                  <span>Item Discounts:</span>
                  <span>-${currency}${invoice.itemDiscountsTotal.toFixed(2)}</span>
                </div>`
              : ''
          }
          ${
            invoice.billDiscountAmount > 0
              ? `<div class="meta-row" style="color: #15803d; font-weight: bold;">
                  <span>Bill Discount:</span>
                  <span>-${currency}${invoice.billDiscountAmount.toFixed(2)}</span>
                </div>`
              : ''
          }
          ${
            invoice.totalTax > 0
              ? `<div class="meta-row">
                  <span>GST (Tax Incl.):</span>
                  <span>${currency}${invoice.totalTax.toFixed(2)}</span>
                </div>`
              : ''
          }
          ${
            invoice.roundOff !== 0
              ? `<div class="meta-row">
                  <span>Round-off:</span>
                  <span>${invoice.roundOff > 0 ? '+' : ''}${currency}${invoice.roundOff.toFixed(2)}</span>
                </div>`
              : ''
          }
          <div class="total-row">
            <span>GRAND TOTAL:</span>
            <span>${currency}${invoice.grandTotal.toFixed(2)}</span>
          </div>
        </div>

        ${
          qrCodeDataUrl
            ? `<div class="qr-container">
                <img src="${qrCodeDataUrl}" width="100" height="100" style="display: block; margin: 0 auto;" />
                <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">Scan with any UPI App to verify</div>
              </div>`
            : ''
        }

        <div class="footer-note">
          ${settings.invoiceFooterNote || 'Thank you for shopping with Cardcrafted by Shivani!'}
        </div>
      </body>
    </html>
  `;

  await triggerHtmlPrint(html, `Invoice #${invoice.invoiceNumber}`);
}

/**
 * Generates and triggers thermal slip print for a Pre-Order Booking
 */
export async function printPreOrderReceipt(preOrder: PreOrder, settings: StoreSettings): Promise<void> {
  const storeDisplayName = (settings.storeName || 'Cardcrafted').replace(/by\s+shivani/gi, '').trim() || 'Cardcrafted';
  const currency = settings.currencySymbol || '₹';

  // Generate UPI QR Code for pending balance
  let qrCodeDataUrl = '';
  if (preOrder.balanceDue > 0) {
    try {
      const upiLink = buildUPIDeepLink({
        upiId: settings.upiId || 'cardcrafted@upi',
        payeeName: settings.upiPayeeName || storeDisplayName,
        amount: preOrder.balanceDue,
        transactionRef: `BAL-${preOrder.orderNumber}`,
        transactionNote: `Pre-Order #${preOrder.orderNumber} Balance - ${storeDisplayName}`,
        currency: settings.currencyCode || 'INR',
      });
      qrCodeDataUrl = await QRCode.toDataURL(upiLink, {
        margin: 1,
        width: 125,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (e) {
      console.warn('Could not generate pre-order print QR:', e);
    }
  }

  const orderDate = new Date(preOrder.timestamp || preOrder.createdAt || Date.now());
  const formattedDate = orderDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = orderDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const isCompleted = preOrder.status === 'completed' || preOrder.balanceDue <= 0;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Pre-Order Slip #${preOrder.orderNumber} - ${settings.storeName}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 2mm 3mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
            background: #fff;
            padding: 4px;
            width: 100%;
            max-width: 320px;
            margin: 0 auto;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .store-title {
            font-size: 16px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .store-subtitle {
            font-size: 11px;
            font-weight: 700;
            color: #2563eb;
            font-family: sans-serif;
          }
          .slip-badge {
            display: inline-block;
            background: #000;
            color: #fff;
            font-weight: bold;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            margin-top: 4px;
            text-transform: uppercase;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            font-size: 11px;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 6px 0;
          }
          .highlight-box {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 6px 8px;
            margin: 6px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            font-weight: bold;
            padding-top: 4px;
            margin-top: 4px;
          }
          .balance-row {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            font-weight: 900;
            padding: 4px 0;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            margin-top: 4px;
          }
          .qr-container {
            text-align: center;
            margin-top: 8px;
            padding-top: 4px;
          }
          .footer-note {
            text-align: center;
            font-size: 10px;
            margin-top: 6px;
            color: #334155;
          }
          @media print {
            body {
              width: 100%;
              max-width: 100%;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          <div class="store-title">${storeDisplayName}</div>
          <div class="store-subtitle">By Shivani</div>
          ${settings.tagline ? `<div style="font-size: 9px; text-transform: uppercase; margin-top: 2px;">${settings.tagline}</div>` : ''}
          ${settings.address ? `<div style="font-size: 9px; margin-top: 2px;">${settings.address}</div>` : ''}
          ${settings.phone ? `<div style="font-size: 10px;">Phone: ${settings.phone}</div>` : ''}
          <div><span class="slip-badge">PRE-ORDER BOOKING SLIP</span></div>
        </div>

        <div class="meta-section">
          <div class="meta-row">
            <span><strong>ORDER #:</strong> ${preOrder.orderNumber}</span>
            <span style="font-weight: bold; text-transform: uppercase;">
              ${isCompleted ? 'COMPLETED' : 'ADVANCE PAID'}
            </span>
          </div>
          <div class="meta-row">
            <span>BOOKED ON:</span>
            <span>${formattedDate} ${formattedTime}</span>
          </div>
          <div class="meta-row">
            <span>CUSTOMER: <strong>${preOrder.customerName || 'Walk-in Customer'}</strong></span>
            ${preOrder.customerPhone ? `<span>${preOrder.customerPhone}</span>` : ''}
          </div>
          ${
            preOrder.expectedDeliveryDate
              ? `<div class="meta-row" style="color: #1e40af; font-weight: bold;">
                  <span>EXPECTED READY:</span>
                  <span>${preOrder.expectedDeliveryDate}</span>
                </div>`
              : ''
          }
        </div>

        <div class="divider"></div>

        <div class="highlight-box">
          <div style="font-weight: 900; font-size: 12px; color: #0f172a; margin-bottom: 2px;">
            ${preOrder.productName}
          </div>
          <div style="font-size: 10.5px; color: #475569;">
            Quantity: <strong>${preOrder.quantity}</strong> × Rate: <strong>${currency}${preOrder.unitPrice.toFixed(2)}</strong>
          </div>
          ${
            preOrder.notes
              ? `<div style="font-size: 10px; color: #64748b; font-style: italic; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 2px;">
                  Note: "${preOrder.notes}"
                </div>`
              : ''
          }
        </div>

        <div class="calc-section">
          <div class="meta-row">
            <span>Total Order Value:</span>
            <span>${currency}${preOrder.totalPrice.toFixed(2)}</span>
          </div>
          <div class="meta-row" style="color: #15803d; font-weight: bold;">
            <span>Advance Received (${(preOrder.advancePaymentMethod || 'UPI').toUpperCase()}):</span>
            <span>-${currency}${preOrder.advancePayment.toFixed(2)}</span>
          </div>
          <div class="balance-row">
            <span>BALANCE DUE:</span>
            <span>${currency}${preOrder.balanceDue.toFixed(2)}</span>
          </div>
        </div>

        ${
          qrCodeDataUrl && preOrder.balanceDue > 0
            ? `<div class="qr-container">
                <img src="${qrCodeDataUrl}" width="105" height="105" style="display: block; margin: 0 auto;" />
                <div style="font-size: 9px; font-weight: bold; margin-top: 2px;">Scan to Pay Pending Balance (${currency}${preOrder.balanceDue.toFixed(2)})</div>
              </div>`
            : ''
        }

        <div class="footer-note">
          Please present this slip or WhatsApp PDF to collect your finished order. Thank you!
        </div>
      </body>
    </html>
  `;

  await triggerHtmlPrint(html, `Pre-Order Slip #${preOrder.orderNumber}`);
}
