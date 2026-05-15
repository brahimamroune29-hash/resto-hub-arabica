import { createFileRoute } from "@tanstack/react-router";
import { runDailySummaryForAll } from "@/server/daily-summary.server";

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
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  return constantTimeEq(provided, cronSecret) || constantTimeEq(provided, anonKey);
}

export const Route = createFileRoute("/api/public/hooks/daily-summary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!checkCronAuth(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const res = await runDailySummaryForAll();
          return Response.json({ ok: true, ...res });
        } catch (err) {
          console.error("[daily-summary hook]", err);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});