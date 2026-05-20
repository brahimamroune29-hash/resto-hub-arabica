import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Download, Layers } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appOrigin } from "@/lib/app-url";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/dashboard/tables")({
  component: Page,
});

type TableRow = {
  id: string;
  table_number: number;
  qr_token: string;
  restaurant_id: string;
};

function Page() {
  const { t } = useTranslation();
  const { restaurantId, loading: rLoading } = useRestaurantId();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCount, setBulkCount] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [toDelete, setToDelete] = useState<TableRow | null>(null);

  async function load(rid: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", rid)
      .order("table_number", { ascending: true });
    if (error) toast.error(t("tables.loadFailed"));
    setTables((data as TableRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!restaurantId) return;
    load(restaurantId);
    const ch = supabase
      .channel("tables-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables", filter: `restaurant_id=eq.${restaurantId}` },
        () => load(restaurantId),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurantId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId) return;
    const n = Number(number);
    if (!Number.isInteger(n) || n <= 0) {
      toast.error(t("tables.mustBeGtZero"));
      return;
    }
    if (tables.some((row) => row.table_number === n)) {
      toast.error(t("tables.alreadyUsed"));
      return;
    }
    setSaving(true);
    const qr_token = crypto.randomUUID();
    const { error } = await supabase.from("tables").insert({
      restaurant_id: restaurantId,
      table_number: n,
      qr_token,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? t("tables.alreadyUsed") : t("tables.addFailed"));
      return;
    }
    toast.success(t("tables.added"));
    setNumber("");
    setOpen(false);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const { error } = await supabase.from("tables").delete().eq("id", toDelete.id);
    if (error) toast.error(t("tables.deleteFailed"));
    else toast.success(t("tables.deleted"));
    setToDelete(null);
  }

  async function handleBulkAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId) return;
    const count = Number(bulkCount);
    if (!Number.isInteger(count) || count <= 0 || count > 200) {
      toast.error("أدخل عدداً صحيحاً بين 1 و 200");
      return;
    }
    setBulkSaving(true);
    const used = new Set(tables.map((row) => row.table_number));
    const rows: { restaurant_id: string; table_number: number; qr_token: string }[] = [];
    let n = 1;
    while (rows.length < count) {
      if (!used.has(n)) {
        rows.push({
          restaurant_id: restaurantId,
          table_number: n,
          qr_token: crypto.randomUUID(),
        });
        used.add(n);
      }
      n++;
      if (n > 100000) break;
    }
    const { error } = await supabase.from("tables").insert(rows);
    setBulkSaving(false);
    if (error) {
      toast.error(t("tables.addFailed"));
      return;
    }
    toast.success(`تمت إضافة ${rows.length} طاولة`);
    setBulkCount("");
    setBulkOpen(false);
  }

  if (rLoading || loading) {
    return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button onClick={() => setBulkOpen(true)} variant="outline" className="rounded-lg">
          <Layers className="ml-2 h-4 w-4" />
          إضافة عدة طاولات
        </Button>
        <Button onClick={() => setOpen(true)} className="rounded-lg">
          <Plus className="ml-2 h-4 w-4" />
          {t("tables.addTable")}
        </Button>
      </div>

      {tables.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">{t("tables.emptyHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tables.map((t) => (
            <TableCard key={t.id} table={t} onDelete={() => setToDelete(t)} />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("tables.addTable")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="num">{t("tables.tableNumber")}</Label>
              <Input
                id="num"
                type="number"
                min={1}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة عدة طاولات</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBulkAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-num">عدد الطاولات المراد إضافتها</Label>
              <Input
                id="bulk-num"
                type="number"
                min={1}
                max={200}
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
                placeholder="مثال: 35"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                سيتم إنشاء رمز QR لكل طاولة برقم تلقائي يبدأ من أصغر رقم متاح.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={bulkSaving}>
                {bulkSaving ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tables.deleteTable")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tables.confirmDeleteWithNumber", { n: toDelete?.table_number ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TableCard({ table, onDelete }: { table: TableRow; onDelete: () => void }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = `${appOrigin()}/r/${table.qr_token}`;

  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [url]);

  async function download() {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 800,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `table-${table.table_number}-qr.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error(t("tables.qrFailed"));
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center gap-4 transition hover:shadow-sm">
      <h3 className="text-xl font-bold text-foreground">{t("common.table")} {table.table_number}</h3>
      <div className="bg-card p-3 rounded-xl border border-border">
        <canvas ref={canvasRef} />
      </div>
      <p className="text-[11px] text-muted-foreground break-all text-center select-all">{url}</p>
      <div className="flex gap-2 w-full">
        <Button onClick={download} variant="outline" className="flex-1 hover:bg-primary hover:text-primary-foreground hover:border-primary">
          <Download className="ml-2 h-4 w-4" />
          {t("tables.downloadQr")}
        </Button>
        <Button variant="outline" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
