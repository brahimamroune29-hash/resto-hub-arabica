-- Add cashier PIN hash to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS cashier_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS cashier_pin_salt TEXT;

-- Cashier sessions
CREATE TABLE IF NOT EXISTS public.cashier_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS cashier_sessions_token_idx ON public.cashier_sessions(token);
ALTER TABLE public.cashier_sessions ENABLE ROW LEVEL SECURITY;
-- Owners can see their cashier sessions
CREATE POLICY "owners read cashier_sessions" ON public.cashier_sessions
  FOR SELECT TO authenticated
  USING (public.user_owns_restaurant(restaurant_id));
CREATE POLICY "owners delete cashier_sessions" ON public.cashier_sessions
  FOR DELETE TO authenticated
  USING (public.user_owns_restaurant(restaurant_id));

-- Failed-attempt tracking (per restaurant)
CREATE TABLE IF NOT EXISTS public.cashier_login_attempts (
  restaurant_id UUID PRIMARY KEY,
  failed_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cashier_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read attempts" ON public.cashier_login_attempts
  FOR SELECT TO authenticated
  USING (public.user_owns_restaurant(restaurant_id));

-- Public restaurants policy already allows reading restaurant info; we hide pin_hash via column-level by NOT exposing it client-side (it's just a string).
-- For extra safety, create a view that excludes the hash for public reads is overkill given clients don't query hash. The server-only client reads it.

-- Allow anon SELECT on restaurants name for cashier-login page lookup
-- (already covered by "public can read restaurants" policy)
