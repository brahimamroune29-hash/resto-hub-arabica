import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS, fr as frLocale } from "date-fns/locale";
import type { Locale } from "date-fns";
import { Star, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/dashboard/reviews")({
  component: Page,
});

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  redirected_to_google: boolean;
  created_at: string;
  order_id: string;
  table_number?: number | null;
};

type Filter = "all" | "positive" | "negative";
const PAGE_SIZE = 20;

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={
            i <= value
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/60"
          }
        />
      ))}
    </div>
  );
}

function Page() {
  const { t, i18n } = useTranslation();
  const base = (i18n.language || "ar").split("-")[0];
  const locale: Locale = base === "en" ? enUS : base === "fr" ? frLocale : ar;
  const { restaurantId, loading: rLoading } = useRestaurantId();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  async function fetchPage(rid: string, p: number, replace: boolean) {
    setLoading(true);
    const from = (p - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("reviews")
      .select("id, rating, comment, redirected_to_google, created_at, order_id")
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      toast.error(t("reviews.loadFailed"));
      setLoading(false);
      return;
    }
    const orderIds = (data ?? []).map((r) => r.order_id);
    let tableMap = new Map<string, number>();
    if (orderIds.length) {
      const { data: ords } = await supabase
        .from("orders")
        .select("id, table_id")
        .in("id", orderIds);
      const tIds = Array.from(new Set((ords ?? []).map((o) => o.table_id).filter(Boolean) as string[]));
      let tNumByTid = new Map<string, number>();
      if (tIds.length) {
        const { data: tbls } = await supabase
          .from("tables")
          .select("id, table_number")
          .in("id", tIds);
        tNumByTid = new Map((tbls ?? []).map((t) => [t.id, t.table_number]));
      }
      tableMap = new Map(
        (ords ?? []).map((o) => [o.id, tNumByTid.get(o.table_id ?? "") ?? 0])
      );
    }
    const mapped: Review[] = (data ?? []).map((r) => ({
      ...r,
      table_number: tableMap.get(r.order_id) ?? null,
    }));
    setReviews((prev) => (replace ? mapped : [...prev, ...mapped]));
    setHasMore((data ?? []).length === PAGE_SIZE);
    setLoading(false);
  }

  useEffect(() => {
    if (!restaurantId) return;
    setPage(1);
    fetchPage(restaurantId, 1, true);
  }, [restaurantId]);

  // Realtime
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`reviews-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reviews",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          const r = payload.new as Review;
          // Try to fetch table_number
          let tn: number | null = null;
          const { data: ord } = await supabase
            .from("orders")
            .select("table_id")
            .eq("id", r.order_id)
            .maybeSingle();
          if (ord?.table_id) {
            const { data: t } = await supabase
              .from("tables")
              .select("table_number")
              .eq("id", ord.table_id)
              .maybeSingle();
            tn = t?.table_number ?? null;
          }
          setReviews((prev) => [{ ...r, table_number: tn }, ...prev]);
          if (r.rating >= 4) toast.success(t("reviews.newPositive"));
          else toast.warning(t("reviews.newNegative"));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurantId]);

  const filtered = useMemo(() => {
    if (filter === "positive") return reviews.filter((r) => r.rating >= 4);
    if (filter === "negative") return reviews.filter((r) => r.rating < 4);
    return reviews;
  }, [reviews, filter]);

  const stats = useMemo(() => {
    if (!reviews.length) return { avg: 0, total: 0, conv: 0 };
    const sum = reviews.reduce((a, r) => a + r.rating, 0);
    const positives = reviews.filter((r) => r.rating >= 4).length;
    const redirected = reviews.filter((r) => r.redirected_to_google).length;
    return {
      avg: sum / reviews.length,
      total: reviews.length,
      conv: positives ? Math.round((redirected / positives) * 100) : 0,
    };
  }, [reviews]);

  const counts = useMemo(
    () => ({
      all: reviews.length,
      positive: reviews.filter((r) => r.rating >= 4).length,
      negative: reviews.filter((r) => r.rating < 4).length,
    }),
    [reviews]
  );

  if (rLoading || (loading && reviews.length === 0)) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl glass-card hover-lift p-6">
          <div className="text-sm font-medium text-muted-foreground mb-3">{t("reviews.avg")}</div>
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold text-foreground">{stats.avg.toFixed(1)}</div>
            <Stars value={Math.round(stats.avg)} size={20} />
          </div>
        </div>
        <div className="rounded-2xl glass-card hover-lift p-6">
          <div className="text-sm font-medium text-muted-foreground mb-3">{t("reviews.count")}</div>
          <div className="text-3xl font-bold text-foreground">{stats.total}</div>
        </div>
        <div className="rounded-2xl glass-card hover-lift p-6">
          <div className="text-sm font-medium text-muted-foreground mb-3">{t("reviews.googleRate")}</div>
          <div className="text-3xl font-bold text-foreground">{stats.conv}%</div>
          <div className="text-xs text-muted-foreground mt-1">{t("reviews.googleHint")}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "all", label: t("reviews.all"), c: counts.all },
          { key: "positive", label: t("reviews.positive"), c: counts.positive },
          { key: "negative", label: t("reviews.negative"), c: counts.negative },
        ] as { key: Filter; label: string; c: number }[]).map((b) => (
          <button
            key={b.key}
            onClick={() => setFilter(b.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition border ${
              filter === b.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            {b.label}
            <span className={`mr-2 inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-xs ${filter === b.key ? "bg-foreground/10" : "bg-muted text-muted-foreground"}`}>
              {b.c}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border bg-background p-12 text-center">
          <Star className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("reviews.empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((r) => {
              const positive = r.rating >= 4;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`rounded-2xl bg-card border border-border p-5 border-r-4 transition hover:shadow-sm ${
                    positive ? "border-r-emerald-500" : "border-r-amber-500"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <Stars value={r.rating} size={20} />
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        r.redirected_to_google
                          ? "bg-green-100 text-green-700"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {r.redirected_to_google ? t("reviews.sentToGoogle") : t("reviews.internalOnly")}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {r.table_number ? `${t("common.table")} ${r.table_number}` : "—"} ·{" "}
                    {formatDistanceToNow(new Date(r.created_at), {
                      addSuffix: true,
                      locale,
                    })}
                  </div>
                  {r.comment ? (
                    <div className="flex gap-2 italic text-foreground">
                      <MessageSquareQuote className="w-4 h-4 shrink-0 mt-1 text-muted-foreground" />
                      <p>{r.comment}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("common.noComment")}</p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => {
                  if (!restaurantId) return;
                  const next = page + 1;
                  setPage(next);
                  fetchPage(restaurantId, next, false);
                }}
              >
                {loading ? t("common.loading") : t("common.loadMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
