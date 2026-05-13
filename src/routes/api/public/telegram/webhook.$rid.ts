import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchTelegramUpdate } from "@/server/telegram-handlers.server";

function deriveSecret(token: string): string {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export const Route = createFileRoute("/api/public/telegram/webhook/$rid")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const rid = params.rid;
        if (!rid) return new Response("Bad Request", { status: 400 });

        const { data: rest } = await supabaseAdmin
          .from("restaurants")
          .select("id, telegram_bot_token")
          .eq("id", rid)
          .maybeSingle();

        const botToken = (rest as any)?.telegram_bot_token as string | null | undefined;
        if (!rest || !botToken) {
          console.warn("[telegram/webhook/$rid] no bot token configured", { rid });
          return new Response("Unknown bot", { status: 404 });
        }

        const expected = deriveSecret(botToken);
        const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(got, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = (await request.json().catch(() => null)) as any;
        if (!update) return Response.json({ ok: true });
        try {
          await dispatchTelegramUpdate(update, {
            botToken,
            restaurantScopeId: rest.id as string,
          });
        } catch (err) {
          console.error("[telegram/webhook/$rid] dispatch error", err);
        }
        return Response.json({ ok: true });
      },
    },
  },
});