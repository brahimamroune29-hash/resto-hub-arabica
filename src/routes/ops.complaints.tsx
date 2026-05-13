import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { tx } from "@/lib/ops-tx";
import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/ops/complaints")({
  component: OpsComplaints,
});

type Complaint = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  type: string;
  description: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  new: tx("جديدة"),
  in_progress: tx("قيد المعالجة"),
  resolved: tx("تم الحل"),
};

function OpsComplaints() {
  useTranslation();
  const { restaurantId } = useRestaurantId();
  const [list, setList] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState<"all" | "new" | "in_progress" | "resolved">("all");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Complaint | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string>("in_progress");

  async function load() {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("complaints")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });
    setList((data as Complaint[]) ?? []);
  }
  useEffect(() => { load(); }, [restaurantId]);

  const filtered = filter === "all" ? list : list.filter((c) => c.status === filter);

  function openItem(c: Complaint) {
    setActive(c);
    setNotes(c.resolution_notes ?? "");
    setStatus(c.status);
    setOpen(true);
  }

  async function save() {
    if (!active) return;
    const patch: {
      status: string;
      resolution_notes: string | null;
      resolved_at?: string;
    } = {
      status,
      resolution_notes: notes.trim() || null,
    };
    if (status === "resolved" && !active.resolved_at) patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("complaints").update(patch).eq("id", active.id);
    if (error) return toast.error(error.message);
    toast.success(tx("تم التحديث"));
    setOpen(false);
    load();
  }

  return (
    <div dir="rtl" className="space-y-5">
      <Card className="p-4 glass flex items-center gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tx("الكل")}</SelectItem>
            <SelectItem value="new">{tx("جديدة")}</SelectItem>
            <SelectItem value="in_progress">{tx("قيد المعالجة")}</SelectItem>
            <SelectItem value="resolved">{tx("تم الحل")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">{filtered.length} شكوى</div>
      </Card>

      <div className="space-y-3">
        {filtered.map((c) => (
          <Card key={c.id} className="p-4 glass cursor-pointer hover:bg-accent/30" onClick={() => openItem(c)}>
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{c.type}</Badge>
                  <Badge
                    variant={c.status === "resolved" ? "secondary" : c.status === "new" ? "destructive" : "default"}
                  >
                    {STATUS_LABEL[c.status] ?? c.status}
                  </Badge>
                </div>
                <div className="text-sm">{c.description}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {c.customer_name ?? tx("مجهول")} {c.customer_phone ? `· ${c.customer_phone}` : ""} · {new Date(c.created_at).toLocaleString("ar-DZ")}
                </div>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-10">{tx("لا توجد شكاوى")}</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{tx("تفاصيل الشكوى")}</DialogTitle></DialogHeader>
          {active && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">{tx("النوع:")} </span>{active.type}</div>
              <div><span className="text-muted-foreground">{tx("الوصف:")} </span>{active.description}</div>
              <div><span className="text-muted-foreground">{tx("العميل:")} </span>{active.customer_name ?? "—"} {active.customer_phone ? `(${active.customer_phone})` : ""}</div>
              <div>
                <label className="text-xs text-muted-foreground">{tx("الحالة")}</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{tx("جديدة")}</SelectItem>
                    <SelectItem value="in_progress">{tx("قيد المعالجة")}</SelectItem>
                    <SelectItem value="resolved">{tx("تم الحل")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{tx("ملاحظات الحل")}</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={save}>{tx("حفظ")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
