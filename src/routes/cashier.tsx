import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  Search,
  CheckCircle2,
  Loader2,
  Calculator,
  Receipt,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import {
  getCashierContext,
  cashierLookupTable,
  cashierMarkPaid,
  cashierLogout,
  cashierListReady,
} from "@/server/cashier.functions";
import { formatDZD } from "@/lib/restaurant";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cashier")({
  component: Page,
});

type Restaurant = { id: string; name: string; logo_url: string | null };
type ReadyOrder = {
  id: string;
  total: number;
  created_at: string;
  table_number: number | null;
  daily_number: number | null;
  order_type?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  items: Array<{ name: string; qty: number; price: number }>;
};

function Page() {
  const navigate = useNavigate();
  const ctxFn = useServerFn(getCashierContext);
  const lookupFn = useServerFn(cashierLookupTable);
  const markFn = useServerFn(cashierMarkPaid);
  const logoutFn = useServerFn(cashierLogout);
  const listReadyFn = useServerFn(cashierListReady);

  const [token, setToken] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);
  const [searchTable, setSearchTable] = useState("");
  const [searching, setSearching] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ amount: number; table: number | null } | null>(null);
  const fmtOrderNo = (n: number | null | undefined) =>
    n != null ? String(n).padStart(3, "0") : "—";
  const [lastPaid, setLastPaid] = useState<ReadyOrder | null>(null);

  // Auth check
  useEffect(() => {
    const t = localStorage.getItem("cashier_token");
    const exp = localStorage.getItem("cashier_expires");
    if (!t || !exp || new Date(exp) < new Date()) {
      const r = localStorage.getItem("cashier_restaurant");
      const rid = r ? (JSON.parse(r) as Restaurant).id : "";
      localStorage.removeItem("cashier_token");
      localStorage.removeItem("cashier_expires");
      navigate({ to: "/cashier-login", search: { r: rid } });
      return;
    }
    setToken(t);
    ctxFn({ data: { token: t } })
      .then((res) => setRestaurant(res.restaurant))
      .catch(() => {
        localStorage.removeItem("cashier_token");
        const r = localStorage.getItem("cashier_restaurant");
        const rid = r ? (JSON.parse(r) as Restaurant).id : "";
        navigate({ to: "/cashier-login", search: { r: rid } });
      });
  }, [ctxFn, navigate]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await listReadyFn({ data: { token } });
      setReadyOrders(res.orders);
    } catch {
      // silent
    }
  }, [token, listReadyFn]);

  // Initial load + realtime updates
  useEffect(() => {
    if (!token || !restaurant) return;
    refresh();
    const channel = supabase
      .channel(`cashier-orders-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        () => refresh(),
      )
      .subscribe();
    // safety polling
    const poll = setInterval(refresh, 8000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [token, restaurant, refresh]);

  async function onSearch() {
    const num = Number(searchTable);
    if (!num || num < 1 || !token) {
      toast.error("رقم طاولة غير صالح");
      return;
    }
    setSearching(true);
    try {
      const res = await lookupFn({ data: { token, tableNumber: num } });
      if (!res.orders.length) {
        toast.error(`لا يوجد طلب نشط لطاولة ${num}`);
      } else {
        // Try to scroll to a matching ready order on screen
        const match = res.orders.find((o) => document.getElementById(`order-${o.id}`));
        if (match) {
          const el = document.getElementById(`order-${match.id}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-4", "ring-primary");
            setTimeout(() => el.classList.remove("ring-4", "ring-primary"), 2500);
          }
        } else {
          toast(`طاولة ${num}: ${res.orders.length} طلب قيد التحضير`);
        }
      }
      setSearchTable("");
    } catch (e) {
      toast.error((e as Error).message || "فشل البحث");
    } finally {
      setSearching(false);
    }
  }

  async function onPay(order: ReadyOrder) {
    if (!token) return;
    setPaying(order.id);
    try {
      await markFn({ data: { token, orderIds: [order.id] } });
      setSuccess({ amount: order.total, table: order.table_number });
      setLastPaid(order);
      setReadyOrders((prev) => prev.filter((o) => o.id !== order.id));
      setTimeout(() => setSuccess(null), 1800);
    } catch (e) {
      toast.error((e as Error).message || "فشل الدفع");
    } finally {
      setPaying(null);
    }
  }

  function printReceipt(order: ReadyOrder) {
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) {
      toast.error("الرجاء السماح بالنوافذ المنبثقة للطباعة");
      return;
    }
    const date = new Date(order.created_at);
    const dateStr = date.toLocaleString("ar", { dateStyle: "short", timeStyle: "short" });
    const orderNo = fmtOrderNo(order.daily_number);
    const itemsHtml = order.items
      .map(
        (it) => `
        <tr>
          <td style="padding:4px 0;">${escapeHtml(it.name)}</td>
          <td style="text-align:center; padding:4px 0;">×${it.qty}</td>
          <td style="text-align:left; padding:4px 0;">${(it.price * it.qty).toLocaleString("en-US")} دج</td>
        </tr>`
      )
      .join("");
    const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>إيصال - ${orderNo}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: 'Cairo', system-ui, sans-serif; width: 72mm; margin: 0 auto; color: #000; }
  .center { text-align: center; }
  .name { font-size: 18px; font-weight: 800; }
  .muted { color: #555; font-size: 12px; }
  hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .total { font-size: 16px; font-weight: 800; display: flex; justify-content: space-between; }
  .thanks { margin-top: 10px; font-size: 12px; }
</style>
</head>
<body>
  <div class="center">
    <div class="name">${escapeHtml(restaurant?.name ?? "")}</div>
    <div class="muted">إيصال دفع</div>
  </div>
  <hr />
  <div class="muted">
    <div>رقم الطلب: <b>${orderNo}</b></div>
    ${order.table_number != null ? `<div>الطاولة: <b>${order.table_number}</b></div>` : ""}
    <div>التاريخ: ${dateStr}</div>
  </div>
  <hr />
  <table>
    <thead>
      <tr style="border-bottom:1px solid #000;">
        <th style="text-align:right; padding:4px 0;">الصنف</th>
        <th style="text-align:center; padding:4px 0;">الكمية</th>
        <th style="text-align:left; padding:4px 0;">السعر</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <hr />
  <div class="total">
    <span>المجموع</span>
    <span>${order.total.toLocaleString("en-US")} دج</span>
  </div>
  <hr />
  <div class="center thanks">شكراً لزيارتكم 🙏</div>
  <script>
    window.onload = function() {
      window.focus();
      window.print();
      setTimeout(function(){ window.close(); }, 300);
    };
  </script>
</body>
</html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  async function onLogout() {
    if (token) {
      try {
        await logoutFn({ data: { token } });
      } catch {
        // ignore
      }
    }
    const r = localStorage.getItem("cashier_restaurant");
    const rid = r ? (JSON.parse(r) as Restaurant).id : "";
    localStorage.removeItem("cashier_token");
    localStorage.removeItem("cashier_expires");
    navigate({ to: "/cashier-login", search: { r: rid } });
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col" dir="rtl">
      <header className="h-14 bg-background border-b flex items-center justify-between gap-3 px-3 md:px-6 sticky top-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-9 h-9 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
              {restaurant.name?.[0] ?? "م"}
            </div>
          )}
          <div className="leading-tight min-w-0">
            <div className="font-bold text-sm truncate">{restaurant.name}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calculator className="w-3 h-3" />
              شاشة الكاشير
            </div>
          </div>
        </div>

        {/* Compact search at top */}
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              inputMode="numeric"
              value={searchTable}
              onChange={(e) => setSearchTable(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="رقم الطاولة"
              className="h-9 ps-3 pe-8 text-sm"
            />
          </div>
          <Button
            onClick={onSearch}
            disabled={searching || !searchTable}
            size="sm"
            className="h-9"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "بحث"}
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={onLogout} className="gap-1.5 shrink-0">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">خروج</span>
        </Button>
      </header>

      <main className="flex-1 p-3 md:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              الطلبات الجاهزة للدفع
              <span className="text-sm font-normal text-muted-foreground">
                ({readyOrders.length})
              </span>
            </h1>
          </div>

          {readyOrders.length === 0 ? (
            <div className="bg-background rounded-2xl shadow-sm p-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Receipt className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium">لا توجد طلبات جاهزة</p>
              <p className="text-sm text-muted-foreground mt-1">
                ستظهر الطلبات تلقائياً عند جاهزيتها
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <AnimatePresence>
                {readyOrders.map((o) => (
                  <motion.div
                    id={`order-${o.id}`}
                    key={o.id}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 200, damping: 22 }}
                    className="bg-background rounded-2xl shadow-sm border p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {o.order_type === "takeaway" ? (
                          <>
                            <span className="text-2xl font-bold text-primary">🥡</span>
                            <span className="text-xs text-muted-foreground">
                              {o.customer_name ?? "تيك أواي"}
                              {o.customer_phone ? ` · ${o.customer_phone}` : ""}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-2xl font-bold text-primary">
                              #{o.table_number ?? "—"}
                            </span>
                            <span className="text-xs text-muted-foreground">طاولة</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10">
                        <span className="text-[10px] text-muted-foreground">طلب</span>
                        <span className="text-base font-bold text-primary font-mono">
                          {fmtOrderNo(o.daily_number)}
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-1 text-sm">
                      {o.items.map((it, idx) => (
                        <li key={idx} className="flex items-center justify-between">
                          <span>
                            <span className="font-bold text-primary">×{it.qty}</span> {it.name}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDZD(it.price * it.qty)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm">المجموع:</span>
                      <span className="text-xl font-bold text-primary">
                        {formatDZD(o.total)}
                      </span>
                    </div>

                    <Button
                      onClick={() => onPay(o)}
                      disabled={paying === o.id}
                      className="w-full h-12 text-base"
                    >
                      {paying === o.id ? (
                        <Loader2 className="w-5 h-5 animate-spin ms-2" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 ms-2" />
                      )}
                      تم الدفع
                    </Button>
                    <Button
                      onClick={() => printReceipt(o)}
                      variant="outline"
                      className="w-full h-10 text-sm"
                    >
                      <Printer className="w-4 h-4 ms-2" />
                      طباعة الإيصال
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Success overlay */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background rounded-3xl p-8 text-center space-y-3 shadow-2xl"
            >
              <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-green-700">تم الدفع ✓</h2>
              <p className="text-lg">
                {success.table != null && <>طاولة {success.table} - </>}
                {formatDZD(success.amount)}
              </p>
              {lastPaid && (
                <Button
                  onClick={() => printReceipt(lastPaid)}
                  className="w-full h-11 mt-2"
                >
                  <Printer className="w-4 h-4 ms-2" />
                  طباعة الإيصال للعميل
                </Button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
