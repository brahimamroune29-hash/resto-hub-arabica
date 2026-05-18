import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "crypto";
import { createHash } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { _genericDbError } from "./_errors.server";
import {
  getBotUsername,
  setBotWebhook,
  deleteBotWebhook,
} from "./telegram.server";

async function getOwnerRestaurant(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("restaurants")
    .select(
      "id, telegram_chat_id, telegram_username, telegram_link_token, telegram_bot_token, telegram_bot_username",
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw _genericDbError(error);
  if (!data) throw new Error("لا يوجد مطعم");
  return data as {
    id: string;
    telegram_chat_id: number | null;
    telegram_username: string | null;
    telegram_link_token: string | null;
    telegram_bot_token: string | null;
    telegram_bot_username: string | null;
  };
}

export const getTelegramStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const r = await getOwnerRestaurant(supabase, userId);
    const usingCustomBot = !!r.telegram_bot_token;
    let botUsername = r.telegram_bot_username ?? "";
    if (!usingCustomBot) {
      try {
        botUsername = await getBotUsername();
      } catch {
        // ignore
      }
    }
    return {
      linked: !!r.telegram_chat_id,
      chatId: r.telegram_chat_id ? String(r.telegram_chat_id) : null,
      username: r.telegram_username,
      botUsername,
      usingCustomBot,
      customBotUsername: r.telegram_bot_username ?? null,
    };
  });

export const generateTelegramLinkToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const r = await getOwnerRestaurant(supabase, userId);
    const token = `lk_${randomBytes(10).toString("hex")}`;
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ telegram_link_token: token })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    const botUsername = r.telegram_bot_username ?? (await getBotUsername());
    return {
      token,
      botUsername,
      deepLink: `https://t.me/${botUsername}?start=${token}`,
    };
  });

export const unlinkTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const r = await getOwnerRestaurant(supabase, userId);
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({
        telegram_chat_id: null,
        telegram_username: null,
        telegram_link_token: null,
      })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

function deriveBotSecret(token: string) {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}

function getPublicWebhookOrigin(appOrigin: string) {
  const origin = appOrigin.replace(/\/$/, "");

  const authBridgeMatch = origin.match(
    /^https:\/\/(?:id-preview--)?([0-9a-f-]{36})\.(lovableproject\.com|lovable\.app)$/i,
  );
  if (authBridgeMatch) {
    return `https://project--${authBridgeMatch[1]}-dev.lovable.app`;
  }

  const previewMatch = origin.match(/^https:\/\/id-preview--([0-9a-f-]+)\.([^/]+)$/i);
  if (previewMatch) {
    return `https://project--${previewMatch[1]}-dev.${previewMatch[2]}`;
  }

  return origin;
}

const SetBotSchema = z.object({
  bot_token: z
    .string()
    .trim()
    .regex(/^\d{6,}:[A-Za-z0-9_-]{30,}$/, "صيغة التوكن غير صحيحة"),
  app_origin: z.string().trim().url(),
});

/**
 * Configure a per-restaurant Telegram bot (token from BotFather).
 * - Validates the token via getMe.
 * - Stores token + username.
 * - Registers the webhook on Telegram pointing to /api/public/telegram/webhook/{rid}.
 * - Clears previously linked chat ids (owner + drivers) since they belong to a different bot.
 */
export const setRestaurantBotToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetBotSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const r = await getOwnerRestaurant(supabase, userId);
    const token = data.bot_token;

    // Validate by fetching bot identity
    let username = "";
    try {
      username = await getBotUsername(token);
    } catch (err) {
      console.error("[setRestaurantBotToken] getMe failed", err);
      throw new Error("التوكن غير صالح أو البوت غير متاح");
    }

    // Telegram can't reach auth-bridged preview hosts. Rewrite preview origins
    // to the stable public project URL so webhook delivery is not redirected.
    const origin = getPublicWebhookOrigin(data.app_origin);
    const webhookUrl = `${origin}/api/public/telegram/webhook/${r.id}`;
    const secret = deriveBotSecret(token);

    // If previous custom token exists and differs, try to clear its webhook
    if (r.telegram_bot_token && r.telegram_bot_token !== token) {
      try {
        await deleteBotWebhook(r.telegram_bot_token);
      } catch {
        /* noop */
      }
    }

    // Skip webhook registration when running on localhost/HTTP (dev mode).
    // Telegram requires HTTPS; webhook will auto-register on first save after deployment.
    const isHttps = origin.startsWith("https://") && !origin.includes("localhost");
    if (isHttps) {
      try {
        await setBotWebhook(token, webhookUrl, secret);
      } catch (err) {
        console.error("[setRestaurantBotToken] setWebhook failed", err);
        throw new Error("فشل تسجيل الويبهوك على البوت. تحقق من التوكن وأعد المحاولة.");
      }
    }

    // Persist + reset previous chat ids (they belonged to the previous/shared bot)
    const { error: uErr } = await supabaseAdmin
      .from("restaurants")
      .update({
        telegram_bot_token: token,
        telegram_bot_username: username,
        telegram_chat_id: null,
        telegram_username: null,
        telegram_link_token: null,
      })
      .eq("id", r.id);
    if (uErr) throw _genericDbError(uErr);

    await supabaseAdmin
      .from("delivery_drivers")
      .update({ telegram_chat_id: null, telegram_username: null })
      .eq("restaurant_id", r.id);

    return { ok: true, botUsername: username, webhookUrl };
  });

/**
 * Remove custom bot token; revert restaurant to the shared bot.
 */
export const clearRestaurantBotToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const r = await getOwnerRestaurant(supabase, userId);
    if (r.telegram_bot_token) {
      try {
        await deleteBotWebhook(r.telegram_bot_token);
      } catch (err) {
        console.warn("[clearRestaurantBotToken] deleteWebhook failed", err);
      }
    }
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({
        telegram_bot_token: null,
        telegram_bot_username: null,
        telegram_chat_id: null,
        telegram_username: null,
      })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    await supabaseAdmin
      .from("delivery_drivers")
      .update({ telegram_chat_id: null, telegram_username: null })
      .eq("restaurant_id", r.id);
    return { ok: true };
  });