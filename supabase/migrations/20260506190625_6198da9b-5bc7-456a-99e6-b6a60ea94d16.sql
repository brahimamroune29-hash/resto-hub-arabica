
-- 1) Remove public exposure of owner_id on restaurants.
-- The QR/menu flow uses the service role (supabaseAdmin) and does not depend on this policy.
-- Owners and staff still have access via existing policies.
DROP POLICY IF EXISTS "public can read restaurants" ON public.restaurants;

-- 2) Lock down Realtime broadcast/presence channels.
-- App uses postgres_changes only, which bypasses realtime.messages RLS and
-- relies on each source table's own RLS for row visibility.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can read messages" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can write messages" ON realtime.messages;
DROP POLICY IF EXISTS "deny all reads" ON realtime.messages;
DROP POLICY IF EXISTS "deny all writes" ON realtime.messages;

-- Explicit restrictive deny-all so scanners see policies present.
CREATE POLICY "deny all reads"
  ON realtime.messages
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "deny all writes"
  ON realtime.messages
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);
