import { useEffect, useMemo, useState } from "react";
import { Printer, Plus } from "lucide-react";
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

type Tx = {
  id: string;
  type: "purchase" | "payment" | "advance" | "return";
  amount: number;
  notes: string | null;
  date: string;
  created_at: string;
};

type PaymentType = "full" | "partial" | "advance";

const TYPE_LABELS: Record<Tx["type"], string> = {
  purchase: "فاتورة شراء",
  payment: "دفعة",
  advance: "تسبيق",
  return: "إرجاع",
};

const PAYMENT_LABELS: Record<PaymentType, string> = {
  full: "دفعة كاملة",
  partial: "دفعة جزئية",
  advance: "تسبيق",
};

export function SupplierStatementDialog({
  open,
  onOpenChange,
  restaurantId,
  supplier,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  restaurantId: string;
  supplier: { id: string; name: string };
}) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Add payment form
  const [payOpen, setPayOpen] = useState(false);
  const [payType, setPayType] = useState<PaymentType>("full");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState("");
  const [paySaving, setPaySaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("supplier_transactions")
      .select("*")
      .eq("supplier_id", supplier.id)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error("فشل تحميل الحركات");
    setTxs((data ?? []) as Tx[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier.id]);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      return true;
    });
  }, [txs, from, to]);

  // Debt: supplier-supplied goods we owe (purchase). Credit: payments we made / advances.
  const totals = useMemo(() => {
    let debt = 0;
    let credit = 0;
    for (const t of txs) {
      if (t.type === "purchase") debt += Number(t.amount);
      else if (t.type === "return") debt -= Number(t.amount);
      else if (t.type === "payment" || t.type === "advance") credit += Number(t.amount);
    }
    return { debt, credit, net: debt - credit };
  }, [txs]);

  // Running balance (debt − credit) up to each row
  const withRunning = useMemo(() => {
    let bal = 0;
    // start from full chronological list to keep continuity, then filter for display
    const rowsAll = txs.map((t) => {
      if (t.type === "purchase") bal += Number(t.amount);
      else if (t.type === "return") bal -= Number(t.amount);
      else bal -= Number(t.amount);
      return { ...t, balance: bal };
    });
    return rowsAll.filter((t) => {
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      return true;
    });
  }, [txs, from, to]);

  const submitPayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    setPaySaving(true);
    const txType = payType === "advance" ? "advance" : "payment";
    const noteLabel = PAYMENT_LABELS[payType];
    const fullNote = payNotes.trim() ? `${noteLabel} — ${payNotes.trim()}` : noteLabel;
    const { error } = await supabase.from("supplier_transactions").insert({
      restaurant_id: restaurantId,
      supplier_id: supplier.id,
      type: txType,
      amount,
      date: payDate,
      notes: fullNote,
    });
    setPaySaving(false);
    if (error) {
      toast.error("فشل تسجيل الدفعة");
      return;
    }
    toast.success("تم تسجيل الدفعة");
    setPayOpen(false);
    setPayAmount("");
    setPayNotes("");
    void load();
  };

  const exportPdf = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = withRunning
      .map(
        (t) => `<tr>
          <td>${t.date}</td>
          <td>${TYPE_LABELS[t.type]}</td>
          <td>${t.notes ?? ""}</td>
          <td style="text-align:left">${t.type === "purchase" ? formatDZD(Number(t.amount)) : "-"}</td>
          <td style="text-align:left">${t.type !== "purchase" && t.type !== "return" ? formatDZD(Number(t.amount)) : t.type === "return" ? "-" + formatDZD(Number(t.amount)) : "-"}</td>
          <td style="text-align:left">${formatDZD(t.balance)}</td>
        </tr>`,
      )
      .join("");
    win.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
      <title>كشف حساب — ${supplier.name}</title>
      <style>
        body{font-family:Cairo,system-ui,sans-serif;padding:24px;color:#111}
        h1{margin:0 0 4px}
        .sum{display:flex;gap:12px;margin:16px 0}
        .box{border:1px solid #ddd;border-radius:8px;padding:8px 12px;flex:1}
        table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:right}
        th{background:#f5f5f5}
      </style></head><body>
      <h1>كشف حساب المورد</h1>
      <div>المورد: <b>${supplier.name}</b></div>
      <div>الفترة: ${from || "البداية"} → ${to || "اليوم"}</div>
      <div class="sum">
        <div class="box"><div>مدين</div><b>${formatDZD(totals.debt)}</b></div>
        <div class="box"><div>دائن</div><b>${formatDZD(totals.credit)}</b></div>
        <div class="box"><div>الصافي</div><b>${formatDZD(totals.net)}</b></div>
      </div>
      <table><thead><tr>
        <th>التاريخ</th><th>النوع</th><th>ملاحظة</th><th>مدين</th><th>دائن</th><th>الرصيد</th>
      </tr></thead><tbody>${rows || `<tr><td colspan="6" style="text-align:center">لا حركات</td></tr>`}</tbody></table>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
      </body></html>`);
    win.document.close();
  };

  const statusBadge = () => {
    if (Math.abs(totals.net) < 0.01)
      return <Badge className="bg-emerald-600/15 text-emerald-700">متوازن</Badge>;
    if (totals.net > 0)
      return <Badge variant="destructive">مدين {formatDZD(totals.net)}</Badge>;
    return (
      <Badge className="bg-blue-600/15 text-blue-700">دائن {formatDZD(-totals.net)}</Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            كشف حساب — {supplier.name} {statusBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 my-3">
          <div className="rounded-xl bg-muted p-3">
            <div className="text-xs text-muted-foreground">مدين</div>
            <div className="font-bold text-destructive">{formatDZD(totals.debt)}</div>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <div className="text-xs text-muted-foreground">دائن</div>
            <div className="font-bold text-blue-600">{formatDZD(totals.credit)}</div>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <div className="text-xs text-muted-foreground">الصافي</div>
            <div className="font-bold">{formatDZD(totals.net)}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-end mb-3">
          <div>
            <Label className="text-xs">من</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">إلى</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => setPayOpen(true)} className="gap-1">
            <Plus className="w-4 h-4" /> تسجيل دفعة
          </Button>
          <Button variant="outline" onClick={exportPdf} className="gap-1">
            <Printer className="w-4 h-4" /> تصدير PDF
          </Button>
        </div>

        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs">
              <tr>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">النوع</th>
                <th className="p-2 text-right">ملاحظة</th>
                <th className="p-2 text-right">مدين</th>
                <th className="p-2 text-right">دائن</th>
                <th className="p-2 text-right">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    جاري التحميل…
                  </td>
                </tr>
              ) : withRunning.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    لا توجد حركات
                  </td>
                </tr>
              ) : (
                withRunning.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2">{t.date}</td>
                    <td className="p-2">{TYPE_LABELS[t.type]}</td>
                    <td className="p-2 text-xs text-muted-foreground">{t.notes ?? "-"}</td>
                    <td className="p-2 text-destructive">
                      {t.type === "purchase" ? formatDZD(Number(t.amount)) : "-"}
                    </td>
                    <td className="p-2 text-blue-600">
                      {t.type === "payment" || t.type === "advance"
                        ? formatDZD(Number(t.amount))
                        : t.type === "return"
                          ? formatDZD(Number(t.amount))
                          : "-"}
                    </td>
                    <td className="p-2 font-semibold">{formatDZD(t.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>

        {/* Add payment sub-dialog */}
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>تسجيل دفعة — {supplier.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>نوع الدفعة</Label>
                <Select value={payType} onValueChange={(v) => setPayType(v as PaymentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">دفعة كاملة</SelectItem>
                    <SelectItem value="partial">دفعة جزئية</SelectItem>
                    <SelectItem value="advance">تسبيق</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>المبلغ (دج)</Label>
                  <Input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>التاريخ</Label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={submitPayment} disabled={paySaving}>
                {paySaving ? "جاري الحفظ…" : "حفظ الدفعة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}