# Operations Management — Phased Build Plan

This is a very large request (9 modules, ~7 new tables, 5+ new routes, 4 enhancements). Building it all in one shot risks breaking the working system. I propose **3 phases** so you can review/test between them.

Items #1, #2, #3 (Suppliers balances, Employee deductions, Expenses) are **already partially implemented** from the previous turn — tables exist, dialogs exist, wiring is in place. I will finish polishing them in Phase 1 and then move to the new modules.

---

## Phase 1 — Finish what's started (#1, #2, #3, #7 P&L, #8)

**Already done:**
- DB tables: `supplier_transactions`, `employee_deductions`, `employee_salary_payments`, `expenses`
- `SupplierStatementDialog` (running balance, PDF print, payment entry)
- `EmployeeDeductionsDialog` (advances/meals/other, net salary, payment confirm)
- `/ops/expenses` route + sidebar link
- Dropdown buttons wired in suppliers/employees pages

**Remaining polish:**
- Add **مدين / دائن / متوازن** badge + net balance amount on each supplier card (compute from `purchase_orders` + `supplier_transactions`)
- Auto-record purchase order in `supplier_transactions` (type=`purchase`) when a PO is created (so the statement and balance stay in sync)
- Verify expenses dashboard has bar-chart breakdown + last-3-months comparison
- **#7 Real P&L**: add to `/ops/reports` — Revenue − (Expenses + Purchases + Net salaries) per month, PDF export
- **#8 Fiche Technique**: cost-per-dish + margin in `/ops/recipes` (recipes table & inventory deduction trigger already exist)

---

## Phase 2 — Staff Performance (#4) + Loyalty (#5)

This phase requires schema changes to `orders` and `employees` and a PIN entry flow in cashier/kitchen. Higher risk because it touches order creation flow.

- ALTER `employees`: add `staff_pin`, expand `role` enum (waiter/cashier/kitchen/manager)
- ALTER `orders`: add `assigned_waiter_id`, `assigned_kitchen_id`, `customer_id`
- New `customers` + `customer_points_log` tables
- New `/ops/staff-performance` route — sales handled, ticket avg, prep time, charts
- New `/ops/customers` route — profiles, points, history, offer creation
- Optional PIN selector in cashier/order entry (lightweight — auto-prompts before submit)

---

## Phase 3 — Complaints (#6) + Inventory Count (#9)

Self-contained, low risk.

- New `complaints` table + public form on customer menu page (`/r/[qr_token]`) + ops dashboard
- New `inventory_counts` + `inventory_count_items` tables + `/ops/inventory-count` route with variance report + PDF

---

## Technical notes

- All new tables get RLS via `user_has_restaurant_access(restaurant_id)`, matching existing pattern
- All UI uses existing shadcn components, dark theme tokens, Arabic RTL
- Charts: continue using `recharts` (already in project for analytics)
- PDF: browser print (same as `SupplierStatementDialog`) for consistency
- No changes to: orders flow, menu display, kitchen screen, cashier login, QR system, reviews — only additive ALTERs in Phase 2

---

## Question

**Do I proceed with Phase 1 only now, or do you want me to push through all 3 phases in one go?**

Phase 1 alone is ~5–6 files. All 3 phases is ~20+ files plus 4 migrations and ~7 new tables — much higher risk of regressions and harder to review.
