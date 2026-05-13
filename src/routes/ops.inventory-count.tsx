import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Printer, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId, formatDZD } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tx } from "@/lib/ops-tx";
import { useTranslation } from "react-i18next";


export const Route = createFileRoute("/ops/inventory-count")({
  component: OpsInventoryCount,
});

type CountRow = {
  id: string;
  count_date: string;
  status: string;
  notes: string | null;
  total_variance_value: number;
};
type Ingredient = { id: string; name: string; unit: string; current_stock: number; cost_per_unit: number };
type CountItem = {
  id: string;
  ingredient_id: string;
  expected_qty: number;
  counted_qty: number;
  variance: number;
  variance_value: number;
};

function OpsInventoryCount() {
  useTranslation();
  const { restaurantId } = useRestaurantId();
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [active, setActive] = useState<CountRow | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [items, setItems] = useState<CountItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadCounts() {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("inventory_counts")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("count_date", { ascending: false });
    setCounts((data as CountRow[]) ?? []);
  }
  useEffect(() => { loadCounts(); }, [restaurantId]);

  async function loadActive(c: CountRow) {
    setActive(c);
    setLoading(true);
    const [{ data: ings }, { data: its }] = await Promise.all([
      supabase.from("ingredients").select("id, name, unit, current_stock, cost_per_unit").eq("restaurant_id", restaurantId!),
      supabase.from("inventory_count_items").select("*").eq("count_id", c.id),
    ]);
    setIngredients((ings as Ingredient[]) ?? []);
    setItems((its as CountItem[]) ?? []);
    setLoading(false);
  }

  async function startNew() {
    if (!restaurantId) return;
    const { data: c, error } = await supabase
      .from("inventory_counts")
      .insert({ restaurant_id: restaurantId, count_date: new Date().toISOString().slice(0, 10), status: "open" })
      .select("*")
      .single();
    if (error || !c) return toast.error(error?.message ?? tx("خطأ"));
    const { data: ings } = await supabase
      .from("ingredients")
      .select("id, current_stock, cost_per_unit")
      .eq("restaurant_id", restaurantId);
    if (ings && ings.length > 0) {
      await supabase.from("inventory_count_items").insert(
        ings.map((i) => ({
          count_id: c.id,
          ingredient_id: i.id,
          expected_qty: Number(i.current_stock) || 0,
          counted_qty: 0,
          variance: -Number(i.current_stock) || 0,
          variance_value: 0,
        })),
      );
    }
    await loadCounts();
    await loadActive(c as CountRow);
    toast.success(tx("تم بدء جرد جديد"));
  }

  async function updateCount(itemId: string, counted: number) {
    const item = items.find((i) => i.id === itemId);
    const ing = ingredients.find((g) => g.id === item?.ingredient_id);
    if (!item || !ing) return;
    const variance = counted - item.expected_qty;
    const variance_value = variance * Number(ing.cost_per_unit || 0);
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, counted_qty: counted, variance, variance_value } : i));
    await supabase.from("inventory_count_items").update({ counted_qty: counted, variance, variance_value }).eq("id", itemId);
  }

  async function closeCount() {
    if (!active) return;
    const total = items.reduce((s, i) => s + Number(i.variance_value), 0);
    const { error } = await supabase
      .from("inventory_counts")
      .update({ status: "closed", closed_at: new Date().toISOString(), total_variance_value: total })
      .eq("id", active.id);
    if (error) return toast.error(error.message);
    toast.success(tx("تم إقفال الجرد"));
    await loadCounts();
    setActive({ ...active, status: "closed", total_variance_value: total });
  }

  const totalVariance = useMemo(() => items.reduce((s, i) => s + Number(i.variance_value), 0), [items]);

  if (active) {
    const isClosed = active.status === "closed";
    return (
      <div dir="rtl" className="space-y-4">
        <Card className="p-4 glass flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold">جرد بتاريخ {active.count_date}</div>
            <div className="text-xs text-muted-foreground">
              {isClosed ? tx("مُقفل") : tx("مفتوح")} · إجمالي الفرق: {formatDZD(totalVariance)}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 ml-1" /> {tx("طباعة")}</Button>
            {!isClosed && <Button onClick={closeCount}><Lock className="w-4 h-4 ml-1" /> {tx("إقفال")}</Button>}
            <Button variant="ghost" onClick={() => setActive(null)}>{tx("عودة")}</Button>
          </div>
        </Card>

        <Card className="p-4 glass overflow-x-auto">
          {loading ? (
            <div className="text-center py-6 text-muted-foreground">{tx("جار التحميل...")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/40">
                  <th className="text-right p-2">{tx("المكوّن")}</th>
                  <th className="text-right p-2">{tx("الوحدة")}</th>
                  <th className="text-right p-2">{tx("المتوقع")}</th>
                  <th className="text-right p-2">{tx("المعدود")}</th>
                  <th className="text-right p-2">{tx("الفرق")}</th>
                  <th className="text-right p-2">{tx("قيمة الفرق")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const ing = ingredients.find((g) => g.id === it.ingredient_id);
                  return (
                    <tr key={it.id} className="border-b border-border/20">
                      <td className="p-2">{ing?.name ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">{ing?.unit}</td>
                      <td className="p-2">{Number(it.expected_qty).toFixed(2)}</td>
                      <td className="p-2 w-32">
                        {isClosed ? (
                          Number(it.counted_qty).toFixed(2)
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            value={it.counted_qty}
                            onChange={(e) => updateCount(it.id, Number(e.target.value))}
                            className="h-8"
                          />
                        )}
                      </td>
                      <td className={`p-2 ${it.variance < 0 ? "text-destructive" : it.variance > 0 ? "text-emerald-500" : ""}`}>
                        {Number(it.variance).toFixed(2)}
                      </td>
                      <td className="p-2">{formatDZD(it.variance_value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-5">
      <Card className="p-4 glass flex items-center justify-between">
        <div>
          <h3 className="font-bold">{tx("جرد المخزون")}</h3>
          <p className="text-xs text-muted-foreground">{tx("قارن المخزون الفعلي بالمخزون النظري واستخرج الفروقات.")}</p>
        </div>
        <Button onClick={startNew}><Plus className="w-4 h-4 ml-1" /> {tx("جرد جديد")}</Button>
      </Card>

      <div className="space-y-2">
        {counts.map((c) => (
          <Card key={c.id} className="p-3 glass cursor-pointer hover:bg-accent/30 flex items-center justify-between" onClick={() => loadActive(c)}>
            <div>
              <div className="font-medium">{c.count_date}</div>
              <div className="text-xs text-muted-foreground">فرق: {formatDZD(c.total_variance_value)}</div>
            </div>
            <Badge variant={c.status === "closed" ? "secondary" : "default"}>
              {c.status === "closed" ? tx("مُقفل") : tx("مفتوح")}
            </Badge>
          </Card>
        ))}
        {counts.length === 0 && (
          <div className="text-center text-muted-foreground py-10">{tx("لا توجد عمليات جرد")}</div>
        )}
      </div>
    </div>
  );
}
