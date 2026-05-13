DROP POLICY IF EXISTS "owner manages ingredients" ON public.ingredients;
CREATE POLICY "restaurant members manage ingredients"
ON public.ingredients
FOR ALL
TO authenticated
USING (public.user_has_restaurant_access(restaurant_id))
WITH CHECK (public.user_has_restaurant_access(restaurant_id));

DROP POLICY IF EXISTS "owner manages suppliers" ON public.suppliers;
CREATE POLICY "restaurant members manage suppliers"
ON public.suppliers
FOR ALL
TO authenticated
USING (public.user_has_restaurant_access(restaurant_id))
WITH CHECK (public.user_has_restaurant_access(restaurant_id));

DROP POLICY IF EXISTS "owner manages purchase_orders" ON public.purchase_orders;
CREATE POLICY "restaurant members manage purchase_orders"
ON public.purchase_orders
FOR ALL
TO authenticated
USING (public.user_has_restaurant_access(restaurant_id))
WITH CHECK (public.user_has_restaurant_access(restaurant_id));

DROP POLICY IF EXISTS "owner manages purchase_items" ON public.purchase_items;
CREATE POLICY "restaurant members manage purchase_items"
ON public.purchase_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.purchase_orders po
    WHERE po.id = purchase_items.purchase_order_id
      AND public.user_has_restaurant_access(po.restaurant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.purchase_orders po
    WHERE po.id = purchase_items.purchase_order_id
      AND public.user_has_restaurant_access(po.restaurant_id)
  )
);

DROP POLICY IF EXISTS "owner manages employees" ON public.employees;
CREATE POLICY "restaurant members manage employees"
ON public.employees
FOR ALL
TO authenticated
USING (public.user_has_restaurant_access(restaurant_id))
WITH CHECK (public.user_has_restaurant_access(restaurant_id));

DROP POLICY IF EXISTS "owner manages salary_payments" ON public.salary_payments;
CREATE POLICY "restaurant members manage salary_payments"
ON public.salary_payments
FOR ALL
TO authenticated
USING (public.user_has_restaurant_access(restaurant_id))
WITH CHECK (public.user_has_restaurant_access(restaurant_id));

DROP POLICY IF EXISTS "owner manages waste_logs" ON public.waste_logs;
CREATE POLICY "restaurant members manage waste_logs"
ON public.waste_logs
FOR ALL
TO authenticated
USING (public.user_has_restaurant_access(restaurant_id))
WITH CHECK (public.user_has_restaurant_access(restaurant_id));

DROP POLICY IF EXISTS "owner manages recipes" ON public.menu_item_recipes;
CREATE POLICY "restaurant members manage recipes"
ON public.menu_item_recipes
FOR ALL
TO authenticated
USING (public.user_has_restaurant_access(restaurant_id))
WITH CHECK (public.user_has_restaurant_access(restaurant_id));