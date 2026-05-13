GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_has_restaurant_access(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_restaurant(uuid) TO authenticated, anon;