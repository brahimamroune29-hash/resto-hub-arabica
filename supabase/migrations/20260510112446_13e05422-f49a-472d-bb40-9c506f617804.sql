
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS takeaway_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS takeaway_token text;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_takeaway_token_uk
  ON public.restaurants (takeaway_token)
  WHERE takeaway_token IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS daily_number integer;

CREATE TABLE IF NOT EXISTS public.restaurant_daily_counters (
  restaurant_id uuid NOT NULL,
  day_key date NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, day_key)
);

ALTER TABLE public.restaurant_daily_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads daily counters"
  ON public.restaurant_daily_counters
  FOR SELECT TO authenticated
  USING (public.user_owns_restaurant(restaurant_id));

CREATE OR REPLACE FUNCTION public.current_business_day(_at timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ((_at AT TIME ZONE 'Africa/Algiers') - interval '6 hours')::date
$$;

CREATE OR REPLACE FUNCTION public.assign_daily_number(_restaurant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _day date := public.current_business_day();
  _next integer;
BEGIN
  INSERT INTO public.restaurant_daily_counters (restaurant_id, day_key, last_number, updated_at)
  VALUES (_restaurant_id, _day, 1, now())
  ON CONFLICT (restaurant_id, day_key)
  DO UPDATE SET last_number = restaurant_daily_counters.last_number + 1,
                updated_at = now()
  RETURNING last_number INTO _next;
  RETURN _next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_daily_number(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.current_business_day(timestamptz) TO authenticated, anon, service_role;
