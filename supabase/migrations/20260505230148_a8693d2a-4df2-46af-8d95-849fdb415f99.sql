-- Move pin hash to a separate table that anon CANNOT read
CREATE TABLE IF NOT EXISTS public.cashier_credentials (
  restaurant_id UUID PRIMARY KEY,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cashier_credentials ENABLE ROW LEVEL SECURITY;

-- Owner can check that credentials exist (boolean-like) but cannot read hash unless they really want
CREATE POLICY "owners check own credentials" ON public.cashier_credentials
  FOR SELECT TO authenticated
  USING (public.user_owns_restaurant(restaurant_id));

-- No INSERT/UPDATE/DELETE policy from authenticated → only service role (server functions) can write.

-- Add a flag on restaurants to indicate cashier is enabled (publicly visible is OK; reveals nothing sensitive)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS cashier_enabled BOOLEAN NOT NULL DEFAULT false;

-- Drop the temporary columns
ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS cashier_pin_hash,
  DROP COLUMN IF EXISTS cashier_pin_salt;