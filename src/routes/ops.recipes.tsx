import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, X, ChefHat, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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

export const Route = createFileRoute("/ops/recipes")({
  component: OpsRecipes,
});

type MenuItem = { id: string; name: string; price: number };
type Ingredient = { id: string; name: string; unit: string; cost_per_unit: number };
type Recipe = {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  quantity: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(n);
}

function OpsRecipes() {
  useTranslation();
  const { restaurantId, loading: restaurantLoading } = useRestaurantId();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [draft, setDraft] = useState<{ ingredient_id: string; quantity: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const ingMap = useMemo(() => {
    const m = new Map<string, Ingredient>();
    for (const i of ingredients) m.set(i.id, i);
    return m;
  }, [ingredients]);

  const recipesByItem = useMemo(() => {
    const m = new Map<string, Recipe[]>();
    for (const r of recipes) {
      const arr = m.get(r.menu_item_id) ?? [];
      arr.push(r);
      m.set(r.menu_item_id, arr);
    }
    return m;
  }, [recipes]);

  const itemCost = (itemId: string) => {
    const rs = recipesByItem.get(itemId) ?? [];
    let total = 0;
    for (const r of rs) {
      const ing = ingMap.get(r.ingredient_id);
      if (ing) total += Number(ing.cost_per_unit) * Number(r.quantity);
    }
    return total;
  };

  const loadAll = async (rid: string) => {
    const [m, i, r] = await Promise.all([
      supabase
        .from("menu_items")
        .select("id,name,price")
        .eq("restaurant_id", rid)
        .order("name"),
      supabase
        .from("ingredients")
        .select("id,name,unit,cost_per_unit")
        .eq("restaurant_id", rid)
        .order("name"),
      supabase
        .from("menu_item_recipes")
        .select("id,menu_item_id,ingredient_id,quantity")
        .eq("restaurant_id", rid),
    ]);
    setItems((m.data ?? []) as MenuItem[]);
    setIngredients((i.data ?? []) as Ingredient[]);
    setRecipes((r.data ?? []) as Recipe[]);
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

  const openItem = (it: MenuItem) => {
    setActiveItem(it);
    const existing = recipesByItem.get(it.id) ?? [];
    setDraft(
      existing.length
        ? existing.map((r) => ({ ingredient_id: r.ingredient_id, quantity: String(r.quantity) }))
        : [{ ingredient_id: "", quantity: "" }],
    );
    setOpen(true);
  };

  const save = async () => {
    if (!restaurantId || !activeItem) return;
    const clean = draft
      .map((d) => ({
        ingredient_id: d.ingredient_id,
        quantity: Number(d.quantity),
      }))
      .filter((d) => d.ingredient_id && d.quantity > 0);

    setSaving(true);
    const { error: delErr } = await supabase
      .from("menu_item_recipes")
      .delete()
      .eq("menu_item_id", activeItem.id);
    if (delErr) {
      toast.error(tx("فشل الحفظ"));
      setSaving(false);
      return;
    }
    if (clean.length) {
      const { error: insErr } = await supabase.from("menu_item_recipes").insert(
        clean.map((c) => ({
          restaurant_id: restaurantId,
          menu_item_id: activeItem.id,
          ingredient_id: c.ingredient_id,
          quantity: c.quantity,
        })),
      );
      if (insErr) {
        toast.error(tx("فشل الحفظ"));
        setSaving(false);
        return;
      }
    }
    toast.success(tx("تم حفظ الوصفة"));
    setOpen(false);
    setSaving(false);
    await loadAll(restaurantId);
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-2 space-y-4" dir="rtl">
      <Card className="p-4 rounded-2xl glass shadow-glass border-border/60">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-primary" />
              {tx("وصفات الأصناف")}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {tx("اربط كل صنف بالمكونات المستهلكة. عند تأكيد الدفع يُنقص المخزون تلقائياً.")}
            </p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tx("بحث صنف...")}
              className="pr-9 w-56"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{tx("جاري التحميل…")}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 rounded-2xl glass shadow-glass border-border/60 text-center text-muted-foreground">
          {tx("لا توجد أصناف.")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((it) => {
            const rs = recipesByItem.get(it.id) ?? [];
            const cost = itemCost(it.id);
            const margin = Number(it.price) - cost;
            const marginPct = it.price > 0 ? (margin / Number(it.price)) * 100 : 0;
            return (
              <Card
                key={it.id}
                className="p-4 rounded-2xl glass shadow-glass border-border/60 cursor-pointer hover:shadow-md transition"
                onClick={() => openItem(it)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      السعر: {fmt(Number(it.price))} دج
                    </div>
                  </div>
                  <div
                    className={`text-[10px] px-2 py-1 rounded-lg font-medium ${
                      rs.length === 0
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {rs.length === 0 ? tx("بدون وصفة") : (rs.length) + tx(" مكوّن")}
                  </div>
                </div>
                {rs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">{tx("تكلفة")}</div>
                      <div className="font-semibold">{fmt(cost)} دج</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{tx("ربح")}</div>
                      <div
                        className={`font-semibold ${
                          margin >= 0 ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        {fmt(margin)} ({marginPct.toFixed(0)}%)
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>وصفة: {activeItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {draft.map((row, idx) => {
              const ing = ingMap.get(row.ingredient_id);
              return (
                <div key={idx} className="grid grid-cols-[1fr_100px_auto] gap-2 items-end">
                  <div>
                    {idx === 0 && <Label className="text-xs">{tx("المكوّن")}</Label>}
                    <Select
                      value={row.ingredient_id}
                      onValueChange={(v) => {
                        const next = [...draft];
                        next[idx] = { ...next[idx], ingredient_id: v };
                        setDraft(next);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={tx("اختر...")} />
                      </SelectTrigger>
                      <SelectContent>
                        {ingredients.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    {idx === 0 && <Label className="text-xs">الكمية {ing ? `(${ing.unit})` : ""}</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      value={row.quantity}
                      onChange={(e) => {
                        const next = [...draft];
                        next[idx] = { ...next[idx], quantity: e.target.value };
                        setDraft(next);
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDraft(draft.filter((_, i) => i !== idx))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDraft([...draft, { ingredient_id: "", quantity: "" }])}
            >
              <Plus className="w-4 h-4 ml-1" /> {tx("إضافة مكوّن")}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tx("إلغاء")}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? tx("جاري الحفظ…") : tx("حفظ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}