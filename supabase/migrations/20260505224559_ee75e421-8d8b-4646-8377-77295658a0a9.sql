
-- Add owner delete policies for cascading account deletion
CREATE POLICY "owner deletes order_items"
ON public.order_items
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = order_items.order_id AND public.user_owns_restaurant(o.restaurant_id)
));

CREATE POLICY "owner deletes reviews"
ON public.reviews
FOR DELETE
TO authenticated
USING (public.user_owns_restaurant(restaurant_id));
