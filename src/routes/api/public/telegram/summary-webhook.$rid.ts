import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTelegramMessage } from "@/server/telegram.server";

function deriveSecret(token: string): string {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

function extractToken(text: string): string | null {
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+/);
  if (/^\/start(?:@\w+)?$/i.test(parts[0]) && parts[1]) return parts[1].trim();
  if (/^sum_[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

function isPlainStart(text: string): boolean {
  return /^\/start(?:@\w+)?$/i.test(text.trim());
}

export const Route = createFileRoute("/api/public/telegram/summary-webhook/$rid")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const rid = params.rid;
        if (!rid) return new Response("Bad Request", { status: 400 });

        const { data: rest } = await supabaseAdmin
          .from("restaurants")
          .select("id, name, summary_bot_token, summary_link_token")
          .eq("id", rid)
          .maybeSingle();

        const botToken = (rest as any)?.summary_bot_token as string | null | undefined;
        if (!rest || !botToken) {
          return new Response("Unknown bot", { status: 404 });
        }

        const expected = deriveSecret(botToken);
        const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(got, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = (await request.json().catch(() => null)) as any;
        if (!update) return Response.json({ ok: true });

        const msg = update.message ?? update.edited_message;
        const chatId = msg?.chat?.id;
        const text: string = msg?.text?.trim() ?? "";
        if (!chatId) return Response.json({ ok: true });

        const token = extractToken(text) ?? (isPlainStart(text) ? ((rest as any).summary_link_token as string | null) : null);
        const username = msg.from?.username ?? msg.from?.first_name ?? "Unknown";

        if (token && token === (rest as any).summary_link_token) {
          await supabaseAdmin
            .from("restaurants")
            .update({
              summary_chat_id: chatId,
              summary_username: username,
              summary_link_token: null,
            })
            .eq("id", rest.id);
          await sendTelegramMessage(
            chatId,
            `✅ تم الربط بنجاح مع <b>${(rest as any).name}</b>!\n\nسيصلك ملخص اليوم تلقائياً كل ليلة على هذا البوت.`,
            { botToken },
          );
        } else if (token) {
          await sendTelegramMessage(
            chatId,
            `❌ رابط الربط غير صالح أو منتهي.\n\nالكود: <code>${token}</code>\n\nولّد رابطاً جديداً من إعدادات الملخص اليومي.`,
            { botToken },
          );
        } else if (text) {
          await sendTelegramMessage(
            chatId,
            "📊 هذا البوت يرسل ملخص اليوم تلقائياً. لربط حسابك استخدم الرابط من إعدادات المطعم.",
            { botToken },
          );
        }
        return Response.json({ ok: true });
      },
    },
  },
});