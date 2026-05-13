import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { _genericDbError } from "./_errors.server";
import { sendDailySummaryFor } from "./daily-summary.server";

async function getOwnedRestaurantId(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("restaurants")
    .select("id, daily_summary_enabled, summary_chat_id, summary_bot_token")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw _genericDbError(error);
  if (!data) throw new Error("لا يوجد مطعم");
  return data;
}

export const getDailySummaryStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await getOwnedRestaurantId(context.userId);
    return {
      enabled: !!r.daily_summary_enabled,
      telegramLinked: !!r.summary_chat_id && !!r.summary_bot_token,
    };
  });

export const setDailySummaryEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await getOwnedRestaurantId(context.userId);
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ daily_summary_enabled: data.enabled })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true, enabled: data.enabled };
  });

export const sendDailySummaryNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await getOwnedRestaurantId(context.userId);
    if (!r.summary_chat_id || !r.summary_bot_token) {
      throw new Error("أضف بوت الملخص واربط حسابك أولاً");
    }
    const res = await sendDailySummaryFor(r.id as string, { skipMarkSent: true });
    if (!res.sent) throw new Error(res.reason ?? "تعذر الإرسال");
    return { ok: true };
  });