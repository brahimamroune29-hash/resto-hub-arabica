import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Minus,
  X,
  ShoppingBag,
  MapPinOff,
  CheckCircle2,
  Loader2,
  ChefHat,
  Package,
  Check,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMenuByTakeawayToken,
  submitTakeawayOrder,
  getTakeawayOrderStatus,
  type TakeawayMenuResult,
} from "@/server/takeaway.functions";
import { formatDZD } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RestaurantSplash } from "@/components/RestaurantSplash";

type CartItem = {
  menu_item_id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
};

export const Route = createFileRoute("/t/$takeaway_token")({
  component: Page,
});

function Page() {
  const { takeaway_token } = useParams({ from: "/t/$takeaway_token" });
  const [data, setData] = useState<TakeawayMenuResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(false);

  const cartKey = `tcart_${takeaway_token}`;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tracking, setTracking] = useState<{
    order_id: string;
    daily_number: number | null;
    total: number;
    status: string;
  } | null>(null);

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getMenuByTakeawayToken({ data: { token: takeaway_token } });
        if (!mounted) return;
        setData(res);
        if (res.categories[0]) setActiveCat(res.categories[0].id);
        if (res.restaurant.splash?.splash_enabled) {
          if (res.restaurant.splash.splash_always_show) {
            setShowSplash(true);
          } else {
            try {
              const key = `splash_seen_${res.restaurant.id}`;
              const raw = localStorage.getItem(key);
              const ts = raw ? Number(raw) : 0;
              const fresh = ts && Date.now() - ts < 24 * 60 * 60 * 1000;
              if (!fresh) setShowSplash(true);
            } catch {
              setShowSplash(true);
            }
          }
        }
      } catch {
        if (mounted) setNotFound(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [takeaway_token]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cartKey);
      if (raw) setCart(JSON.parse(raw));
    } catch {
      // ignore
    }
    try {
      const info = localStorage.getItem(`tinfo_${takeaway_token}`);
      if (info) {
        const p = JSON.parse(info);
        setName(p.name ?? "");
        setLastName(p.lastName ?? "");
        setPhone(p.phone ?? "");
      }
    } catch {
      // ignore
    }
    try {
      const last = localStorage.getItem(`tlast_${takeaway_token}`);
      if (last) {
        const p = JSON.parse(last);
        if (p?.order_id) {
          setTracking({
            order_id: p.order_id,
            daily_number: p.daily_number ?? null,
            total: p.total,
            status: p.status ?? "new",
          });
        }
      }
    } catch {
      // ignore
    }
  }, [cartKey, takeaway_token]);

  useEffect(() => {
    if (!tracking) return;
    let stopped = false;
    async function tick() {
      if (!tracking) return;
      try {
        const res = await getTakeawayOrderStatus({
          data: { token: takeaway_token, order_id: tracking.order_id },
        });
        if (stopped) return;
        setTracking((prev) =>
          prev
            ? {
                ...prev,
                status: res.status,
                total: res.total,
                daily_number: res.daily_number ?? prev.daily_number,
              }
            : prev,
        );
        try {
          localStorage.setItem(
            `tlast_${takeaway_token}`,
            JSON.stringify({
              order_id: res.order_id,
              daily_number: res.daily_number,
              total: res.total,
              status: res.status,
            }),
          );
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    }
    tick();
    const id = setInterval(tick, 6000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [tracking?.order_id, takeaway_token]);

  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart, cartKey]);

  const addToCart = useCallback((item: TakeawayMenuResult["menu_items"][number]) => {
    setCart((prev) => {
      const found = prev.find((c) => c.menu_item_id === item.id);
      if (found) {
        return prev.map((c) =>
          c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          image_url: item.image_url,
          quantity: 1,
        },
      ];
    });
    toast.success("تمت الإضافة", { duration: 1000 });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.menu_item_id === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0),
    );
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((c) => c.menu_item_id !== id));
  }, []);

  const totalQty = cart.reduce((s, c) => s + c.quantity, 0);
  const totalPrice = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  const itemsByCat = useMemo(() => {
    const map: Record<string, TakeawayMenuResult["menu_items"]> = {};
    if (!data) return map;
    for (const c of data.categories) map[c.id] = [];
    for (const it of data.menu_items) {
      if (it.category_id && map[it.category_id]) map[it.category_id].push(it);
    }
    return map;
  }, [data]);

  async function handleSubmit() {
    if (cart.length === 0) return;
    const fullName = `${name.trim()} ${lastName.trim()}`.trim();
    if (!fullName) {
      toast.error("الرجاء إدخال الاسم");
      return;
    }
    if (!phone.trim() || phone.trim().length < 4) {
      toast.error("الرجاء إدخال رقم الهاتف");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitTakeawayOrder({
        data: {
          token: takeaway_token,
          customer_name: fullName,
          customer_phone: phone.trim(),
          notes: notes.trim() || null,
          items: cart.map((c) => ({ menu_item_id: c.menu_item_id, quantity: c.quantity })),
        },
      });
      try {
        localStorage.setItem(
          `tinfo_${takeaway_token}`,
          JSON.stringify({ name, lastName, phone }),
        );
        localStorage.removeItem(cartKey);
      } catch {
        // ignore
      }
      setCart([]);
      setNotes("");
      setDrawerOpen(false);
      const next = {
        order_id: res.order_id,
        daily_number: res.daily_number,
        total: res.total,
        status: "new",
      };
      setTracking(next);
      try {
        localStorage.setItem(`tlast_${takeaway_token}`, JSON.stringify(next));
      } catch {
        // ignore
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذّر إرسال الطلب";
      toast.error(msg.includes("NOT_FOUND") ? "رابط غير صالح" : msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <MapPinOff className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">الرابط غير صالح</h1>
        <p className="text-muted-foreground">تواصل مع الكاشير للحصول على رابط جديد.</p>
      </div>
    );
  }

  if (showSplash && data && !tracking) {
    return (
      <RestaurantSplash
        restaurant={{ name: data.restaurant.name, logo_url: data.restaurant.logo_url }}
        splash={data.restaurant.splash}
        onContinue={() => {
          try {
            localStorage.setItem(`splash_seen_${data.restaurant.id}`, String(Date.now()));
          } catch {
            // ignore
          }
          setShowSplash(false);
        }}
      />
    );
  }
  if (tracking) {
    const steps = [
      { key: "new", label: "تم استلام طلبك", icon: CheckCircle2 },
      { key: "preparing", label: "قيد التحضير", icon: ChefHat },
      { key: "ready", label: "جاهز للاستلام", icon: ShoppingBag },
    ];
    const order = ["new", "preparing", "ready"];
    const currentIdx = Math.max(0, order.indexOf(tracking.status));
    const headline =
      tracking.status === "ready"
        ? "طلبك جاهز! توجّه إلى الكاشير 🛍️"
        : tracking.status === "preparing"
        ? "الطباخ يحضّر طلبك الآن 👨‍🍳"
        : "تم استلام طلبك! 🎉";
    const codeStr =
      tracking.daily_number != null
        ? String(tracking.daily_number).padStart(3, "0")
        : "—";
    return (
      <div className="min-h-screen flex flex-col items-center justify-start bg-background p-6 pt-12 text-center" dir="rtl">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6"
        >
          <CheckCircle2 className="w-14 h-14 text-green-600" />
        </motion.div>
        <h1 className="text-2xl font-bold mb-2">{headline}</h1>
        <p className="text-muted-foreground mb-4">احتفظ برمز طلبك وأظهره عند الاستلام.</p>
        <div className="rounded-2xl bg-primary/10 border-2 border-primary px-8 py-5 mb-6">
          <div className="text-xs text-muted-foreground mb-1">رمز طلبك اليوم</div>
          <div className="text-5xl font-extrabold font-mono tracking-widest text-primary">
            {codeStr}
          </div>
          <div className="text-sm mt-3 font-semibold">{formatDZD(tracking.total)}</div>
        </div>

        <div className="w-full max-w-md bg-card border rounded-2xl p-5 mb-6 text-right">
          <h3 className="font-bold mb-4 flex items-center gap-2 justify-start">
            <Package className="w-4 h-4" />
            حالة الطلب
          </h3>
          <div className="space-y-4">
            {steps.map((s, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              const reached = idx <= currentIdx;
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      reached
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {active && tracking.status !== "ready" ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : done ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 text-right">
                    <div
                      className={`text-sm font-semibold ${
                        reached ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </div>
                    {active && tracking.status !== "ready" && (
                      <div className="text-xs text-primary mt-0.5">جاري الآن…</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Button
          onClick={() => {
            setTracking(null);
            try {
              localStorage.removeItem(`tlast_${takeaway_token}`);
            } catch {
              // ignore
            }
          }}
        >
          طلب جديد
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-28" dir="rtl">
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {data.restaurant.logo_url ? (
            <img
              src={data.restaurant.logo_url}
              alt={data.restaurant.name}
              className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/40"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center font-bold text-lg">
              {data.restaurant.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs opacity-90">
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>طلب سريع</span>
            </div>
            <h1 className="text-lg font-extrabold truncate">{data.restaurant.name}</h1>
          </div>
        </div>

        {data.categories.length > 0 && (
          <div className="overflow-x-auto scrollbar-hide bg-background border-b">
            <div className="max-w-2xl mx-auto flex gap-2 px-4 py-2 min-w-max">
              {data.categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCat(c.id);
                    document
                      .getElementById(`t-cat-${c.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                    activeCat === c.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted/70"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-8">
        {data.categories.length === 0 && (
          <div className="text-center text-muted-foreground py-20">
            لا توجد أصناف متاحة حالياً
          </div>
        )}
        {data.categories.map((c) => {
          const items = itemsByCat[c.id] ?? [];
          if (items.length === 0) return null;
          return (
            <section key={c.id} id={`t-cat-${c.id}`}>
              <h2 className="text-xl font-extrabold mb-3">{c.name}</h2>
              <div className="space-y-3">
                {items.map((it) => {
                  const inCart = cart.find((x) => x.menu_item_id === it.id);
                  return (
                    <div
                      key={it.id}
                      className="bg-background rounded-2xl border p-3 flex gap-3 items-center shadow-sm"
                    >
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt={it.name}
                          className="w-20 h-20 rounded-xl object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center text-2xl">
                          🍽️
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{it.name}</div>
                        {it.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {it.description}
                          </div>
                        )}
                        <div className="text-sm font-semibold text-primary mt-1">
                          {formatDZD(it.price)}
                        </div>
                      </div>
                      {inCart ? (
                        <div className="flex items-center gap-1 bg-primary/10 rounded-full p-1">
                          <button
                            onClick={() => updateQty(it.id, -1)}
                            className="w-7 h-7 rounded-full bg-background flex items-center justify-center"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center font-bold">{inCart.quantity}</span>
                          <button
                            onClick={() => updateQty(it.id, 1)}
                            className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          onClick={() => addToCart(it)}
                          className="rounded-full"
                          aria-label="add"
                        >
                          <Plus className="w-5 h-5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      <AnimatePresence>
        {totalQty > 0 && (
          <motion.button
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            onClick={() => setDrawerOpen(true)}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-primary text-primary-foreground rounded-full px-6 py-3 font-bold shadow-2xl flex items-center gap-3"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>عرض السلة ({totalQty})</span>
            <span className="opacity-80">·</span>
            <span>{formatDZD(totalPrice)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto" dir="rtl">
          <SheetHeader>
            <SheetTitle className="text-right">تأكيد الطلب السريع</SheetTitle>
          </SheetHeader>

          <div className="space-y-2 mt-4">
            {cart.map((c) => (
              <div
                key={c.menu_item_id}
                className="flex items-center gap-3 bg-muted/40 rounded-xl p-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{formatDZD(c.price)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQty(c.menu_item_id, -1)}
                    className="w-7 h-7 rounded-full bg-background border flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center font-bold">{c.quantity}</span>
                  <button
                    onClick={() => updateQty(c.menu_item_id, 1)}
                    className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => removeFromCart(c.menu_item_id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            <h3 className="font-bold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              معلوماتك
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">الاسم</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="محمد" />
              </div>
              <div>
                <Label className="text-xs">اللقب</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="بن علي" />
              </div>
            </div>
            <div>
              <Label className="text-xs">رقم الهاتف</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0555 12 34 56"
                inputMode="tel"
                dir="ltr"
                className="text-right"
              />
            </div>
            <div>
              <Label className="text-xs">ملاحظة (اختياري)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="بدون بصل، حار..."
                rows={2}
                maxLength={500}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between text-lg font-bold">
            <span>المجموع</span>
            <span className="text-primary">{formatDZD(totalPrice)}</span>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || cart.length === 0}
            className="w-full mt-3 h-12 text-base font-bold"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin ms-2" /> : <ShoppingCart className="w-5 h-5 ms-2" />}
            تأكيد الطلب
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}