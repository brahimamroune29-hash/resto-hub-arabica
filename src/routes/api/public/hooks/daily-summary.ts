import { createFileRoute } from "@tanstack/react-router";
import { runDailySummaryForAll } from "@/server/daily-summary.server";

function checkCronAuth(request: Request): boolean {
  const expected = process.env.CRON_SECRET || "";
  if (!expected) return false;
  const provided =
    request.headers.get("apikey") ||
    request.headers.get("x-cron-secret") ||
    "";
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
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