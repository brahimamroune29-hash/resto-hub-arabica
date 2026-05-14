
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'cron_secret';
  IF v_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_id, '3ee20b75de901eb135906d76e34fe17fa5b50b55fb820c54efd6b7eb5a2c4b41', 'cron_secret', 'CRON_SECRET shared with project env');
  ELSE
    PERFORM vault.create_secret('3ee20b75de901eb135906d76e34fe17fa5b50b55fb820c54efd6b7eb5a2c4b41', 'cron_secret', 'CRON_SECRET shared with project env');
  END IF;
END $$;
