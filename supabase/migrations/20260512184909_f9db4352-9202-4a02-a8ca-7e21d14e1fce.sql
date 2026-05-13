-- 1) Restrict client read of sensitive token columns on restaurants.
--    Server code uses service_role (supabaseAdmin) and is unaffected.
REVOKE SELECT (
  telegram_bot_token,
  summary_bot_token,
  telegram_link_token,
  summary_link_token,
  delivery_token,
  takeaway_token
) ON public.restaurants FROM authenticated, anon;

-- 2) Remove unused plaintext staff_pin column (no application code reads/writes it).
ALTER TABLE public.employees DROP COLUMN IF EXISTS staff_pin;

-- 3) Drop the broad SELECT policy that allows listing files in splash-media.
--    Bucket remains public, so direct file URLs continue to work, but listing
--    via storage.objects is no longer permitted.
DROP POLICY IF EXISTS "Splash media is publicly accessible" ON storage.objects;
