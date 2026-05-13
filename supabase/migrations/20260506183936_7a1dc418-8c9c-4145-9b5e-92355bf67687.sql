-- Enable RLS on realtime.messages and deny all broadcast/presence access.
-- The app only uses postgres_changes, which is filtered by the source tables' RLS
-- (orders/reviews already restrict SELECT to the owning restaurant).
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing permissive policies if present
DROP POLICY IF EXISTS "Allow all" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can read messages" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can write messages" ON realtime.messages;

-- No policies = deny all. This blocks broadcast/presence channels for every
-- role; postgres_changes streams continue to work because they bypass
-- realtime.messages RLS and rely on the source table's RLS instead.
