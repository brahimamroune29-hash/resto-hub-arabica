-- Feature parity with the owner's newer build (2026-07-18):
--
-- 1. Salary unification: reports were summing BOTH salary_payments (legacy)
--    and employee_salary_payments (settlements) — double-counting salaries.
--    Legacy rows are migrated as settlements (deductions unknown → 0) before
--    the legacy table is dropped.
-- 2. Customers/loyalty removed (0 rows — manual bookkeeping nobody used).
-- 3. Shared kitchen PIN removed — superseded by per-chef accounts
--    (individual_chef_credentials), which staff-performance depends on.

INSERT INTO public.employee_salary_payments
  (restaurant_id, employee_id, month, base_salary, total_deductions, net_salary, notes, paid_at)
SELECT restaurant_id, employee_id, to_char(period_month, 'YYYY-MM'),
       amount, 0, amount, notes, paid_at
FROM public.salary_payments;

DROP TABLE IF EXISTS public.salary_payments;

DROP TABLE IF EXISTS public.customer_points_log;
DROP TABLE IF EXISTS public.customers;
ALTER TABLE public.orders DROP COLUMN IF EXISTS customer_id;

DROP TABLE IF EXISTS public.chef_sessions;
DROP TABLE IF EXISTS public.chef_login_attempts;
DROP TABLE IF EXISTS public.chef_credentials;
ALTER TABLE public.restaurants DROP COLUMN IF EXISTS chef_enabled;
