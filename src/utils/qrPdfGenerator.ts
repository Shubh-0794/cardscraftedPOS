import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Product, Invoice, StoreSettings } from '../types/pos';
import { formatCurrency } from './taxCalculator';

/**
 * Generates an A4 PDF containing exactly 24 QR sticker labels per sheet
 * Grid: 3 columns × 8 rows (Standard Avery 24-up label sheet layout)
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

    for (let i = 0; i < pageItems.length; i++) {
      const product = pageItems[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = marginLeft + col * (labelWidth + gapX);
      const y = marginTop + row * (labelHeight + gapY);

      // Label background & border with subtle cut guide
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, labelWidth, labelHeight, 1.5, 1.5, 'F');
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, labelWidth, labelHeight, 1.5, 1.5, 'S');

      // Top mini header: Store brand tag
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(59, 130, 246); // blue-600
      const storeTag = (settings.storeName || 'Cardcrafted').toUpperCase();
      doc.text(storeTag, x + 3, y + 3.5);

      if (product.category) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(100, 116, 139);
        const catStr = product.category.slice(0, 16);
        doc.text(catStr, x + labelWidth - 3, y + 3.5, { align: 'right' });
      }

      // Divider line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.line(x + 2, y + 4.8, x + labelWidth - 2, y + 4.8);

      // Draw QR Code Image (Left side)
      const qrCode = (product.barcode || product.id).trim();
      const qrDataUrl = qrCache[qrCode];
      const qrSize = 22;
      const qrX = x + 2.5;
      const qrY = y + 6;

      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      }

      // Right side: Product Name, Price, and SKU
      const textX = x + qrSize + 4.5;
      const maxTextWidth = labelWidth - qrSize - 6.5;

      // Product Title (wrapped up to 2 lines)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42); // slate-900
      const titleLines = doc.splitTextToSize(product.name, maxTextWidth);
      const displayedTitle = titleLines.slice(0, 2);
      doc.text(displayedTitle, textX, y + 8.5);

      // Price Tag (Bold Prominent)
      const priceY = y + 18.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(29, 78, 216); // blue-700
      const priceText = formatCurrency(product.unitPrice, settings.currencySymbol);
      doc.text(priceText, textX, priceY);

      if (product.mrp && product.mrp > product.unitPrice) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`MRP: ${formatCurrency(product.mrp, settings.currencySymbol)}`, textX, priceY + 3.2);
      }

      // SKU / QR code number at bottom
      doc.setFont('courier', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(71, 85, 105); // slate-600
      const codeLabel = `QR: ${qrCode.slice(-10)}`;
      doc.text(codeLabel, textX, y + labelHeight - 3);

      if (product.sku) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(148, 163, 184);
        doc.text(product.sku, x + labelWidth - 3, y + labelHeight - 3, { align: 'right' });
      }
    }
  }

  // Trigger browser download
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Cardcrafted_24_QR_Labels_${dateStr}.pdf`);
}

/**
 * Generates an exact visual PDF matching the on-screen invoice receipt layout
 */
export async function generateInvoicePdf(
  invoice: Invoice,
  settings: StoreSettings
): Promise<Blob> {
  // 80mm thermal receipt standard layout: 80mm width × 210mm height
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 220],
  });

  const pageWidth = 80;
  let curY = 8;

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 220, 'F');

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
  doc.text(`STATUS: PAID`, pageWidth - 5, curY, { align: 'right' });
  curY += 3.5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  const dateStr = `${new Date(invoice.timestamp).toLocaleDateString()} ${new Date(invoice.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  doc.text(`DATE: ${dateStr}`, 5, curY);
  doc.text(`PAY: ${invoice.paymentMethod.toUpperCase()}`, pageWidth - 5, curY, { align: 'right' });
  curY += 3.5;

  if (invoice.customer) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(`Customer: ${invoice.customer.name} (${invoice.customer.phone})`, 5, curY);
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
  doc.setFont('helvetica', 'normal');
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
  doc.text('TOTAL PAID', 5, curY);
  doc.setTextColor(29, 78, 216);
  doc.text(formatCurrency(invoice.grandTotal, settings.currencySymbol), pageWidth - 5, curY, { align: 'right' });
  curY += 6;

  // Invoice QR Code
  try {
    const qrDataUrl = await QRCode.toDataURL(`INVOICE:${invoice.invoiceNumber}|TOTAL:${invoice.grandTotal}|STORE:${settings.storeName}`, {
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
    doc.text(`SCAN QR TO VERIFY INVOICE`, pageWidth / 2, curY, { align: 'center' });
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

  // Save PDF
  const filename = `Invoice_${invoice.invoiceNumber}.pdf`;
  doc.save(filename);

  return doc.output('blob');
}
