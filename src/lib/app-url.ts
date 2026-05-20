/**
 * Returns the app's public base URL.
 * Priority: VITE_APP_URL (set in Vercel env vars) → window.location.origin fallback.
 * Set VITE_APP_URL=https://www.sahldz.com in Vercel project settings to lock QR codes
 * to the custom domain (avoids Vercel's internal *.vercel.app URL appearing in QR codes).
 */
export function appOrigin(): string {
  const env = import.meta.env.VITE_APP_URL as string | undefined;
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
