-- Make INSERT policy explicit (in addition to existing ALL policy)
CREATE POLICY "Users can create their own restaurant"
ON public.restaurants FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());