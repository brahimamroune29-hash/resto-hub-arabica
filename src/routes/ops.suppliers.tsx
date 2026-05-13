import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, FileText, X, Pencil, Trash2, MoreVertical, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SupplierStatementDialog } from "@/components/ops/SupplierStatementDialog";
import { tx } from "@/lib/ops-tx";
import { useTranslation } from "react-i18next";


export const Route = createFileRoute("/ops/suppliers")({
  component: OpsSuppliers,
});

type Supplier = { id: string; name: string; phone: string | null; notes: string | null };
type PO = { id: string; supplier_id: string; total: number; created_at: string };
type Ingredient = { id: string; name: string; unit: string; current_stock: number };
type SupplierTx = { id: string; supplier_id: string; type: "purchase" | "payment" | "advance" | "return"; amount: number; notes: string | null };

type Row = { ingredient_id: string; quantity: string; unit_price: string };

function OpsSuppliers() {
  useTranslation();
  const { restaurantId, loading: restaurantLoading } = useRestaurantId();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PO[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [txs, setTxs] = useState<SupplierTx[]>([]);
  const [loading, setLoading] = useState(true);

  // Add supplier
  const [supOpen, setSupOpen] = useState(false);
  const [supForm, setSupForm] = useState({ name: "", phone: "", notes: "" });
  const [supSaving, setSupSaving] = useState(false);

  // Edit supplier
  const [editOpen, setEditOpen] = useState(false);
  const [editSup, setEditSup] = useState<Supplier | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Statement
  const [stmtOpen, setStmtOpen] = useState(false);
  const [stmtSup, setStmtSup] = useState<Supplier | null>(null);

  // New PO
  const [poOpen, setPoOpen] = useState(false);
  const [poSupplier, setPoSupplier] = useState<string>("");
  const [poNewSupplierName, setPoNewSupplierName] = useState<string>("");
  const [poSupplierMode, setPoSupplierMode] = useState<"existing" | "new">("existing");
  const [poNotes, setPoNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([{ ingredient_id: "", quantity: "", unit_price: "" }]);
  const [poSaving, setPoSaving] = useState(false);

  const loadAll = async (rid: string) => {
    const [s, p, i, t] = await Promise.all([
      supabase.from("suppliers").select("*").eq("restaurant_id", rid).order("name"),
      supabase.from("purchase_orders").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }),
      supabase.from("ingredients").select("id,name,unit,current_stock").eq("restaurant_id", rid).order("name"),
      supabase.from("supplier_transactions").select("id,supplier_id,type,amount,notes").eq("restaurant_id", rid),
    ]);
    setSuppliers((s.data ?? []) as Supplier[]);
    setOrders((p.data ?? []) as PO[]);
    setIngredients((i.data ?? []) as Ingredient[]);
    setTxs((t.data ?? []) as SupplierTx[]);
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

  const totalsBySupplier = useMemo(() => {
    const m = new Map<string, { count: number; sum: number; last: string | null }>();
    for (const o of orders) {
      const cur = m.get(o.supplier_id) ?? { count: 0, sum: 0, last: null };
      cur.count += 1;
      cur.sum += Number(o.total || 0);
      if (!cur.last || o.created_at > cur.last) cur.last = o.created_at;
      m.set(o.supplier_id, cur);
    }
    return m;
  }, [orders]);

  // Net balance per supplier:
  //   purchases (POs) + advances given − payments − returns
  // Positive = مدين (we owe them). Negative = دائن (they owe us).
  // Purchases are taken from purchase_orders (canonical). To avoid double counting,
  // we ignore tx rows of type 'purchase' (they exist as a mirror for the statement view).
  const balanceBySupplier = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) {
      m.set(o.supplier_id, (m.get(o.supplier_id) ?? 0) + Number(o.total || 0));
    }
    for (const t of txs) {
      const amt = Number(t.amount || 0);
      if (t.type === "purchase" && t.notes?.includes(tx("الدين السابق"))) {
        m.set(t.supplier_id, (m.get(t.supplier_id) ?? 0) + amt);
      } else if (t.type === "payment" || t.type === "return") {
        m.set(t.supplier_id, (m.get(t.supplier_id) ?? 0) - amt);
      } else if (t.type === "advance") {
        // advance = we paid in advance, increases what they owe us (reduces our debt)
        m.set(t.supplier_id, (m.get(t.supplier_id) ?? 0) - amt);
      }
    }
    return m;
  }, [txs, orders]);

  const submitSupplier = async () => {
    if (!restaurantId) return;
    if (!supForm.name.trim()) {
      toast.error(tx("اسم المورد مطلوب"));
      return;
    }
    setSupSaving(true);
    const { error } = await supabase.from("suppliers").insert({
      restaurant_id: restaurantId,
      name: supForm.name.trim(),
      phone: supForm.phone.trim() || null,
      notes: supForm.notes.trim() || null,
    });
    setSupSaving(false);
    if (error) {
      toast.error(tx("فشل إضافة المورد"));
      return;
    }
    toast.success(tx("تمت إضافة المورد"));
    setSupOpen(false);
    setSupForm({ name: "", phone: "", notes: "" });
    await loadAll(restaurantId);
  };

  const openEdit = (s: Supplier) => {
    setEditSup(s);
    setEditForm({ name: s.name, phone: s.phone ?? "", notes: s.notes ?? "" });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editSup || !restaurantId) return;
    if (!editForm.name.trim()) {
      toast.error(tx("الاسم مطلوب"));
      return;
    }
    setEditSaving(true);
    const { error } = await supabase
      .from("suppliers")
      .update({
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        notes: editForm.notes.trim() || null,
      })
      .eq("id", editSup.id);
    setEditSaving(false);
    if (error) {
      toast.error(tx("فشل التعديل"));
      return;
    }
    toast.success(tx("تم التعديل"));
    setEditOpen(false);
    await loadAll(restaurantId);
  };

  const deleteSupplier = async (s: Supplier) => {
    if (!restaurantId) return;
    if (!confirm(tx("حذف \"") + (s.name) + tx("\"؟ لن يتأثر سجل الفواتير السابقة."))) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", s.id);
    if (error) {
      toast.error(tx("فشل الحذف — قد يكون مرتبطاً بفواتير"));
      return;
    }
    toast.success(tx("تم الحذف"));
    await loadAll(restaurantId);
  };

  const rowSubtotal = (r: Row) => (Number(r.quantity) || 0) * (Number(r.unit_price) || 0);
  const poTotal = rows.reduce((s, r) => s + rowSubtotal(r), 0);

  const submitPO = async () => {
    if (!restaurantId) return;
    let supplierId = poSupplier;
    if (poSupplierMode === "new") {
      const newName = poNewSupplierName.trim();
      if (!newName) {
        toast.error(tx("أدخل اسم المورد الجديد"));
        return;
      }
      // Reuse if name already exists (case-insensitive)
      const existing = suppliers.find(
        (s) => s.name.trim().toLowerCase() === newName.toLowerCase(),
      );
      if (existing) {
        supplierId = existing.id;
      } else {
        const { data: created, error: cErr } = await supabase
          .from("suppliers")
          .insert({ restaurant_id: restaurantId, name: newName })
          .select("id")
          .single();
        if (cErr || !created) {
          toast.error(tx("فشل إضافة المورد الجديد"));
          return;
        }
        supplierId = created.id;
      }
    }
    if (!supplierId) {
      toast.error(tx("اختر المورد"));
      return;
    }
    const valid = rows.filter(
      (r) => r.ingredient_id && Number(r.quantity) > 0 && Number(r.unit_price) >= 0,
    );
    if (valid.length === 0) {
      toast.error(tx("أضف صفاً واحداً على الأقل"));
      return;
    }
    setPoSaving(true);

    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .insert({
        restaurant_id: restaurantId,
        supplier_id: supplierId,
        total: poTotal,
        notes: poNotes.trim() || null,
      })
      .select("id")
      .single();
    if (poErr || !po) {
      setPoSaving(false);
      toast.error(tx("فشل إنشاء الفاتورة"));
      return;
    }

    const items = valid.map((r) => ({
      purchase_order_id: po.id,
      ingredient_id: r.ingredient_id,
      quantity: Number(r.quantity),
      unit_price: Number(r.unit_price),
      subtotal: rowSubtotal(r),
    }));
    const { error: itErr } = await supabase.from("purchase_items").insert(items);
    if (itErr) {
      setPoSaving(false);
      toast.error(tx("فشل حفظ بنود الفاتورة"));
      return;
    }

    // Mirror this PO into supplier_transactions so balance & statement stay in sync.
    await supabase.from("supplier_transactions").insert({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      type: "purchase",
      amount: poTotal,
      date: new Date().toISOString().slice(0, 10),
      notes: poNotes.trim() || tx("فاتورة شراء #") + (po.id.slice(0, 8)),
    });

    // Update stock for each ingredient
    for (const r of valid) {
      const ing = ingredients.find((i) => i.id === r.ingredient_id);
      if (!ing) continue;
      const newStock = Number(ing.current_stock) + Number(r.quantity);
      await supabase.from("ingredients").update({ current_stock: newStock }).eq("id", r.ingredient_id);
    }

    setPoSaving(false);
    toast.success(tx("تم تسجيل الفاتورة وتحديث المخزون"));
    setPoOpen(false);
    setPoSupplier("");
    setPoNewSupplierName("");
    setPoSupplierMode("existing");
    setPoNotes("");
    setRows([{ ingredient_id: "", quantity: "", unit_price: "" }]);
    await loadAll(restaurantId);
  };

  return (
    <div className="space-y-4 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">إجمالي الموردين: {suppliers.length}</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSupOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> {tx("إضافة مورد")}
          </Button>
          <Button onClick={() => setPoOpen(true)} className="gap-2" disabled={ingredients.length === 0}>
            <FileText className="w-4 h-4" /> {tx("فاتورة شراء جديدة")}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-8">{tx("جاري التحميل…")}</div>
      ) : suppliers.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground rounded-2xl glass shadow-glass border-border/60">
          {tx("لا يوجد موردين بعد")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {suppliers.map((s) => {
            const t = totalsBySupplier.get(s.id);
            const sOrders = orders.filter((o) => o.supplier_id === s.id).slice(0, 5);
            return (
              <Card key={s.id} className="p-4 rounded-2xl glass shadow-glass border-border/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-foreground truncate">{s.name}</div>
                    {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-right">
                      <DropdownMenuItem onClick={() => { setStmtSup(s); setStmtOpen(true); }}>
                        <BookOpen className="w-4 h-4 ml-2" /> {tx("كشف حساب")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(s)}>
                        <Pencil className="w-4 h-4 ml-2" /> {tx("تعديل")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteSupplier(s)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 ml-2" /> {tx("حذف")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted px-2 py-1.5">
                    <div className="text-muted-foreground">{tx("عدد الفواتير")}</div>
                    <div className="font-bold text-foreground">{t?.count ?? 0}</div>
                  </div>
                  <div className="rounded-lg bg-muted px-2 py-1.5">
                    <div className="text-muted-foreground">{tx("المجموع الكلي")}</div>
                    <div className="font-bold text-foreground">{(t?.sum ?? 0).toFixed(2)} دج</div>
                  </div>
                </div>
                {(() => {
                  const bal = balanceBySupplier.get(s.id) ?? 0;
                  const tone =
                    Math.abs(bal) < 0.01
                      ? "bg-muted text-muted-foreground"
                      : bal > 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
                  const label =
                    Math.abs(bal) < 0.01 ? tx("متوازن") : bal > 0 ? tx("مدين (لنا عليه)") : tx("دائن (لهم علينا)");
                  return (
                    <div className={`mt-2 rounded-lg px-2 py-1.5 flex items-center justify-between text-xs ${tone}`}>
                      <span className="font-medium">{label}</span>
                      <span className="font-bold">{Math.abs(bal).toFixed(2)} دج</span>
                    </div>
                  );
                })()}
                {sOrders.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-[11px] text-muted-foreground">{tx("آخر الفواتير:")}</div>
                    {sOrders.map((o) => (
                      <div key={o.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString("ar-DZ")}
                        </span>
                        <span className="font-medium">{Number(o.total).toFixed(2)} دج</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add supplier modal */}
      <Dialog open={supOpen} onOpenChange={setSupOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{tx("إضافة مورد")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tx("الاسم")}</Label>
              <Input value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} />
            </div>
            <div>
              <Label>{tx("الهاتف")}</Label>
              <Input value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} />
            </div>
            <div>
              <Label>{tx("ملاحظات")}</Label>
              <Textarea value={supForm.notes} onChange={(e) => setSupForm({ ...supForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupOpen(false)}>{tx("إلغاء")}</Button>
            <Button onClick={submitSupplier} disabled={supSaving}>
              {supSaving ? tx("جاري الحفظ…") : tx("حفظ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit supplier modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{tx("تعديل المورد")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tx("الاسم")}</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label>{tx("الهاتف")}</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <Label>{tx("ملاحظات")}</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{tx("إلغاء")}</Button>
            <Button onClick={submitEdit} disabled={editSaving}>
              {editSaving ? tx("جاري الحفظ…") : tx("حفظ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New PO modal */}
      <Dialog open={poOpen} onOpenChange={setPoOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tx("فاتورة شراء جديدة")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{tx("المورد")}</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  size="sm"
                  variant={poSupplierMode === "existing" ? "default" : "outline"}
                  onClick={() => setPoSupplierMode("existing")}
                  className="flex-1"
                >
                  {tx("من القائمة")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={poSupplierMode === "new" ? "default" : "outline"}
                  onClick={() => setPoSupplierMode("new")}
                  className="flex-1 gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> {tx("مورد جديد")}
                </Button>
              </div>
              {poSupplierMode === "existing" ? (
                <Select value={poSupplier} onValueChange={setPoSupplier}>
                  <SelectTrigger>
                    <SelectValue placeholder={suppliers.length ? tx("اختر المورد") : tx("لا يوجد موردون — اختر «مورد جديد»")} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={poNewSupplierName}
                  onChange={(e) => setPoNewSupplierName(e.target.value)}
                  placeholder={tx("اسم المورد الجديد (سيُضاف تلقائياً)")}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{tx("البنود")}</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRows([...rows, { ingredient_id: "", quantity: "", unit_price: "" }])}
                  className="gap-1"
                >
                  <Plus className="w-3 h-3" /> {tx("صف")}
                </Button>
              </div>
              {rows.map((r, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Select
                      value={r.ingredient_id}
                      onValueChange={(v) => {
                        const cp = [...rows];
                        cp[idx] = { ...cp[idx], ingredient_id: v };
                        setRows(cp);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder={tx("مكون")} /></SelectTrigger>
                      <SelectContent>
                        {ingredients.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      placeholder={tx("الكمية")}
                      value={r.quantity}
                      onChange={(e) => {
                        const cp = [...rows];
                        cp[idx] = { ...cp[idx], quantity: e.target.value };
                        setRows(cp);
                      }}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      placeholder={tx("سعر/وحدة")}
                      value={r.unit_price}
                      onChange={(e) => {
                        const cp = [...rows];
                        cp[idx] = { ...cp[idx], unit_price: e.target.value };
                        setRows(cp);
                      }}
                    />
                  </div>
                  <div className="col-span-1">
                    {rows.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label>{tx("ملاحظات (اختياري)")}</Label>
              <Textarea value={poNotes} onChange={(e) => setPoNotes(e.target.value)} />
            </div>

            <div className="flex justify-between items-center bg-muted rounded-xl px-4 py-3">
              <span className="text-sm text-muted-foreground">{tx("المجموع")}</span>
              <span className="text-xl font-bold text-foreground">{poTotal.toFixed(2)} دج</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoOpen(false)}>{tx("إلغاء")}</Button>
            <Button onClick={submitPO} disabled={poSaving}>
              {poSaving ? tx("جاري الحفظ…") : tx("حفظ الفاتورة")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {stmtSup && restaurantId && (
        <SupplierStatementDialog
          open={stmtOpen}
          onOpenChange={(o) => { setStmtOpen(o); if (!o) setStmtSup(null); }}
          restaurantId={restaurantId}
          supplier={{ id: stmtSup.id, name: stmtSup.name }}
        />
      )}
    </div>
  );
}
