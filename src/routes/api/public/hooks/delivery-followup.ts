import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  type InlineKeyboard,
} from "@/server/telegram.server";

const FIRST_DELAY_MIN = 10;
// Retry schedule (minutes) AFTER the first followup, indexed by followup_count
// followup_count = 1 means first followup already sent → wait 3 min for retry #2
// followup_count = 2 → wait 5 min for retry #3
// followup_count = 3 → wait 5 min for retry #4 (final, then alert owner)
const RETRY_DELAYS_MIN = [3, 5, 5];
const MAX_FOLLOWUPS = 1 + RETRY_DELAYS_MIN.length; // total messages before owner alert

function constantTimeEq(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function checkCronAuth(request: Request): boolean {
  const provided =
    request.headers.get("apikey") ||
    request.headers.get("x-cron-secret") ||
    "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) return false;
  return constantTimeEq(provided, cronSecret);
}

function followupKeyboard(orderId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "✅ نعم، تم الدفع", callback_data: `paid:${orderId}` },
        { text: "⏳ لسه", callback_data: `pending:${orderId}` },
      ],
    ],
  };
}

export const Route = createFileRoute("/api/public/hooks/delivery-followup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!checkCronAuth(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const nowMs = Date.now();
        const firstThreshold = new Date(nowMs - FIRST_DELAY_MIN * 60_000).toISOString();

        // Pending assignments: confirmed_at IS NULL
        const { data: rows, error } = await supabaseAdmin
          .from("delivery_assignments")
          .select("order_id, restaurant_id, driver_chat_id, claimed_at, last_followup_at, followup_count, owner_alerted")
          .is("confirmed_at", null);

        if (error) {
          console.error("[delivery-followup]", error);
          return new Response("error", { status: 500 });
        }

        let processed = 0;
        for (const r of rows ?? []) {
          const claimedAt = r.claimed_at as string;
          const last = r.last_followup_at as string | null;
          const count = (r.followup_count as number) ?? 0;

          const dueForFirst = !last && claimedAt <= firstThreshold;
          // Pick retry delay based on how many followups already sent (count >= 1)
          const retryDelayMin =
            count >= 1 && count <= RETRY_DELAYS_MIN.length
              ? RETRY_DELAYS_MIN[count - 1]
              : RETRY_DELAYS_MIN[RETRY_DELAYS_MIN.length - 1];
          const retryThreshold = new Date(nowMs - retryDelayMin * 60_000).toISOString();
          const dueForRetry = !!last && last <= retryThreshold && count < MAX_FOLLOWUPS;
          const dueForOwnerAlert =
            !!last && count >= MAX_FOLLOWUPS && !r.owner_alerted && last <= retryThreshold;

          if (!dueForFirst && !dueForRetry && !dueForOwnerAlert) continue;

          const orderId = r.order_id as string;
          const orderNum = orderId.replace(/-/g, "").slice(-6).toUpperCase();

        // Look up restaurant's custom bot token (if any)
        const { data: restRow } = await supabaseAdmin
          .from("restaurants")
          .select("telegram_bot_token")
          .eq("id", r.restaurant_id)
          .maybeSingle();
        const botToken = (restRow as any)?.telegram_bot_token as string | null;

          if (dueForFirst || dueForRetry) {
            const driverChatId = Number(r.driver_chat_id);
            const text =
              count === 0
                ? `🔔 طلب #${orderNum}\nمضت ${FIRST_DELAY_MIN} دقائق منذ استلامك للطلب.\nهل تم تسليمه وتحصيل المبلغ؟`
                : `🔔 تذكير (${count + 1}) — طلب #${orderNum}\nهل تم تسليم الطلب وتحصيل المبلغ؟`;
            try {
              const sent = await sendTelegramMessageWithKeyboard(
                driverChatId,
                text,
                followupKeyboard(orderId),
              { botToken },
              );
              await supabaseAdmin.from("order_telegram_messages").insert({
                order_id: orderId,
                chat_id: driverChatId,
                message_id: sent.message_id,
                kind: "followup",
              });
              await supabaseAdmin
                .from("delivery_assignments")
                .update({
                  last_followup_at: new Date().toISOString(),
                  followup_count: count + 1,
                })
                .eq("order_id", orderId);
              processed++;
            } catch (err) {
              console.error("[delivery-followup send]", err);
            }
          } else if (dueForOwnerAlert) {
            // Alert owner
            const { data: rest } = await supabaseAdmin
              .from("restaurants")
              .select("telegram_chat_id, name")
              .eq("id", r.restaurant_id)
              .maybeSingle();
            if (rest?.telegram_chat_id) {
              try {
                await sendTelegramMessage(
                  Number(rest.telegram_chat_id),
                  `⚠️ <b>تنبيه:</b> الطلب #${orderNum} لم يتم تأكيد دفعه من قبل الديلفري بعد ${MAX_FOLLOWUPS} محاولات.\nيرجى المتابعة يدوياً.`,
                { botToken },
                );
              } catch (err) {
                console.error("[owner alert]", err);
              }
            }
            // Push in-app notification (bell)
            await supabaseAdmin.from("notifications").insert({
              restaurant_id: r.restaurant_id,
              kind: "delivery_no_response",
              title: `الديلفري لم يؤكد طلب #${orderNum}`,
              body: `لم يرد على ${MAX_FOLLOWUPS} محاولات تأكيد دفع. يرجى المتابعة يدوياً.`,
              order_id: orderId,
            });
            await supabaseAdmin
              .from("delivery_assignments")
              .update({ owner_alerted: true })
              .eq("order_id", orderId);
            processed++;
          }
        }
        return Response.json({ ok: true, processed });
      },
    },
  },
});
