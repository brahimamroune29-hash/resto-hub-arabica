-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _restaurant_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND restaurant_id = _restaurant_id AND role = _role
  );
$$;

-- has_any_access function: owner OR has any role
CREATE OR REPLACE FUNCTION public.user_has_restaurant_access(_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = _restaurant_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE restaurant_id = _restaurant_id AND user_id = auth.uid()
  );
$$;

-- RLS: users can read their own roles
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Owners can manage roles for their restaurants
CREATE POLICY "owners manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.user_owns_restaurant(restaurant_id))
  WITH CHECK (public.user_owns_restaurant(restaurant_id));

-- Staff invitations
CREATE TABLE public.staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'staff',
  invited_by UUID NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, email)
);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage invitations" ON public.staff_invitations
  FOR ALL TO authenticated
  USING (public.user_owns_restaurant(restaurant_id))
  WITH CHECK (public.user_owns_restaurant(restaurant_id));

-- Anyone authenticated can read pending invitations matching their email (to accept them)
CREATE POLICY "users read own pending invitations" ON public.staff_invitations
  FOR SELECT TO authenticated
  USING (
    accepted = false 
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Users can update their own invitation to accept
CREATE POLICY "users accept own invitations" ON public.staff_invitations
  FOR UPDATE TO authenticated
  USING (
    accepted = false
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Extend access to existing tables for staff (in addition to owner)
-- Staff can read & update orders
CREATE POLICY "staff read orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), restaurant_id, 'staff'));

CREATE POLICY "staff update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), restaurant_id, 'staff'))
  WITH CHECK (public.has_role(auth.uid(), restaurant_id, 'staff'));

-- Staff read order_items
CREATE POLICY "staff read order_items" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND public.has_role(auth.uid(), o.restaurant_id, 'staff')
  ));

-- Staff read & update menu_items (toggle availability)
CREATE POLICY "staff read menu_items" ON public.menu_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), restaurant_id, 'staff'));

CREATE POLICY "staff update menu_items availability" ON public.menu_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), restaurant_id, 'staff'))
  WITH CHECK (public.has_role(auth.uid(), restaurant_id, 'staff'));

-- Staff read categories, tables, restaurants
CREATE POLICY "staff read categories" ON public.categories
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), restaurant_id, 'staff'));

CREATE POLICY "staff read tables" ON public.tables
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), restaurant_id, 'staff'));

CREATE POLICY "staff read restaurant" ON public.restaurants
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), id, 'staff'));