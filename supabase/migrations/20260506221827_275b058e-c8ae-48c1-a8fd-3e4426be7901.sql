
DROP POLICY IF EXISTS "owner upload menu-images" ON storage.objects;
DROP POLICY IF EXISTS "owner update menu-images" ON storage.objects;
DROP POLICY IF EXISTS "owner delete menu-images" ON storage.objects;

CREATE POLICY "restaurant upload menu-images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'menu-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND r.owner_id = auth.uid()
  )
);

CREATE POLICY "restaurant update menu-images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'menu-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND r.owner_id = auth.uid()
  )
);

CREATE POLICY "restaurant delete menu-images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND r.owner_id = auth.uid()
  )
);
