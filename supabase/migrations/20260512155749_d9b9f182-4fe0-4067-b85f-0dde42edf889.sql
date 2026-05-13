
-- Phase 2: extend employees and orders
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS staff_pin text;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_waiter_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_kitchen_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id uuid;

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  total_points integer NOT NULL DEFAULT 0,
  total_visits integer NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  last_visit_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_restaurant ON public.customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(restaurant_id, phone);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members manage customers" ON public.customers;
CREATE POLICY "members manage customers" ON public.customers FOR ALL TO authenticated
  USING (user_has_restaurant_access(restaurant_id))
  WITH CHECK (user_has_restaurant_access(restaurant_id));

CREATE TABLE IF NOT EXISTS public.customer_points_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  order_id uuid,
  points_earned integer NOT NULL DEFAULT 0,
  points_redeemed integer NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpl_customer ON public.customer_points_log(customer_id);
ALTER TABLE public.customer_points_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members manage customer_points_log" ON public.customer_points_log;
CREATE POLICY "members manage customer_points_log" ON public.customer_points_log FOR ALL TO authenticated
  USING (user_has_restaurant_access(restaurant_id))
  WITH CHECK (user_has_restaurant_access(restaurant_id));

-- Complaints
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  customer_name text,
  customer_phone text,
  type text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_complaints_restaurant ON public.complaints(restaurant_id, status);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members manage complaints" ON public.complaints;
CREATE POLICY "members manage complaints" ON public.complaints FOR ALL TO authenticated
  USING (user_has_restaurant_access(restaurant_id))
  WITH CHECK (user_has_restaurant_access(restaurant_id));
DROP POLICY IF EXISTS "public submit complaints" ON public.complaints;
CREATE POLICY "public submit complaints" ON public.complaints FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Inventory counts
CREATE TABLE IF NOT EXISTS public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  count_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'open',
  notes text,
  total_variance_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_invcounts_restaurant ON public.inventory_counts(restaurant_id, count_date);
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members manage inventory_counts" ON public.inventory_counts;
CREATE POLICY "members manage inventory_counts" ON public.inventory_counts FOR ALL TO authenticated
  USING (user_has_restaurant_access(restaurant_id))
  WITH CHECK (user_has_restaurant_access(restaurant_id));

CREATE TABLE IF NOT EXISTS public.inventory_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id uuid NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL,
  expected_qty numeric NOT NULL DEFAULT 0,
  counted_qty numeric NOT NULL DEFAULT 0,
  variance numeric NOT NULL DEFAULT 0,
  variance_value numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invci_count ON public.inventory_count_items(count_id);
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members manage inventory_count_items" ON public.inventory_count_items;
CREATE POLICY "members manage inventory_count_items" ON public.inventory_count_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventory_counts ic WHERE ic.id = count_id AND user_has_restaurant_access(ic.restaurant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.inventory_counts ic WHERE ic.id = count_id AND user_has_restaurant_access(ic.restaurant_id)));
