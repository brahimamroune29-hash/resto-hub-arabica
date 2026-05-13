
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS chef_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.chef_credentials (
  restaurant_id uuid PRIMARY KEY,
  pin_hash text NOT NULL,
  pin_salt text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chef_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners check own chef credentials" ON public.chef_credentials
  FOR SELECT TO authenticated USING (public.user_owns_restaurant(restaurant_id));

CREATE TABLE IF NOT EXISTS public.chef_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false
);
ALTER TABLE public.chef_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read chef_sessions" ON public.chef_sessions
  FOR SELECT TO authenticated USING (public.user_owns_restaurant(restaurant_id));
CREATE POLICY "owners delete chef_sessions" ON public.chef_sessions
  FOR DELETE TO authenticated USING (public.user_owns_restaurant(restaurant_id));

CREATE TABLE IF NOT EXISTS public.chef_login_attempts (
  restaurant_id uuid PRIMARY KEY,
  failed_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chef_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read chef attempts" ON public.chef_login_attempts
  FOR SELECT TO authenticated USING (public.user_owns_restaurant(restaurant_id));
