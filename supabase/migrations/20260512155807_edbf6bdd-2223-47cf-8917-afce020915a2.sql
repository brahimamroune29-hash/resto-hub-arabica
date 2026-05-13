
DROP POLICY IF EXISTS "public submit complaints" ON public.complaints;
CREATE POLICY "public submit complaints" ON public.complaints FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id));
