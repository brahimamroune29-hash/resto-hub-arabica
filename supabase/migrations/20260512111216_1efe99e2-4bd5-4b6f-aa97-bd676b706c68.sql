
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS cover_video_url text,
  ADD COLUMN IF NOT EXISTS cover_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS splash_description text,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS brand_color text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('splash-media', 'splash-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Splash media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'splash-media');

CREATE POLICY "Owners upload splash media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'splash-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owners update splash media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'splash-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Owners delete splash media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'splash-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
