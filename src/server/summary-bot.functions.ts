import { createServerFn } from "@tanstack/react-start";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { _genericDbError } from "./_errors.server";
import {
  getBotUsername,
  setBotWebhook,
  deleteBotWebhook,
} from "./telegram.server";

function deriveBotSecret(token: string) {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}

/**
 * Telegram يحتاج URL ثابت لا يمر عبر auth.
 * id-preview--<id>.<host>  ->  project--<id>-dev.<host>
 * <id>.lovableproject.com     ->  project--<id>-dev.lovable.app
 * أي رابط آخر (نطاق منشور أو مخصص) يُترك كما هو.
 */
function normalizePublicOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    const m = u.hostname.match(/^id-preview--([^.]+)\.(.+)$/);
    if (m) {
      u.hostname = `project--${m[1]}-dev.${m[2]}`;
    } else {
      const lovableProject = u.hostname.match(/^([0-9a-f-]{36})\.lovableproject\.com$/i);
      if (lovableProject) {
        u.hostname = `project--${lovableProject[1]}-dev.lovable.app`;
      }
    }
    return `${u.protocol}//${u.hostname}`.replace(/\/$/, "");
  } catch {
    return origin.replace(/\/$/, "");
  }
}

async function getOwnerRestaurant(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("restaurants")
    .select("id, summary_bot_token, summary_bot_username, summary_chat_id, summary_username, summary_link_token")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw _genericDbError(error);
  if (!data) throw new Error("لا يوجد مطعم");
  return data as {
    id: string;
    summary_bot_token: string | null;
    summary_bot_username: string | null;
    summary_chat_id: number | null;
    summary_username: string | null;
    summary_link_token: string | null;
  };
}

export const getSummaryBotStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await getOwnerRestaurant(context.userId);
    return {
      botConfigured: !!r.summary_bot_token,
      botUsername: r.summary_bot_username,
      linked: !!r.summary_chat_id,
      username: r.summary_username,
    };
  });

const SetBotSchema = z.object({
  bot_token: z
    .string()
    .trim()
    .regex(/^\d{6,}:[A-Za-z0-9_-]{30,}$/, "صيغة التوكن غير صحيحة"),
  app_origin: z.string().trim().url(),
});

export const setSummaryBotToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetBotSchema.parse(d))
  .handler(async ({ data, context }) => {
    const r = await getOwnerRestaurant(context.userId);
    const token = data.bot_token;

    let username = "";
    try {
      username = await getBotUsername(token);
    } catch (err) {
      console.error("[setSummaryBotToken] getMe failed", err);
      throw new Error("التوكن غير صالح أو البوت غير متاح");
    }

    const origin = data.app_origin.replace(/\/$/, "");
    const publicOrigin = normalizePublicOrigin(origin);
    const webhookUrl = `${publicOrigin}/api/public/telegram/summary-webhook/${r.id}`;
    const secret = deriveBotSecret(token);

    if (r.summary_bot_token && r.summary_bot_token !== token) {
      try {
        await deleteBotWebhook(r.summary_bot_token);
      } catch {
        /* noop */
      }
    }

    try {
      await setBotWebhook(token, webhookUrl, secret);
    } catch (err) {
      console.error("[setSummaryBotToken] setWebhook failed", err);
      throw new Error("فشل تسجيل الويبهوك على البوت. تحقق من التوكن وأعد المحاولة.");
    }

    const { error: uErr } = await supabaseAdmin
      .from("restaurants")
      .update({
        summary_bot_token: token,
        summary_bot_username: username,
        summary_chat_id: null,
        summary_username: null,
        summary_link_token: null,
      })
      .eq("id", r.id);
    if (uErr) throw _genericDbError(uErr);

    return { ok: true, botUsername: username };
  });

export const clearSummaryBotToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await getOwnerRestaurant(context.userId);
    if (r.summary_bot_token) {
      try {
        await deleteBotWebhook(r.summary_bot_token);
      } catch (err) {
        console.warn("[clearSummaryBotToken] deleteWebhook failed", err);
      }
    }
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({
        summary_bot_token: null,
        summary_bot_username: null,
        summary_chat_id: null,
        summary_username: null,
        summary_link_token: null,
      })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

export const generateSummaryLinkToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ app_origin: z.string().trim().url().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const r = await getOwnerRestaurant(context.userId);
    if (!r.summary_bot_token || !r.summary_bot_username) {
      throw new Error("أضف توكن البوت أولاً");
    }
    // إعادة تسجيل الويبهوك على رابط عام ثابت (يُصلح حالات تسجيله سابقاً على id-preview)
    if (data?.app_origin) {
      try {
        const publicOrigin = normalizePublicOrigin(data.app_origin);
        const webhookUrl = `${publicOrigin}/api/public/telegram/summary-webhook/${r.id}`;
        const secret = deriveBotSecret(r.summary_bot_token);
        await setBotWebhook(r.summary_bot_token, webhookUrl, secret);
      } catch (err) {
        console.warn("[generateSummaryLinkToken] re-register webhook failed", err);
      }
    }
    const token = `sum_${randomBytes(10).toString("hex")}`;
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ summary_link_token: token })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return {
      token,
      botUsername: r.summary_bot_username,
      deepLink: `https://t.me/${r.summary_bot_username}?start=${token}`,
    };
  });

export const unlinkSummaryTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await getOwnerRestaurant(context.userId);
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({
        summary_chat_id: null,
        summary_username: null,
        summary_link_token: null,
      })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });