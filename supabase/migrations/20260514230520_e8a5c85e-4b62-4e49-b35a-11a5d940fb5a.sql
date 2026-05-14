
-- Store cron secret in vault (will be replaced with real CRON_SECRET value)
DO $$
DECLARE
  v_secret text;
BEGIN
  -- Generate a placeholder secret if not exists
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_secret') THEN
    v_secret := encode(gen_random_bytes(32), 'hex');
    PERFORM vault.create_secret(v_secret, 'cron_secret', 'CRON_SECRET shared with project env for hook auth');
  END IF;
END $$;

-- Schedule delivery-followup every minute
SELECT cron.schedule(
  'delivery-followup-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--bd4c9b15-cefb-4656-b94d-ab0a8989f1f4-dev.lovable.app/api/public/hooks/delivery-followup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule daily-summary at 23:00 Africa/Algiers (22:00 UTC)
SELECT cron.schedule(
  'daily-summary-23h-algiers',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--bd4c9b15-cefb-4656-b94d-ab0a8989f1f4-dev.lovable.app/api/public/hooks/daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
