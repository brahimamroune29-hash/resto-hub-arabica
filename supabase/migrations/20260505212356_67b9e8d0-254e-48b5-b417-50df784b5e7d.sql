
-- Drop overly-permissive anon insert/select policies on transactional tables
DROP POLICY IF EXISTS "anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "anyone can insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "anyone can insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "public can read orders" ON public.orders;
DROP POLICY IF EXISTS "public can read order_items" ON public.order_items;

-- Drop the broad storage SELECT policies (public buckets already serve via CDN)
DROP POLICY IF EXISTS "public read logos" ON storage.objects;
DROP POLICY IF EXISTS "public read menu-images" ON storage.objects;

-- Restrict execute on helper function
REVOKE EXECUTE ON FUNCTION public.user_owns_restaurant(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_owns_restaurant(uuid) TO authenticated;
