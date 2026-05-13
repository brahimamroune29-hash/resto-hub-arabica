import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Wallet, AlertTriangle, Users, Trash2, TrendingUp, PiggyBank } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { tx } from "@/lib/ops-tx";
import { useTranslation } from "react-i18next";


export const Route = createFileRoute("/ops/")({
  component: OpsOverview,
});

type Kpis = {
  monthExpenses: number;
  lowStock: number;
  pendingSalaries: number;
  weekWaste: number;
  monthRevenue: number;
  monthNet: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(n);
}

function OpsOverview() {
  useTranslation();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis>({
    monthExpenses: 0,
    lowStock: 0,
    pendingSalaries: 0,
    weekWaste: 0,
    monthRevenue: 0,
    monthNet: 0,
  });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: r } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", u.user.id)
        .maybeSingle();
      if (!r) {
        setLoading(false);
        return;
      }
      const rid = r.id;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const periodMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);

      const [poRes, salRes, ingRes, empRes, paidRes, wasteRes, ordersRes, monthWasteRes] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select("total")
          .eq("restaurant_id", rid)
          .gte("created_at", monthStart),
        supabase
          .from("salary_payments")
          .select("amount")
          .eq("restaurant_id", rid)
          .gte("paid_at", monthStart),
        supabase
          .from("ingredients")
          .select("id,current_stock,alert_threshold")
          .eq("restaurant_id", rid),
        supabase
          .from("employees")
          .select("id")
          .eq("restaurant_id", rid)
          .eq("is_active", true),
        supabase
          .from("salary_payments")
          .select("employee_id")
          .eq("restaurant_id", rid)
          .eq("period_month", periodMonth),
        supabase
          .from("waste_logs")
          .select("cost")
          .eq("restaurant_id", rid)
          .gte("created_at", weekStart),
        supabase
          .from("orders")
          .select("total")
          .eq("restaurant_id", rid)
          .eq("status", "paid")
          .gte("created_at", monthStart),
        supabase
          .from("waste_logs")
          .select("cost")
          .eq("restaurant_id", rid)
          .gte("created_at", monthStart),
      ]);

      const purchases = (poRes.data ?? []).reduce((s, x) => s + Number(x.total || 0), 0);
      const salaries = (salRes.data ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
      const lowStock = (ingRes.data ?? []).filter(
        (i) => Number(i.current_stock) < Number(i.alert_threshold),
      ).length;
      const paidIds = new Set((paidRes.data ?? []).map((p) => p.employee_id));
      const pendingSalaries = (empRes.data ?? []).filter((e) => !paidIds.has(e.id)).length;
      const weekWaste = (wasteRes.data ?? []).reduce((s, x) => s + Number(x.cost || 0), 0);
      const monthRevenue = (ordersRes.data ?? []).reduce((s, x) => s + Number(x.total || 0), 0);
      const monthWaste = (monthWasteRes.data ?? []).reduce((s, x) => s + Number(x.cost || 0), 0);
      const monthExpensesAll = purchases + salaries + monthWaste;

      setKpis({
        monthExpenses: purchases + salaries,
        lowStock,
        pendingSalaries,
        weekWaste,
        monthRevenue,
        monthNet: monthRevenue - monthExpensesAll,
      });
      setLoading(false);
    })();
  }, []);

  const items = [
    {
      label: tx("إيرادات هذا الشهر"),
      value: (fmt(kpis.monthRevenue)) + tx(" دج"),
      hint: tx("طلبات مدفوعة"),
      icon: TrendingUp,
      tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: tx("صافي الربح"),
      value: (fmt(kpis.monthNet)) + tx(" دج"),
      hint: tx("إيرادات − (مشتريات + رواتب + هدر)"),
      icon: PiggyBank,
      tone:
        kpis.monthNet >= 0
          ? "bg-primary/10 text-primary"
          : "bg-destructive/10 text-destructive",
    },
    {
      label: tx("مصاريف هذا الشهر"),
      value: (fmt(kpis.monthExpenses)) + tx(" دج"),
      hint: tx("مشتريات + رواتب"),
      icon: Wallet,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: tx("مكونات ناقصة"),
      value: `${kpis.lowStock}`,
      hint: tx("أقل من حد التنبيه"),
      icon: AlertTriangle,
      tone: "bg-destructive/10 text-destructive",
    },
    {
      label: tx("رواتب معلقة"),
      value: `${kpis.pendingSalaries}`,
      hint: tx("موظفين لم يُدفعوا هذا الشهر"),
      icon: Users,
      tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    },
    {
      label: tx("تكلفة الهدر هذا الأسبوع"),
      value: (fmt(kpis.weekWaste)) + tx(" دج"),
      hint: tx("آخر 7 أيام"),
      icon: Trash2,
      tone: "bg-muted text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-2">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Card key={it.label} className="p-5 rounded-2xl glass shadow-glass border-border/60">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${it.tone}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mb-1">{it.label}</div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {loading ? "…" : it.value}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">{it.hint}</div>
          </Card>
        );
      })}
    </div>
  );
}
