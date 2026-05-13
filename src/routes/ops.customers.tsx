import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Heart, Gift } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId, formatDZD } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { tx } from "@/lib/ops-tx";
import { useTranslation } from "react-i18next";


export const Route = createFileRoute("/ops/customers")({
  component: OpsCustomers,
});

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  total_points: number;
  total_visits: number;
  total_spent: number;
  last_visit_at: string | null;
  notes: string | null;
};

function OpsCustomers() {
  useTranslation();
  const { restaurantId } = useRestaurantId();
  const [list, setList] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [pointsOpen, setPointsOpen] = useState(false);
  const [target, setTarget] = useState<Customer | null>(null);
  const [pointsForm, setPointsForm] = useState({ delta: "", reason: "" });

  async function load() {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("total_points", { ascending: false });
    setList((data as Customer[]) ?? []);
  }
  useEffect(() => { load(); }, [restaurantId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [list, search]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", phone: "", notes: "" });
    setOpen(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone ?? "", notes: c.notes ?? "" });
    setOpen(true);
  }

  async function save() {
    if (!restaurantId) return;
    if (!form.name.trim()) return toast.error(tx("الاسم مطلوب"));
    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success(tx("تم التحديث"));
    } else {
      const { error } = await supabase.from("customers").insert(payload);
      if (error) return toast.error(error.message);
      toast.success(tx("تمت الإضافة"));
    }
    setOpen(false);
    load();
  }

  async function adjustPoints() {
    if (!target || !restaurantId) return;
    const delta = parseInt(pointsForm.delta, 10);
    if (!Number.isFinite(delta) || delta === 0) return toast.error(tx("أدخل قيمة صحيحة"));
    const earned = delta > 0 ? delta : 0;
    const redeemed = delta < 0 ? -delta : 0;
    const { error: e1 } = await supabase.from("customer_points_log").insert({
      restaurant_id: restaurantId,
      customer_id: target.id,
      points_earned: earned,
      points_redeemed: redeemed,
      reason: pointsForm.reason.trim() || null,
    });
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase
      .from("customers")
      .update({ total_points: target.total_points + delta })
      .eq("id", target.id);
    if (e2) return toast.error(e2.message);
    toast.success(tx("تم تحديث النقاط"));
    setPointsOpen(false);
    setPointsForm({ delta: "", reason: "" });
    load();
  }

  return (
    <div dir="rtl" className="space-y-5">
      <Card className="p-4 glass flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tx("بحث بالاسم أو الهاتف")}
            className="pr-9"
          />
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 ml-1" /> {tx("عميل جديد")}
        </Button>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Card key={c.id} className="p-4 glass space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold flex items-center gap-2">
                  <Heart className="w-4 h-4 text-primary" />
                  {c.name}
                </div>
                {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
              </div>
              <Badge>{c.total_points} نقطة</Badge>
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>{c.total_visits} زيارة</span>
              <span>{formatDZD(c.total_spent)}</span>
            </div>
            {c.notes && <div className="text-xs text-muted-foreground border-t border-border/30 pt-2">{c.notes}</div>}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(c)}>
                {tx("تعديل")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={() => { setTarget(c); setPointsOpen(true); }}
              >
                <Gift className="w-3 h-3 ml-1" /> {tx("نقاط")}
              </Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-10">{tx("لا يوجد عملاء")}</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editing ? tx("تعديل عميل") : tx("عميل جديد")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{tx("الاسم")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>{tx("الهاتف")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>{tx("ملاحظات")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>{tx("حفظ")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pointsOpen} onOpenChange={setPointsOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعديل نقاط {target?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tx("عدد النقاط (سالب لخصم/استبدال)")}</Label>
              <Input type="number" value={pointsForm.delta} onChange={(e) => setPointsForm({ ...pointsForm, delta: e.target.value })} />
            </div>
            <div><Label>{tx("السبب")}</Label><Input value={pointsForm.reason} onChange={(e) => setPointsForm({ ...pointsForm, reason: e.target.value })} placeholder={tx("مثلاً: استبدال هدية")} /></div>
            <div className="text-xs text-muted-foreground">الرصيد الحالي: {target?.total_points ?? 0}</div>
          </div>
          <DialogFooter><Button onClick={adjustPoints}>{tx("تطبيق")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
