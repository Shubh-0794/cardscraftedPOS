import { BillDiscount, CartItem } from '../types/pos';

export interface CalculationSummary {
  subtotal: number;
  itemDiscountsTotal: number;
  billDiscountAmount: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  taxBreakdown: {
    rate: number;
    taxable: number;
    cgst: number;
    sgst: number;
    totalTax: number;
  }[];
}

/**
 * Calculates taxable amounts, GST, and totals for a single item
 */
export function calculateItemFinancials(
  unitPrice: number,
  quantity: number,
  gstRate: number,
  discountType: 'percent' | 'fixed',
  discountValue: number
) {
  const gross = unitPrice * quantity;
  let discountAmount = 0;

  if (discountType === 'percent') {
    discountAmount = (gross * Math.min(Math.max(discountValue, 0), 100)) / 100;
  } else {
    discountAmount = Math.min(Math.max(discountValue, 0), gross);
  }

  const taxableAmount = Math.max(0, gross - discountAmount);
  // GST calculation (exclusive GST model)
  const gstAmount = (taxableAmount * gstRate) / 100;
  const totalAmount = taxableAmount + gstAmount;

  return {
    gross,
    discountAmount,
    taxableAmount,
    gstAmount,
    totalAmount,
  };
}

/**
 * Calculate totals for the entire cart including order-level discounts and tax breakdowns
 */
export function calculateCartTotals(
  items: CartItem[],
  billDiscount: BillDiscount,
  isInterState: boolean = false
): CalculationSummary {
  let subtotal = 0;
  let itemDiscountsTotal = 0;

  // Map to collect tax breakdown by GST percentage rate
  const rateMap = new Map<number, { taxable: number; tax: number }>();

  items.forEach((item) => {
    const gross = item.unitPrice * item.quantity;
    subtotal += gross;

    let itemDisc = 0;
    if (item.discountType === 'percent') {
      itemDisc = (gross * Math.min(Math.max(item.discountValue, 0), 100)) / 100;
    } else {
      itemDisc = Math.min(Math.max(item.discountValue, 0), gross);
    }
    itemDiscountsTotal += itemDisc;

    const itemTaxable = Math.max(0, gross - itemDisc);
    const itemTax = (itemTaxable * item.product.gstRate) / 100;

    const current = rateMap.get(item.product.gstRate) || { taxable: 0, tax: 0 };
    rateMap.set(item.product.gstRate, {
      taxable: current.taxable + itemTaxable,
      tax: current.tax + itemTax,
    });
  });

  const netAfterItemDiscounts = Math.max(0, subtotal - itemDiscountsTotal);

  // Calculate bill/order level discount
  let billDiscountAmount = 0;
  if (billDiscount.value > 0) {
    if (billDiscount.type === 'percent') {
      billDiscountAmount = (netAfterItemDiscounts * Math.min(billDiscount.value, 100)) / 100;
    } else {
      billDiscountAmount = Math.min(billDiscount.value, netAfterItemDiscounts);
    }
  }

  // Adjust taxable proportion if order-level discount is applied
  const discountFactor = netAfterItemDiscounts > 0 ? (netAfterItemDiscounts - billDiscountAmount) / netAfterItemDiscounts : 1;

  let totalTaxable = 0;
  let totalTax = 0;
  const taxBreakdown: CalculationSummary['taxBreakdown'] = [];

  // Sort rates ascending
  const sortedRates = Array.from(rateMap.keys()).sort((a, b) => a - b);

  sortedRates.forEach((rate) => {
    const entry = rateMap.get(rate)!;
    const adjustedTaxable = entry.taxable * discountFactor;
    const adjustedTax = (adjustedTaxable * rate) / 100;

    totalTaxable += adjustedTaxable;
    totalTax += adjustedTax;

    const halfTax = adjustedTax / 2;
    taxBreakdown.push({
      rate,
      taxable: Number(adjustedTaxable.toFixed(2)),
      cgst: Number(halfTax.toFixed(2)),
      sgst: Number(halfTax.toFixed(2)),
      totalTax: Number(adjustedTax.toFixed(2)),
    });
  });

  const rawGrandTotal = totalTaxable + totalTax;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Number((roundedGrandTotal - rawGrandTotal).toFixed(2));

  const cgstTotal = isInterState ? 0 : Number((totalTax / 2).toFixed(2));
  const sgstTotal = isInterState ? 0 : Number((totalTax / 2).toFixed(2));
  const igstTotal = isInterState ? Number(totalTax.toFixed(2)) : 0;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    itemDiscountsTotal: Number(itemDiscountsTotal.toFixed(2)),
    billDiscountAmount: Number(billDiscountAmount.toFixed(2)),
    taxableTotal: Number(totalTaxable.toFixed(2)),
    cgstTotal,
    sgstTotal,
    igstTotal,
    totalTax: Number(totalTax.toFixed(2)),
    roundOff,
    grandTotal: roundedGrandTotal,
    taxBreakdown,
  };
}

/**
 * Currency formatter with symbol
 */
export function formatCurrency(amount: number, symbol: string = '₹'): string {
  return `${symbol}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
