-- Verifies that authenticated (and anon) can EXECUTE the role-check functions.
-- Exits with non-zero status if any required grant is missing.
WITH required(fn, role) AS (
  VALUES
    ('public.has_role(uuid,uuid,public.app_role)', 'authenticated'),
    ('public.has_role(uuid,uuid,public.app_role)', 'anon'),
    ('public.user_has_restaurant_access(uuid)',    'authenticated'),
    ('public.user_has_restaurant_access(uuid)',    'anon'),
    ('public.user_owns_restaurant(uuid)',          'authenticated'),
    ('public.user_owns_restaurant(uuid)',          'anon')
),
checked AS (
  SELECT r.fn, r.role,
         has_function_privilege(r.role, r.fn, 'EXECUTE') AS can_exec
  FROM required r
)
SELECT * FROM checked ORDER BY fn, role;

DO $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing
  FROM (VALUES
    ('public.has_role(uuid,uuid,public.app_role)', 'authenticated'),
    ('public.has_role(uuid,uuid,public.app_role)', 'anon'),
    ('public.user_has_restaurant_access(uuid)',    'authenticated'),
    ('public.user_has_restaurant_access(uuid)',    'anon'),
    ('public.user_owns_restaurant(uuid)',          'authenticated'),
    ('public.user_owns_restaurant(uuid)',          'anon')
  ) AS r(fn, role)
  WHERE NOT has_function_privilege(r.role, r.fn, 'EXECUTE');

  IF missing > 0 THEN
    RAISE EXCEPTION 'Missing EXECUTE grants on % role-check function(s). RLS will fail.', missing;
  END IF;
END $$;
