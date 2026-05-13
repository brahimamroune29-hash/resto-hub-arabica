CREATE POLICY "Users can read their own logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);