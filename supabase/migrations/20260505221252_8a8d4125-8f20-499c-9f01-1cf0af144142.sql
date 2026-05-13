ALTER TABLE public.tables REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;