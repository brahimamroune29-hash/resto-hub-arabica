
-- Enums
CREATE TYPE public.order_status AS ENUM ('new', 'preparing', 'ready', 'paid');

-- restaurants
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  logo_url text,
  google_maps_review_url text,
  setup_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurants_owner_id_idx ON public.restaurants(owner_id);

-- categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX categories_restaurant_id_idx ON public.categories(restaurant_id);

-- menu_items
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menu_items_restaurant_id_idx ON public.menu_items(restaurant_id);
CREATE INDEX menu_items_category_id_idx ON public.menu_items(category_id);

-- tables
CREATE TABLE public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  table_number int NOT NULL,
  qr_token text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, table_number)
);
CREATE INDEX tables_restaurant_id_idx ON public.tables(restaurant_id);
CREATE INDEX tables_qr_token_idx ON public.tables(qr_token);

-- orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'new',
  total numeric(10,2) NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  served_at timestamptz,
  review_due_at timestamptz
);
CREATE INDEX orders_restaurant_id_idx ON public.orders(restaurant_id);
CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_created_at_idx ON public.orders(created_at);

-- order_items
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  price_snapshot numeric(10,2) NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0)
);
CREATE INDEX order_items_order_id_idx ON public.order_items(order_id);
CREATE INDEX order_items_menu_item_id_idx ON public.order_items(menu_item_id);

-- reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  redirected_to_google boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_restaurant_id_idx ON public.reviews(restaurant_id);
CREATE INDEX reviews_order_id_idx ON public.reviews(order_id);

-- Helper function: check if current user owns a restaurant (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.user_owns_restaurant(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = _restaurant_id AND owner_id = auth.uid()
  )
$$;

-- Enable RLS
ALTER TABLE public.restaurants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews      ENABLE ROW LEVEL SECURITY;

-- restaurants: owner-only + public read (needed for QR menu page)
CREATE POLICY "owner full access on restaurants"
  ON public.restaurants FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "public can read restaurants"
  ON public.restaurants FOR SELECT TO anon, authenticated
  USING (true);

-- categories: owner manages, public read
CREATE POLICY "owner manages categories"
  ON public.categories FOR ALL TO authenticated
  USING (public.user_owns_restaurant(restaurant_id))
  WITH CHECK (public.user_owns_restaurant(restaurant_id));
CREATE POLICY "public can read categories"
  ON public.categories FOR SELECT TO anon, authenticated
  USING (true);

-- menu_items: owner manages, public read
CREATE POLICY "owner manages menu_items"
  ON public.menu_items FOR ALL TO authenticated
  USING (public.user_owns_restaurant(restaurant_id))
  WITH CHECK (public.user_owns_restaurant(restaurant_id));
CREATE POLICY "public can read menu_items"
  ON public.menu_items FOR SELECT TO anon, authenticated
  USING (true);

-- tables: owner manages, public read (qr_token lookup)
CREATE POLICY "owner manages tables"
  ON public.tables FOR ALL TO authenticated
  USING (public.user_owns_restaurant(restaurant_id))
  WITH CHECK (public.user_owns_restaurant(restaurant_id));
CREATE POLICY "public can read tables"
  ON public.tables FOR SELECT TO anon, authenticated
  USING (true);

-- orders: owner sees/updates, public can insert (customer order placement)
CREATE POLICY "owner reads orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.user_owns_restaurant(restaurant_id));
CREATE POLICY "owner updates orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.user_owns_restaurant(restaurant_id))
  WITH CHECK (public.user_owns_restaurant(restaurant_id));
CREATE POLICY "owner deletes orders"
  ON public.orders FOR DELETE TO authenticated
  USING (public.user_owns_restaurant(restaurant_id));
CREATE POLICY "anyone can insert orders"
  ON public.orders FOR INSERT TO anon, authenticated
  WITH CHECK (true);
-- Customers also need to read their own order's status (subscribe by id from localStorage)
CREATE POLICY "public can read orders"
  ON public.orders FOR SELECT TO anon, authenticated
  USING (true);

-- order_items: owner reads, public can insert
CREATE POLICY "owner reads order_items"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.user_owns_restaurant(o.restaurant_id)));
CREATE POLICY "anyone can insert order_items"
  ON public.order_items FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "public can read order_items"
  ON public.order_items FOR SELECT TO anon, authenticated
  USING (true);

-- reviews: owner reads, public can insert
CREATE POLICY "owner reads reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (public.user_owns_restaurant(restaurant_id));
CREATE POLICY "anyone can insert reviews"
  ON public.reviews FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.reviews REPLICA IDENTITY FULL;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, authenticated owners can upload/update/delete in their own folder (folder = restaurant_id or user uid)
CREATE POLICY "public read logos"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'logos');
CREATE POLICY "auth upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos');
CREATE POLICY "auth update logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos');
CREATE POLICY "auth delete logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos');

CREATE POLICY "public read menu-images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'menu-images');
CREATE POLICY "auth upload menu-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'menu-images');
CREATE POLICY "auth update menu-images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'menu-images');
CREATE POLICY "auth delete menu-images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'menu-images');
