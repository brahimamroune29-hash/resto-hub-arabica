
-- Remove public read on tables (qr_token must not leak)
DROP POLICY IF EXISTS "public can read tables" ON public.tables;

-- Tighten storage policies for logos and menu-images: scope by owner folder
DROP POLICY IF EXISTS "auth delete logos" ON storage.objects;
DROP POLICY IF EXISTS "auth update logos" ON storage.objects;
DROP POLICY IF EXISTS "auth upload logos" ON storage.objects;
DROP POLICY IF EXISTS "auth delete menu-images" ON storage.objects;
DROP POLICY IF EXISTS "auth update menu-images" ON storage.objects;
DROP POLICY IF EXISTS "auth upload menu-images" ON storage.objects;

CREATE POLICY "owner upload logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "owner update logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'logos' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "owner delete logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "owner upload menu-images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'menu-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "owner update menu-images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'menu-images' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'menu-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "owner delete menu-images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'menu-images' AND (auth.uid())::text = (storage.foldername(name))[1]);
