CREATE OR REPLACE FUNCTION public.current_business_day(_at timestamp with time zone DEFAULT now())
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT ((_at AT TIME ZONE 'Africa/Algiers') - interval '5 hours')::date
$function$;