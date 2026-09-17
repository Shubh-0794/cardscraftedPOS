-- ==========================================
-- PRE-ORDERS SQL SCHEMA FOR SUPABASE DATABASE
-- Cardcrafted POS / QuickPOS
-- ==========================================

-- 1. Create the dedicated Pre-Orders table
CREATE TABLE IF NOT EXISTS public.pre_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  advance_payment NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  expected_delivery_date TEXT,
  notes TEXT,
  advance_payment_method TEXT DEFAULT 'upi',
  status TEXT NOT NULL DEFAULT 'advance_paid',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  timestamp BIGINT NOT NULL,
  completed_at TEXT,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pre_orders_order_number ON public.pre_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_pre_orders_customer_phone ON public.pre_orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_pre_orders_status ON public.pre_orders(status);
CREATE INDEX IF NOT EXISTS idx_pre_orders_timestamp ON public.pre_orders(timestamp);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.pre_orders ENABLE ROW LEVEL SECURITY;

-- 4. Grant Clean Permissive Policy for POS Terminal
DROP POLICY IF EXISTS "Allow all on pre_orders" ON public.pre_orders;
CREATE POLICY "Allow all on pre_orders" 
  ON public.pre_orders 
  FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);
