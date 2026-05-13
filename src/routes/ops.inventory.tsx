import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, Pencil, Plus as PlusIcon, Minus, MoreVertical, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { sendLowStockAlert, sendPurchaseNotification } from "@/server/ops-alerts.functions";
import { analyzeReceipt } from "@/server/inventory-receipt.functions";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/ops/inventory")({
  component: OpsInventory,
});

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  alert_threshold: number;
  cost_per_unit: number;
};

type ReceiptMeta = {
  supplierName: string;
  totalAmount: string;
  previousDebt: string;
  grandTotalDebt: string;
  paidAmount: string;
};

const emptyReceiptMeta: ReceiptMeta = {
  supplierName: "",
  totalAmount: "0",
  previousDebt: "0",
  grandTotalDebt: "0",
  paidAmount: "0",
};

const WASTE_REASONS: { value: string; label: string }[] = [
  { value: "burned", label: tx("محروق") },
  { value: "expired", label: tx("منتهي الصلاحية") },
  { value: "dropped", label: tx("سقط/تلف") },
  { value: "prep_error", label: tx("خطأ في التحضير") },
  { value: "other", label: tx("أخرى") },
];

function OpsInventory() {
  useTranslation();
  const { restaurantId, loading: restaurantLoading } = useRestaurantId();
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const alertFn = useServerFn(sendLowStockAlert);
  const notifyPurchase = useServerFn(sendPurchaseNotification);
  const analyzeFn = useServerFn(analyzeReceipt);

  const maybeAlert = async (ingredientId: string) => {
    try {
      const r = await alertFn({ data: { ingredientId } });
      if (r.sent) toast.warning(tx("تم إرسال تنبيه Telegram للمخزون الناقص"));
    } catch {
      // silent
    }
  };

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editIng, setEditIng] = useState<Ingredient | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    unit: "",
    alert_threshold: "0",
    cost_per_unit: "0",
  });
  const [editSaving, setEditSaving] = useState(false);

  // Adjust stock modal
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjIng, setAdjIng] = useState<Ingredient | null>(null);
  const [adjForm, setAdjForm] = useState({
    direction: "add" as "add" | "remove",
    quantity: "",
    note: "",
  });
  const [adjSaving, setAdjSaving] = useState(false);

  // Add ingredient modal
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    unit: "",
    current_stock: "0",
    alert_threshold: "0",
    cost_per_unit: "0",
  });
  const [saving, setSaving] = useState(false);

  // Receipt photo modal
  const [recOpen, setRecOpen] = useState(false);
  const [recAnalyzing, setRecAnalyzing] = useState(false);
  const [recSaving, setRecSaving] = useState(false);
  const [recItems, setRecItems] = useState<
    { name: string; quantity: number; unit: string; unit_price: number }[]
  >([]);
  const [recPreview, setRecPreview] = useState<string | null>(null);
  const [recMeta, setRecMeta] = useState<ReceiptMeta>(emptyReceiptMeta);

  // Waste modal
  const [wasteOpen, setWasteOpen] = useState(false);
  const [wasteIng, setWasteIng] = useState<Ingredient | null>(null);
  const [wasteForm, setWasteForm] = useState({
    quantity: "",
    reason: "burned" as string,
    reason_other: "",
    logged_by: "",
  });
  const [wasteSaving, setWasteSaving] = useState(false);

  const loadAll = async (rid: string) => {
    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .eq("restaurant_id", rid)
      .order("name");
    if (error) toast.error(tx("فشل تحميل المكونات"));
    setItems((data ?? []) as Ingredient[]);
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

  const submitAdd = async () => {
    if (!restaurantId) return;
    if (!form.name.trim() || !form.unit.trim()) {
      toast.error(tx("الاسم والوحدة مطلوبان"));
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("ingredients").insert({
      restaurant_id: restaurantId,
      name: form.name.trim(),
      unit: form.unit.trim(),
      current_stock: Number(form.current_stock) || 0,
      alert_threshold: Number(form.alert_threshold) || 0,
      cost_per_unit: Number(form.cost_per_unit) || 0,
    });
    setSaving(false);
    if (error) {
      console.error("ingredient insert failed", error);
      toast.error(tx("فشل إضافة المكون: ") + (error.message));
      return;
    }
    toast.success(tx("تمت إضافة المكون"));
    setAddOpen(false);
    setForm({ name: "", unit: "", current_stock: "0", alert_threshold: "0", cost_per_unit: "0" });
    await loadAll(restaurantId);
  };

  // ===== Receipt photo flow =====
  const onPickReceipt = async (file: File | null) => {
    if (!file) return;
    setRecPreview(URL.createObjectURL(file));
    setRecItems([]);
    setRecMeta(emptyReceiptMeta);
    setRecAnalyzing(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const s = String(r.result || "");
          const i = s.indexOf(",");
          resolve(i >= 0 ? s.slice(i + 1) : s);
        };
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const r = await analyzeFn({
        data: { imageBase64: b64, mimeType: file.type || "image/jpeg" },
      });
      if (!r.items.length) {
        toast.warning(tx("لم نستطع قراءة أي عنصر — جرّب صورة أوضح"));
      } else {
        toast.success(tx("تم استخراج ") + (r.items.length) + tx(" عنصر"));
      }
      setRecItems(r.items);
      const itemsTotal = r.items.reduce(
        (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
        0,
      );
      setRecMeta({
        supplierName: r.supplierName ?? "",
        totalAmount: String(Number(r.totalAmount) || itemsTotal || 0),
        previousDebt: String(Number(r.previousDebt) || 0),
        grandTotalDebt: String(Number(r.grandTotalDebt) || 0),
        paidAmount: String(Number(r.paidAmount) || 0),
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || tx("فشل تحليل الصورة"));
    } finally {
      setRecAnalyzing(false);
    }
  };

  const updateRecItem = (idx: number, patch: Partial<(typeof recItems)[number]>) => {
    setRecItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeRecItem = (idx: number) => {
    setRecItems((arr) => arr.filter((_, i) => i !== idx));
  };

  const ensureReceiptSupplier = async () => {
    if (!restaurantId) return null;
    const supplierName = recMeta.supplierName.trim();
    if (!supplierName) return null;

    const { data: existing, error: findErr } = await supabase
      .from("suppliers")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .ilike("name", supplierName)
      .maybeSingle();

    if (findErr) throw findErr;
    if (existing) return existing.id;

    const { data: created, error: createErr } = await supabase
      .from("suppliers")
      .insert({ restaurant_id: restaurantId, name: supplierName })
      .select("id")
      .single();

    if (createErr || !created) throw createErr ?? new Error(tx("فشل إضافة المورد"));
    return created.id;
  };

  const readSupplierBalance = async (supplierId: string) => {
    if (!restaurantId) return 0;
    const [poRes, txRes] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select("total")
        .eq("restaurant_id", restaurantId)
        .eq("supplier_id", supplierId),
      supabase
        .from("supplier_transactions")
        .select("type,amount,notes")
        .eq("restaurant_id", restaurantId)
        .eq("supplier_id", supplierId),
    ]);
    if (poRes.error) throw poRes.error;
    if (txRes.error) throw txRes.error;
    const purchasesFromOrders = (poRes.data ?? []).reduce((sum, row) => sum + Number(row.total || 0), 0);
    const previousDebtRows = (txRes.data ?? []).reduce((sum, row) => {
      return row.type === "purchase" && row.notes?.includes(tx("الدين السابق"))
        ? sum + Number(row.amount || 0)
        : sum;
    }, 0);
    const credits = (txRes.data ?? []).reduce((sum, row) => {
      const amount = Number(row.amount || 0);
      return row.type === "payment" || row.type === "advance" || row.type === "return"
        ? sum + amount
        : sum;
    }, 0);
    return purchasesFromOrders + previousDebtRows - credits;
  };

  const submitReceipt = async () => {
    if (!restaurantId) return;
    if (!recItems.length) {
      toast.error(tx("لا توجد عناصر للحفظ"));
      return;
    }
    if (!recMeta.supplierName.trim()) {
      toast.error(tx("اسم المورد مطلوب لحفظ الفاتورة في حساب المورد"));
      return;
    }
    setRecSaving(true);
    let total = 0;
    let processed = 0;
    try {
      const supplierId = await ensureReceiptSupplier();
      const purchaseRows: { ingredient_id: string; quantity: number; unit_price: number; subtotal: number }[] = [];
      for (const it of recItems) {
        const name = it.name.trim();
        const unit = it.unit.trim() || tx("حبة");
        const qty = Number(it.quantity) || 0;
        const price = Number(it.unit_price) || 0;
        if (!name || qty <= 0) continue;

        // Match existing ingredient (case-insensitive)
        const { data: existing } = await supabase
          .from("ingredients")
          .select("id, current_stock, cost_per_unit")
          .eq("restaurant_id", restaurantId)
          .ilike("name", name)
          .maybeSingle();

        let ingredientId: string | null = existing?.id ?? null;
        if (existing) {
          const newStock = Number(existing.current_stock) + qty;
          await supabase
            .from("ingredients")
            .update({
              current_stock: newStock,
              ...(price > 0 ? { cost_per_unit: price } : {}),
            })
            .eq("id", existing.id);
        } else {
          const { data: createdIng, error: ingErr } = await supabase
            .from("ingredients")
            .insert({
              restaurant_id: restaurantId,
              name,
              unit,
              current_stock: qty,
              alert_threshold: 0,
              cost_per_unit: price,
            })
            .select("id")
            .single();
          if (ingErr || !createdIng) throw ingErr ?? new Error(tx("فشل إضافة المكون"));
          ingredientId = createdIng.id;
        }
        const subtotal = qty * price;
        if (ingredientId) purchaseRows.push({ ingredient_id: ingredientId, quantity: qty, unit_price: price, subtotal });
        total += subtotal;
        processed += 1;
      }
      const receiptTotal = Number(recMeta.totalAmount) || total;
      const paidAmount = Number(recMeta.paidAmount) || 0;
      const grandTotalDebt = Number(recMeta.grandTotalDebt) || 0;
      const previousDebt = Number(recMeta.previousDebt) || Math.max(grandTotalDebt - receiptTotal + paidAmount, 0);

      if (supplierId && processed > 0) {
        const existingBalance = await readSupplierBalance(supplierId);
        const previousDebtToRecord = Math.max(previousDebt - Math.max(existingBalance, 0), 0);
        const { data: po, error: poErr } = await supabase
          .from("purchase_orders")
          .insert({
            restaurant_id: restaurantId,
            supplier_id: supplierId,
            total: receiptTotal,
            notes: tx("فاتورة مصورة") + (previousDebt ? ` — الدين السابق ${previousDebt} دج` : "") + (grandTotalDebt ? ` — الدين الإجمالي ${grandTotalDebt} دج` : ""),
          })
          .select("id")
          .single();
        if (poErr || !po) throw poErr ?? new Error(tx("فشل إنشاء فاتورة المورد"));

        if (purchaseRows.length) {
          const { error: piErr } = await supabase.from("purchase_items").insert(
            purchaseRows.map((r) => ({ purchase_order_id: po.id, ...r })),
          );
          if (piErr) throw piErr;
        }

        const today = new Date().toISOString().slice(0, 10);
        const txRows: {
          restaurant_id: string;
          supplier_id: string;
          type: string;
          amount: number;
          date: string;
          notes: string;
        }[] = [
          {
            restaurant_id: restaurantId,
            supplier_id: supplierId,
            type: "purchase",
            amount: receiptTotal,
            date: today,
            notes: tx("فاتورة مصورة #") + (po.id.slice(0, 8)),
          },
        ];
        if (paidAmount > 0) {
          txRows.push({
            restaurant_id: restaurantId,
            supplier_id: supplierId,
            type: "payment",
            amount: paidAmount,
            date: today,
            notes: tx("المبلغ المدفوع من الفاتورة المصورة"),
          });
        }
        if (previousDebtToRecord > 0) {
          txRows.push({
            restaurant_id: restaurantId,
            supplier_id: supplierId,
            type: "purchase",
            amount: previousDebtToRecord,
            date: today,
            notes: tx("الدين السابق المستخرج من الفاتورة"),
          });
        }
        const { error: txErr } = await supabase.from("supplier_transactions").insert(txRows);
        if (txErr) throw txErr;
      }
      toast.success(tx("تمت إضافة ") + (processed) + tx(" مكون للمخزون"));
      try {
        await notifyPurchase({
          data: {
            restaurantId,
            itemCount: processed,
            totalCost: total,
            source: "receipt",
          },
        });
      } catch {
        // silent
      }
      setRecOpen(false);
      setRecItems([]);
      setRecPreview(null);
      setRecMeta(emptyReceiptMeta);
      await loadAll(restaurantId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || tx("فشل حفظ الفاتورة"));
    } finally {
      setRecSaving(false);
    }
  };

  const openWaste = (ing: Ingredient) => {
    setWasteIng(ing);
    setWasteForm({ quantity: "", reason: "burned", reason_other: "", logged_by: "" });
    setWasteOpen(true);
  };

  const submitWaste = async () => {
    if (!restaurantId || !wasteIng) return;
    const qty = Number(wasteForm.quantity);
    if (!qty || qty <= 0) {
      toast.error(tx("أدخل الكمية"));
      return;
    }
    setWasteSaving(true);
    const cost = qty * Number(wasteIng.cost_per_unit || 0);
    const { error: wErr } = await supabase.from("waste_logs").insert({
      restaurant_id: restaurantId,
      ingredient_id: wasteIng.id,
      quantity: qty,
      reason: wasteForm.reason as
        | "burned"
        | "expired"
        | "dropped"
        | "prep_error"
        | "other",
      reason_other: wasteForm.reason === "other" ? wasteForm.reason_other.trim() || null : null,
      logged_by: wasteForm.logged_by.trim() || null,
      cost,
    });
    if (wErr) {
      setWasteSaving(false);
      toast.error(tx("فشل تسجيل الهدر"));
      return;
    }
    // Decrement stock
    const newStock = Math.max(0, Number(wasteIng.current_stock) - qty);
    const { error: uErr } = await supabase
      .from("ingredients")
      .update({ current_stock: newStock })
      .eq("id", wasteIng.id);
    setWasteSaving(false);
    if (uErr) {
      toast.error(tx("سُجِّل الهدر لكن فشل تحديث المخزون"));
    } else {
      toast.success(tx("تم تسجيل الهدر"));
    }
    setWasteOpen(false);
    void maybeAlert(wasteIng.id);
    await loadAll(restaurantId);
  };

  const openEdit = (ing: Ingredient) => {
    setEditIng(ing);
    setEditForm({
      name: ing.name,
      unit: ing.unit,
      alert_threshold: String(ing.alert_threshold),
      cost_per_unit: String(ing.cost_per_unit),
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editIng || !restaurantId) return;
    if (!editForm.name.trim() || !editForm.unit.trim()) {
      toast.error(tx("الاسم والوحدة مطلوبان"));
      return;
    }
    setEditSaving(true);
    const { error } = await supabase
      .from("ingredients")
      .update({
        name: editForm.name.trim(),
        unit: editForm.unit.trim(),
        alert_threshold: Number(editForm.alert_threshold) || 0,
        cost_per_unit: Number(editForm.cost_per_unit) || 0,
      })
      .eq("id", editIng.id);
    setEditSaving(false);
    if (error) {
      toast.error(tx("فشل التعديل"));
      return;
    }
    toast.success(tx("تم التعديل"));
    setEditOpen(false);
    await loadAll(restaurantId);
  };

  const deleteIngredient = async (ing: Ingredient) => {
    if (!restaurantId) return;
    if (!confirm(tx("حذف \"") + (ing.name) + tx("\"؟ لا يمكن التراجع."))) return;
    const { error } = await supabase.from("ingredients").delete().eq("id", ing.id);
    if (error) {
      toast.error(tx("فشل الحذف — قد يكون مرتبطاً بسجلات"));
      return;
    }
    toast.success(tx("تم الحذف"));
    await loadAll(restaurantId);
  };

  const openAdjust = (ing: Ingredient, direction: "add" | "remove") => {
    setAdjIng(ing);
    setAdjForm({ direction, quantity: "", note: "" });
    setAdjOpen(true);
  };

  const submitAdjust = async () => {
    if (!adjIng || !restaurantId) return;
    const qty = Number(adjForm.quantity);
    if (!qty || qty <= 0) {
      toast.error(tx("أدخل كمية صحيحة"));
      return;
    }
    setAdjSaving(true);
    const delta = adjForm.direction === "add" ? qty : -qty;
    const newStock = Math.max(0, Number(adjIng.current_stock) + delta);
    const { error } = await supabase
      .from("ingredients")
      .update({ current_stock: newStock })
      .eq("id", adjIng.id);
    setAdjSaving(false);
    if (error) {
      toast.error(tx("فشل التعديل"));
      return;
    }
    toast.success(adjForm.direction === "add" ? tx("تمت الإضافة للمخزون") : tx("تم الخصم من المخزون"));
    setAdjOpen(false);
    if (adjForm.direction === "remove") void maybeAlert(adjIng.id);
    await loadAll(restaurantId);
  };

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">إجمالي المكونات: {items.length}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setRecItems([]);
              setRecPreview(null);
              setRecMeta(emptyReceiptMeta);
              setRecOpen(true);
            }}
            className="gap-2"
          >
            <Camera className="w-4 h-4" /> {tx("تصوير الفاتورة")}
          </Button>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> {tx("إضافة مكون")}
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl glass shadow-glass border-border/60 overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">{tx("الاسم")}</TableHead>
              <TableHead className="text-right">{tx("الوحدة")}</TableHead>
              <TableHead className="text-right">{tx("الكمية الحالية")}</TableHead>
              <TableHead className="text-right">{tx("الحد")}</TableHead>
              <TableHead className="text-right">{tx("السعر/وحدة")}</TableHead>
              <TableHead className="text-right">{tx("الحالة")}</TableHead>
              <TableHead className="text-right">{tx("إجراء")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {tx("جاري التحميل…")}
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {tx("لا توجد مكونات بعد")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((i) => {
                const low = Number(i.current_stock) < Number(i.alert_threshold);
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>{i.unit}</TableCell>
                    <TableCell>{Number(i.current_stock)}</TableCell>
                    <TableCell>{Number(i.alert_threshold)}</TableCell>
                    <TableCell>{Number(i.cost_per_unit)} دج</TableCell>
                    <TableCell>
                      {low ? (
                        <Badge variant="destructive">{tx("ناقص")}</Badge>
                      ) : (
                        <Badge variant="secondary">{tx("جيد")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openWaste(i)}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {tx("هدر")}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-right">
                            <DropdownMenuItem onClick={() => openAdjust(i, "add")}>
                              <PlusIcon className="w-4 h-4 ml-2" /> {tx("إضافة للمخزون")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openAdjust(i, "remove")}>
                              <Minus className="w-4 h-4 ml-2" /> {tx("خصم من المخزون")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEdit(i)}>
                              <Pencil className="w-4 h-4 ml-2" /> {tx("تعديل")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteIngredient(i)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 ml-2" /> {tx("حذف")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add ingredient modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{tx("إضافة مكون جديد")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tx("الاسم")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tx("مثال: طماطم")} />
            </div>
            <div>
              <Label>{tx("الوحدة")}</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder={tx("كغ / لتر / حبة")} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <Label>{tx("الكمية الحالية")}</Label>
                <Input type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} />
              </div>
              <div>
                <Label>{tx("حد التنبيه")}</Label>
                <Input type="number" value={form.alert_threshold} onChange={(e) => setForm({ ...form, alert_threshold: e.target.value })} />
              </div>
              <div>
                <Label>{tx("السعر/وحدة (دج)")}</Label>
                <Input type="number" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{tx("إلغاء")}</Button>
            <Button onClick={submitAdd} disabled={saving}>
              {saving ? tx("جاري الحفظ…") : tx("حفظ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waste modal */}
      <Dialog open={wasteOpen} onOpenChange={setWasteOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل هدر — {wasteIng?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الكمية ({wasteIng?.unit})</Label>
              <Input
                type="number"
                value={wasteForm.quantity}
                onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })}
              />
            </div>
            <div>
              <Label>{tx("السبب")}</Label>
              <Select
                value={wasteForm.reason}
                onValueChange={(v) => setWasteForm({ ...wasteForm, reason: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WASTE_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {wasteForm.reason === "other" && (
              <div>
                <Label>{tx("وصف السبب")}</Label>
                <Textarea
                  value={wasteForm.reason_other}
                  onChange={(e) => setWasteForm({ ...wasteForm, reason_other: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>{tx("سجّله (اسم الطباخ)")}</Label>
              <Input
                value={wasteForm.logged_by}
                onChange={(e) => setWasteForm({ ...wasteForm, logged_by: e.target.value })}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              التكلفة المُحتسبة: {((Number(wasteForm.quantity) || 0) * Number(wasteIng?.cost_per_unit || 0)).toFixed(2)} دج
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWasteOpen(false)}>{tx("إلغاء")}</Button>
            <Button onClick={submitWaste} disabled={wasteSaving}>
              {wasteSaving ? tx("جاري الحفظ…") : tx("تسجيل")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit ingredient modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{tx("تعديل المكون")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tx("الاسم")}</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label>{tx("الوحدة")}</Label>
              <Input value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{tx("حد التنبيه")}</Label>
                <Input type="number" value={editForm.alert_threshold} onChange={(e) => setEditForm({ ...editForm, alert_threshold: e.target.value })} />
              </div>
              <div>
                <Label>{tx("السعر/وحدة (دج)")}</Label>
                <Input type="number" value={editForm.cost_per_unit} onChange={(e) => setEditForm({ ...editForm, cost_per_unit: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {tx("لتعديل الكمية الحالية، استخدم \"إضافة/خصم من المخزون\".")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{tx("إلغاء")}</Button>
            <Button onClick={submitEdit} disabled={editSaving}>
              {editSaving ? tx("جاري الحفظ…") : tx("حفظ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust stock modal */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {adjForm.direction === "add" ? tx("إضافة للمخزون") : tx("خصم من المخزون")} — {adjIng?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              الحالي: {Number(adjIng?.current_stock || 0)} {adjIng?.unit}
            </div>
            <div>
              <Label>الكمية ({adjIng?.unit})</Label>
              <Input
                type="number"
                value={adjForm.quantity}
                onChange={(e) => setAdjForm({ ...adjForm, quantity: e.target.value })}
              />
            </div>
            <div>
              <Label>{tx("ملاحظة (اختياري)")}</Label>
              <Input
                value={adjForm.note}
                onChange={(e) => setAdjForm({ ...adjForm, note: e.target.value })}
                placeholder={tx("مثال: شراء سريع، تصحيح جرد...")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)}>{tx("إلغاء")}</Button>
            <Button onClick={submitAdjust} disabled={adjSaving}>
              {adjSaving ? tx("جاري الحفظ…") : tx("تأكيد")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt photo modal */}
      <Dialog open={recOpen} onOpenChange={setRecOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tx("تصوير فاتورة شراء")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {tx("ارفع صورة الفاتورة وسيتم استخراج العناصر تلقائياً وإضافتها للمخزون.")}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onPickReceipt(e.target.files?.[0] ?? null)}
                />
                <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-accent/30 transition">
                  <Camera className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-sm">{tx("اضغط لالتقاط صورة أو رفع ملف")}</div>
                </div>
              </label>
            </div>

            {recPreview && (
              <div className="flex items-start gap-3">
                <img
                  src={recPreview}
                  alt="receipt"
                  className="w-32 h-32 object-cover rounded-md border"
                />
                {recAnalyzing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> {tx("جاري تحليل الصورة…")}
                  </div>
                )}
              </div>
            )}

            {(recPreview || recItems.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 rounded-lg border p-3">
                <div className="sm:col-span-2 lg:col-span-1">
                  <Label>{tx("اسم المورد")}</Label>
                  <Input
                    value={recMeta.supplierName}
                    onChange={(e) => setRecMeta({ ...recMeta, supplierName: e.target.value })}
                    placeholder={tx("مثال: جاري للتجارة")}
                  />
                </div>
                <div>
                  <Label>{tx("المجموع")}</Label>
                  <Input
                    type="number"
                    value={recMeta.totalAmount}
                    onChange={(e) => setRecMeta({ ...recMeta, totalAmount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{tx("الدين السابق")}</Label>
                  <Input
                    type="number"
                    value={recMeta.previousDebt}
                    onChange={(e) => setRecMeta({ ...recMeta, previousDebt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{tx("الدين الإجمالي")}</Label>
                  <Input
                    type="number"
                    value={recMeta.grandTotalDebt}
                    onChange={(e) => setRecMeta({ ...recMeta, grandTotalDebt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{tx("المبلغ المدفوع")}</Label>
                  <Input
                    type="number"
                    value={recMeta.paidAmount}
                    onChange={(e) => setRecMeta({ ...recMeta, paidAmount: e.target.value })}
                  />
                </div>
              </div>
            )}

            {recItems.length > 0 && (
              <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">{tx("الاسم")}</TableHead>
                      <TableHead className="text-right">{tx("الكمية")}</TableHead>
                      <TableHead className="text-right">{tx("الوحدة")}</TableHead>
                      <TableHead className="text-right">{tx("السعر/وحدة")}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recItems.map((it, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input
                            value={it.name}
                            onChange={(e) => updateRecItem(i, { name: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="w-24">
                          <Input
                            type="number"
                            value={it.quantity}
                            onChange={(e) =>
                              updateRecItem(i, { quantity: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell className="w-20">
                          <Input
                            value={it.unit}
                            onChange={(e) => updateRecItem(i, { unit: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="w-28">
                          <Input
                            type="number"
                            value={it.unit_price}
                            onChange={(e) =>
                              updateRecItem(i, { unit_price: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRecItem(i)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecOpen(false)}>
              {tx("إلغاء")}
            </Button>
            <Button
              onClick={submitReceipt}
              disabled={recSaving || recAnalyzing || recItems.length === 0}
            >
              {recSaving ? tx("جاري الحفظ…") : tx("حفظ (") + (recItems.length) + ")"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
