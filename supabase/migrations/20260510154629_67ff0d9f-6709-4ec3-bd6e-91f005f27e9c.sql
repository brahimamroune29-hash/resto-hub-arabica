CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _restaurant_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND restaurant_id = _restaurant_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_restaurant_access(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants
    WHERE id = _restaurant_id
      AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE restaurant_id = _restaurant_id
      AND user_id = auth.uid()
  );
$$;