
-- Recipes: link menu items to ingredients
CREATE TABLE public.menu_item_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  menu_item_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(menu_item_id, ingredient_id)
);

CREATE INDEX idx_menu_item_recipes_item ON public.menu_item_recipes(menu_item_id);
CREATE INDEX idx_menu_item_recipes_rest ON public.menu_item_recipes(restaurant_id);

ALTER TABLE public.menu_item_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages recipes"
  ON public.menu_item_recipes
  FOR ALL TO authenticated
  USING (user_owns_restaurant(restaurant_id))
  WITH CHECK (user_owns_restaurant(restaurant_id));

-- Track which orders have already deducted inventory to avoid double-deduction
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS inventory_deducted_at timestamptz;

-- Function: deduct inventory based on recipes when order is paid
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid'
     AND (OLD.status IS DISTINCT FROM 'paid')
     AND NEW.inventory_deducted_at IS NULL THEN
    UPDATE public.ingredients i
    SET current_stock = i.current_stock - sub.total_qty,
        updated_at = now()
    FROM (
      SELECT r.ingredient_id, SUM(oi.quantity * r.quantity) AS total_qty
      FROM public.order_items oi
      JOIN public.menu_item_recipes r ON r.menu_item_id = oi.menu_item_id
      WHERE oi.order_id = NEW.id
      GROUP BY r.ingredient_id
    ) sub
    WHERE i.id = sub.ingredient_id
      AND i.restaurant_id = NEW.restaurant_id;

    NEW.inventory_deducted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_inventory_on_paid ON public.orders;
CREATE TRIGGER trg_deduct_inventory_on_paid
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.deduct_inventory_on_paid();
