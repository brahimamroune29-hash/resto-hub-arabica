DROP POLICY IF EXISTS "public can read orders" ON public.orders;
DROP POLICY IF EXISTS "members read orders" ON public.orders;
CREATE POLICY "members read orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.user_has_restaurant_access(restaurant_id));

DROP POLICY IF EXISTS "public can read order_items" ON public.order_items;
DROP POLICY IF EXISTS "members read order_items" ON public.order_items;
CREATE POLICY "members read order_items"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.user_has_restaurant_access(o.restaurant_id)
    )
  );

DROP POLICY IF EXISTS "auth upload logos" ON storage.objects;
CREATE POLICY "auth upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );