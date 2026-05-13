-- Drop redundant authenticated SELECT policy on logos (bucket is public)
DROP POLICY IF EXISTS "Users can read their own logos" ON storage.objects;

-- Lock down SECURITY DEFINER helper functions: revoke public EXECUTE.
-- They are invoked from RLS policies (which run as the table owner) and from
-- server functions using the service role, so anon/authenticated do not need
-- to call them directly.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_restaurant_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_owns_restaurant(uuid) FROM PUBLIC, anon, authenticated;