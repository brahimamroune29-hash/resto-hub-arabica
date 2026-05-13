ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS daily_summary_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS daily_summary_last_sent_for date;