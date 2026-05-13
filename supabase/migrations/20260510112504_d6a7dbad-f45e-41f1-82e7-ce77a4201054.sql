
REVOKE EXECUTE ON FUNCTION public.assign_daily_number(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_daily_number(uuid) TO service_role;
