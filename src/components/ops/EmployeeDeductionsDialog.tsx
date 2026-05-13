import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDZD } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

type Deduction = {
  id: string;
  type: "advance" | "meal" | "other";
  amount: number;
  quantity: number;
  label: string | null;
  date: string;
  month: string;
  notes: string | null;
};

type Settlement = {
  id: string;
  month: string;
  base_salary: number;
  total_deductions: number;
  net_salary: number;
  paid_at: string;
};

const TYPE_LABELS: Record<Deduction["type"], string> = {
  advance: "سلفة",
  meal: "وجبات",
  other: "اقتطاع آخر",
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function EmployeeDeductionsDialog({
  open,
  onOpenChange,
  restaurantId,
  employee,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  restaurantId: string;
  employee: { id: string; name: string; base_salary: number };
}) {
  const [month, setMonth] = useState(currentMonth());
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);

  // Add deduction form
  const [type, setType] = useState<Deduction["type"]>("advance");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = async () => {
    setLoading(true);
    const [d, s] = await Promise.all([
      supabase
        .from("employee_deductions")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("month", month)
        .order("date", { ascending: true }),
      supabase
        .from("employee_salary_payments")
        .select("*")
        .eq("employee_id", employee.id)
        .order("month", { ascending: false }),
    ]);
    setDeductions((d.data ?? []) as Deduction[]);
    setSettlements((s.data ?? []) as Settlement[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee.id, month]);

  const totals = useMemo(() => {
    let advances = 0;
    let meals = 0;
    let other = 0;
    for (const d of deductions) {
      const sub = d.type === "meal" ? Number(d.amount) * Number(d.quantity || 1) : Number(d.amount);
      if (d.type === "advance") advances += sub;
      else if (d.type === "meal") meals += sub;
      else other += sub;
    }
    const total = advances + meals + other;
    const net = Math.max(0, Number(employee.base_salary) - total);
    return { advances, meals, other, total, net };
  }, [deductions, employee.base_salary]);

  const settlementForMonth = settlements.find((s) => s.month === month);

  const addDeduction = async () => {
    const a = Number(amount);
    if (!a || a <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    if (type === "other" && !label.trim()) {
      toast.error("أدخل عنوان الاقتطاع");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("employee_deductions").insert({
      restaurant_id: restaurantId,
      employee_id: employee.id,
      type,
      amount: a,
      quantity: type === "meal" ? Number(quantity) || 1 : 1,
      label: label.trim() || null,
      date,
      month,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("فشل الإضافة");
      return;
    }
    toast.success("تمت الإضافة");
    setAmount("");
    setQuantity("1");
    setLabel("");
    setNotes("");
    void load();
  };

  const removeDeduction = async (id: string) => {
    if (!confirm("حذف هذا الاقتطاع؟")) return;
    const { error } = await supabase.from("employee_deductions").delete().eq("id", id);
    if (error) {
      toast.error("فشل الحذف");
      return;
    }
    void load();
  };

  const confirmPayment = async () => {
    if (settlementForMonth) {
      toast.error("تم الدفع لهذا الشهر مسبقاً");
      return;
    }
    setConfirming(true);
    const { error } = await supabase.from("employee_salary_payments").insert({
      restaurant_id: restaurantId,
      employee_id: employee.id,
      month,
      base_salary: Number(employee.base_salary),
      total_deductions: totals.total,
      net_salary: totals.net,
    });
    setConfirming(false);
    if (error) {
      toast.error("فشل تسجيل الدفع");
      return;
    }
    toast.success("تم تسجيل الراتب الصافي");
    void load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            اقتطاعات وراتب — {employee.name}
            {settlementForMonth && (
              <Badge className="bg-emerald-600/15 text-emerald-700">تم الدفع</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-end gap-2 mt-2">
          <div className="flex-1">
            <Label className="text-xs">الشهر</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        </div>

        {/* Salary breakdown */}
        <div className="rounded-xl border p-3 mt-3 space-y-1.5 text-sm bg-muted/30">
          <div className="flex justify-between">
            <span className="text-muted-foreground">الراتب الأساسي</span>
            <span className="font-bold">{formatDZD(Number(employee.base_salary))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">السلف</span>
            <span className="text-destructive">- {formatDZD(totals.advances)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">الوجبات</span>
            <span className="text-destructive">- {formatDZD(totals.meals)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">اقتطاعات أخرى</span>
            <span className="text-destructive">- {formatDZD(totals.other)}</span>
          </div>
          <div className="border-t pt-1.5 flex justify-between text-base">
            <span className="font-bold">الراتب الصافي</span>
            <span className="font-extrabold text-emerald-600">{formatDZD(totals.net)}</span>
          </div>
        </div>

        <Button
          onClick={confirmPayment}
          disabled={confirming || !!settlementForMonth}
          className="w-full mt-3 gap-2"
        >
          <Check className="w-4 h-4" />
          {settlementForMonth ? "تم الدفع" : confirming ? "جاري…" : "تأكيد دفع الصافي"}
        </Button>

        {/* Add deduction */}
        <div className="border rounded-xl p-3 mt-4 space-y-2">
          <div className="font-semibold text-sm">إضافة اقتطاع</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">النوع</Label>
              <Select value={type} onValueChange={(v) => setType(v as Deduction["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="advance">سلفة</SelectItem>
                  <SelectItem value="meal">وجبات</SelectItem>
                  <SelectItem value="other">اقتطاع آخر</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{type === "meal" ? "السعر/وجبة" : "المبلغ"}</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            {type === "meal" && (
              <div>
                <Label className="text-xs">عدد الوجبات</Label>
                <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            )}
            <div>
              <Label className="text-xs">التاريخ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {(type === "other" || type === "advance") && (
            <div>
              <Label className="text-xs">{type === "other" ? "العنوان" : "السبب (اختياري)"}</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
          )}
          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button onClick={addDeduction} disabled={saving} size="sm" className="gap-1">
            <Plus className="w-4 h-4" /> إضافة
          </Button>
        </div>

        {/* Deductions list */}
        <div className="mt-4 border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs">
              <tr>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">النوع</th>
                <th className="p-2 text-right">التفاصيل</th>
                <th className="p-2 text-right">المبلغ</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">جاري التحميل…</td></tr>
              ) : deductions.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">لا اقتطاعات لهذا الشهر</td></tr>
              ) : (
                deductions.map((d) => {
                  const sub = d.type === "meal" ? Number(d.amount) * Number(d.quantity || 1) : Number(d.amount);
                  return (
                    <tr key={d.id} className="border-t">
                      <td className="p-2">{d.date}</td>
                      <td className="p-2">{TYPE_LABELS[d.type]}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {d.type === "meal" ? `${d.quantity} × ${formatDZD(Number(d.amount))}` : d.label || d.notes || "-"}
                      </td>
                      <td className="p-2 font-semibold text-destructive">{formatDZD(sub)}</td>
                      <td className="p-2">
                        <Button size="icon" variant="ghost" onClick={() => removeDeduction(d.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}