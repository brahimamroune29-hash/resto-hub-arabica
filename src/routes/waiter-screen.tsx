import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { UtensilsCrossed, LogOut, RefreshCw, CheckCircle2, Clock, ChefHat, Loader2, Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { getWaiterContext, waiterLogout, waiterListReadyOrders, waiterClaimOrder, waiterMarkServed } from "@/lib/waiter.functions";

export const Route = createFileRoute("/waiter-screen")({
  component: Page,
});

type Order = {
  id: string;
  total: number;
  status: string;
  created_at: string;
  order_type: string;
  customer_name: string | null;
  daily_number: number | null;
  notes: string | null;
  table_number: number | null;
  is_mine: boolean;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "جديد ⏳", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  preparing: { label: "قيد التحضير 👨‍🍳", color: "bg-orange-100 text-orange-800 border-orange-200" },
  ready: { label: "جاهز ✅", color: "bg-green-100 text-green-800 border-green-200" },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" });
}

function Page() {
  const navigate = useNavigate();
  const getContext = useServerFn(getWaiterContext);
  const logout = useServerFn(waiterLogout);
  const listOrders = useServerFn(waiterListReadyOrders);
  const claimOrder = useServerFn(waiterClaimOrder);
  const markServed = useServerFn(waiterMarkServed);

  const [waiterName, setWaiterName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [servingId, setServingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [filter, setFilter] = useState<"all" | "ready" | "mine">("ready");

  const token = typeof window !== "undefined" ? localStorage.getItem("waiter_token") ?? "" : "";

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await listOrders({ data: { token } });
      setOrders(res.orders as Order[]);
    } catch {
      // session expired
    }
  }, [token]);

  useEffect(() => {
    if (!token) { navigate({ to: "/waiter-login" }); return; }
    getContext({ data: { token } })
      .then((ctx) => {
        setWaiterName(ctx.waiterName);
        setRestaurantName(ctx.restaurant.name);
        setLoadingCtx(false);
      })
      .catch(() => {
        localStorage.removeItem("waiter_token");
        navigate({ to: "/waiter-login" });
      });
    fetchOrders();
    pollRef.current = setInterval(fetchOrders, 6000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [token]);

  async function handleLogout() {
    try { await logout({ data: { token } }); } catch { /* ignore */ }
    localStorage.removeItem("waiter_token");
    localStorage.removeItem("waiter_expires");
    localStorage.removeItem("waiter_name");
    localStorage.removeItem("waiter_id");
    localStorage.removeItem("waiter_restaurant");
    navigate({ to: "/waiter-login" });
  }

  async function handleClaim(orderId: string) {
    try {
      await claimOrder({ data: { token, orderId } });
      await fetchOrders();
      toast.success("تم أخذ الطلب");
    } catch (e) {
      toast.error((e as Error).message || "فشل");
    }
  }

  async function handleServe(orderId: string) {
    setServingId(orderId);
    try {
      await markServed({ data: { token, orderId } });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success("تم تسليم الطلب ✅");
    } catch (e) {
      toast.error((e as Error).message || "فشل");
    } finally {
      setServingId(null);
    }
  }

  const filtered = orders.filter((o) => {
    if (filter === "ready") return o.status === "ready";
    if (filter === "mine") return o.is_mine;
    return true;
  });

  const readyCount = orders.filter((o) => o.status === "ready").length;

  if (loadingCtx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col" dir="rtl">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5" />
          <div>
            <p className="font-bold text-sm leading-tight">{waiterName}</p>
            <p className="text-xs text-blue-200 leading-tight">{restaurantName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {readyCount > 0 && (
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
              <Bell className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{readyCount} جاهز</span>
            </div>
          )}
          <button onClick={fetchOrders} className="text-white/80 hover:text-white p-1">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={handleLogout} className="text-white/80 hover:text-white p-1">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-1 p-3 bg-background border-b sticky top-14 z-10">
        {(["ready", "all", "mine"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            {f === "ready" ? `جاهزة (${readyCount})` : f === "all" ? "الكل" : "طلباتي"}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <main className="flex-1 p-3 space-y-3 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <CheckCircle2 className="w-12 h-12 opacity-30" />
            <p className="text-sm">
              {filter === "ready" ? "لا توجد طلبات جاهزة حالياً" : "لا توجد طلبات"}
            </p>
          </div>
        ) : (
          filtered.map((order) => (
            <div
              key={order.id}
              className={`bg-background rounded-2xl shadow-sm border-2 p-4 space-y-3 ${
                order.status === "ready" ? "border-green-200" : order.is_mine ? "border-blue-200" : "border-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg">
                      {order.daily_number ? `#${String(order.daily_number).padStart(3, "0")}` : "—"}
                    </span>
                    {order.table_number && (
                      <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        طاولة {order.table_number}
                      </span>
                    )}
                    {order.order_type === "delivery" && (
                      <span className="text-sm bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        توصيل
                      </span>
                    )}
                    {order.order_type === "takeaway" && (
                      <span className="text-sm bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                        سريع
                      </span>
                    )}
                    {order.is_mine && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">طلبك</span>
                    )}
                  </div>
                  {order.customer_name && (
                    <p className="text-sm text-muted-foreground mt-0.5">{order.customer_name}</p>
                  )}
                </div>
                <div className="text-left shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_LABELS[order.status]?.color ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                    {STATUS_LABELS[order.status]?.label ?? order.status}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    {formatTime(order.created_at)}
                  </p>
                </div>
              </div>

              {order.notes && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                  ملاحظة: {order.notes}
                </p>
              )}

              <div className="flex gap-2">
                {!order.is_mine && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleClaim(order.id)}
                    className="flex-1"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 ms-1" />
                    أنا سأخدم
                  </Button>
                )}
                {order.status === "ready" && (
                  <Button
                    size="sm"
                    onClick={() => handleServe(order.id)}
                    disabled={servingId === order.id}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {servingId === order.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin ms-1" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 ms-1" />
                    )}
                    تم التسليم
                  </Button>
                )}
                {order.status !== "ready" && order.is_mine && (
                  <div className="flex-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <ChefHat className="w-3.5 h-3.5" />
                    قيد التحضير…
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
