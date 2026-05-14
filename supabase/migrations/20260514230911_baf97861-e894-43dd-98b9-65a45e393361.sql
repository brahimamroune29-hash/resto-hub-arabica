
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'cron_secret';
  IF v_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_id, 'menuflow_cron_3ee20b75de901eb135906d76e34fe17fa5b50b55fb820c54efd6b7eb5a2c4b41', 'cron_secret', 'shared with project env CRON_SECRET');
  ELSE
    PERFORM vault.create_secret('menuflow_cron_3ee20b75de901eb135906d76e34fe17fa5b50b55fb820c54efd6b7eb5a2c4b41', 'cron_secret', 'shared with project env CRON_SECRET');
  END IF;
END $$;
