import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId, formatDZD } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { tx } from "@/lib/ops-tx";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/ops/expenses")({
  component: OpsExpenses,
});

const CATEGORIES = [
  tx("الإيجار"),
  tx("الكهرباء والماء"),
  tx("الإنترنت"),
  tx("تأمينات العمال"),
  tx("الصيانة والإصلاحات"),
  tx("نقل العمال والبضائع"),
  tx("مصاريف أخرى"),
] as const;

type Expense = {
  id: string;
  category: string;
  custom_label: string | null;
  amount: number;
  date: string;
  notes: string | null;
  is_recurring: boolean;
  month: string;
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function OpsExpenses() {
  useTranslation();
  const { restaurantId, loading: restaurantLoading } = useRestaurantId();
  const [month, setMonth] = useState(currentMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // P&L data
  const [revenue, setRevenue] = useState(0);
  const [supplierPurchases, setSupplierPurchases] = useState(0);
  const [employeeSalaries, setEmployeeSalaries] = useState(0);
  const [last3, setLast3] = useState<{ month: string; total: number }[]>([]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    category: string;
    custom_label: string;
    amount: string;
    date: string;
    notes: string;
    is_recurring: boolean;
  }>({
    category: CATEGORIES[0],
    custom_label: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
    is_recurring: false,
  });
  const [saving, setSaving] = useState(false);

  const monthBounds = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    const start = `${y}-${String(mo).padStart(2, "0")}-01`;
    const next = new Date(y, mo, 1);
    const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
    return { start, end };
  };

  const load = async (rid: string) => {
    setLoading(true);
    const { start, end } = monthBounds(month);
    const last3Months = [shiftMonth(month, -2), shiftMonth(month, -1), month];

    const [exps, ords, purchases, sals, exps3] = await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .eq("restaurant_id", rid)
        .eq("month", month)
        .order("date", { ascending: false }),
      supabase
        .from("orders")
        .select("total,status,created_at")
        .eq("restaurant_id", rid)
        .gte("created_at", start)
        .lt("created_at", end),
      supabase
        .from("purchase_orders")
        .select("total,created_at")
        .eq("restaurant_id", rid)
        .gte("created_at", start)
        .lt("created_at", end),
      supabase
        .from("employee_salary_payments")
        .select("net_salary,month")
        .eq("restaurant_id", rid)
        .eq("month", month),
      supabase
        .from("expenses")
        .select("amount,month")
        .eq("restaurant_id", rid)
        .in("month", last3Months),
    ]);

    setExpenses((exps.data ?? []) as Expense[]);
    const paidOrders = (ords.data ?? []).filter((o) =>
      ["paid", "served", "ready"].includes(String(o.status)),
    );
    setRevenue(paidOrders.reduce((s, o) => s + Number(o.total || 0), 0));
    setSupplierPurchases((purchases.data ?? []).reduce((s, p) => s + Number(p.total || 0), 0));
    setEmployeeSalaries((sals.data ?? []).reduce((s, p) => s + Number(p.net_salary || 0), 0));

    const map = new Map<string, number>();
    last3Months.forEach((m) => map.set(m, 0));
    for (const e of exps3.data ?? []) {
      map.set(e.month as string, (map.get(e.month as string) ?? 0) + Number(e.amount || 0));
    }
    setLast3(last3Months.map((m) => ({ month: m, total: map.get(m) ?? 0 })));

    setLoading(false);
  };

  useEffect(() => {
    if (restaurantLoading) return;
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    void load(restaurantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, restaurantLoading, month]);

  const totalThisMonth = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    [expenses],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const key = e.category;
      map.set(key, (map.get(key) ?? 0) + Number(e.amount || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const maxCat = byCategory[0]?.[1] ?? 1;
  const maxLast3 = Math.max(1, ...last3.map((l) => l.total));

  const profit = revenue - totalThisMonth - supplierPurchases - employeeSalaries;

  const submitExpense = async () => {
    if (!restaurantId) return;
    const a = Number(form.amount);
    if (!a || a <= 0) {
      toast.error(tx("أدخل مبلغاً صحيحاً"));
      return;
    }
    setSaving(true);
    const expMonth = form.date.slice(0, 7);
    const { error } = await supabase.from("expenses").insert({
      restaurant_id: restaurantId,
      category: form.category,
      custom_label: form.category === tx("مصاريف أخرى") ? form.custom_label.trim() || null : null,
      amount: a,
      date: form.date,
      notes: form.notes.trim() || null,
      is_recurring: form.is_recurring,
      month: expMonth,
    });
    setSaving(false);
    if (error) {
      toast.error(tx("فشل الحفظ"));
      return;
    }
    toast.success(tx("تمت إضافة المصروف"));
    setOpen(false);
    setForm({
      category: CATEGORIES[0],
      custom_label: "",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      notes: "",
      is_recurring: false,
    });
    void load(restaurantId);
  };

  const removeExpense = async (id: string) => {
    if (!restaurantId) return;
    if (!confirm(tx("حذف هذا المصروف؟"))) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error(tx("فشل الحذف"));
      return;
    }
    void load(restaurantId);
  };

  const carryRecurring = async () => {
    if (!restaurantId) return;
    const prev = shiftMonth(month, -1);
    const { data: prevExp } = await supabase
      .from("expenses")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("month", prev)
      .eq("is_recurring", true);
    if (!prevExp || prevExp.length === 0) {
      toast.message(tx("لا توجد مصاريف متكررة من الشهر الماضي"));
      return;
    }
    const existing = new Set(
      expenses.filter((e) => e.is_recurring).map((e) => `${e.category}|${e.custom_label ?? ""}`),
    );
    const toInsert = prevExp
      .filter((e) => !existing.has(`${e.category}|${e.custom_label ?? ""}`))
      .map((e) => ({
        restaurant_id: restaurantId,
        category: e.category,
        custom_label: e.custom_label,
        amount: e.amount,
        date: `${month}-01`,
        notes: e.notes,
        is_recurring: true,
        month,
      }));
    if (toInsert.length === 0) {
      toast.message(tx("كل المصاريف المتكررة موجودة"));
      return;
    }
    const { error } = await supabase.from("expenses").insert(toInsert);
    if (error) {
      toast.error(tx("فشل النسخ"));
      return;
    }
    toast.success(tx("تم نسخ ") + (toInsert.length) + tx(" مصروف"));
    void load(restaurantId);
  };

  const exportPnlPdf = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(tx("<!doctype html><html dir=\"rtl\" lang=\"ar\"><head><meta charset=\"utf-8\"/>\n      <title>تقرير الربح — ") + (month) + tx("</title>\n      <style>\n        body{font-family:Cairo,system-ui,sans-serif;padding:24px;color:#111}\n        h1{margin:0 0 12px}\n        table{width:100%;border-collapse:collapse;font-size:14px}\n        td{padding:8px 10px;border-bottom:1px solid #eee}\n        .total{font-weight:bold;font-size:18px;background:#fafafa}\n        .pos{color:#16a34a} .neg{color:#dc2626}\n      </style></head><body>\n      <h1>تقرير الربح الحقيقي — ") + (month) + tx("</h1>\n      <table>\n        <tr><td>{tx(\"إجمالي الإيرادات\")}</td><td style=\"text-align:left\" class=\"pos\">+ ") + (formatDZD(revenue)) + tx("</td></tr>\n        <tr><td>{tx(\"مصاريف التشغيل\")}</td><td style=\"text-align:left\" class=\"neg\">- ") + (formatDZD(totalThisMonth)) + tx("</td></tr>\n        <tr><td>{tx(\"مشتريات الموردين\")}</td><td style=\"text-align:left\" class=\"neg\">- ") + (formatDZD(supplierPurchases)) + tx("</td></tr>\n        <tr><td>{tx(\"رواتب العمال\")}</td><td style=\"text-align:left\" class=\"neg\">- ") + (formatDZD(employeeSalaries)) + "</td></tr>\n        <tr class=\"total\"><td>" + (profit >= 0 ? "الربح الصافي" : "الخسارة الصافية") + "</td>\n          <td style=\"text-align:left\" class=\"" + (profit >= 0 ? "pos" : "neg") + "\">" + (formatDZD(profit)) + "</td></tr>\n      </table>\n      <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>\n      </body></html>");
    win.document.close();
  };

  return (
    <div className="space-y-5 p-2" dir="rtl">
      {/* Header controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label className="text-xs">{tx("الشهر")}</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={carryRecurring} className="gap-1">
            <RefreshCw className="w-4 h-4" /> {tx("نسخ المتكرر")}
          </Button>
          <Button onClick={() => setOpen(true)} className="gap-1">
            <Plus className="w-4 h-4" /> {tx("مصروف جديد")}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{tx("إجمالي مصاريف الشهر")}</div>
          <div className="text-xl font-bold">{formatDZD(totalThisMonth)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{tx("الإيرادات")}</div>
          <div className="text-xl font-bold text-emerald-600">{formatDZD(revenue)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{tx("مشتريات الموردين")}</div>
          <div className="text-xl font-bold text-destructive">{formatDZD(supplierPurchases)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{tx("رواتب العمال")}</div>
          <div className="text-xl font-bold text-destructive">{formatDZD(employeeSalaries)}</div>
        </Card>
      </div>

      {/* P&L */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold">{tx("تقرير الربح الحقيقي")}</h3>
          <Button size="sm" variant="outline" onClick={exportPnlPdf} className="gap-1">
            <Printer className="w-4 h-4" /> {tx("تصدير PDF")}
          </Button>
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span>{tx("إجمالي الإيرادات")}</span>
            <span className="text-emerald-600 font-semibold">+ {formatDZD(revenue)}</span>
          </div>
          <div className="flex justify-between">
            <span>{tx("مصاريف التشغيل")}</span>
            <span className="text-destructive">- {formatDZD(totalThisMonth)}</span>
          </div>
          <div className="flex justify-between">
            <span>{tx("مشتريات الموردين")}</span>
            <span className="text-destructive">- {formatDZD(supplierPurchases)}</span>
          </div>
          <div className="flex justify-between">
            <span>{tx("رواتب العمال")}</span>
            <span className="text-destructive">- {formatDZD(employeeSalaries)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between text-base font-bold">
            <span>{profit >= 0 ? tx("الربح الصافي") : tx("الخسارة الصافية")}</span>
            <span className={profit >= 0 ? "text-emerald-600" : "text-destructive"}>
              {formatDZD(profit)}
            </span>
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <h3 className="font-bold mb-3">{tx("حسب الفئة")}</h3>
          {byCategory.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">{tx("لا بيانات")}</div>
          ) : (
            <div className="space-y-2">
              {byCategory.map(([cat, amt]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{cat}</span>
                    <span className="font-semibold">{formatDZD(amt)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(amt / maxCat) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="font-bold mb-3">{tx("آخر 3 أشهر")}</h3>
          <div className="flex items-end gap-3 h-40 px-2">
            {last3.map((l) => (
              <div key={l.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs font-semibold">{formatDZD(l.total)}</div>
                <div
                  className="w-full bg-primary rounded-t"
                  style={{ height: `${Math.max(4, (l.total / maxLast3) * 100)}%` }}
                />
                <div className="text-xs text-muted-foreground">{l.month}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* List */}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs">
            <tr>
              <th className="p-2 text-right">{tx("التاريخ")}</th>
              <th className="p-2 text-right">{tx("الفئة")}</th>
              <th className="p-2 text-right">{tx("المبلغ")}</th>
              <th className="p-2 text-right">{tx("متكرر")}</th>
              <th className="p-2 text-right">{tx("ملاحظات")}</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{tx("جاري التحميل…")}</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{tx("لا مصاريف لهذا الشهر")}</td></tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-2">{e.date}</td>
                  <td className="p-2">{e.custom_label ? `${e.category} — ${e.custom_label}` : e.category}</td>
                  <td className="p-2 font-semibold">{formatDZD(Number(e.amount))}</td>
                  <td className="p-2">{e.is_recurring ? tx("نعم") : "-"}</td>
                  <td className="p-2 text-xs text-muted-foreground">{e.notes ?? "-"}</td>
                  <td className="p-2">
                    <Button size="icon" variant="ghost" onClick={() => removeExpense(e.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Add modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{tx("إضافة مصروف")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tx("الفئة")}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.category === tx("مصاريف أخرى") && (
              <div>
                <Label>{tx("الوصف")}</Label>
                <Input
                  value={form.custom_label}
                  onChange={(e) => setForm({ ...form, custom_label: e.target.value })}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{tx("المبلغ (دج)")}</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <Label>{tx("التاريخ")}</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{tx("ملاحظات")}</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border px-3 py-2">
              <div>
                <div className="text-sm font-medium">{tx("شهري متكرر")}</div>
                <div className="text-xs text-muted-foreground">{tx("يظهر في زر \"نسخ المتكرر\"")}</div>
              </div>
              <Switch
                checked={form.is_recurring}
                onCheckedChange={(v) => setForm({ ...form, is_recurring: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{tx("إلغاء")}</Button>
            <Button onClick={submitExpense} disabled={saving}>
              {saving ? tx("جاري الحفظ…") : tx("حفظ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}