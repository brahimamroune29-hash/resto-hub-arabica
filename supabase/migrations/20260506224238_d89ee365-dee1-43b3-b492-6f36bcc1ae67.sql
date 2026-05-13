DROP POLICY IF EXISTS "restaurant upload menu-images" ON storage.objects;
DROP POLICY IF EXISTS "restaurant update menu-images" ON storage.objects;
DROP POLICY IF EXISTS "restaurant delete menu-images" ON storage.objects;

CREATE POLICY "restaurant access upload menu-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'menu-images'
  AND public.user_has_restaurant_access(((storage.foldername(storage.objects.name))[1])::uuid)
);

CREATE POLICY "restaurant access update menu-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'menu-images'
  AND public.user_has_restaurant_access(((storage.foldername(storage.objects.name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'menu-images'
  AND public.user_has_restaurant_access(((storage.foldername(storage.objects.name))[1])::uuid)
);

CREATE POLICY "restaurant access delete menu-images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'menu-images'
  AND public.user_has_restaurant_access(((storage.foldername(storage.objects.name))[1])::uuid)
);