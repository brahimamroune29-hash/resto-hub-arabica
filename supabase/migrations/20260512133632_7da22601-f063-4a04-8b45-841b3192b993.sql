-- 1. Supplier transactions (debt/credit ledger)
CREATE TABLE public.supplier_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('purchase','payment','advance','return')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_tx_supplier ON public.supplier_transactions(supplier_id, date DESC);
CREATE INDEX idx_supplier_tx_restaurant ON public.supplier_transactions(restaurant_id, date DESC);

ALTER TABLE public.supplier_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage supplier_transactions"
  ON public.supplier_transactions
  FOR ALL TO authenticated
  USING (public.user_has_restaurant_access(restaurant_id))
  WITH CHECK (public.user_has_restaurant_access(restaurant_id));

-- 2. Employee deductions
CREATE TABLE public.employee_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('advance','meal','other')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  quantity int NOT NULL DEFAULT 1,
  label text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  month text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_emp_ded_employee_month ON public.employee_deductions(employee_id, month);
CREATE INDEX idx_emp_ded_restaurant_month ON public.employee_deductions(restaurant_id, month);

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage employee_deductions"
  ON public.employee_deductions
  FOR ALL TO authenticated
  USING (public.user_has_restaurant_access(restaurant_id))
  WITH CHECK (public.user_has_restaurant_access(restaurant_id));

-- 3. Employee monthly salary settlements (net salary record)
CREATE TABLE public.employee_salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  month text NOT NULL,
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE UNIQUE INDEX idx_emp_settlement_unique ON public.employee_salary_payments(employee_id, month);
CREATE INDEX idx_emp_settlement_restaurant ON public.employee_salary_payments(restaurant_id, month);

ALTER TABLE public.employee_salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage employee_salary_payments"
  ON public.employee_salary_payments
  FOR ALL TO authenticated
  USING (public.user_has_restaurant_access(restaurant_id))
  WITH CHECK (public.user_has_restaurant_access(restaurant_id));

-- 4. Operating expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  category text NOT NULL,
  custom_label text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  is_recurring boolean NOT NULL DEFAULT false,
  month text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_restaurant_month ON public.expenses(restaurant_id, month);
CREATE INDEX idx_expenses_restaurant_date ON public.expenses(restaurant_id, date DESC);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members manage expenses"
  ON public.expenses
  FOR ALL TO authenticated
  USING (public.user_has_restaurant_access(restaurant_id))
  WITH CHECK (public.user_has_restaurant_access(restaurant_id));