ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS splash_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS splash_always_show boolean NOT NULL DEFAULT false;