/**
 * Returns the app's public base URL.
 * On the browser: always uses window.location.origin so QR codes and links
 * always reflect the actual domain the user is on (works with any custom domain).
 * On the server (SSR): falls back to VITE_APP_URL env var.
 */
export function appOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  const env = import.meta.env.VITE_APP_URL as string | undefined;
  if (env) return env.replace(/\/$/, "");
  return "";
}
