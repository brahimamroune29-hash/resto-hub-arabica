-- Delivery system
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_token text UNIQUE;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dine_in',
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS customer_address text;

-- table_id is already nullable; delivery orders won't have one.
CREATE INDEX IF NOT EXISTS idx_restaurants_delivery_token ON public.restaurants(delivery_token);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders(order_type);