import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId, formatDZD } from "@/lib/restaurant";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tx } from "@/lib/ops-tx";
import { useTranslation } from "react-i18next";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/ops/staff-performance")({
  component: StaffPerformance,
});

type Employee = { id: string; name: string; role: string };
type OrderRow = {
  id: string;
  total: number;
  created_at: string;
  served_at: string | null;
  assigned_waiter_id: string | null;
  assigned_kitchen_id: string | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function StaffPerformance() {
  useTranslation();
  const { restaurantId } = useRestaurantId();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [from, setFrom] = useState(daysAgoISO(7));
  const [to, setTo] = useState(todayISO());
  const [role, setRole] = useState<"all" | "waiter" | "kitchen">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      setLoading(true);
      const [{ data: emps }, { data: ords }] = await Promise.all([
        supabase
          .from("employees")
          .select("id, name, role")
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true),
        supabase
          .from("orders")
          .select("id, total, created_at, served_at, assigned_waiter_id, assigned_kitchen_id")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", `${from}T00:00:00`)
          .lte("created_at", `${to}T23:59:59`),
      ]);
      setEmployees((emps as Employee[]) ?? []);
      setOrders((ords as OrderRow[]) ?? []);
      setLoading(false);
    })();
  }, [restaurantId, from, to]);

  const stats = useMemo(() => {
    const map = new Map<
      string,
      { name: string; role: string; orders: number; revenue: number; prepMs: number; prepCount: number }
    >();
    for (const e of employees) {
      map.set(e.id, { name: e.name, role: e.role, orders: 0, revenue: 0, prepMs: 0, prepCount: 0 });
    }
    for (const o of orders) {
      if (role === "all" || role === "waiter") {
        if (o.assigned_waiter_id && map.has(o.assigned_waiter_id)) {
          const s = map.get(o.assigned_waiter_id)!;
          s.orders += 1;
          s.revenue += Number(o.total) || 0;
        }
      }
      if (role === "all" || role === "kitchen") {
        if (o.assigned_kitchen_id && map.has(o.assigned_kitchen_id)) {
          const s = map.get(o.assigned_kitchen_id)!;
          if (o.served_at) {
            s.prepMs += new Date(o.served_at).getTime() - new Date(o.created_at).getTime();
            s.prepCount += 1;
          }
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, s]) => ({
        id,
        ...s,
        avgTicket: s.orders > 0 ? s.revenue / s.orders : 0,
        avgPrepMin: s.prepCount > 0 ? s.prepMs / s.prepCount / 60000 : 0,
      }))
      .filter((s) =>
        role === "all"
          ? true
          : role === "waiter"
            ? s.orders > 0
            : s.prepCount > 0,
      )
      .sort((a, b) => b.revenue - a.revenue);
  }, [employees, orders, role]);

  return (
    <div dir="rtl" className="space-y-5">
      <Card className="p-4 glass">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>{tx("من")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{tx("إلى")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>{tx("الدور")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("الكل")}</SelectItem>
                <SelectItem value="waiter">{tx("نُدُل (مبيعات)")}</SelectItem>
                <SelectItem value="kitchen">{tx("مطبخ (وقت التحضير)")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            {loading ? "..." : (stats.length) + tx(" موظف")}
          </div>
        </div>
      </Card>

      <Card className="p-4 glass">
        <h3 className="font-bold mb-3">{tx("المبيعات لكل موظف")}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v: number) => formatDZD(v)} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4 glass overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border/40">
              <th className="text-right p-2">{tx("الاسم")}</th>
              <th className="text-right p-2">{tx("الدور")}</th>
              <th className="text-right p-2">{tx("عدد الطلبات")}</th>
              <th className="text-right p-2">{tx("إجمالي المبيعات")}</th>
              <th className="text-right p-2">{tx("متوسط الفاتورة")}</th>
              <th className="text-right p-2">{tx("متوسط وقت التحضير")}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.id} className="border-b border-border/20">
                <td className="p-2 font-medium">{s.name}</td>
                <td className="p-2 text-muted-foreground">{s.role}</td>
                <td className="p-2">{s.orders}</td>
                <td className="p-2">{formatDZD(s.revenue)}</td>
                <td className="p-2">{formatDZD(s.avgTicket)}</td>
                <td className="p-2">{s.avgPrepMin > 0 ? (s.avgPrepMin.toFixed(1)) + tx(" د") : "—"}</td>
              </tr>
            ))}
            {!loading && stats.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{tx("لا توجد بيانات")}</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground">
        {tx("ملاحظة: تعتمد الإحصائيات على ربط الطلبات بالموظفين (أُضيف الحقل حديثاً ولا يكسر إنشاء الطلبات الحالي).")}
      </p>
    </div>
  );
}
