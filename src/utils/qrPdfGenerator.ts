import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Product, Invoice, StoreSettings } from '../types/pos';
import { formatCurrency } from './taxCalculator';

/**
 * Generates an A4 PDF containing QR sticker labels
 * Grid: 3 columns × 8 rows (Max 24 labels per page, exact count, no repeat)
 */
export async function generate24QrLabelsA4Pdf(
  products: Product[],
  settings: StoreSettings
): Promise<void> {
  if (!products || products.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // A4 dimensions: 210mm × 297mm
  const pageWidth = 210;
  const pageHeight = 297;

  // Grid layout: 3 columns × 8 rows = 24 labels per sheet
  const cols = 3;
  const rows = 8;
  const labelsPerPage = cols * rows; // 24

  const marginLeft = 8;
  const marginTop = 10;
  const labelWidth = 62;
  const labelHeight = 33.5;
  const gapX = 3.5;
  const gapY = 1.2;

  // Print each product exactly once without repetition
  // Maximum 24 labels per A4 page. If 8 products => 8 labels on Page 1. If 30 products => 24 on Page 1, 6 on Page 2.
  const itemsToPrint: Product[] = [...products];

  const totalPages = Math.ceil(itemsToPrint.length / labelsPerPage);

  // Pre-generate QR Code data URLs for speed and consistency
  const qrCache: Record<string, string> = {};
  for (const item of itemsToPrint) {
    const code = (item.barcode || item.id).trim();
    if (!qrCache[code]) {
      try {
        qrCache[code] = await QRCode.toDataURL(code, {
          width: 240,
          margin: 1,
          color: {
            dark: '#0a0f1d',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        });
      } catch {
        qrCache[code] = '';
      }
    }
  }

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      doc.addPage('a4', 'portrait');
    }

    const pageItems = itemsToPrint.slice(
      page * labelsPerPage,
      (page + 1) * labelsPerPage
    );

    for (let index = 0; index < pageItems.length; index++) {
      const product = pageItems[index];
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = marginLeft + col * (labelWidth + gapX);
      const y = marginTop + row * (labelHeight + gapY);

      // Label background card with fine outline for cutting guides
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, labelWidth, labelHeight, 2, 2, 'S');

      // Top brand banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.roundedRect(x + 0.5, y + 0.5, labelWidth - 1, 4.5, 1.5, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);
      const brandText = (settings.storeName || 'Cardcrafted').toUpperCase();
      doc.text(brandText, x + labelWidth / 2, y + 3.6, { align: 'center' });

      // QR Code on Left
      const qrDataUrl = qrCache[(product.barcode || product.id).trim()];
      const qrSize = 20.5;
      const qrX = x + 2.5;
      const qrY = y + 6;

      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      } else {
        doc.setFillColor(241, 245, 249);
        doc.rect(qrX, qrY, qrSize, qrSize, 'F');
      }

      // Code text under QR
      doc.setFont('courier', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(51, 65, 85);
      const displayCode = product.barcode || product.id;
      doc.text(displayCode, qrX + qrSize / 2, qrY + qrSize + 2.6, { align: 'center' });

      // Right Column: Product details
      const textX = x + 25;
      let textY = y + 8.5;

      // Product Name (wrapped if needed)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42); // slate-900
      const maxTitleWidth = labelWidth - 27;
      const titleLines = doc.splitTextToSize(product.name, maxTitleWidth);
      const linesToShow = titleLines.slice(0, 2);
      doc.text(linesToShow, textX, textY);
      textY += linesToShow.length * 3.2;

      // Category / SKU
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139); // slate-500
      const skuCat = `${product.category} • SKU: ${product.sku || 'N/A'}`;
      doc.text(doc.splitTextToSize(skuCat, maxTitleWidth)[0] || '', textX, textY);
      textY += 3.6;

      // Selling Price Highlight Pill
      doc.setFillColor(238, 242, 255); // indigo-50
      doc.roundedRect(textX - 0.5, textY - 2.5, maxTitleWidth + 1, 6.2, 1, 1, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(29, 78, 216); // blue-700
      const priceText = `MRP ${formatCurrency(product.unitPrice, settings.currencySymbol)}`;
      doc.text(priceText, textX + 1, textY + 1.8);
    }

    // Page footer note
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${page + 1} of ${totalPages} — Printable Retail QR Labels (Cardcrafted)`,
      pageWidth / 2,
      pageHeight - 4,
      { align: 'center' }
    );
  }

  const filename = `Product_QR_Labels_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/**
 * Builds the visual thermal receipt PDF document (80mm standard width)
 */
export async function buildInvoicePdfDoc(
  invoice: Invoice,
  settings: StoreSettings
): Promise<jsPDF> {
  const itemCount = invoice.items.length;
  // Calculate dynamic page height to avoid clipping
  const calculatedHeight = Math.max(180, 130 + itemCount * 10);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, calculatedHeight],
  });

  const pageWidth = 80;
  let curY = 8;

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, calculatedHeight, 'F');

  // Store Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  const storeName = (settings.storeName || 'Cardcrafted').replace(/by\s+shivani/gi, '').trim() || 'Cardcrafted';
  doc.text(storeName, pageWidth / 2, curY, { align: 'center' });
  curY += 4.5;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(59, 130, 246);
  doc.text('By Shivani', pageWidth / 2, curY, { align: 'center' });
  curY += 4;

  if (settings.address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const addrLines = doc.splitTextToSize(settings.address, 70);
    doc.text(addrLines, pageWidth / 2, curY, { align: 'center' });
    curY += addrLines.length * 3 + 1;
  }

  if (settings.phone) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Phone: ${settings.phone}`, pageWidth / 2, curY, { align: 'center' });
    curY += 3.5;
  }

  if (settings.gstin) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`GSTIN: ${settings.gstin}`, pageWidth / 2, curY, { align: 'center' });
    curY += 3.5;
  }

  // Dashed divider line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, curY, pageWidth - 5, curY);
  curY += 4;

  // Invoice Meta
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`INVOICE: #${invoice.invoiceNumber}`, 5, curY);
  const statusLabel = invoice.paymentStatus === 'success' ? 'PAID' : invoice.paymentStatus.toUpperCase();
  doc.text(`STATUS: ${statusLabel}`, pageWidth - 5, curY, { align: 'right' });
  curY += 3.5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  const dateStr = `${new Date(invoice.timestamp).toLocaleDateString()} ${new Date(invoice.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  doc.text(`DATE: ${dateStr}`, 5, curY);
  doc.text(`PAY: ${invoice.paymentMethod.toUpperCase()}`, pageWidth - 5, curY, { align: 'right' });
  curY += 3.5;

  if (invoice.customer && invoice.customer.name) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(`Customer: ${invoice.customer.name} (${invoice.customer.phone || 'N/A'})`, 5, curY);
    curY += 4;
  }

  // Dashed divider
  doc.line(5, curY, pageWidth - 5, curY);
  curY += 4;

  // Items Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('ITEM / QTY', 5, curY);
  doc.text('TOTAL', pageWidth - 5, curY, { align: 'right' });
  curY += 3.5;

  // Items List
  for (const item of invoice.items) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    const itemName = item.product.name.length > 28 ? item.product.name.slice(0, 26) + '..' : item.product.name;
    doc.text(itemName, 5, curY);

    const itemTotal = formatCurrency(item.totalAmount, settings.currencySymbol);
    doc.text(itemTotal, pageWidth - 5, curY, { align: 'right' });
    curY += 3.2;

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const qtyRate = `${item.quantity} × ${formatCurrency(item.unitPrice, settings.currencySymbol)}`;
    doc.text(qtyRate, 5, curY);
    curY += 3.8;
  }

  // Dashed divider
  doc.line(5, curY, pageWidth - 5, curY);
  curY += 4;

  // Financials
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal', 5, curY);
  doc.text(formatCurrency(invoice.subtotal, settings.currencySymbol), pageWidth - 5, curY, { align: 'right' });
  curY += 3.5;

  if (invoice.billDiscountAmount > 0) {
    doc.setTextColor(16, 185, 129); // emerald-600
    doc.text('Discount', 5, curY);
    doc.text(`-${formatCurrency(invoice.billDiscountAmount, settings.currencySymbol)}`, pageWidth - 5, curY, { align: 'right' });
    curY += 3.5;
  }

  if (invoice.totalTax > 0) {
    doc.setTextColor(71, 85, 105);
    doc.text('GST (Tax Incl.)', 5, curY);
    doc.text(formatCurrency(invoice.totalTax, settings.currencySymbol), pageWidth - 5, curY, { align: 'right' });
    curY += 3.5;
  }

  // Total Paid (Highlight)
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.line(5, curY, pageWidth - 5, curY);
  curY += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL AMOUNT', 5, curY);
  doc.setTextColor(29, 78, 216);
  doc.text(formatCurrency(invoice.grandTotal, settings.currencySymbol), pageWidth - 5, curY, { align: 'right' });
  curY += 6;

  // Invoice QR Code (Encodes verifying invoice web link)
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const verifyPayload = origin
      ? `${origin}/?view_invoice=${invoice.invoiceNumber}`
      : `INVOICE:${invoice.invoiceNumber}|TOTAL:${invoice.grandTotal}|STORE:${settings.storeName}`;

    const qrDataUrl = await QRCode.toDataURL(verifyPayload, {
      width: 180,
      margin: 1,
      color: { dark: '#0a0f1d', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });

    const qrSize = 24;
    doc.addImage(qrDataUrl, 'PNG', (pageWidth - qrSize) / 2, curY, qrSize, qrSize);
    curY += qrSize + 3;

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`SCAN QR TO VIEW / VERIFY INVOICE`, pageWidth / 2, curY, { align: 'center' });
    curY += 4;
  } catch {
    // ignore
  }

  // Footer note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  const footerNote = settings.invoiceFooterNote || 'Thank you for shopping with Cardcrafted by Shivani!';
  const footerLines = doc.splitTextToSize(footerNote, 70);
  doc.text(footerLines, pageWidth / 2, curY, { align: 'center' });

  return doc;
}

/**
 * Creates Blob and File objects for direct Web Share API or download
 */
export async function createInvoicePdfBlob(
  invoice: Invoice,
  settings: StoreSettings
): Promise<{ doc: jsPDF; blob: Blob; file: File; filename: string }> {
  const doc = await buildInvoicePdfDoc(invoice, settings);
  const filename = `Invoice_${invoice.invoiceNumber}.pdf`;
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });
  return { doc, blob, file, filename };
}

/**
 * Generates and downloads the visual thermal receipt PDF
 */
export async function generateInvoicePdf(
  invoice: Invoice,
  settings: StoreSettings
): Promise<Blob> {
  const { doc, blob, filename } = await createInvoicePdfBlob(invoice, settings);
  doc.save(filename);
  return blob;
}
