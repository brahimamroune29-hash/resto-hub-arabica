CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  order_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_restaurant_unread
  ON public.notifications (restaurant_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_owns_restaurant(restaurant_id));

CREATE POLICY "owner updates notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_owns_restaurant(restaurant_id))
  WITH CHECK (user_owns_restaurant(restaurant_id));

CREATE POLICY "owner deletes notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_owns_restaurant(restaurant_id));

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;