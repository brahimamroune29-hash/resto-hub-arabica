import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ShoppingBag,
  DollarSign,
  Receipt,
  TrendingUp,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
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

function KpiCard({
  title,
  value,
  prev,
  format,
  Icon,
}: {
  title: string;
  value: number;
  prev: number;
  format: (n: number) => string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const diff = pctChange(value, prev);
  const positive = diff >= 0;
  return (
    <div className="group relative rounded-2xl glass-card hover-lift p-6 overflow-hidden">
      <div className="absolute -top-16 -left-16 w-40 h-40 rounded-full bg-gradient-primary opacity-10 blur-3xl group-hover:opacity-20 transition-opacity" />
      <div className="relative flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground text-left">{title}</span>
      </div>
      <div className="relative text-3xl md:text-4xl font-bold text-foreground mb-2 tabular-nums">{format(value)}</div>
      <div className="relative flex items-center gap-1.5 text-xs">
        <span
          className={`inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-md ${
            positive ? "text-emerald-600 bg-emerald-500/10" : "text-red-500 bg-red-500/10"
          }`}
        >
          {positive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {Math.abs(diff)}%
        </span>
        <span className="text-muted-foreground">vs الفترة السابقة</span>
      </div>
    </div>
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

  return (
    <div className="rounded-2xl glass-card p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h3 className="text-lg font-semibold text-foreground">💰 الإيرادات حسب الفترة</h3>
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
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground mb-1">{label}</div>
          <div className="text-xl font-bold text-foreground">{formatDZD(total)}</div>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground mb-1">عدد الطلبات</div>
          <div className="text-xl font-bold text-foreground">{count}</div>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground mb-1">متوسط الطلب</div>
          <div className="text-xl font-bold text-foreground">
            {formatDZD(count ? Math.round(total / count) : 0)}
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
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.68 0.18 255)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="oklch(0.70 0.18 285)" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
              <Tooltip
                formatter={(v: number) => [formatDZD(v), "المبيعات"]}
                labelFormatter={(l) => `التاريخ: ${l}`}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              />
              <Bar dataKey="total" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
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
      <div className="rounded-2xl border bg-background p-12 text-center">
        <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">لم تبدأ المبيعات بعد</p>
      </div>
    );
  }

  const dailyChart = data.daily.map((d) => ({
    label: d.date.slice(5),
    total: d.total,
  }));

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
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2 flex-wrap">
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
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="طلبات اليوم"
          value={data.kpis.ordersToday}
          prev={data.kpis.ordersTodayPrev}
          format={(n) => String(n)}
          Icon={ShoppingBag}
        />
        <KpiCard
          title="مبيعات اليوم"
          value={data.kpis.salesToday}
          prev={data.kpis.salesTodayPrev}
          format={formatDZD}
          Icon={DollarSign}
        />
        <KpiCard
          title="متوسط قيمة الطلب (الأسبوع)"
          value={Math.round(data.kpis.avgOrderWeek)}
          prev={Math.round(data.kpis.avgOrderWeekPrev)}
          format={formatDZD}
          Icon={Receipt}
        />
        <KpiCard
          title="مبيعات هذا الشهر"
          value={data.kpis.salesMonth}
          prev={data.kpis.salesMonthPrev}
          format={formatDZD}
          Icon={TrendingUp}
        />
      </div>

      <div className="rounded-2xl glass-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">📈 المبيعات اليومية (آخر 30 يوم)</h3>
        <div className="h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyChart}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.62 0.19 255)" />
                  <stop offset="100%" stopColor="oklch(0.74 0.17 290)" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
              <Tooltip
                formatter={(v: number) => [formatDZD(v), "المبيعات"]}
                labelFormatter={(l) => `التاريخ: ${l}`}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="url(#lineGrad)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <RevenueRangeCard
        restaurantId={restaurantId!}
        restaurantCreatedAt={restaurantCreatedAt}
      />

      <div className="rounded-2xl glass-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">🔥 الأصناف الأكثر طلباً (هذا الشهر)</h3>
        {data.topItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بيانات بعد</p>
        ) : (
          <div className="space-y-3">
            {data.topItems.map((it, idx) => (
              <div key={idx} className="flex items-center gap-3">
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
                    <div
                      className="h-full bg-gradient-primary rounded-full transition-all duration-500"
                      style={{
                        width: `${maxTopQty ? (it.qty / maxTopQty) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl glass-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">❄️ الأصناف الأقل طلباً (هذا الشهر)</h3>
        <p className="text-xs italic text-muted-foreground mb-4">
          فكر في تحسين هذه الأصناف أو إزالتها
        </p>
        {data.bottomItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بيانات بعد</p>
        ) : (
          <div className="space-y-2">
            {data.bottomItems.map((it, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
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
      </div>

      <div className="rounded-2xl glass-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">⏰ ساعات الذروة (هذا الأسبوع)</h3>
        <div className="h-56" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.hourly}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.68 0.18 255)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="oklch(0.70 0.18 285)" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                tickFormatter={(h) => `${h}:00`}
              />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" allowDecimals={false} />
              <Tooltip
                formatter={(v: number) => [v, "طلبات"]}
                labelFormatter={(h) => `الساعة ${h}:00`}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              />
              <Bar dataKey="count" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
