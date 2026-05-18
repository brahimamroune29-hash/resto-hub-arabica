import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, AlertTriangle, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendLowStockAlert } from "@/lib/ops-alerts.functions";
import { useRestaurantId } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import { tx } from "@/lib/ops-tx";
import { useTranslation } from "react-i18next";


export const Route = createFileRoute("/ops/waste")({
  component: OpsWaste,
});

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  cost_per_unit: number;
};

type WasteLog = {
  id: string;
  ingredient_id: string;
  quantity: number;
  reason: string;
  reason_other: string | null;
  logged_by: string | null;
  cost: number;
  created_at: string;
};

const REASONS: { value: string; label: string }[] = [
  { value: "burned", label: tx("محروق") },
  { value: "expired", label: tx("منتهي الصلاحية") },
  { value: "dropped", label: tx("سقط/تلف") },
  { value: "prep_error", label: tx("خطأ في التحضير") },
  { value: "other", label: tx("أخرى") },
];

const REASON_LABEL = (v: string) => REASONS.find((r) => r.value === v)?.label ?? v;

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(n || 0);

function OpsWaste() {
  useTranslation();
  const { restaurantId, loading: restaurantLoading } = useRestaurantId();
  const alertFn = useServerFn(sendLowStockAlert);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    ingredient_id: "",
    quantity: "",
    reason: "burned",
    reason_other: "",
    logged_by: "",
  });
  const [saving, setSaving] = useState(false);

  const loadAll = async (rid: string) => {
    setLoading(true);
    const [ings, lg] = await Promise.all([
      supabase
        .from("ingredients")
        .select("id,name,unit,current_stock,cost_per_unit")
        .eq("restaurant_id", rid)
        .order("name"),
      supabase
        .from("waste_logs")
        .select("*")
        .eq("restaurant_id", rid)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (ings.error) toast.error(tx("فشل التحميل"));
    setIngredients((ings.data ?? []) as Ingredient[]);
    setLogs((lg.data ?? []) as WasteLog[]);
    setLoading(false);
  };

  useEffect(() => {
    if (restaurantLoading) return;
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    void loadAll(restaurantId);
  }, [restaurantId, restaurantLoading]);

  const selectedIng = useMemo(
    () => ingredients.find((i) => i.id === form.ingredient_id) ?? null,
    [ingredients, form.ingredient_id]
  );
  const previewCost = useMemo(() => {
    if (!selectedIng) return 0;
    return (Number(form.quantity) || 0) * Number(selectedIng.cost_per_unit || 0);
  }, [selectedIng, form.quantity]);

  // KPIs
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 3600 * 1000;
  const monthAgo = now - 30 * 24 * 3600 * 1000;
  const weekCost = logs
    .filter((l) => new Date(l.created_at).getTime() >= weekAgo)
    .reduce((s, l) => s + Number(l.cost || 0), 0);
  const monthCost = logs
    .filter((l) => new Date(l.created_at).getTime() >= monthAgo)
    .reduce((s, l) => s + Number(l.cost || 0), 0);

  const topReason = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of logs.filter((x) => new Date(x.created_at).getTime() >= monthAgo)) {
      map.set(l.reason, (map.get(l.reason) || 0) + Number(l.cost || 0));
    }
    let best: [string, number] | null = null;
    for (const e of map.entries()) {
      if (!best || e[1] > best[1]) best = e;
    }
    return best;
  }, [logs, monthAgo]);

  const submit = async () => {
    if (!restaurantId) return;
    if (!form.ingredient_id) {
      toast.error(tx("اختر المكون"));
      return;
    }
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) {
      toast.error(tx("الكمية غير صحيحة"));
      return;
    }
    if (form.reason === "other" && !form.reason_other.trim()) {
      toast.error(tx("اذكر السبب"));
      return;
    }
    const ing = ingredients.find((i) => i.id === form.ingredient_id);
    if (!ing) return;
    const cost = qty * Number(ing.cost_per_unit || 0);

    setSaving(true);
    const { error: insErr } = await supabase.from("waste_logs").insert({
      restaurant_id: restaurantId,
      ingredient_id: ing.id,
      quantity: qty,
      reason: form.reason as "burned" | "expired" | "dropped" | "prep_error" | "other",
      reason_other: form.reason === "other" ? form.reason_other.trim() : null,
      logged_by: form.logged_by.trim() || null,
      cost,
    });
    if (insErr) {
      setSaving(false);
      toast.error(tx("فشل تسجيل الهدر"));
      return;
    }
    const newStock = Math.max(0, Number(ing.current_stock || 0) - qty);
    await supabase.from("ingredients").update({ current_stock: newStock }).eq("id", ing.id);
    setSaving(false);
    toast.success(tx("تم التسجيل"));
    setOpen(false);
    setForm({ ingredient_id: "", quantity: "", reason: "burned", reason_other: "", logged_by: "" });
    await loadAll(restaurantId);
    try {
      const r = await alertFn({ data: { ingredientId: ing.id } });
      if (r.sent) toast.warning(tx("تم إرسال تنبيه Telegram للمخزون الناقص"));
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{tx("تكلفة الهدر — الأسبوع")}</div>
              <div className="text-xl font-bold">{fmt(weekCost)} دج</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{tx("تكلفة الهدر — 30 يوم")}</div>
              <div className="text-xl font-bold">{fmt(monthCost)} دج</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{tx("السبب الأكثر تكلفة")}</div>
              <div className="text-xl font-bold">
                {topReason ? REASON_LABEL(topReason[0]) : "—"}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">{tx("سجل الهدر")}</h3>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> {tx("تسجيل هدر")}
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">{tx("التاريخ")}</TableHead>
              <TableHead className="text-right">{tx("المكون")}</TableHead>
              <TableHead className="text-right">{tx("الكمية")}</TableHead>
              <TableHead className="text-right">{tx("السبب")}</TableHead>
              <TableHead className="text-right">{tx("سجّله")}</TableHead>
              <TableHead className="text-right">{tx("التكلفة")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {tx("جاري التحميل...")}
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {tx("لا يوجد تسجيلات بعد")}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((l) => {
                const ing = ingredients.find((i) => i.id === l.ingredient_id);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">
                      {new Date(l.created_at).toLocaleString("ar-DZ")}
                    </TableCell>
                    <TableCell className="font-medium">{ing?.name ?? "—"}</TableCell>
                    <TableCell>
                      {fmt(Number(l.quantity))} {ing?.unit ?? ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {REASON_LABEL(l.reason)}
                        {l.reason === "other" && l.reason_other ? `: ${l.reason_other}` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {l.logged_by || "-"}
                    </TableCell>
                    <TableCell className="font-semibold">{fmt(Number(l.cost))} دج</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{tx("تسجيل هدر")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tx("المكون")}</Label>
              <Select
                value={form.ingredient_id}
                onValueChange={(v) => setForm({ ...form, ingredient_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tx("اختر مكوّن...")} />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({fmt(Number(i.current_stock))} {i.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الكمية {selectedIng ? `(${selectedIng.unit})` : ""}</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
              {selectedIng && (
                <p className="text-xs text-muted-foreground mt-1">
                  التكلفة المقدّرة: {fmt(previewCost)} دج
                </p>
              )}
            </div>
            <div>
              <Label>{tx("السبب")}</Label>
              <Select
                value={form.reason}
                onValueChange={(v) => setForm({ ...form, reason: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.reason === "other" && (
              <div>
                <Label>{tx("اذكر السبب")}</Label>
                <Textarea
                  value={form.reason_other}
                  onChange={(e) => setForm({ ...form, reason_other: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>{tx("سجّله (اسم الطباخ)")}</Label>
              <Input
                value={form.logged_by}
                onChange={(e) => setForm({ ...form, logged_by: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tx("إلغاء")}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? tx("جاري الحفظ...") : tx("تسجيل")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
