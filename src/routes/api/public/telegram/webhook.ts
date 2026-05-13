import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { dispatchTelegramUpdate } from "@/server/telegram-handlers.server";

function deriveSecret(apiKey: string): string {
  return createHash("sha256")
    .update(`telegram-webhook:${apiKey}`)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
        if (!TELEGRAM_API_KEY) return new Response("Misconfigured", { status: 500 });
        const expected = deriveSecret(TELEGRAM_API_KEY);
        const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(got, expected)) return new Response("Unauthorized", { status: 401 });

        const update = (await request.json().catch(() => null)) as any;
        if (!update) return Response.json({ ok: true });
        await dispatchTelegramUpdate(update); // shared bot
        return Response.json({ ok: true });
      },
    },
  },
});