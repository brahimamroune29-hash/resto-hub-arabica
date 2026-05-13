import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS, fr as frLocale } from "date-fns/locale";
import type { Locale } from "date-fns";
import { Inbox, ChefHat, CheckCheck, Wallet, Bell, BellOff, Bike, Phone, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { formatDZD } from "@/lib/restaurant";
import { useNewOrderNotifications } from "@/hooks/useNewOrderNotifications";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/dashboard/orders")({
  component: Page,
});

type OrderStatus = "new" | "preparing" | "ready" | "paid";

type OrderItem = {
  id: string;
  name_snapshot: string;
  quantity: number;
  price_snapshot: number;
};

type Order = {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  status: OrderStatus;
  total: number;
  acknowledged: boolean;
  created_at: string;
  table_number?: number | null;
  items?: OrderItem[];
  order_type?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
};

type ColumnDef = {
  status: OrderStatus;
  bg: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
};

const COLUMNS: ColumnDef[] = [
  { status: "new", bg: "#FFFFFF", accent: "#EF4444", icon: Inbox },
  { status: "preparing", bg: "#FFFFFF", accent: "#F59E0B", icon: ChefHat },
  { status: "ready", bg: "#FFFFFF", accent: "#10B981", icon: CheckCheck },
  { status: "paid", bg: "#FFFFFF", accent: "var(--muted-foreground)", icon: Wallet },
];

function getNextStatus(o: Pick<Order, "status" | "order_type">): { label: string; next: OrderStatus } | null {
  const isDelivery = o.order_type === "delivery";
  switch (o.status) {
    case "new":
      return { label: "بدء التحضير", next: "preparing" };
    case "preparing":
      return { label: isDelivery ? "جاهز للتوصيل" : "تحديد كجاهز", next: "ready" };
    case "ready":
      return { label: isDelivery ? "✓ تم التسليم والدفع" : "تحديد كمدفوع", next: "paid" };
    default:
      return null;
  }
}

function Page() {
  const { t, i18n } = useTranslation();
  const { restaurantId, loading: rLoading } = useRestaurantId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMobileTab, setActiveMobileTab] = useState<OrderStatus>("new");
  const [, force] = useState(0);
  const notif = useNewOrderNotifications();

  // Tick for relative time
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  async function loadAll(rid: string) {
    setLoading(true);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data: orderRows, error } = await supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", rid)
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(t("orders.loadFailed"));
      setLoading(false);
      return;
    }
    const ids = (orderRows ?? []).map((o) => o.id);
    const tableIds = (orderRows ?? []).map((o) => o.table_id).filter(Boolean) as string[];
    const [itemsRes, tablesRes] = await Promise.all([
      ids.length
        ? supabase.from("order_items").select("*").in("order_id", ids)
        : Promise.resolve({ data: [], error: null } as const),
      tableIds.length
        ? supabase.from("tables").select("id, table_number").in("id", tableIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    const itemsByOrder = new Map<string, OrderItem[]>();
    for (const it of (itemsRes.data ?? []) as (OrderItem & { order_id: string })[]) {
      const arr = itemsByOrder.get(it.order_id) ?? [];
      arr.push(it);
      itemsByOrder.set(it.order_id, arr);
    }
    const tableMap = new Map<string, number>();
    for (const t of (tablesRes.data ?? []) as { id: string; table_number: number }[]) {
      tableMap.set(t.id, t.table_number);
    }
    setOrders(
      (orderRows ?? []).map((o) => ({
        ...(o as Order),
        total: Number(o.total),
        items: itemsByOrder.get(o.id) ?? [],
        table_number: o.table_id ? tableMap.get(o.table_id) ?? null : null,
      })),
    );
    setLoading(false);
  }

  async function fetchSingleOrder(rid: string, id: string) {
    const { data: o } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("restaurant_id", rid)
      .maybeSingle();
    if (!o) return null;
    const [{ data: items }, { data: t }] = await Promise.all([
      supabase.from("order_items").select("*").eq("order_id", id),
      o.table_id
        ? supabase.from("tables").select("table_number").eq("id", o.table_id).maybeSingle()
        : Promise.resolve({ data: null } as const),
    ]);
    return {
      ...(o as Order),
      total: Number(o.total),
      items: (items as OrderItem[]) ?? [],
      table_number: t?.table_number ?? null,
    } as Order;
  }

  useEffect(() => {
    if (!restaurantId) return;
    loadAll(restaurantId);
    const ch = supabase
      .channel("orders-rt")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const fresh = await fetchSingleOrder(restaurantId, (payload.new as Order).id);
            if (fresh) {
              setOrders((prev) => [fresh, ...prev.filter((o) => o.id !== fresh.id)]);
              toast.success(t("orders.newOrder"));
              notif.notify(t("orders.newOrder"), `${t("common.table")} ${fresh.table_number ?? "?"} - ${formatDZD(fresh.total)}`);
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Order;
            setOrders((prev) =>
              prev.map((o) =>
                o.id === updated.id
                  ? { ...o, status: updated.status, acknowledged: updated.acknowledged, total: Number(updated.total) }
                  : o,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Order;
            setOrders((prev) => prev.filter((o) => o.id !== old.id));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const grouped = useMemo(() => {
    const g: Record<OrderStatus, Order[]> = { new: [], preparing: [], ready: [], paid: [] };
    for (const o of orders) g[o.status]?.push(o);
    return g;
  }, [orders]);

  async function advance(o: Order) {
    const cfg = getNextStatus(o);
    if (!cfg) return;
    const next = cfg.next;
    const prev = orders;
    // Optimistic
    setOrders((curr) =>
      curr.map((x) => (x.id === o.id ? { ...x, status: next, acknowledged: true } : x)),
    );
    const now = new Date();
    const patch =
      next === "paid"
        ? {
            status: next,
            acknowledged: true,
            served_at: now.toISOString(),
            review_due_at: new Date(now.getTime() + 35 * 60_000).toISOString(),
          }
        : { status: next, acknowledged: true };
    const { error } = await supabase.from("orders").update(patch).eq("id", o.id);
    if (error) {
      setOrders(prev);
      toast.error(t("orders.updateFailed"));
    }
  }

  if (rLoading || loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t("orders.title")}</h1>
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((c) => (
            <div key={c.status} className="rounded-2xl p-3 min-h-[200px]" style={{ backgroundColor: c.bg }}>
              <div className="h-6 w-24 bg-background/70 rounded mb-3" />
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="bg-background rounded-2xl p-4 space-y-2 animate-pulse">
                    <div className="h-4 w-20 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="h-3 w-2/3 bg-muted rounded" />
                    <div className="h-9 w-full bg-muted rounded mt-2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="md:hidden space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-background border rounded-2xl p-4 space-y-2 animate-pulse">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-3 w-full bg-muted rounded" />
              <div className="h-9 w-full bg-muted rounded mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const visibleColumns = COLUMNS;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <Button
          variant={notif.enabled ? "default" : "outline"}
          size="sm"
          onClick={() => (notif.enabled ? notif.disable() : notif.enable())}
          className="gap-2"
        >
          {notif.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          {notif.enabled ? t("orders.soundOn") : t("orders.enableSound")}
        </Button>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
        {visibleColumns.map((c) => (
          <button
            key={c.status}
            onClick={() => setActiveMobileTab(c.status)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
              activeMobileTab === c.status
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            {t(`orders.${c.status}`)} ({grouped[c.status].length})
          </button>
        ))}
      </div>

      {/* Mobile single column */}
      <div className="md:hidden">
        <Column
          col={visibleColumns.find((c) => c.status === activeMobileTab)!}
          items={grouped[activeMobileTab]}
          onAdvance={advance}
        />
      </div>

      {/* Tablet 2x2 / Desktop 4 cols */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleColumns.map((c) => (
          <Column key={c.status} col={c} items={grouped[c.status]} onAdvance={advance} />
        ))}
      </div>
    </div>
  );
}

function Column({
  col,
  items,
  onAdvance,
}: {
  col: ColumnDef;
  items: Order[];
  onAdvance: (o: Order) => void;
}) {
  const { t } = useTranslation();
  const Icon = col.icon;
  return (
    <div className="rounded-2xl p-4 min-h-[200px] bg-card border border-border">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.accent }} />
          <Icon className="w-4 h-4 text-muted-foreground" />
          {t(`orders.${col.status}`)}
        </h2>
        <span className="text-xs font-semibold bg-muted text-foreground rounded-full px-2 py-0.5 min-w-[24px] text-center">
          {items.length}
        </span>
      </div>
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {items.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-xs">
              <Icon className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {t("orders.noOrdersIn")} {t(`orders.${col.status}`)}
            </div>
          ) : (
            items.map((o) => (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
              >
                <OrderCard order={o} accent={col.accent} onAdvance={() => onAdvance(o)} />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function OrderCard({ order, accent, onAdvance }: { order: Order; accent: string; onAdvance: () => void }) {
  const { t, i18n } = useTranslation();
  const cfg = getNextStatus(order);
  const isNew = order.status === "new" && !order.acknowledged;
  const orderNum = order.id.replace(/-/g, "").slice(-6).toUpperCase();
  const base = (i18n.language || "ar").split("-")[0];
  const locale: Locale = base === "en" ? enUS : base === "fr" ? frLocale : ar;
  const ago = formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale });
  const isDelivery = order.order_type === "delivery";

  return (
    <div
      className={`bg-card rounded-xl p-4 space-y-3 border-r-4 transition hover:shadow-sm ${
        isNew ? "border border-primary/40 animate-pulse" : "border border-border"
      }`}
      style={{ borderRightColor: accent }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold font-mono text-sm text-foreground">#{orderNum}</h3>
        {isDelivery ? (
          <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 px-2 py-1 rounded-full font-medium flex items-center gap-1">
            <Bike className="w-3 h-3" /> توصيل
          </span>
        ) : order.table_number != null && (
          <span className="text-xs bg-muted text-foreground px-2 py-1 rounded-full font-medium">
            {t("common.table")} {order.table_number}
          </span>
        )}
      </div>

      {isDelivery && (
        <div className="text-xs space-y-1 text-foreground bg-muted/40 rounded-lg p-2">
          {order.customer_name && (
            <div className="flex items-center gap-1.5"><User className="w-3 h-3 text-muted-foreground" />{order.customer_name}</div>
          )}
          {order.customer_phone && (
            <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1.5 text-primary hover:underline" dir="ltr">
              <Phone className="w-3 h-3" />{order.customer_phone}
            </a>
          )}
          {order.customer_address && (
            <div className="flex items-start gap-1.5"><MapPin className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" /><span className="break-words">{order.customer_address}</span></div>
          )}
        </div>
      )}

      <ul className="text-sm space-y-1 text-foreground">
        {(order.items ?? []).map((it) => (
          <li key={it.id}>
            <span className="font-bold text-primary">x{it.quantity}</span> - {it.name_snapshot}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground">{ago}</span>
        <span className="font-bold text-foreground">{formatDZD(order.total)}</span>
      </div>

      {cfg && (
        <Button
          onClick={onAdvance}
          variant={isDelivery && order.status === "ready" ? "default" : "outline"}
          className="w-full hover:bg-primary hover:text-primary-foreground hover:border-primary transition"
        >
          {cfg.label}
        </Button>
      )}
    </div>
  );
}
