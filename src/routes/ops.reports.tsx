import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Trash2,
  Truck,
  Download,
  Printer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRestaurantId } from "@/lib/restaurant";
import { tx } from "@/lib/ops-tx";
import { useTranslation } from "react-i18next";


export const Route = createFileRoute("/ops/reports")({
  component: OpsReports,
});

type Range = "week" | "month" | "quarter" | "year";

function fmt(n: number) {
  return new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(n);
}

function rangeStart(r: Range) {
  const now = new Date();
  if (r === "week") return new Date(now.getTime() - 7 * 86400000);
  if (r === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (r === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), q * 3, 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

const labelOf: Record<Range, string> = {
  week: tx("آخر 7 أيام"),
  month: tx("هذا الشهر"),
  quarter: tx("هذا الربع"),
  year: tx("هذه السنة"),
};

type Data = {
  revenue: number;
  purchases: number;
  salaries: number;
  operatingExpenses: number;
  waste: number;
  ordersCount: number;
  topItems: { name: string; qty: number; revenue: number }[];
  topWaste: { name: string; cost: number; qty: number }[];
  topSupplier: { name: string; total: number } | null;
};

function OpsReports() {
  useTranslation();
  const { restaurantId, loading: restaurantLoading } = useRestaurantId();
  const [range, setRange] = useState<Range>("month");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Data>({
    revenue: 0,
    purchases: 0,
    salaries: 0,
    operatingExpenses: 0,
    waste: 0,
    ordersCount: 0,
    topItems: [],
    topWaste: [],
    topSupplier: null,
  });

  const load = async (rid: string, r: Range) => {
    setLoading(true);
    const start = rangeStart(r).toISOString();

    const [ordersRes, poRes, salRes, salNetRes, expRes, wasteRes, supRes, ingRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id,total,status,created_at,order_items(menu_item_id,name_snapshot,quantity,price_snapshot)")
        .eq("restaurant_id", rid)
        .eq("status", "paid")
        .gte("created_at", start),
      supabase
        .from("purchase_orders")
        .select("supplier_id,total")
        .eq("restaurant_id", rid)
        .gte("created_at", start),
      supabase
        .from("salary_payments")
        .select("amount")
        .eq("restaurant_id", rid)
        .gte("paid_at", start),
      supabase
        .from("employee_salary_payments")
        .select("net_salary")
        .eq("restaurant_id", rid)
        .gte("paid_at", start),
      supabase
        .from("expenses")
        .select("amount,date")
        .eq("restaurant_id", rid)
        .gte("date", start.slice(0, 10)),
      supabase
        .from("waste_logs")
        .select("ingredient_id,cost,quantity")
        .eq("restaurant_id", rid)
        .gte("created_at", start),
      supabase.from("suppliers").select("id,name").eq("restaurant_id", rid),
      supabase.from("ingredients").select("id,name").eq("restaurant_id", rid),
    ]);

    const orders = (ordersRes.data ?? []) as any[];
    const revenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const purchases = (poRes.data ?? []).reduce((s, x) => s + Number(x.total || 0), 0);
    const salariesLegacy = (salRes.data ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
    const salariesNet = (salNetRes.data ?? []).reduce((s, x) => s + Number(x.net_salary || 0), 0);
    const salaries = salariesLegacy + salariesNet;
    const operatingExpenses = (expRes.data ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
    const waste = (wasteRes.data ?? []).reduce((s, x) => s + Number(x.cost || 0), 0);

    // top items
    const itemAgg = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of orders) {
      for (const it of o.order_items ?? []) {
        const key = it.name_snapshot || it.menu_item_id || "—";
        const cur = itemAgg.get(key) ?? { name: key, qty: 0, revenue: 0 };
        cur.qty += Number(it.quantity || 0);
        cur.revenue += Number(it.quantity || 0) * Number(it.price_snapshot || 0);
        itemAgg.set(key, cur);
      }
    }
    const topItems = [...itemAgg.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    // top waste
    const ingMap = new Map<string, string>();
    for (const i of ingRes.data ?? []) ingMap.set(i.id, i.name);
    const wasteAgg = new Map<string, { name: string; cost: number; qty: number }>();
    for (const w of wasteRes.data ?? []) {
      const name = ingMap.get(w.ingredient_id) || "—";
      const cur = wasteAgg.get(w.ingredient_id) ?? { name, cost: 0, qty: 0 };
      cur.cost += Number(w.cost || 0);
      cur.qty += Number(w.quantity || 0);
      wasteAgg.set(w.ingredient_id, cur);
    }
    const topWaste = [...wasteAgg.values()].sort((a, b) => b.cost - a.cost).slice(0, 5);

    // top supplier
    const supMap = new Map<string, string>();
    for (const s of supRes.data ?? []) supMap.set(s.id, s.name);
    const supAgg = new Map<string, number>();
    for (const p of poRes.data ?? []) {
      supAgg.set(p.supplier_id, (supAgg.get(p.supplier_id) ?? 0) + Number(p.total || 0));
    }
    let topSupplier: Data["topSupplier"] = null;
    for (const [id, total] of supAgg.entries()) {
      if (!topSupplier || total > topSupplier.total) {
        topSupplier = { name: supMap.get(id) || "—", total };
      }
    }

    setData({
      revenue,
      purchases,
      salaries,
      operatingExpenses,
      waste,
      ordersCount: orders.length,
      topItems,
      topWaste,
      topSupplier,
    });
    setLoading(false);
  };

  useEffect(() => {
    if (restaurantLoading) return;
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    void load(restaurantId, range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, restaurantLoading]);

  useEffect(() => {
    if (restaurantId) load(restaurantId, range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const expenses = data.purchases + data.salaries + data.waste + data.operatingExpenses;
  const net = data.revenue - expenses;

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push(tx("القسم,البند,القيمة"));
    lines.push(tx("الفترة,") + (labelOf[range]) + ",");
    lines.push(tx("ملخص,الإيرادات (طلبات مدفوعة),") + (data.revenue));
    lines.push(tx("ملخص,المشتريات,") + (data.purchases));
    lines.push(tx("ملخص,الرواتب,") + (data.salaries));
    lines.push(tx("ملخص,مصاريف التشغيل,") + (data.operatingExpenses));
    lines.push(tx("ملخص,الهدر,") + (data.waste));
    lines.push(tx("ملخص,صافي الربح,") + (net));
    lines.push("");
    lines.push(tx("الأصناف الأكثر مبيعاً,الكمية,الإيرادات"));
    for (const t of data.topItems) lines.push(`${t.name},${t.qty},${t.revenue}`);
    lines.push("");
    lines.push(tx("أكثر مكوّن مهدور,التكلفة,الكمية"));
    for (const t of data.topWaste) lines.push(`${t.name},${t.cost},${t.qty}`);

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPnlPdf = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(tx("<!doctype html><html dir=\"rtl\" lang=\"ar\"><head><meta charset=\"utf-8\"/>\n      <title>الربح الحقيقي — ") + (labelOf[range]) + tx("</title>\n      <style>\n        body{font-family:Cairo,system-ui,sans-serif;padding:24px;color:#111}\n        h1{margin:0 0 12px}\n        table{width:100%;border-collapse:collapse;font-size:14px}\n        td{padding:8px 10px;border-bottom:1px solid #eee}\n        .total{font-weight:bold;font-size:18px;background:#fafafa}\n        .pos{color:#16a34a} .neg{color:#dc2626}\n      </style></head><body>\n      <h1>تقرير الربح الحقيقي — ") + (labelOf[range]) + tx("</h1>\n      <table>\n        <tr><td>{tx(\"إجمالي الإيرادات\")}</td><td style=\"text-align:left\" class=\"pos\">+ ") + (fmt(data.revenue)) + tx(" دج</td></tr>\n        <tr><td>{tx(\"مصاريف التشغيل\")}</td><td style=\"text-align:left\" class=\"neg\">- ") + (fmt(data.operatingExpenses)) + tx(" دج</td></tr>\n        <tr><td>{tx(\"مشتريات الموردين\")}</td><td style=\"text-align:left\" class=\"neg\">- ") + (fmt(data.purchases)) + tx(" دج</td></tr>\n        <tr><td>{tx(\"رواتب الموظفين\")}</td><td style=\"text-align:left\" class=\"neg\">- ") + (fmt(data.salaries)) + tx(" دج</td></tr>\n        <tr><td>{tx(\"تكلفة الهدر\")}</td><td style=\"text-align:left\" class=\"neg\">- ") + (fmt(data.waste)) + tx(" دج</td></tr>\n        <tr class=\"total\"><td>") + (net >= 0 ? "الربح الصافي" : "الخسارة الصافية") + "</td>\n          <td style=\"text-align:left\" class=\"" + (net >= 0 ? "pos" : "neg") + "\">" + (fmt(net)) + tx(" دج</td></tr>\n      </table>\n      <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>\n      </body></html>"));
    win.document.close();
  };

  const kpis = useMemo(
    () => [
      {
        label: tx("الإيرادات"),
        value: (fmt(data.revenue)) + tx(" دج"),
        hint: (data.ordersCount) + tx(" طلب مدفوع"),
        icon: TrendingUp,
        tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      },
      {
        label: tx("المصاريف"),
        value: (fmt(expenses)) + tx(" دج"),
        hint: tx("مشتريات + رواتب + هدر"),
        icon: TrendingDown,
        tone: "bg-destructive/10 text-destructive",
      },
      {
        label: tx("صافي الربح"),
        value: (fmt(net)) + tx(" دج"),
        hint: data.revenue > 0 ? (((net / data.revenue) * 100).toFixed(1)) + tx("% هامش") : "—",
        icon: PiggyBank,
        tone:
          net >= 0
            ? "bg-primary/10 text-primary"
            : "bg-destructive/10 text-destructive",
      },
      {
        label: tx("تكلفة الهدر"),
        value: (fmt(data.waste)) + tx(" دج"),
        hint: data.revenue > 0 ? (((data.waste / data.revenue) * 100).toFixed(1)) + tx("% من الإيراد") : "—",
        icon: Trash2,
        tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      },
    ],
    [data, expenses, net],
  );

  return (
    <div className="p-2 space-y-4" dir="rtl">
      <Card className="p-4 rounded-2xl glass shadow-glass border-border/60">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-base">{tx("التقارير المالية")}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {tx("أداء المطعم: إيرادات، مصاريف، ربح، وأكثر الأصناف والمكونات.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={(v) => setRange(v as Range)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">{tx("آخر 7 أيام")}</SelectItem>
                <SelectItem value="month">{tx("هذا الشهر")}</SelectItem>
                <SelectItem value="quarter">{tx("هذا الربع")}</SelectItem>
                <SelectItem value="year">{tx("هذه السنة")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv} disabled={loading}>
              <Download className="w-4 h-4 ml-1" /> CSV
            </Button>
            <Button variant="outline" onClick={exportPnlPdf} disabled={loading}>
              <Printer className="w-4 h-4 ml-1" /> P&L PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Real P&L breakdown */}
      <Card className="p-5 rounded-2xl glass shadow-glass border-border/60">
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-primary" /> {tx("الربح الحقيقي")}
        </h4>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span>{tx("إجمالي الإيرادات")}</span>
            <span className="text-emerald-600 font-semibold">+ {fmt(data.revenue)} دج</span>
          </div>
          <div className="flex justify-between">
            <span>{tx("مصاريف التشغيل")}</span>
            <span className="text-destructive">- {fmt(data.operatingExpenses)} دج</span>
          </div>
          <div className="flex justify-between">
            <span>{tx("مشتريات الموردين")}</span>
            <span className="text-destructive">- {fmt(data.purchases)} دج</span>
          </div>
          <div className="flex justify-between">
            <span>{tx("رواتب الموظفين")}</span>
            <span className="text-destructive">- {fmt(data.salaries)} دج</span>
          </div>
          <div className="flex justify-between">
            <span>{tx("تكلفة الهدر")}</span>
            <span className="text-destructive">- {fmt(data.waste)} دج</span>
          </div>
          <div className="border-t border-border/60 pt-2 mt-1 flex justify-between text-base font-bold">
            <span>{net >= 0 ? tx("الربح الصافي") : tx("الخسارة الصافية")}</span>
            <span className={net >= 0 ? "text-emerald-600" : "text-destructive"}>
              {fmt(net)} دج
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((it) => {
          const Icon = it.icon;
          return (
            <Card key={it.label} className="p-5 rounded-2xl glass shadow-glass border-border/60">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${it.tone}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-xs text-muted-foreground mb-1">{it.label}</div>
              <div className="text-2xl font-bold tracking-tight">{loading ? "…" : it.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{it.hint}</div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 rounded-2xl glass shadow-glass border-border/60">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> {tx("الأصناف الأكثر مبيعاً")}
          </h4>
          {data.topItems.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">{tx("لا توجد بيانات")}</div>
          ) : (
            <div className="space-y-2">
              {data.topItems.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm border-b border-border/60 last:border-0 pb-2 last:pb-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate">{t.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {t.qty} × · <span className="font-semibold text-foreground">{fmt(t.revenue)} دج</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 rounded-2xl glass shadow-glass border-border/60">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-orange-600" /> {tx("أكثر مكوّن مهدور")}
          </h4>
          {data.topWaste.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">{tx("لا توجد بيانات")}</div>
          ) : (
            <div className="space-y-2">
              {data.topWaste.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm border-b border-border/60 last:border-0 pb-2 last:pb-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-600 text-xs flex items-center justify-center font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate">{t.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {fmt(t.qty)} · <span className="font-semibold text-destructive">{fmt(t.cost)} دج</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 rounded-2xl glass shadow-glass border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{tx("المورد الأكثر اعتماداً")}</div>
              <div className="font-semibold truncate">
                {data.topSupplier ? data.topSupplier.name : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {data.topSupplier ? (fmt(data.topSupplier.total)) + tx(" دج") : tx("لا توجد مشتريات")}
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-5 rounded-2xl glass shadow-glass border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-muted text-foreground flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{tx("تفاصيل المصاريف")}</div>
              <div className="text-xs mt-1">
                {tx("مصاريف التشغيل:")} <span className="font-semibold">{fmt(data.operatingExpenses)} {tx("دج")}</span>
              </div>
              <div className="text-xs mt-1">
                {tx("مشتريات:")} <span className="font-semibold">{fmt(data.purchases)} {tx("دج")}</span>
              </div>
              <div className="text-xs">
                {tx("رواتب:")} <span className="font-semibold">{fmt(data.salaries)} {tx("دج")}</span>
              </div>
              <div className="text-xs">
                {tx("هدر:")} <span className="font-semibold">{fmt(data.waste)} {tx("دج")}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}