
-- Drivers per restaurant
CREATE TABLE public.delivery_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  telegram_chat_id bigint,
  telegram_username text,
  display_name text NOT NULL,
  link_token text UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_drivers_restaurant ON public.delivery_drivers(restaurant_id);
CREATE INDEX idx_delivery_drivers_chat ON public.delivery_drivers(telegram_chat_id);
CREATE UNIQUE INDEX uniq_delivery_drivers_restaurant_chat
  ON public.delivery_drivers(restaurant_id, telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages drivers" ON public.delivery_drivers
  FOR ALL TO authenticated
  USING (user_owns_restaurant(restaurant_id))
  WITH CHECK (user_owns_restaurant(restaurant_id));

-- Order assignment + payment confirmation tracking
CREATE TABLE public.delivery_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  restaurant_id uuid NOT NULL,
  driver_chat_id bigint NOT NULL,
  driver_id uuid,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  last_followup_at timestamptz,
  followup_count integer NOT NULL DEFAULT 0,
  owner_alerted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_delivery_assignments_pending
  ON public.delivery_assignments(confirmed_at, claimed_at)
  WHERE confirmed_at IS NULL;

ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads assignments" ON public.delivery_assignments
  FOR SELECT TO authenticated
  USING (user_owns_restaurant(restaurant_id));

-- Telegram messages sent for an order (so we can edit them later)
CREATE TABLE public.order_telegram_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  chat_id bigint NOT NULL,
  message_id bigint NOT NULL,
  kind text NOT NULL DEFAULT 'new_order',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_tg_msgs_order ON public.order_telegram_messages(order_id);
ALTER TABLE public.order_telegram_messages ENABLE ROW LEVEL SECURITY;
-- service-role only (no policies for normal users)

-- Track who is the assigned driver on the order (atomic claim)
ALTER TABLE public.orders ADD COLUMN assigned_driver_chat_id bigint;
