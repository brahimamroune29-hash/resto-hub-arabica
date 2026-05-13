import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Minus,
  X,
  ShoppingBag,
  MapPinOff,
  CheckCircle2,
  Receipt,
  ChefHat,
  Bell,
  Wallet,
  Check,
  Star,
  ExternalLink,
  Heart,
  UtensilsCrossed,
  WifiOff,
  MessageSquareWarning,
  Sparkles,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getMenuByQr, type MenuByQrResult } from "@/server/menu.functions";
import {
  submitOrder,
  getOrderStatus,
  submitReview,
  type OrderStatusInfo,
} from "@/server/order.functions";
import { formatDZD } from "@/lib/restaurant";
import { askMenuBot } from "@/server/menu-chat.functions";
import { submitComplaint } from "@/server/complaint.functions";
import { useServerFn } from "@tanstack/react-start";
import { getMenuTheme, getMenuColors, parseMenuAppearance, type MenuLayoutId } from "@/lib/menu-themes";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RestaurantSplash } from "@/components/RestaurantSplash";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CartItem = {
  menu_item_id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
};

type MenuItem = MenuByQrResult["menu_items"][number];

function categoryEmoji(name: string): string | null {
  const n = name.toLowerCase();
  const map: { keys: string[]; emoji: string }[] = [
    { keys: ["شاورما", "شورما", "shawarma"], emoji: "🌯" },
    { keys: ["برغر", "بيرغر", "burger"], emoji: "🍔" },
    { keys: ["بيتزا", "pizza"], emoji: "🍕" },
    { keys: ["دجاج", "chicken", "فراخ"], emoji: "🍗" },
    { keys: ["لحم", "ستيك", "steak", "meat"], emoji: "🥩" },
    { keys: ["سمك", "fish", "مأكولات بحرية", "seafood"], emoji: "🐟" },
    { keys: ["سلطة", "سلطات", "salad"], emoji: "🥗" },
    { keys: ["مقبلات", "appetizer", "starter"], emoji: "🥟" },
    { keys: ["حلى", "حلوى", "حلويات", "dessert", "sweet"], emoji: "🍰" },
    { keys: ["آيس", "ايس", "ice", "بوظة"], emoji: "🍨" },
    { keys: ["عصير", "juice", "مشروب", "drink", "beverage"], emoji: "🥤" },
    { keys: ["قهوة", "coffee", "كافيه"], emoji: "☕" },
    { keys: ["شاي", "tea"], emoji: "🍵" },
    { keys: ["فطور", "إفطار", "breakfast"], emoji: "🥐" },
    { keys: ["معكرونة", "باستا", "pasta"], emoji: "🍝" },
    { keys: ["أرز", "ارز", "rice", "كبسة"], emoji: "🍚" },
    { keys: ["سندويش", "سندويتش", "sandwich"], emoji: "🥪" },
    { keys: ["فطائر", "معجنات", "خبز", "bread"], emoji: "🥐" },
    { keys: ["شوربة", "soup"], emoji: "🍲" },
    { keys: ["تاكو", "taco"], emoji: "🌮" },
    { keys: ["سوشي", "sushi"], emoji: "🍣" },
  ];
  for (const m of map) if (m.keys.some((k) => n.includes(k.toLowerCase()))) return m.emoji;
  return null;
}

export const Route = createFileRoute("/r/$qr_token")({
  component: Page,
});

function Page() {
  const { qr_token } = useParams({ from: "/r/$qr_token" });
  const [data, setData] = useState<MenuByQrResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const tabsRef = useRef<HTMLDivElement>(null);

  const cartKey = `cart_${qr_token}`;
  const orderKey = `active_order_${qr_token}`;
  const menuCacheKey = `menu_cache_${qr_token}`;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [orderNotes, setOrderNotes] = useState("");

  // Complaints
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    type: "جودة الطعام",
    customer_name: "",
    customer_phone: "",
    description: "",
  });
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);

  // AI menu chat
  const askBot = useServerFn(askMenuBot);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight });
      }, 50);
    }
  }, [chatMessages, chatLoading, chatOpen]);

  const sendChat = useCallback(async (text?: string) => {
    const content = (text ?? chatInput).trim();
    if (!content || chatLoading || !qr_token) return;
    const next = [...chatMessages, { role: "user" as const, content }];
    setChatMessages(next);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await askBot({ data: { qr_token, messages: next.slice(-10) } });
      setChatMessages([...next, { role: "assistant", content: res.reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "خطأ";
      toast.error(msg);
      setChatMessages(next);
    } finally {
      setChatLoading(false);
    }
  }, [askBot, chatInput, chatLoading, chatMessages, qr_token]);

  // Restore active order on mount
  useEffect(() => {
    try {
      const id = localStorage.getItem(orderKey);
      if (id) setActiveOrderId(id);
    } catch {
      // ignore
    }
  }, [orderKey]);

  const clearActiveOrder = useCallback(() => {
    try {
      localStorage.removeItem(orderKey);
      if (activeOrderId) localStorage.removeItem(`review_due_${activeOrderId}`);
    } catch {
      // ignore
    }
    setActiveOrderId(null);
  }, [orderKey, activeOrderId]);

  // Load cart from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(cartKey);
      if (raw) setCart(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [cartKey]);

  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart, cartKey]);

  const addToCart = useCallback((item: MenuItem, qty: number = 1) => {
    setCart((prev) => {
      const found = prev.find((c) => c.menu_item_id === item.id);
      if (found) {
        return prev.map((c) =>
          c.menu_item_id === item.id ? { ...c, quantity: c.quantity + qty } : c,
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          image_url: item.image_url,
          quantity: qty,
        },
      ];
    });
    toast.success("تمت الإضافة", { duration: 1200 });
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

  async function handleSubmit() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await submitOrder({
        data: {
          qr_token,
          notes: orderNotes.trim() || null,
          items: cart.map((c) => ({ menu_item_id: c.menu_item_id, quantity: c.quantity })),
        },
      });
      localStorage.removeItem(cartKey);
      localStorage.setItem(orderKey, res.order_id);
      setCart([]);
      setOrderNotes("");
      setDrawerOpen(false);
      setActiveOrderId(res.order_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "تعذّر إرسال الطلب";
      toast.error(msg.includes("NOT_FOUND") ? "الطاولة غير موجودة" : "تعذّر إرسال الطلب");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getMenuByQr({ data: { qr_token } });
        if (!mounted) return;
        setData(res);
        setFromCache(false);
        try {
          localStorage.setItem(
            menuCacheKey,
            JSON.stringify({ ts: Date.now(), data: res }),
          );
        } catch {
          // ignore quota
        }
        if (res.categories[0]) setActiveCat(res.categories[0].id);
        // Decide whether to show the splash
        if (res.restaurant.splash.splash_enabled) {
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
      } catch (e: unknown) {
        // Try cached menu when offline / network failure
        try {
          const raw = localStorage.getItem(menuCacheKey);
          if (raw) {
            const parsed = JSON.parse(raw) as { ts: number; data: MenuByQrResult };
            if (parsed?.data) {
              if (mounted) {
                setData(parsed.data);
                setFromCache(true);
                if (parsed.data.categories[0]) setActiveCat(parsed.data.categories[0].id);
              }
              return;
            }
          }
        } catch {
          // ignore
        }
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
  }, [qr_token, menuCacheKey]);

  // Online/offline tracking
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Scroll spy
  useEffect(() => {
    if (!data) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const id = (visible.target as HTMLElement).dataset.catId;
          if (id) setActiveCat(id);
        }
      },
      { rootMargin: "-180px 0px -50% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [data]);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!activeCat || !tabsRef.current) return;
    const el = tabsRef.current.querySelector<HTMLElement>(`[data-tab="${activeCat}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCat]);

  const itemsByCat = useMemo(() => {
    const map: Record<string, MenuByQrResult["menu_items"]> = {};
    if (!data) return map;
    for (const c of data.categories) map[c.id] = [];
    for (const it of data.menu_items) {
      if (it.category_id && map[it.category_id]) map[it.category_id].push(it);
    }
    return map;
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <div className="w-12 h-12 rounded-full bg-primary/30" />
        </motion.div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <MapPinOff className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">الطاولة غير موجودة</h1>
        <p className="text-muted-foreground">تأكّد من رمز QR أو اطلب المساعدة من النادل.</p>
      </div>
    );
  }

  if (activeOrderId) {
    return (
      <OrderTrackingScreen
        orderId={activeOrderId}
        qrToken={qr_token}
        onComplete={clearActiveOrder}
      />
    );
  }

  if (showSplash && data) {
    return (
      <RestaurantSplash
        restaurant={{ name: data.restaurant.name, logo_url: data.restaurant.logo_url }}
        splash={data.restaurant.splash}
        onContinue={() => {
          try {
            localStorage.setItem(
              `splash_seen_${data.restaurant.id}`,
              String(Date.now()),
            );
          } catch {
            // ignore
          }
          setShowSplash(false);
        }}
      />
    );
  }

  const appearance = parseMenuAppearance(data.restaurant.menu_theme);
  const theme = getMenuTheme(data.restaurant.menu_theme);
  const colors = getMenuColors(data.restaurant.menu_theme);
  const layout = appearance.layout;
  const isDark = theme.id === "midnight_gold";
  const textPrimary = isDark ? "text-white" : "text-neutral-900";
  const textMuted = isDark ? "text-neutral-400" : "text-neutral-500";
  const cardBg = isDark ? "bg-[#1a1a1a]" : "bg-white";
  const cardBorder = isDark ? "border-white/10" : "border-black/5";
  const contentWidth = layout === "photo_grid" || layout === "featured_magazine" ? "max-w-4xl" : "max-w-2xl";

  return (
    <div className={`min-h-screen ${theme.pageBg} pb-28`}>
      {(!isOnline || fromCache) && (
        <div className="sticky top-0 z-40 bg-amber-500 text-black text-center text-xs font-semibold py-2 px-3 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>أنت غير متصل — المنيو محفوظ مؤقتاً</span>
        </div>
      )}
      {/* Hero header with gradient */}
      <header className="sticky top-0 z-30">
        <div
          style={{ background: `linear-gradient(135deg, ${colors.header}, ${colors.headerDark})` }}
          className={`text-white ${theme.headerShadow}`}
        >
          <div className={`${contentWidth} mx-auto px-5 pt-6 pb-5 flex items-center gap-3`}>
          {data.restaurant.logo_url ? (
            <img
              src={data.restaurant.logo_url}
              alt={data.restaurant.name}
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white/40 shadow-lg"
              loading="lazy"
            />
          ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-white font-bold text-xl ring-2 ring-white/30">
              {data.restaurant.name[0]}
            </div>
          )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/80">مرحباً بك في</p>
              <h1 className="text-xl font-extrabold truncate tracking-tight">{data.restaurant.name}</h1>
              <div className="flex items-center gap-1 mt-0.5 text-[11px] text-white/85">
                <Star className="w-3 h-3 fill-yellow-300 text-yellow-300" />
                <span className="font-semibold">4.8</span>
                <span className="opacity-70">· استمتع بتجربتك</span>
              </div>
            </div>
          </div>
        </div>

        {data.categories.length > 0 && (
          <div ref={tabsRef} className={`overflow-x-auto scrollbar-hide ${isDark ? "bg-[#1a1a1a]/95 border-white/10" : "bg-white/90 border-black/5"} backdrop-blur-md border-b shadow-sm`}>
            <div className={`${contentWidth} mx-auto flex gap-2 px-4 py-3 min-w-max`}>
              {data.categories.map((c) => (
                <button
                  key={c.id}
                  data-tab={c.id}
                  onClick={() => {
                    setActiveCat(c.id);
                    sectionRefs.current[c.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  style={
                    activeCat === c.id
                      ? { background: `linear-gradient(135deg, ${colors.category}, ${colors.categoryDark})` }
                      : undefined
                  }
                  className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                    activeCat === c.id
                      ? "text-white shadow-md scale-[1.02]"
                      : isDark
                        ? "bg-white/5 text-neutral-300 hover:bg-white/10"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`${contentWidth} mx-auto px-4 py-6 space-y-8`}
      >
        {data.categories.length === 0 && (
          <div className="text-center text-neutral-500 py-20">
            لا توجد أصناف متاحة حالياً
          </div>
        )}

        {data.categories.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className={`text-xl font-extrabold ${textPrimary} tracking-tight`}>
                تصفح حسب الفئة
              </h2>
              <span className={`text-xs ${textMuted} font-medium`}>
                {data.categories.length} فئة
              </span>
            </div>
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="flex gap-3 min-w-max pb-1">
                {data.categories.map((c) => {
                  const count = (itemsByCat[c.id] ?? []).length;
                  const isActive = activeCat === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setActiveCat(c.id);
                        sectionRefs.current[c.id]?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                      style={
                        isActive
                          ? { background: `linear-gradient(135deg, ${colors.category}, ${colors.categoryDark})` }
                          : undefined
                      }
                      className={`group flex flex-col items-center gap-2 w-[88px] rounded-2xl p-3 border transition-all duration-200 active:scale-[0.97] ${
                        isActive
                          ? "border-transparent text-white shadow-md"
                          : `${cardBg} ${cardBorder} ${isDark ? "text-neutral-200" : "text-neutral-800"} hover:shadow-md`
                      }`}
                    >
                      <div
                        style={
                          !isActive
                            ? { background: `linear-gradient(135deg, ${colors.categorySoftFrom}, ${colors.categorySoftTo})`, color: colors.categoryDark }
                            : undefined
                        }
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-extrabold transition ${
                          isActive
                            ? "bg-white/20 text-white"
                            : ""
                        }`}
                      >
                        {categoryEmoji(c.name) ?? <UtensilsCrossed className="w-5 h-5" />}
                      </div>
                      <span className="text-[12px] font-bold leading-tight text-center line-clamp-2">
                        {c.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          isActive ? "text-white/80" : textMuted
                        }`}
                      >
                        {count} صنف
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {data.categories.filter((c) => c.id === activeCat).map((c) => (
          <section
            key={c.id}
            ref={(el) => {
              sectionRefs.current[c.id] = el;
            }}
            data-cat-id={c.id}
            className="scroll-mt-40"
          >
            <div className="flex items-baseline justify-between mb-4">
              <h2 className={`text-2xl font-extrabold ${textPrimary} tracking-tight`}>{c.name}</h2>
              <span className={`text-xs ${textMuted} font-medium`}>{(itemsByCat[c.id] ?? []).length} صنف</span>
            </div>
            {(itemsByCat[c.id] ?? []).length === 0 ? (
              <p className={`${textMuted} text-sm`}>لا توجد أصناف متاحة حالياً</p>
            ) : (
              <div className={layout === "photo_grid" ? "grid grid-cols-2 gap-3 sm:gap-5" : layout === "featured_magazine" ? "grid grid-cols-1 sm:grid-cols-2 gap-5" : "grid grid-cols-1 gap-5"}>
                {itemsByCat[c.id].map((it, index) => (
                  <ItemCard
                    key={it.id}
                    item={it}
                    onAdd={() => addToCart(it)}
                    onOpen={() => setDetailItem(it)}
                    layout={layout}
                    featured={layout === "featured_magazine" && index === 0}
                    primary={colors.button}
                    primaryDark={colors.buttonDark}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    textPrimary={textPrimary}
                    textMuted={textMuted}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </motion.main>

      <AnimatePresence>
        {totalQty > 0 && !drawerOpen && isOnline && !fromCache && (
          <motion.button
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={() => setDrawerOpen(true)}
            style={{ background: `linear-gradient(135deg, ${colors.button}, ${colors.buttonDark})` }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 text-white rounded-2xl shadow-2xl px-5 py-3.5 flex items-center gap-4 min-w-[300px] justify-between active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
                <span style={{ color: colors.buttonDark }} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-[11px] font-extrabold flex items-center justify-center">{totalQty}</span>
              </div>
              <span className="font-bold text-sm">عرض السلة</span>
            </div>
            <span className="font-extrabold tabular-nums">{formatDZD(totalPrice)}</span>
          </motion.button>
        )}
        {(!isOnline || fromCache) && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-neutral-800 text-white rounded-2xl shadow-2xl px-5 py-3.5 flex items-center gap-2 min-w-[300px] justify-center"
          >
            <WifiOff className="w-4 h-4" />
            <span className="font-bold text-sm">الطلب غير متاح حالياً</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] flex flex-col border-0 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.3)]">
          <SheetHeader>
            <SheetTitle className="text-right text-2xl font-extrabold tracking-tight">سلة الطلبات</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {cart.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
                  <ShoppingBag className="w-7 h-7 text-neutral-400" />
                </div>
                <p className="text-neutral-500">السلة فارغة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((c) => (
                  <div key={c.menu_item_id} className="flex items-center gap-3 bg-neutral-50 rounded-2xl p-3 border border-black/5">
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="w-16 h-16 rounded-xl object-cover shadow-sm" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-neutral-200" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate text-neutral-900">{c.name}</p>
                      <p style={{ color: colors.buttonDark }} className="text-sm font-bold tabular-nums">{formatDZD(c.price)}</p>
                    </div>
                    <div className="flex items-center gap-1 bg-white rounded-full px-1 py-1 shadow-sm">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full hover:bg-neutral-100"
                        onClick={() => updateQty(c.menu_item_id, -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-6 text-center font-extrabold tabular-nums">{c.quantity}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        style={{ background: colors.buttonDark }}
                        className="h-8 w-8 rounded-full text-white hover:opacity-90"
                        onClick={() => updateQty(c.menu_item_id, 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-neutral-400 hover:text-destructive"
                      onClick={() => removeFromCart(c.menu_item_id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {cart.length > 0 && (
            <div className="border-t border-neutral-100 pt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-neutral-700">
                  ملاحظة للمطبخ <span className="text-neutral-400 font-normal">(اختياري)</span>
                </label>
                <Textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value.slice(0, 500))}
                  placeholder="مثال: بدون ملح، حار، بدون بصل..."
                  className="resize-none rounded-xl text-right"
                  rows={2}
                  maxLength={500}
                  dir="rtl"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 font-medium">الإجمالي</span>
                <span className="text-2xl font-extrabold text-neutral-900 tabular-nums">{formatDZD(totalPrice)}</span>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ background: `linear-gradient(135deg, ${colors.button}, ${colors.buttonDark})` }}
                className="w-full h-14 text-base font-extrabold rounded-2xl text-white hover:opacity-95 shadow-xl"
              >
                {submitting ? "جاري الإرسال..." : "تأكيد الطلب"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ImageLightbox item={detailItem} onClose={() => setDetailItem(null)} />

      {/* Floating complaint button */}
      <button
        onClick={() => setComplaintOpen(true)}
        className="fixed bottom-24 end-4 z-30 bg-amber-600 hover:bg-amber-700 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg"
        aria-label="شكوى أو ملاحظة"
        title="شكوى أو ملاحظة"
      >
        <MessageSquareWarning className="w-5 h-5" />
      </button>

      {/* Floating AI assistant button */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-40 end-4 z-30 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-xl hover:scale-105 transition"
        aria-label="مساعد المنيو الذكي"
        title="اسأل المساعد الذكي"
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* AI Chat Sheet */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0" dir="rtl">
          <SheetHeader className="px-4 py-3 border-b bg-gradient-to-l from-primary/10 to-transparent shrink-0">
            <SheetTitle className="flex items-center gap-2 text-right">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold">مساعد المنيو الذكي</div>
                <div className="text-[11px] font-normal text-muted-foreground">اسألني ايش تحب تاكل اليوم</div>
              </div>
            </SheetTitle>
          </SheetHeader>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="space-y-3 text-center py-6">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div className="text-sm text-neutral-600 dark:text-neutral-300">
                  مرحباً! اسألني عن أي طبق أو خليني أنصحك
                </div>
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  {[
                    "إيش تنصحني؟",
                    "عندكم شي حار؟",
                    "أرخص طبق عندكم؟",
                    "أكلة خفيفة من فضلك",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => sendChat(s)}
                      className="text-xs px-3 py-2 rounded-full border border-border hover:bg-accent transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    m.role === "user"
                      ? "bg-neutral-200 dark:bg-neutral-700"
                      : "bg-gradient-to-br from-primary to-primary/60 text-primary-foreground"
                  }`}
                >
                  {m.role === "user" ? "👤" : <Sparkles className="w-3.5 h-3.5" />}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-neutral-100 dark:bg-neutral-800 text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl px-3.5 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> يفكر...
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3 flex gap-2 shrink-0 bg-background">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChat();
                }
              }}
              placeholder="اكتب سؤالك..."
              disabled={chatLoading}
              className="flex-1"
            />
            <Button
              onClick={() => sendChat()}
              disabled={chatLoading || !chatInput.trim() || !isOnline}
              size="icon"
              className="shrink-0"
            >
              {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={complaintOpen} onOpenChange={setComplaintOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>شكوى أو ملاحظة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-right">
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">نوع الشكوى</label>
              <Select
                value={complaintForm.type}
                onValueChange={(v) => setComplaintForm({ ...complaintForm, type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="جودة الطعام">جودة الطعام</SelectItem>
                  <SelectItem value="الخدمة">الخدمة</SelectItem>
                  <SelectItem value="النظافة">النظافة</SelectItem>
                  <SelectItem value="السعر">السعر</SelectItem>
                  <SelectItem value="آخر">آخر</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">الاسم (اختياري)</label>
              <Input
                value={complaintForm.customer_name}
                onChange={(e) => setComplaintForm({ ...complaintForm, customer_name: e.target.value })}
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">رقم الهاتف (اختياري)</label>
              <Input
                value={complaintForm.customer_phone}
                onChange={(e) => setComplaintForm({ ...complaintForm, customer_phone: e.target.value })}
                maxLength={30}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">الوصف</label>
              <Textarea
                value={complaintForm.description}
                onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value.slice(0, 1000) })}
                rows={4}
                maxLength={1000}
                placeholder="اكتب شكواك أو ملاحظتك هنا..."
              />
            </div>
            <Button
              disabled={complaintSubmitting || !complaintForm.description.trim() || !isOnline}
              onClick={async () => {
                if (!data?.restaurant.id) return;
                setComplaintSubmitting(true);
                try {
                  await submitComplaint({
                    data: {
                      qr_token,
                      type: complaintForm.type,
                      description: complaintForm.description.trim(),
                      customer_name: complaintForm.customer_name.trim() || null,
                      customer_phone: complaintForm.customer_phone.trim() || null,
                    },
                  });
                } catch (error) {
                  setComplaintSubmitting(false);
                  toast.error("تعذّر الإرسال");
                  return;
                }
                setComplaintSubmitting(false);
                toast.success("شكراً، تم استلام شكواك");
                setComplaintOpen(false);
                setComplaintForm({ type: "جودة الطعام", customer_name: "", customer_phone: "", description: "" });
              }}
              className="w-full"
            >
              {complaintSubmitting ? "جاري الإرسال..." : !isOnline ? "غير متاح بدون إنترنت" : "إرسال"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemCard({
  item,
  onAdd,
  onOpen,
  layout,
  featured,
  primary,
  primaryDark,
  cardBg,
  cardBorder,
  textPrimary,
  textMuted,
}: {
  item: MenuItem;
  onAdd: () => void;
  onOpen: () => void;
  layout: MenuLayoutId;
  featured: boolean;
  primary: string;
  primaryDark: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textMuted: string;
}) {
  const addButton = (className = "w-11 h-11 rounded-2xl") => (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      style={{ background: `linear-gradient(135deg, ${primary}, ${primaryDark})` }}
      className={`${className} text-white flex items-center justify-center shadow-xl`}
      aria-label="إضافة إلى السلة"
    >
      <Plus className="w-5 h-5" strokeWidth={2.5} />
    </motion.button>
  );

  if (layout === "compact_list" || (layout === "featured_magazine" && !featured)) {
    return (
      <motion.div
        whileHover={{ y: -1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        onClick={onOpen}
        className={`flex items-center gap-3 rounded-2xl ${cardBg} border ${cardBorder} p-3 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.25)] cursor-pointer`}
      >
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} loading="lazy" className="w-20 h-20 rounded-2xl object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-200" />
        )}
        <div className="flex-1 min-w-0">
          <h3 className={`text-base font-extrabold ${textPrimary} leading-snug truncate`}>{item.name}</h3>
          {item.description && <p className={`text-xs ${textMuted} mt-1 line-clamp-2`}>{item.description}</p>}
          <p style={{ color: primaryDark }} className="text-sm font-extrabold tabular-nums mt-2">{formatDZD(item.price)}</p>
        </div>
        {addButton("w-10 h-10 rounded-xl shrink-0")}
      </motion.div>
    );
  }

  if (layout === "photo_grid") {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        onClick={onOpen}
        className={`relative rounded-2xl ${cardBg} overflow-hidden border ${cardBorder} cursor-pointer shadow-[0_10px_30px_-16px_rgba(0,0,0,0.28)]`}
      >
        <div className="relative aspect-square">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-neutral-100 to-neutral-200" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute bottom-2 right-2 left-2">
            <h3 className="text-white text-sm font-extrabold leading-snug line-clamp-2">{item.name}</h3>
            <p className="text-white/90 text-xs font-bold tabular-nums mt-1">{formatDZD(item.price)}</p>
          </div>
          <div className="absolute top-2 left-2">{addButton("w-9 h-9 rounded-xl")}</div>
        </div>
      </motion.div>
    );
  }

  if (layout === "simple_catalog") {
    return (
      <motion.div
        whileHover={{ y: -1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        onClick={onOpen}
        className={`rounded-2xl ${cardBg} border ${cardBorder} p-4 cursor-pointer`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={`text-[17px] font-extrabold ${textPrimary} leading-snug`}>{item.name}</h3>
            {item.description && <p className={`text-[13px] ${textMuted} mt-1 line-clamp-2`}>{item.description}</p>}
            <p style={{ color: primaryDark }} className="text-base font-extrabold tabular-nums mt-3">{formatDZD(item.price)}</p>
          </div>
          {addButton("w-10 h-10 rounded-xl shrink-0")}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      onClick={onOpen}
      className={`relative rounded-3xl ${cardBg} shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)] overflow-hidden border ${cardBorder} cursor-pointer ${featured ? "sm:col-span-2" : ""}`}
    >
      <div className="relative">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className={`w-full ${featured ? "h-[280px]" : "h-[220px]"} object-cover`}
          />
        ) : (
          <div className={`w-full ${featured ? "h-[280px]" : "h-[220px]"} bg-gradient-to-br from-neutral-100 to-neutral-200`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

        <button
          aria-label="المفضلة"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/85 backdrop-blur-md flex items-center justify-center shadow-md hover:bg-white transition"
        >
          <Heart style={{ color: primaryDark }} className="w-4 h-4" />
        </button>

        <div className="absolute top-3 left-3 flex items-center gap-1 bg-white/90 backdrop-blur-md rounded-full px-2.5 py-1 shadow-md">
          <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
          <span className="text-xs font-bold text-neutral-800">4.8</span>
        </div>

        <div className="absolute bottom-3 right-3">
          <div className="bg-white rounded-2xl px-3 py-1.5 shadow-lg">
            <span style={{ color: primaryDark }} className="text-base font-extrabold tabular-nums">{formatDZD(item.price)}</span>
          </div>
        </div>
      </div>

      <div className="p-4 pt-3.5 relative">
        <h3 className={`text-[17px] font-extrabold ${textPrimary} tracking-tight leading-snug pl-14`}>
          {item.name}
        </h3>
        {item.description && (
          <p className={`text-[13px] ${textMuted} mt-1 leading-relaxed pl-14 line-clamp-2`}>
            {item.description}
          </p>
        )}

        <div className="absolute -top-7 left-4">
          {addButton("w-12 h-12 rounded-2xl ring-4 ring-white")}
        </div>
      </div>
    </motion.div>
  );
}

function ImageLightbox({
  item,
  onClose,
}: {
  item: MenuItem | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="p-0 bg-transparent border-0 shadow-none max-w-[95vw] sm:max-w-2xl [&>button]:hidden"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{item?.name ?? ""}</DialogTitle>
        </DialogHeader>
        {item && (
          <div className="relative">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full max-h-[85vh] object-contain rounded-2xl"
              />
            ) : (
              <div className="w-full h-[60vh] bg-gradient-to-br from-neutral-200 to-neutral-300 rounded-2xl flex items-center justify-center text-neutral-500">
                لا توجد صورة
              </div>
            )}
            <button
              onClick={onClose}
              aria-label="إغلاق"
              className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center shadow-lg hover:scale-105 transition"
            >
              <X className="w-5 h-5 text-neutral-800" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const STATUS_STEPS: {
  key: OrderStatusInfo["status"] | "received";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "received", label: "تم الاستلام", icon: Receipt },
  { key: "preparing", label: "قيد التحضير", icon: ChefHat },
  { key: "ready", label: "جاهز", icon: Bell },
  { key: "paid", label: "مدفوع", icon: Wallet },
];

function statusIndex(s: OrderStatusInfo["status"]): number {
  switch (s) {
    case "new":
      return 0;
    case "preparing":
      return 1;
    case "ready":
      return 2;
    case "paid":
      return 3;
  }
}

function OrderTrackingScreen({
  orderId,
  qrToken,
  onComplete,
}: {
  orderId: string;
  qrToken: string;
  onComplete: () => void;
}) {
  const [info, setInfo] = useState<OrderStatusInfo | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const lastStatusRef = useRef<OrderStatusInfo["status"] | null>(null);

  // Poll order status every 5s
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function fetchOnce() {
      try {
        const res = await getOrderStatus({ data: { order_id: orderId, qr_token: qrToken } });
        if (!mounted) return;
        if (!res) return;
        setInfo(res);
        // Status change toast
        const prev = lastStatusRef.current;
        if (prev && prev !== res.status) {
          if (res.status === "preparing") toast("طلبك قيد التحضير 👨‍🍳");
          else if (res.status === "ready") toast.success("طلبك جاهز! 🎉");
          else if (res.status === "paid") toast("شكراً لك على زيارتنا");
        }
        lastStatusRef.current = res.status;
      } catch {
        // silent
      }
    }

    fetchOnce();
    timer = setInterval(fetchOnce, 5000);
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [orderId, qrToken]);

  // Mark as done if a review already exists
  useEffect(() => {
    if (info?.has_review) setReviewDone(true);
  }, [info]);

  const orderNumber = orderId.replace(/-/g, "").slice(-6).toUpperCase();
  const currentIdx = info ? statusIndex(info.status) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start p-6 text-center pt-12">
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
      >
        <CheckCircle2 className="w-24 h-24 text-green-500 mb-4" strokeWidth={1.5} />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold mb-1"
      >
        تم استلام طلبك ✓
      </motion.h1>
      <p className="text-muted-foreground mb-1">
        رقم الطلب: <span className="font-mono font-bold text-foreground">#{orderNumber}</span>
      </p>
      <p className="text-muted-foreground mb-10">سيتم تحضير طلبك قريباً</p>

      {/* Tracker */}
      <div className="w-full max-w-md">
        <div className="relative flex items-start justify-between">
          {/* Background line */}
          <div className="absolute top-6 right-6 left-6 h-1 bg-muted rounded-full" />
          {/* Filled line */}
          <motion.div
            className="absolute top-6 right-6 h-1 bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{
              width: `calc((100% - 48px) * ${currentIdx / (STATUS_STEPS.length - 1)})`,
            }}
            transition={{ duration: 0.5 }}
          />
          {STATUS_STEPS.map((step, idx) => {
            const completed = idx < currentIdx || (idx === currentIdx && info?.status === "paid");
            const active = idx === currentIdx && info?.status !== "paid";
            const Icon = completed ? Check : step.icon;
            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center w-1/4">
                <motion.div
                  animate={active ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                  transition={active ? { duration: 1.5, repeat: Infinity } : {}}
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                    completed || active
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-background border-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </motion.div>
                <span
                  className={`text-xs mt-2 ${
                    completed || active ? "text-foreground font-bold" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons: order more / rate now */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-md mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <Button
          variant="outline"
          className="h-12 gap-2"
          onClick={onComplete}
        >
          <Plus className="w-4 h-4" />
          اطلب شيئاً آخر
        </Button>
        <Button
          variant="default"
          className="h-12 gap-2"
          disabled={reviewDone}
          onClick={() => setReviewOpen(true)}
        >
          <Star className="w-4 h-4" />
          {reviewDone ? "تم التقييم ✓" : "قيّم خدمتنا"}
        </Button>
      </motion.div>

      <ReviewModal
        open={reviewOpen}
        orderId={orderId}
        qrToken={qrToken}
        googleUrl={info?.google_maps_review_url ?? null}
        onDone={() => {
          setReviewOpen(false);
          setReviewDone(true);
          onComplete();
        }}
      />
    </div>
  );
}

function ReviewModal({
  open,
  orderId,
  qrToken,
  googleUrl,
  onDone,
}: {
  open: boolean;
  orderId: string;
  qrToken: string;
  googleUrl: string | null;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "thanks-high" | "thanks-low">("form");
  const [savedGoogleUrl, setSavedGoogleUrl] = useState<string | null>(null);

  async function handleSubmit() {
    if (rating < 1) return;
    setSubmitting(true);
    try {
      const res = await submitReview({
        data: { order_id: orderId, qr_token: qrToken, rating, comment: comment.trim() || null },
      });
      if (res.should_redirect) {
        setSavedGoogleUrl(res.google_url);
        setStep("thanks-high");
      } else {
        setStep("thanks-low");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "تعذّر إرسال التقييم";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* prevent outside close */ }}>
      <DialogContent
        className="rounded-2xl p-8 max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">كيفاش كانت تجربتك؟</DialogTitle>
              <p className="text-center text-muted-foreground">رأيك يهمنا</p>
            </DialogHeader>

            <div className="flex justify-center gap-2 py-4" dir="ltr">
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= (hover || rating);
                return (
                  <motion.button
                    key={n}
                    type="button"
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    className="p-1"
                    aria-label={`${n} نجوم`}
                  >
                    <Star
                      className={`w-12 h-12 transition-colors ${
                        filled ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                      }`}
                    />
                  </motion.button>
                );
              })}
            </div>

            {rating > 0 && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center font-medium mb-2"
              >
                {rating >= 4
                  ? "ممتاز! ساعدنا بمشاركة تجربتك"
                  : "نأسف، نريد أن نتحسّن"}
              </motion.p>
            )}

            <Textarea
              placeholder="أضف تعليقاً (اختياري)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              rows={3}
              maxLength={1000}
            />

            <Button
              className="w-full h-12 mt-2"
              disabled={rating < 1 || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "جاري الإرسال..." : "إرسال التقييم"}
            </Button>
          </>
        )}

        {step === "thanks-high" && (
          <div className="text-center space-y-4 py-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="text-5xl"
            >
              🌟
            </motion.div>
            <h2 className="text-2xl font-bold">شكراً لك!</h2>
            <p className="text-muted-foreground">هل تساعدنا بمشاركة تقييمك على Google؟</p>
            {savedGoogleUrl ? (
              <Button
                className="w-full h-12"
                onClick={() => {
                  if (savedGoogleUrl && savedGoogleUrl.startsWith("https://")) {
                    window.open(savedGoogleUrl, "_blank", "noopener");
                  }
                  onDone();
                }}
              >
                <ExternalLink className="ml-2 w-4 h-4" />
                اكتب تقييم على Google
              </Button>
            ) : null}
            <Button variant="ghost" className="w-full" onClick={onDone}>
              تخطّى
            </Button>
          </div>
        )}

        {step === "thanks-low" && (
          <div className="text-center space-y-4 py-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="flex justify-center"
            >
              <Heart className="w-16 h-16 text-primary fill-primary/20" />
            </motion.div>
            <h2 className="text-2xl font-bold">شكراً على ملاحظتك</h2>
            <p className="text-muted-foreground">سنعمل على تحسين تجربتك القادمة</p>
            <Button className="w-full h-12" onClick={onDone}>
              إغلاق
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}