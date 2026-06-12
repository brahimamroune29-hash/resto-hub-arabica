import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, ChefHat, Volume2, VolumeX, Loader2, Bell, ChefHat as ChefIcon, Bike, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import {
  getChefContext,
  chefListActive,
  chefStartPreparing,
  chefMarkReady,
  chefLogout,
} from "@/lib/chef.functions";
import {
  getIndividualChefContext,
  individualChefListActive,
  individualChefStartPreparing,
  individualChefMarkReady,
  individualChefLogout,
} from "@/lib/individual-chef.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/kitchen-screen")({
  component: Page,
});

type Restaurant = { id: string; name: string; logo_url: string | null };
type Order = {
  id: string;
  status: string;
  created_at: string;
  acknowledged: boolean;
  table_number: number | null;
  notes: string | null;
  order_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  daily_number: number | null;
  items: Array<{ name: string; qty: number }>;
};

function timeAgo(iso: string) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}ث`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} د`;
  return `${Math.floor(m / 60)} س`;
}

function Page() {
  const navigate = useNavigate();
  const ctxFn = useServerFn(getChefContext);
  const listFn = useServerFn(chefListActive);
  const startFn = useServerFn(chefStartPreparing);
  const readyFn = useServerFn(chefMarkReady);
  const logoutFn = useServerFn(chefLogout);
  const iCtxFn = useServerFn(getIndividualChefContext);
  const iListFn = useServerFn(individualChefListActive);
  const iStartFn = useServerFn(individualChefStartPreparing);
  const iReadyFn = useServerFn(individualChefMarkReady);
  const iLogoutFn = useServerFn(individualChefLogout);

  const [token, setToken] = useState<string | null>(null);
  const [isIndividual, setIsIndividual] = useState(false);
  const [chefName, setChefName] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [, setTick] = useState(0);

  // tick every 30s for elapsed time refresh
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  // Auth — supports both individual chef sessions and the legacy shared session
  useEffect(() => {
    const it = localStorage.getItem("individual_chef_token");
    const iexp = localStorage.getItem("individual_chef_expires");
    if (it && iexp && new Date(iexp) > new Date()) {
      setIsIndividual(true);
      setToken(it);
      iCtxFn({ data: { token: it } })
        .then((res) => {
          setRestaurant(res.restaurant);
          setChefName(res.chefName);
        })
        .catch(() => {
          const r = localStorage.getItem("individual_chef_restaurant");
          const rid = r ? (JSON.parse(r) as Restaurant).id : "";
          localStorage.removeItem("individual_chef_token");
          localStorage.removeItem("individual_chef_expires");
          navigate({ to: "/kitchen-login", search: { r: "", rid, mode: "individual" } });
        });
      return;
    }
    const t = localStorage.getItem("chef_token");
    const exp = localStorage.getItem("chef_expires");
    if (!t || !exp || new Date(exp) < new Date()) {
      const ir = localStorage.getItem("individual_chef_restaurant");
      if (ir) {
        const rid = (JSON.parse(ir) as Restaurant).id;
        localStorage.removeItem("individual_chef_token");
        localStorage.removeItem("individual_chef_expires");
        navigate({ to: "/kitchen-login", search: { r: "", rid, mode: "individual" } });
        return;
      }
      const r = localStorage.getItem("chef_restaurant");
      const rid = r ? (JSON.parse(r) as Restaurant).id : "";
      localStorage.removeItem("chef_token");
      localStorage.removeItem("chef_expires");
      navigate({ to: "/kitchen-login", search: { r: rid, rid: "", mode: "shared" } });
      return;
    }
    setToken(t);
    ctxFn({ data: { token: t } })
      .then((res) => setRestaurant(res.restaurant))
      .catch(() => {
        localStorage.removeItem("chef_token");
        const r = localStorage.getItem("chef_restaurant");
        const rid = r ? (JSON.parse(r) as Restaurant).id : "";
        navigate({ to: "/kitchen-login", search: { r: rid, rid: "", mode: "shared" } });
      });
  }, [ctxFn, iCtxFn, navigate]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await (isIndividual ? iListFn : listFn)({ data: { token } });
      setOrders(res.orders);
    } catch {
      // silent
    }
  }, [token, isIndividual, listFn, iListFn]);

  useEffect(() => {
    if (!token || !restaurant) return;
    refresh();
    const channel = supabase
      .channel(`kitchen-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        () => refresh(),
      )
      .subscribe();
    const poll = setInterval(refresh, 8000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [token, restaurant, refresh]);

  // Audio beep loop while there are unacknowledged new orders
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hasUnack = useMemo(
    () => orders.some((o) => o.status === "new" && !o.acknowledged),
    [orders],
  );

  useEffect(() => {
    if (!soundOn || !hasUnack) return;
    let cancelled = false;
    function beep() {
      if (cancelled) return;
      try {
        if (!audioCtxRef.current) {
          const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
          audioCtxRef.current = new Ctx();
        }
        const ctx = audioCtxRef.current!;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 800;
        osc.type = "sine";
        gain.gain.value = 0.3;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        osc.stop(ctx.currentTime + 0.22);
      } catch {
        // ignore
      }
    }
    beep();
    const i = setInterval(beep, 3000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, [soundOn, hasUnack]);

  async function onStart(o: Order) {
    if (!token) return;
    setBusy(o.id);
    try {
      await (isIndividual ? iStartFn : startFn)({ data: { token, orderId: o.id } });
      setOrders((prev) =>
        prev.map((x) => (x.id === o.id ? { ...x, status: "preparing", acknowledged: true } : x)),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onReady(o: Order) {
    if (!token) return;
    setBusy(o.id);
    try {
      await (isIndividual ? iReadyFn : readyFn)({ data: { token, orderId: o.id } });
      setOrders((prev) => prev.filter((x) => x.id !== o.id));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onLogout() {
    if (token) {
      try {
        await (isIndividual ? iLogoutFn : logoutFn)({ data: { token } });
      } catch {
        // ignore
      }
    }
    if (isIndividual) {
      const r = localStorage.getItem("individual_chef_restaurant");
      const rid = r ? (JSON.parse(r) as Restaurant).id : "";
      localStorage.removeItem("individual_chef_token");
      localStorage.removeItem("individual_chef_expires");
      localStorage.removeItem("individual_chef_name");
      localStorage.removeItem("individual_chef_id");
      navigate({ to: "/kitchen-login", search: { r: "", rid, mode: "individual" } });
      return;
    }
    const r = localStorage.getItem("chef_restaurant");
    const rid = r ? (JSON.parse(r) as Restaurant).id : "";
    localStorage.removeItem("chef_token");
    localStorage.removeItem("chef_expires");
    navigate({ to: "/kitchen-login", search: { r: rid, rid: "", mode: "shared" } });
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const newOrders = orders.filter((o) => o.status === "new");
  const prepOrders = orders.filter((o) => o.status === "preparing");

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col" dir="rtl">
      <header className="h-16 bg-background border-b flex items-center justify-between gap-3 px-4 md:px-6 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
              {restaurant.name?.[0] ?? "م"}
            </div>
          )}
          <div className="leading-tight min-w-0">
            <div className="font-bold text-base truncate flex items-center gap-1.5">
              <ChefIcon className="w-4 h-4 text-primary" />
              مطبخ - {restaurant.name}
            </div>
            {chefName && (
              <div className="text-xs text-muted-foreground truncate">👨‍🍳 {chefName}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={soundOn ? "default" : "outline"}
            size="sm"
            onClick={() => setSoundOn((s) => !s)}
            className="gap-1.5"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundOn ? "الصوت" : "صامت"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onLogout} className="gap-1.5">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">خروج</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 p-3 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 max-w-7xl mx-auto">
          {/* New orders */}
          <section className="rounded-2xl bg-red-50 border-2 border-red-200 p-3 md:p-4">
            <div className="flex items-center gap-2 mb-3">
              <ChefHat className="w-6 h-6 text-red-600" />
              <h2 className="text-xl md:text-2xl font-bold text-red-700">طلبات جديدة</h2>
              <span className="bg-red-600 text-white rounded-full px-3 py-0.5 text-sm font-bold">
                {newOrders.length}
              </span>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {newOrders.map((o) => (
                  <motion.div
                    key={o.id}
                    layout
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-background rounded-2xl border-2 border-red-300 p-4 space-y-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {o.order_type === "delivery" ? (
                          <span className="bg-blue-600 text-white rounded-lg px-3 py-1 text-lg font-bold flex items-center gap-1.5">
                            <Bike className="w-5 h-5" />
                            توصيل 🛵
                          </span>
                        ) : o.order_type === "takeaway" ? (
                          <span className="bg-emerald-600 text-white rounded-lg px-3 py-1 text-lg font-bold">
                            طلب سريع 🛍️
                          </span>
                        ) : (
                          <span className="bg-red-600 text-white rounded-lg px-3 py-1 text-lg font-bold">
                            طاولة {o.table_number ?? "—"}
                          </span>
                        )}
                        {o.daily_number != null && (
                          <span className="bg-foreground text-background rounded-lg px-3 py-1 text-xl font-extrabold font-mono">
                            #{String(o.daily_number).padStart(3, "0")}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        #{o.id.replace(/-/g, "").slice(-6).toUpperCase()} · {timeAgo(o.created_at)}
                      </div>
                    </div>
                    {(o.order_type === "delivery" || o.order_type === "takeaway") && (
                      <div className="rounded-xl bg-blue-50 border-2 border-blue-300 p-3 space-y-1 text-sm">
                        <div className="font-bold text-blue-900">👤 {o.customer_name ?? "—"}</div>
                        {o.customer_phone && (
                          <div className="flex items-center gap-1.5 text-blue-800">
                            <Phone className="w-3.5 h-3.5" />
                            <a href={`tel:${o.customer_phone}`} dir="ltr" className="font-mono">{o.customer_phone}</a>
                          </div>
                        )}
                        {o.customer_address && (
                          <div className="flex items-start gap-1.5 text-blue-800">
                            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span className="break-words">{o.customer_address}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <ul className="space-y-1 text-lg">
                      {o.items.map((it, idx) => (
                        <li key={idx} className="flex items-baseline gap-2">
                          <span className="font-bold text-red-700 text-xl">×{it.qty}</span>
                          <span>{it.name}</span>
                        </li>
                      ))}
                    </ul>
                    {o.notes && (
                      <div className="rounded-xl bg-yellow-100 border-2 border-yellow-400 p-3">
                        <div className="text-xs font-bold text-yellow-800 mb-1">📝 ملاحظة العميل</div>
                        <div className="text-base font-semibold text-yellow-900 whitespace-pre-wrap break-words">{o.notes}</div>
                      </div>
                    )}
                    <Button
                      onClick={() => onStart(o)}
                      disabled={busy === o.id}
                      className="w-full text-lg font-bold"
                      style={{ height: 64 }}
                    >
                      {busy === o.id ? (
                        <Loader2 className="w-5 h-5 animate-spin ms-2" />
                      ) : (
                        "✓ بدء التحضير"
                      )}
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {newOrders.length === 0 && (
                <div className="text-center text-muted-foreground py-8">لا توجد طلبات جديدة</div>
              )}
            </div>
          </section>

          {/* Preparing */}
          <section className="rounded-2xl bg-orange-50 border-2 border-orange-200 p-3 md:p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl md:text-2xl font-bold text-orange-700">قيد التحضير</h2>
              <span className="bg-orange-600 text-white rounded-full px-3 py-0.5 text-sm font-bold">
                {prepOrders.length}
              </span>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {prepOrders.map((o) => (
                  <motion.div
                    key={o.id}
                    layout
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-background rounded-2xl border-2 border-orange-300 p-4 space-y-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {o.order_type === "delivery" ? (
                          <span className="bg-blue-600 text-white rounded-lg px-3 py-1 text-lg font-bold flex items-center gap-1.5">
                            <Bike className="w-5 h-5" />
                            توصيل 🛵
                          </span>
                        ) : o.order_type === "takeaway" ? (
                          <span className="bg-emerald-600 text-white rounded-lg px-3 py-1 text-lg font-bold">
                            طلب سريع 🛍️
                          </span>
                        ) : (
                          <span className="bg-orange-600 text-white rounded-lg px-3 py-1 text-lg font-bold">
                            طاولة {o.table_number ?? "—"}
                          </span>
                        )}
                        {o.daily_number != null && (
                          <span className="bg-foreground text-background rounded-lg px-3 py-1 text-xl font-extrabold font-mono">
                            #{String(o.daily_number).padStart(3, "0")}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        #{o.id.replace(/-/g, "").slice(-6).toUpperCase()} · {timeAgo(o.created_at)}
                      </div>
                    </div>
                    {(o.order_type === "delivery" || o.order_type === "takeaway") && (
                      <div className="rounded-xl bg-blue-50 border-2 border-blue-300 p-3 space-y-1 text-sm">
                        <div className="font-bold text-blue-900">👤 {o.customer_name ?? "—"}</div>
                        {o.customer_phone && (
                          <div className="flex items-center gap-1.5 text-blue-800">
                            <Phone className="w-3.5 h-3.5" />
                            <a href={`tel:${o.customer_phone}`} dir="ltr" className="font-mono">{o.customer_phone}</a>
                          </div>
                        )}
                        {o.customer_address && (
                          <div className="flex items-start gap-1.5 text-blue-800">
                            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span className="break-words">{o.customer_address}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <ul className="space-y-1 text-lg">
                      {o.items.map((it, idx) => (
                        <li key={idx} className="flex items-baseline gap-2">
                          <span className="font-bold text-orange-700 text-xl">×{it.qty}</span>
                          <span>{it.name}</span>
                        </li>
                      ))}
                    </ul>
                    {o.notes && (
                      <div className="rounded-xl bg-yellow-100 border-2 border-yellow-400 p-3">
                        <div className="text-xs font-bold text-yellow-800 mb-1">📝 ملاحظة العميل</div>
                        <div className="text-base font-semibold text-yellow-900 whitespace-pre-wrap break-words">{o.notes}</div>
                      </div>
                    )}
                    <Button
                      onClick={() => onReady(o)}
                      disabled={busy === o.id}
                      className="w-full text-lg font-bold bg-green-600 hover:bg-green-700 text-white"
                      style={{ height: 64 }}
                    >
                      {busy === o.id ? (
                        <Loader2 className="w-5 h-5 animate-spin ms-2" />
                      ) : (
                        "🔔 جاهز"
                      )}
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {prepOrders.length === 0 && (
                <div className="text-center text-muted-foreground py-8">لا يوجد قيد التحضير</div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}