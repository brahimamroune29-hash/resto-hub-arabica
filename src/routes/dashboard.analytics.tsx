import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  ShoppingBag,
  DollarSign,
  Receipt,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Flame,
  Snowflake,
  Clock,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId, formatDZD } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { exportAnalyticsExcel, exportAnalyticsPDF } from "@/lib/exportReports";

export const Route = createFileRoute("/dashboard/analytics")({
  component: Page,
});

type AnalyticsData = {
  kpis: {
    ordersToday: number;
    salesToday: number;
    avgOrderWeek: number;
    salesMonth: number;
    ordersTodayPrev: number;
    salesTodayPrev: number;
    avgOrderWeekPrev: number;
    salesMonthPrev: number;
  };
  daily: { date: string; total: number }[];
  topItems: TopItem[];
  bottomItems: TopItem[];
  hourly: { hour: number; count: number }[];
};

type TopItem = {
  menu_item_id: string | null;
  name: string;
  image_url: string | null;
  qty: number;
  revenue: number;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function pctChange(curr: number, prev: number) {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function safeIsoDate(iso: string): Date | null {
  if (!iso || typeof iso !== "string") return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d;
}

async function loadAnalytics(restaurantId: string): Promise<AnalyticsData> {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const thirtyAgo = new Date(today);
  thirtyAgo.setDate(thirtyAgo.getDate() - 29);

  const fetchSince = new Date(prevMonthStart);

  const { data: ordersRaw, error } = await supabase
    .from("orders")
    .select("id, total, created_at, status")
    .eq("restaurant_id", restaurantId)
    .eq("status", "paid")
    .gte("created_at", fetchSince.toISOString())
    .limit(5000);

  if (error) throw new Error(error.message);

  const paid = (ordersRaw ?? [])
    .map((o) => ({ ...o, _date: safeIsoDate(o.created_at as string) }))
    .filter((o) => o._date !== null) as Array<{
    id: string;
    total: number | string;
    created_at: string;
    _date: Date;
  }>;

  const inRange = (d: Date, start: Date, end: Date) =>
    d.getTime() >= start.getTime() && d.getTime() < end.getTime();

  const ordersToday = paid.filter((o) => inRange(o._date, today, tomorrow));
  const ordersYesterday = paid.filter((o) => inRange(o._date, yesterday, today));
  const ordersWeek = paid.filter((o) => inRange(o._date, weekStart, tomorrow));
  const ordersPrevWeek = paid.filter((o) =>
    inRange(o._date, prevWeekStart, weekStart)
  );
  const ordersMonth = paid.filter((o) => inRange(o._date, monthStart, tomorrow));
  const ordersPrevMonth = paid.filter((o) =>
    inRange(o._date, prevMonthStart, monthStart)
  );

  const sum = (arr: { total: number | string }[]) =>
    arr.reduce((a, x) => a + Number(x.total || 0), 0);

  const kpis = {
    ordersToday: ordersToday.length,
    salesToday: sum(ordersToday),
    avgOrderWeek: ordersWeek.length ? sum(ordersWeek) / ordersWeek.length : 0,
    salesMonth: sum(ordersMonth),
    ordersTodayPrev: ordersYesterday.length,
    salesTodayPrev: sum(ordersYesterday),
    avgOrderWeekPrev: ordersPrevWeek.length
      ? sum(ordersPrevWeek) / ordersPrevWeek.length
      : 0,
    salesMonthPrev: sum(ordersPrevMonth),
  };

  // Daily 30 days
  const dailyMap = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyAgo);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    dailyMap.set(key, 0);
  }
  paid
    .filter((o) => inRange(o._date, thirtyAgo, tomorrow))
    .forEach((o) => {
      const d = o._date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + Number(o.total || 0));
    });
  const daily = Array.from(dailyMap.entries()).map(([date, total]) => ({
    date,
    total,
  }));

  // Hourly this week
  const hourMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourMap.set(h, 0);
  paid
    .filter((o) => inRange(o._date, weekStart, tomorrow))
    .forEach((o) => {
      const h = o._date.getHours();
      hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
    });
  const hourly = Array.from(hourMap.entries()).map(([hour, count]) => ({
    hour,
    count,
  }));

  // Items this month
  let topItems: TopItem[] = [];
  let bottomItems: TopItem[] = [];
  const monthOrderIds = ordersMonth.map((o) => o.id);
  if (monthOrderIds.length) {
    const { data: items, error: iErr } = await supabase
      .from("order_items")
      .select("menu_item_id, name_snapshot, price_snapshot, quantity, order_id")
      .in("order_id", monthOrderIds)
      .limit(5000);
    if (iErr) throw new Error(iErr.message);
    const agg = new Map<
      string,
      { name: string; qty: number; revenue: number; menu_item_id: string | null }
    >();
    (items ?? []).forEach((it) => {
      const key = it.menu_item_id ?? `name:${it.name_snapshot}`;
      const cur = agg.get(key) ?? {
        name: it.name_snapshot,
        qty: 0,
        revenue: 0,
        menu_item_id: it.menu_item_id,
      };
      cur.qty += Number(it.quantity || 0);
      cur.revenue += Number(it.price_snapshot || 0) * Number(it.quantity || 0);
      agg.set(key, cur);
    });
    const ids = Array.from(agg.values())
      .map((v) => v.menu_item_id)
      .filter(Boolean) as string[];
    let imgs = new Map<string, string | null>();
    if (ids.length) {
      const { data: mi } = await supabase
        .from("menu_items")
        .select("id, image_url")
        .in("id", ids);
      imgs = new Map((mi ?? []).map((m) => [m.id, m.image_url]));
    }
    const arr: TopItem[] = Array.from(agg.values()).map((v) => ({
      ...v,
      image_url: v.menu_item_id ? imgs.get(v.menu_item_id) ?? null : null,
    }));
    arr.sort((a, b) => b.qty - a.qty);
    topItems = arr.slice(0, 10);
    bottomItems = arr.slice().sort((a, b) => a.qty - b.qty).slice(0, 5);
  }

  return { kpis, daily, topItems, bottomItems, hourly };
}

/* ---------------------------------------------------------------------- */
/* Small shared visual helpers                                            */
/* ---------------------------------------------------------------------- */

/** requestAnimationFrame-driven count-up between the previous and next value. */
function useCountUp(target: number, duration = 750) {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      prevRef.current = target;
      setValue(target);
      return;
    }
    const start = prevRef.current;
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(start + (target - start) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

/** Wraps children with a subtle mouse-follow 3D tilt + spring reset. */
function Tilt3D({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 260, damping: 22 });
  const springY = useSpring(rotateY, { stiffness: 260, damping: 22 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 9);
    rotateX.set(-py * 9);
  };
  const handleLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX: springX, rotateY: springY, transformPerspective: 900 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Floating blurred gradient blobs for page atmosphere — purely decorative. */
function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-24 -right-20 w-96 h-96 rounded-full bg-gradient-primary opacity-[0.14] blur-[100px] animate-float-slow" />
      <div className="absolute top-1/3 -left-24 w-80 h-80 rounded-full bg-gradient-primary opacity-[0.10] blur-[110px] animate-float-slower" />
      <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-gradient-primary opacity-[0.09] blur-[90px] animate-float-slow" />
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground leading-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Floating glass tooltip shared by all charts on the page. */
function ChartTooltip({
  active,
  payload,
  label,
  labelPrefix,
  labelFormatter,
  valueLabel,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string | number;
  labelPrefix?: string;
  labelFormatter?: (label: string | number | undefined) => string;
  valueLabel: string;
  valueFormatter: (n: number) => string;
}) {
  if (!active || !payload || !payload.length) return null;
  const value = payload[0].value;
  return (
    <div className="glass-strong rounded-xl px-3.5 py-2.5 shadow-elegant border border-border/60 text-xs min-w-[120px]">
      <div className="text-muted-foreground mb-1">
        {labelFormatter ? labelFormatter(label) : `${labelPrefix ?? ""}${label}`}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">{valueLabel}</span>
        <span className="font-bold text-foreground tabular-nums">
          {valueFormatter(value)}
        </span>
      </div>
    </div>
  );
}

const recessiveGridProps = {
  strokeDasharray: "4 8",
  stroke: "var(--border)",
  strokeOpacity: 0.6,
  vertical: false,
};

const axisTickProps = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
};

function KpiCard({
  title,
  value,
  prev,
  format,
  Icon,
  trend,
  index,
}: {
  title: string;
  value: number;
  prev: number;
  format: (n: number) => string;
  Icon: React.ComponentType<{ className?: string }>;
  trend?: number[];
  index: number;
}) {
  const diff = pctChange(value, prev);
  const positive = diff >= 0;
  const animated = useCountUp(value);
  const sparkData = (trend ?? []).map((v, i) => ({ i, v }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
      style={{ transformStyle: "preserve-3d" }}
    >
      <Tilt3D className="group relative rounded-2xl glass-card hover-lift p-6 overflow-hidden">
        <div className="absolute -top-16 -left-16 w-40 h-40 rounded-full bg-gradient-primary opacity-10 blur-3xl group-hover:opacity-25 transition-opacity duration-500" />
        <div className="relative flex items-start justify-between mb-4">
          <div
            className="w-11 h-11 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center"
            style={{ transform: "translateZ(30px)" }}
          >
            <Icon className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground text-left">
            {title}
          </span>
        </div>
        <div
          className="relative text-3xl md:text-4xl font-bold text-foreground mb-2 tabular-nums"
          style={{ transform: "translateZ(20px)" }}
        >
          {format(Math.round(animated))}
        </div>
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-md ${
                positive
                  ? "text-emerald-600 bg-emerald-500/10"
                  : "text-red-500 bg-red-500/10"
              }`}
            >
              {positive ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )}
              {Math.abs(diff)}%
            </span>
            <span className="text-muted-foreground">vs الفترة السابقة</span>
          </div>
          {sparkData.length > 1 && (
            <div className="w-16 h-8 opacity-80" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData}>
                  <defs>
                    <linearGradient id={`sparkGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="var(--primary)"
                    strokeWidth={1.5}
                    fill={`url(#sparkGrad-${index})`}
                    isAnimationActive
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Tilt3D>
    </motion.div>
  );
}

type RangePreset = "week" | "month" | "year" | "custom";

function fmtKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function RevenueRangeCard({
  restaurantId,
  restaurantCreatedAt,
}: {
  restaurantId: string;
  restaurantCreatedAt: string | null;
}) {
  const [preset, setPreset] = useState<RangePreset>("week");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [rows, setRows] = useState<{ date: string; total: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const { startDate, endDate, label } = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    let start = new Date(today);
    let lbl = "";
    if (preset === "week") {
      start.setDate(start.getDate() - 6);
      lbl = "آخر 7 أيام";
    } else if (preset === "month") {
      start.setDate(start.getDate() - 29);
      lbl = "آخر 30 يوم";
    } else if (preset === "year") {
      start.setDate(start.getDate() - 364);
      lbl = "آخر 12 شهر";
    } else {
      const minDate = restaurantCreatedAt
        ? startOfDay(new Date(restaurantCreatedAt))
        : today;
      start = customDate ? startOfDay(customDate) : minDate;
      if (start.getTime() < minDate.getTime()) start = minDate;
      lbl = `من ${fmtKey(start)} إلى اليوم`;
    }
    return { startDate: start, endDate: end, label: lbl };
  }, [preset, customDate, restaurantCreatedAt]);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    setBusy(true);
    supabase
      .from("orders")
      .select("id, total, created_at")
      .eq("restaurant_id", restaurantId)
      .eq("status", "paid")
      .gte("created_at", startDate.toISOString())
      .lt("created_at", endDate.toISOString())
      .limit(10000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("فشل تحميل الإيرادات");
          setRows([]);
          setTotal(0);
          setCount(0);
          setBusy(false);
          return;
        }
        const map = new Map<string, number>();
        const days =
          Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) || 1;
        for (let i = 0; i < days; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          map.set(fmtKey(d), 0);
        }
        let sum = 0;
        (data ?? []).forEach((o) => {
          const d = new Date(o.created_at as string);
          if (isNaN(d.getTime())) return;
          const k = fmtKey(d);
          map.set(k, (map.get(k) ?? 0) + Number(o.total || 0));
          sum += Number(o.total || 0);
        });
        setRows(Array.from(map.entries()).map(([date, total]) => ({ date, total })));
        setTotal(sum);
        setCount((data ?? []).length);
        setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, startDate, endDate]);

  const chart = rows.map((r) => ({ label: r.date.slice(5), total: r.total }));
  const minDate = restaurantCreatedAt
    ? startOfDay(new Date(restaurantCreatedAt))
    : new Date(2000, 0, 1);
  const maxDate = startOfDay(new Date());

  const animatedTotal = useCountUp(total);
  const animatedCount = useCountUp(count);
  const animatedAvg = useCountUp(count ? Math.round(total / count) : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
      className="rounded-2xl glass-card hover-lift p-6"
    >
      <SectionHeader
        icon={Wallet}
        title="الإيرادات حسب الفترة"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">أسبوع</SelectItem>
                <SelectItem value="month">شهر</SelectItem>
                <SelectItem value="year">سنة</SelectItem>
                <SelectItem value="custom">مخصص</SelectItem>
              </SelectContent>
            </Select>
            {preset === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 gap-2",
                      !customDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="w-4 h-4" />
                    {customDate ? fmtKey(customDate) : "اختر تاريخ البداية"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={setCustomDate}
                    disabled={(d) => d < minDate || d > maxDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl border border-border/70 bg-muted/40 p-3 transition-colors hover:bg-muted/60">
          <div className="text-xs text-muted-foreground mb-1">{label}</div>
          <div className="text-xl font-bold text-foreground tabular-nums">
            {formatDZD(Math.round(animatedTotal))}
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/40 p-3 transition-colors hover:bg-muted/60">
          <div className="text-xs text-muted-foreground mb-1">عدد الطلبات</div>
          <div className="text-xl font-bold text-foreground tabular-nums">
            {Math.round(animatedCount)}
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/40 p-3 transition-colors hover:bg-muted/60">
          <div className="text-xs text-muted-foreground mb-1">متوسط الطلب</div>
          <div className="text-xl font-bold text-foreground tabular-nums">
            {formatDZD(Math.round(animatedAvg))}
          </div>
        </div>
      </div>

      <div className="h-64" dir="ltr">
        {busy ? (
          <div className="h-full rounded-xl bg-muted animate-pulse" />
        ) : chart.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            لا توجد بيانات في هذه الفترة
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <defs>
                <linearGradient id="barGradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <CartesianGrid {...recessiveGridProps} />
              <XAxis
                dataKey="label"
                tick={axisTickProps}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={axisTickProps} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={
                  <ChartTooltip
                    labelPrefix="التاريخ: "
                    valueLabel="المبيعات"
                    valueFormatter={formatDZD}
                  />
                }
              />
              <Bar
                dataKey="total"
                fill="url(#barGradRevenue)"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}

function Page() {
  const { restaurantId, loading: rLoading } = useRestaurantId();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [restaurantCreatedAt, setRestaurantCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from("restaurants")
      .select("name, created_at")
      .eq("id", restaurantId)
      .maybeSingle()
      .then(({ data }) => {
        setRestaurantName(data?.name ?? "");
        setRestaurantCreatedAt((data as { created_at?: string } | null)?.created_at ?? null);
      });
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    loadAnalytics(restaurantId)
      .then((d) => setData(d))
      .catch((e) => {
        console.error("[analytics] load error", e);
        toast.error("فشل تحميل التحليلات");
        setData({
          kpis: {
            ordersToday: 0,
            salesToday: 0,
            avgOrderWeek: 0,
            salesMonth: 0,
            ordersTodayPrev: 0,
            salesTodayPrev: 0,
            avgOrderWeekPrev: 0,
            salesMonthPrev: 0,
          },
          daily: [],
          topItems: [],
          bottomItems: [],
          hourly: [],
        });
      })
      .finally(() => setLoading(false));
  }, [restaurantId]);

  if (rLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-muted animate-pulse" />
        <div className="h-72 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const hasAnyData =
    data.kpis.salesMonth > 0 ||
    data.kpis.salesToday > 0 ||
    data.kpis.ordersToday > 0 ||
    data.daily.some((d) => d.total > 0);

  if (!hasAnyData) {
    return (
      <div className="relative rounded-2xl border bg-background p-12 text-center overflow-hidden">
        <AnimatedBackground />
        <div className="relative">
          <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">لم تبدأ المبيعات بعد</p>
        </div>
      </div>
    );
  }

  const dailyChart = data.daily.map((d) => ({
    label: d.date.slice(5),
    total: d.total,
  }));

  // Shared decorative trend used across KPI sparklines (last 7 of the 30-day series).
  const sparkTrend = data.daily.slice(-7).map((d) => d.total);

  const maxTopQty = data.topItems[0]?.qty ?? 0;

  const handleExport = (kind: "pdf" | "excel") => {
    const payload = {
      restaurantName,
      kpis: {
        ordersToday: data.kpis.ordersToday,
        salesToday: data.kpis.salesToday,
        avgOrderWeek: data.kpis.avgOrderWeek,
        salesMonth: data.kpis.salesMonth,
      },
      daily: data.daily,
      topItems: data.topItems.map((i) => ({ name: i.name, qty: i.qty, revenue: i.revenue })),
      bottomItems: data.bottomItems.map((i) => ({ name: i.name, qty: i.qty, revenue: i.revenue })),
    };
    try {
      if (kind === "pdf") exportAnalyticsPDF(payload);
      else exportAnalyticsExcel(payload);
      toast.success(kind === "pdf" ? "تم تصدير PDF" : "تم تصدير Excel");
    } catch (e) {
      console.error(e);
      toast.error("فشل التصدير");
    }
  };

  return (
    <div className="relative">
      <AnimatedBackground />
      <div className="relative space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-end gap-2 flex-wrap"
        >
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("excel")} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} className="gap-2">
              <FileText className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ perspective: 1200 }}>
          <KpiCard
            title="طلبات اليوم"
            value={data.kpis.ordersToday}
            prev={data.kpis.ordersTodayPrev}
            format={(n) => String(n)}
            Icon={ShoppingBag}
            trend={sparkTrend}
            index={0}
          />
          <KpiCard
            title="مبيعات اليوم"
            value={data.kpis.salesToday}
            prev={data.kpis.salesTodayPrev}
            format={formatDZD}
            Icon={DollarSign}
            trend={sparkTrend}
            index={1}
          />
          <KpiCard
            title="متوسط قيمة الطلب (الأسبوع)"
            value={Math.round(data.kpis.avgOrderWeek)}
            prev={Math.round(data.kpis.avgOrderWeekPrev)}
            format={formatDZD}
            Icon={Receipt}
            trend={sparkTrend}
            index={2}
          />
          <KpiCard
            title="مبيعات هذا الشهر"
            value={data.kpis.salesMonth}
            prev={data.kpis.salesMonthPrev}
            format={formatDZD}
            Icon={TrendingUp}
            trend={sparkTrend}
            index={3}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
          className="rounded-2xl glass-card hover-lift p-6"
        >
          <SectionHeader
            icon={TrendingUp}
            title="المبيعات اليومية"
            subtitle="آخر 30 يوم"
          />
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChart}>
                <defs>
                  <linearGradient id="areaGradSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...recessiveGridProps} />
                <XAxis
                  dataKey="label"
                  tick={axisTickProps}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={axisTickProps} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  cursor={{ stroke: "var(--primary)", strokeOpacity: 0.25, strokeWidth: 2 }}
                  content={
                    <ChartTooltip
                      labelPrefix="التاريخ: "
                      valueLabel="المبيعات"
                      valueFormatter={formatDZD}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#areaGradSales)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  isAnimationActive
                  animationDuration={1100}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <RevenueRangeCard
          restaurantId={restaurantId!}
          restaurantCreatedAt={restaurantCreatedAt}
        />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
          className="rounded-2xl glass-card hover-lift p-6"
        >
          <SectionHeader
            icon={Flame}
            title="الأصناف الأكثر طلباً"
            subtitle="هذا الشهر"
          />
          {data.topItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد بيانات بعد</p>
          ) : (
            <div className="space-y-3">
              {data.topItems.map((it, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: idx * 0.03 }}
                  className="flex items-center gap-3"
                >
                  {it.image_url ? (
                    <img
                      src={it.image_url}
                      alt={it.name}
                      className="w-10 h-10 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-medium truncate">{it.name}</div>
                      <div className="text-sm text-muted-foreground shrink-0">
                        {it.qty}× · {formatDZD(it.revenue)}
                      </div>
                    </div>
                    <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{
                          width: `${maxTopQty ? (it.qty / maxTopQty) * 100 : 0}%`,
                        }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: idx * 0.03, ease: [0.2, 0.7, 0.2, 1] }}
                        className="h-full bg-gradient-primary rounded-full"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
          className="rounded-2xl glass-card hover-lift p-6"
        >
          <SectionHeader
            icon={Snowflake}
            title="الأصناف الأقل طلباً"
            subtitle="فكر في تحسين هذه الأصناف أو إزالتها"
          />
          {data.bottomItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد بيانات بعد</p>
          ) : (
            <div className="space-y-2">
              {data.bottomItems.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {it.image_url ? (
                      <img
                        src={it.image_url}
                        alt={it.name}
                        className="w-8 h-8 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-muted" />
                    )}
                    <span className="text-sm font-medium">{it.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {it.qty}× · {formatDZD(it.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
          className="rounded-2xl glass-card hover-lift p-6"
        >
          <SectionHeader icon={Clock} title="ساعات الذروة" subtitle="هذا الأسبوع" />
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hourly}>
                <defs>
                  <linearGradient id="barGradHourly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...recessiveGridProps} />
                <XAxis
                  dataKey="hour"
                  tick={axisTickProps}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(h) => `${h}:00`}
                />
                <YAxis
                  tick={axisTickProps}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={30}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  content={
                    <ChartTooltip
                      labelFormatter={(h) => `الساعة ${h}:00`}
                      valueLabel="طلبات"
                      valueFormatter={(v) => `${Math.round(v)}`}
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  fill="url(#barGradHourly)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
