-- Restrict public complaint inserts: route through server function (uses service role)
DROP POLICY IF EXISTS "public submit complaints" ON public.complaints;

-- Re-affirm column-level revoke on sensitive restaurant tokens
REVOKE SELECT (telegram_bot_token, summary_bot_token, telegram_link_token, summary_link_token, delivery_token, takeaway_token)
  ON public.restaurants FROM authenticated, anon;