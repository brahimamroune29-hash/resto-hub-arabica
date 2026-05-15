
SELECT cron.unschedule('delivery-followup-every-minute');
SELECT cron.unschedule('daily-summary-23h-algiers');

SELECT cron.schedule(
  'delivery-followup-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--bd4c9b15-cefb-4656-b94d-ab0a8989f1f4-dev.lovable.app/api/public/hooks/delivery-followup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrcmppYmZwcXdwa3J0eWtyZWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjQ3OTcsImV4cCI6MjA5NDI0MDc5N30._DDUVlOmDV59rLzcU6ECBqZmwzAWpk-RPpJ8YFpByAo'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'daily-summary-23h-algiers',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--bd4c9b15-cefb-4656-b94d-ab0a8989f1f4-dev.lovable.app/api/public/hooks/daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrcmppYmZwcXdwa3J0eWtyZWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjQ3OTcsImV4cCI6MjA5NDI0MDc5N30._DDUVlOmDV59rLzcU6ECBqZmwzAWpk-RPpJ8YFpByAo'
    ),
    body := '{}'::jsonb
  );
  $$
);
