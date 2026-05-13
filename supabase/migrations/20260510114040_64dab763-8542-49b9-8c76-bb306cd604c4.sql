ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS summary_bot_token text,
ADD COLUMN IF NOT EXISTS summary_bot_username text,
ADD COLUMN IF NOT EXISTS summary_chat_id bigint,
ADD COLUMN IF NOT EXISTS summary_username text,
ADD COLUMN IF NOT EXISTS summary_link_token text;