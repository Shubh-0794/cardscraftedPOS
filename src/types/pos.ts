export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  unitPrice: number;
  mrp?: number;
  gstRate: number; // in percentage e.g. 5, 12, 18
  hsnCode: string;
  stock: number;
  unit: string; // 'pcs', 'kg', 'pkt', 'box', 'ltr'
  image?: string;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number; // can be adjusted
  discountType: 'percent' | 'fixed';
  discountValue: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  countryCode: string; // e.g. '+91'
  email?: string;
  loyaltyPoints: number;
  totalSpent: number;
  ordersCount: number;
  lastVisit?: string;
  address?: string;
  vipTier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
}

export type PaymentMethod = 'upi' | 'cash' | 'whatsapp' | 'split';
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'completed';

export interface BillDiscount {
  type: 'percent' | 'fixed';
  value: number;
  reason?: string;
}

export interface SplitPaymentDetail {
  cash: number;
  upi: number;
  whatsapp?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  timestamp: number;
  customer: Customer;
  items: CartItem[];
  subtotal: number;
  itemDiscountsTotal: number;
  billDiscount: BillDiscount;
  billDiscountAmount: number;
  totalTaxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentDetails: {
    upiRef?: string;
    upiIdUsed?: string;
    cashTendered?: number;
    changeDue?: number;
    splitDetails?: SplitPaymentDetail;
    gatewayOrderId?: string;
    paymentLink?: string;
    whatsappPhone?: string;
    paymentLinkSent?: boolean;
  };
  whatsappDispatchStatus: 'not_sent' | 'sent' | 'failed';
  whatsappDispatchedAt?: string;
  whatsappMessageId?: string;
  cashierName: string;
  notes?: string;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  gstin: string;
  fssaiNumber?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  upiId: string;
  upiPayeeName: string;
  currencySymbol: string;
  currencyCode: string;
  taxType: 'none' | 'gst' | 'vat' | 'sales_tax';
  whatsappApiProvider: 'direct_wa_me' | 'whatsapp_cloud_api' | 'twilio';
  whatsappApiKey?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  razorpayKeyId?: string;
  invoiceFooterNote: string;
  termsAndConditions: string;
  thermalPaperWidth: '80mm' | '58mm';
  enableBeepSound: boolean;
  autoOpenWhatsApp: boolean;
}

export interface HoldCart {
  id: string;
  name: string;
  customer: Customer | null;
  items: CartItem[];
  billDiscount: BillDiscount;
  timestamp: number;
  itemCount: number;
  totalAmount: number;
}
