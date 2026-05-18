import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTelegramMessage } from "./telegram.server";

function fmtMoney(n: number) {
  return new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 0 }).format(n);
}

function businessDayBounds(): { startUtc: string; endUtc: string; dayKey: string } {
  // Business day = (now in Africa/Algiers - 6h)::date.
  // Window: [dayKey 06:00 Algiers, dayKey+1 06:00 Algiers).
  // Africa/Algiers is UTC+1 (no DST). 06:00 Algiers = 05:00 UTC.
  const now = new Date();
  const algiers = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const shifted = new Date(algiers.getTime() - 6 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const dayKey = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  // 06:00 Algiers == 05:00 UTC of dayKey
  const startUtc = new Date(Date.UTC(y, m, d, 5, 0, 0)).toISOString();
  const endUtc = new Date(Date.UTC(y, m, d + 1, 5, 0, 0)).toISOString();
  return { startUtc, endUtc, dayKey };
}

type Stats = {
  dayKey: string;
  totalRevenue: number;
  totalOrders: number;
  byType: { dine_in: number; delivery: number; takeaway: number };
  topItems: { name: string; qty: number }[];
  bottomItems: { name: string; qty: number }[];
  avgTicket: number;
  cancelled: number;
};

async function computeStats(restaurantId: string): Promise<Stats> {
  const { startUtc, endUtc, dayKey } = businessDayBounds();

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, total, order_type, status")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", startUtc)
    .lt("created_at", endUtc);

  const list = orders ?? [];
  const completed = list.filter((o) => (o.status as string) !== "cancelled");
  const cancelled = list.length - completed.length;
  const totalRevenue = completed.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const byType = { dine_in: 0, delivery: 0, takeaway: 0 };
  for (const o of completed) {
    const t = (o.order_type as keyof typeof byType) ?? "dine_in";
    if (t in byType) byType[t]++;
  }

  // Items
  const orderIds = completed.map((o) => o.id as string);
  const itemMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("name_snapshot, quantity, order_id")
      .in("order_id", orderIds);
    for (const it of items ?? []) {
      const name = (it.name_snapshot as string) ?? "—";
      itemMap.set(name, (itemMap.get(name) ?? 0) + Number(it.quantity ?? 0));
    }
  }
  const sorted = [...itemMap.entries()].sort((a, b) => b[1] - a[1]);
  const topItems = sorted.slice(0, 3).map(([name, qty]) => ({ name, qty }));
  const bottomItems = sorted.slice(-3).reverse().map(([name, qty]) => ({ name, qty }));

  return {
    dayKey,
    totalRevenue,
    totalOrders: completed.length,
    byType,
    topItems,
    bottomItems,
    avgTicket: completed.length ? totalRevenue / completed.length : 0,
    cancelled,
  };
}

async function generateTips(stats: Stats, restaurantName: string): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackTips(stats);
  try {
    const prompt = `أنت مستشار مطاعم. حلّل ملخص يوم ${stats.dayKey} لمطعم "${restaurantName}" وأعطِ من 3 إلى 4 نقاط قصيرة جداً (سطر لكل نقطة، بدون أرقام أو رموز نقطية): تنبيهات مهمة + اقتراح تطوير عملي. كن مباشراً ومحدداً.

الإيرادات: ${fmtMoney(stats.totalRevenue)} دج
عدد الطلبات: ${stats.totalOrders} (صالة: ${stats.byType.dine_in} | توصيل: ${stats.byType.delivery} | سريع: ${stats.byType.takeaway})
متوسط الفاتورة: ${fmtMoney(stats.avgTicket)} دج
طلبات ملغاة: ${stats.cancelled}
الأكثر مبيعاً: ${stats.topItems.map((i) => `${i.name} (${i.qty})`).join("، ") || "لا يوجد"}
الأقل مبيعاً: ${stats.bottomItems.map((i) => `${i.name} (${i.qty})`).join("، ") || "لا يوجد"}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return fallbackTips(stats);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return fallbackTips(stats);
    return text
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-•*\d.\s]+/, "").trim())
      .filter((l) => l.length > 0)
      .slice(0, 4);
  } catch (err) {
    console.error("[daily-summary tips]", err);
    return fallbackTips(stats);
  }
}

function fallbackTips(stats: Stats): string[] {
  const tips: string[] = [];
  if (stats.cancelled > 0) tips.push(`انتبه: ${stats.cancelled} طلب ملغى اليوم — راجع الأسباب.`);
  if (stats.bottomItems.length > 0)
    tips.push(`الأصناف الضعيفة (${stats.bottomItems.map((i) => i.name).join("، ")}) — فكّر بعرض ترويجي أو استبدالها.`);
  if (stats.topItems.length > 0)
    tips.push(`صنفك الأقوى "${stats.topItems[0].name}" — تأكد من توفر مكوناته دائماً.`);
  if (stats.totalOrders === 0) tips.push("لا توجد طلبات اليوم — راجع ساعات العمل والترويج.");
  return tips.length ? tips : ["يوم هادئ — استمر في تحسين القائمة وخدمة العملاء."];
}

function formatMessage(stats: Stats, restaurantName: string, tips: string[]): string {
  const lines: string[] = [];
  lines.push(`📊 <b>ملخص اليوم — ${restaurantName}</b>`);
  lines.push(`📅 ${stats.dayKey}`);
  lines.push("");
  lines.push(`💰 <b>الإيرادات:</b> ${fmtMoney(stats.totalRevenue)} دج`);
  lines.push(`🧾 <b>الطلبات:</b> ${stats.totalOrders} (متوسط ${fmtMoney(stats.avgTicket)} دج)`);
  lines.push(`   🍽️ صالة: ${stats.byType.dine_in}  |  🛵 توصيل: ${stats.byType.delivery}  |  🛍️ سريع: ${stats.byType.takeaway}`);
  if (stats.cancelled > 0) lines.push(`   ❌ ملغاة: ${stats.cancelled}`);
  lines.push("");
  if (stats.topItems.length > 0) {
    lines.push(`🔥 <b>الأكثر مبيعاً:</b>`);
    for (const i of stats.topItems) lines.push(`   • ${i.name} — ${i.qty}`);
  }
  if (stats.bottomItems.length > 0 && stats.bottomItems[0].name !== stats.topItems[0]?.name) {
    lines.push("");
    lines.push(`🥶 <b>الأقل مبيعاً:</b>`);
    for (const i of stats.bottomItems) lines.push(`   • ${i.name} — ${i.qty}`);
  }
  lines.push("");
  lines.push(`💡 <b>نقاط للانتباه والتطوير:</b>`);
  for (const t of tips) lines.push(`   • ${t}`);
  return lines.join("\n");
}

export async function sendDailySummaryFor(
  restaurantId: string,
  opts?: { skipMarkSent?: boolean },
): Promise<{ sent: boolean; reason?: string }> {
  const { data: rest } = await supabaseAdmin
    .from("restaurants")
    .select("id, name, summary_chat_id, summary_bot_token, daily_summary_enabled")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!rest) return { sent: false, reason: "restaurant not found" };
  if (!rest.summary_chat_id || !rest.summary_bot_token) {
    return { sent: false, reason: "summary bot not linked" };
  }

  const stats = await computeStats(restaurantId);
  const tips = await generateTips(stats, rest.name as string);
  const text = formatMessage(stats, rest.name as string, tips);

  await sendTelegramMessage(Number(rest.summary_chat_id), text, {
    botToken: rest.summary_bot_token as string,
  });

  if (!opts?.skipMarkSent) {
    await supabaseAdmin
      .from("restaurants")
      .update({ daily_summary_last_sent_for: stats.dayKey })
      .eq("id", restaurantId);
  }
  return { sent: true };
}

export async function runDailySummaryForAll(): Promise<{ sent: number; skipped: number; errors: number }> {
  const { dayKey } = businessDayBounds();
  const { data: rows } = await supabaseAdmin
    .from("restaurants")
    .select("id, daily_summary_last_sent_for")
    .eq("daily_summary_enabled", true)
    .not("summary_chat_id", "is", null)
    .not("summary_bot_token", "is", null);

  let sent = 0, skipped = 0, errors = 0;
  for (const r of rows ?? []) {
    if ((r.daily_summary_last_sent_for as string | null) === dayKey) {
      skipped++;
      continue;
    }
    try {
      const res = await sendDailySummaryFor(r.id as string);
      if (res.sent) sent++;
      else skipped++;
    } catch (err) {
      console.error("[daily-summary]", r.id, err);
      errors++;
    }
  }
  return { sent, skipped, errors };
}