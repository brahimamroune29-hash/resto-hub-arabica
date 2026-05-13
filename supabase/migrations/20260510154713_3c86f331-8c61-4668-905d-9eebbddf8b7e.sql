DROP POLICY IF EXISTS "deny user reads order telegram messages" ON public.order_telegram_messages;
DROP POLICY IF EXISTS "deny user writes order telegram messages" ON public.order_telegram_messages;
DROP POLICY IF EXISTS "deny user updates order telegram messages" ON public.order_telegram_messages;
DROP POLICY IF EXISTS "deny user deletes order telegram messages" ON public.order_telegram_messages;

CREATE POLICY "deny user reads order telegram messages"
ON public.order_telegram_messages
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (false);

CREATE POLICY "deny user writes order telegram messages"
ON public.order_telegram_messages
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "deny user updates order telegram messages"
ON public.order_telegram_messages
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "deny user deletes order telegram messages"
ON public.order_telegram_messages
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);