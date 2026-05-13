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
  Bike,
  Loader2,
  ChefHat,
  Package,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMenuByDeliveryToken,
  submitDeliveryOrder,
  getDeliveryOrderStatus,
  type DeliveryMenuResult,
} from "@/server/delivery.functions";
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

type CartItem = {
  menu_item_id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
};

export const Route = createFileRoute("/d/$delivery_token")({
  component: Page,
});

function Page() {
  const { delivery_token } = useParams({ from: "/d/$delivery_token" });
  const [data, setData] = useState<DeliveryMenuResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const cartKey = `dcart_${delivery_token}`;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tracking, setTracking] = useState<{
    order_id: string;
    orderNumber: string;
    total: number;
    status: string;
  } | null>(null);

  // customer info
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getMenuByDeliveryToken({ data: { token: delivery_token } });
        if (!mounted) return;
        setData(res);
        if (res.categories[0]) setActiveCat(res.categories[0].id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("NOT_FOUND")) setNotFound(true);
        else setNotFound(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [delivery_token]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cartKey);
      if (raw) setCart(JSON.parse(raw));
    } catch {
      // ignore
    }
    try {
      const info = localStorage.getItem(`dinfo_${delivery_token}`);
      if (info) {
        const p = JSON.parse(info);
        setName(p.name ?? "");
        setLastName(p.lastName ?? "");
        setPhone(p.phone ?? "");
        setAddress(p.address ?? "");
      }
    } catch {
      // ignore
    }
    try {
      const last = localStorage.getItem(`dlast_${delivery_token}`);
      if (last) {
        const p = JSON.parse(last);
        if (p?.order_id) {
          setTracking({
            order_id: p.order_id,
            orderNumber: p.orderNumber,
            total: p.total,
            status: p.status ?? "new",
          });
        }
      }
    } catch {
      // ignore
    }
  }, [cartKey, delivery_token]);

  // Poll order status while tracking
  useEffect(() => {
    if (!tracking) return;
    let stopped = false;
    async function tick() {
      if (!tracking) return;
      try {
        const res = await getDeliveryOrderStatus({
          data: { token: delivery_token, order_id: tracking.order_id },
        });
        if (stopped) return;
        setTracking((prev) =>
          prev ? { ...prev, status: res.status, total: res.total } : prev,
        );
        try {
          localStorage.setItem(
            `dlast_${delivery_token}`,
            JSON.stringify({
              order_id: res.order_id,
              orderNumber: res.order_number,
              total: res.total,
              status: res.status,
            }),
          );
        } catch {
          // ignore
        }
      } catch {
        // ignore polling errors
      }
    }
    tick();
    const id = setInterval(tick, 6000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [tracking?.order_id, delivery_token]);

  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart, cartKey]);

  const addToCart = useCallback((item: DeliveryMenuResult["menu_items"][number]) => {
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
    const map: Record<string, DeliveryMenuResult["menu_items"]> = {};
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
    if (!address.trim() || address.trim().length < 3) {
      toast.error("الرجاء إدخال عنوان التوصيل");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitDeliveryOrder({
        data: {
          token: delivery_token,
          customer_name: fullName,
          customer_phone: phone.trim(),
          customer_address: address.trim(),
          notes: notes.trim() || null,
          items: cart.map((c) => ({ menu_item_id: c.menu_item_id, quantity: c.quantity })),
        },
      });
      try {
        localStorage.setItem(
          `dinfo_${delivery_token}`,
          JSON.stringify({ name, lastName, phone, address }),
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
        orderNumber: res.order_number,
        total: res.total,
        status: "new",
      };
      setTracking(next);
      try {
        localStorage.setItem(`dlast_${delivery_token}`, JSON.stringify(next));
      } catch {
        // ignore
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذّر إرسال الطلب";
      toast.error(msg.includes("NOT_FOUND") ? "رابط التوصيل غير صالح" : msg);
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
        <h1 className="text-2xl font-bold mb-2">رابط التوصيل غير صالح</h1>
        <p className="text-muted-foreground">تواصل مع المطعم للحصول على رابط جديد.</p>
      </div>
    );
  }

  if (tracking) {
    const steps = [
      { key: "new", label: "تم استلام الطلب", icon: CheckCircle2 },
      { key: "preparing", label: "قيد التحضير", icon: ChefHat },
      { key: "ready", label: "في الطريق إليك", icon: Bike },
      { key: "delivered", label: "تم التوصيل", icon: Check },
    ];
    const order = ["new", "preparing", "ready", "delivered"];
    const currentIdx = Math.max(0, order.indexOf(tracking.status));
    const headline =
      tracking.status === "delivered"
        ? "تم توصيل طلبك! شكراً لك 🙌"
        : tracking.status === "ready"
        ? "طلبك في الطريق إليك 🛵"
        : tracking.status === "preparing"
        ? "الطباخ يحضّر طلبك الآن 👨‍🍳"
        : "تم استلام طلبك! 🎉";
    const sub =
      tracking.status === "delivered"
        ? "نتمنى أن ينال إعجابك."
        : tracking.status === "ready"
        ? "السائق في طريقه إلى عنوانك."
        : tracking.status === "preparing"
        ? "سيتم إعلامك عند خروج الطلب للتوصيل."
        : "سيبدأ الطباخ بتحضيره قريباً.";
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
        <p className="text-muted-foreground mb-4">{sub}</p>
        <div className="rounded-2xl bg-muted px-6 py-4 mb-6">
          <div className="text-xs text-muted-foreground">رقم الطلب</div>
          <div className="text-2xl font-bold font-mono tracking-wider">#{tracking.orderNumber}</div>
          <div className="text-sm mt-2 font-semibold">{formatDZD(tracking.total)}</div>
        </div>

        <div className="w-full max-w-md bg-card border rounded-2xl p-5 mb-6 text-right">
          <h3 className="font-bold mb-4 flex items-center gap-2 justify-start">
            <Package className="w-4 h-4" />
            حالة الطلب
          </h3>
          <div className="space-y-4">
            {steps.map((s, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx && tracking.status !== "delivered";
              const completed = idx === currentIdx && tracking.status === "delivered" && idx === steps.length - 1;
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
                    {active ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : done || completed ? (
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
                    {active && (
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
              localStorage.removeItem(`dlast_${delivery_token}`);
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
              <Bike className="w-3.5 h-3.5" />
              <span>طلب توصيل</span>
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
                      .getElementById(`d-cat-${c.id}`)
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
            <section key={c.id} id={`d-cat-${c.id}`}>
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
            <SheetTitle className="text-right">تأكيد طلب التوصيل</SheetTitle>
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
              <Bike className="w-4 h-4" />
              معلومات التوصيل
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
              <Label className="text-xs">عنوان التوصيل</Label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="الحي، الشارع، رقم العمارة، الطابق..."
                rows={2}
              />
            </div>
            <div>
              <Label className="text-xs">ملاحظة (اختياري)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="بدون بصل، توصيل بعد 8م..."
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
            {submitting ? <Loader2 className="w-5 h-5 animate-spin ms-2" /> : <Bike className="w-5 h-5 ms-2" />}
            تأكيد طلب التوصيل
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}