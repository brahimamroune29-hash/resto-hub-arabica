import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

const SESSION_WAIT_MS = 4000;

export function getAuthSessionWaitMs() {
  if (typeof window === "undefined") return SESSION_WAIT_MS;
  const callbackPayload = `${window.location.search}${window.location.hash}`;
  return /(access_token|refresh_token|code=|state=|type=|error=)/.test(callbackPayload)
    ? 6000
    : 1200;
}

/** Wait briefly for OAuth redirects to finish hydrating the browser session. */
export async function waitForAuthSession(timeoutMs = SESSION_WAIT_MS): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (session: Session | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      subscription.unsubscribe();
      resolve(session);
    };

    const { data: subscriptionData } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session);
    });
    const subscription = subscriptionData.subscription;

    const timer = window.setTimeout(async () => {
      const { data: latest } = await supabase.auth.getSession();
      finish(latest.session ?? null);
    }, timeoutMs);
  });
}

/** Translate common Supabase auth errors to Arabic. */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (m.includes("already registered") || m.includes("user already"))
    return "هذا البريد الإلكتروني مستخدم بالفعل";
  if (m.includes("password") && m.includes("6")) return "كلمة المرور قصيرة جداً (6 أحرف على الأقل)";
  if (m.includes("password")) return "كلمة المرور غير صالحة";
  if (m.includes("rate") || m.includes("too many")) return "محاولات كثيرة، حاول لاحقاً";
  if (m.includes("sending") || m.includes("confirmation email"))
    return "تعذّر إرسال بريد التأكيد، حاول مرة أخرى بعد قليل";
  if (m.includes("email signups") || m.includes("signup") || m.includes("sign up") || m.includes("not enabled"))
    return "التسجيل مغلق مؤقتاً، تواصل مع المسؤول";
  if (m.includes("not authorized") || m.includes("not allowed"))
    return "هذا البريد الإلكتروني غير مصرح له بالتسجيل";
  if (m.includes("email")) return "البريد الإلكتروني غير صالح";
  return `حدث خطأ: ${message}`;
}

/** Decide where to send a freshly-authenticated user. */
export async function getPostAuthRedirect(userId: string): Promise<"/setup" | "/dashboard" | "/ops"> {
  // Check if user owns a restaurant
  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("setup_completed")
    .eq("owner_id", userId)
    .limit(1);

  if (restaurants && restaurants.length > 0) {
    return restaurants[0].setup_completed ? "/dashboard" : "/setup";
  }

  // Not an owner — check if they are a staff member
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1);

  if (roles && roles.length > 0) {
    // Staff members go to ops panel
    return "/ops";
  }

  return "/setup";
}

/** Use inside `beforeLoad` of protected routes. */
export async function requireAuth() {
  // Skip on server — session lives in browser localStorage.
  // Otherwise SSR has no session and would redirect signed-in users to /login on refresh.
  if (typeof window === "undefined") return {};
  const session = await waitForAuthSession();
  if (!session) {
    throw redirect({ to: "/login" });
  }
  return { userId: session.user.id };
}

/** Use inside `beforeLoad` of /login and /signup to bounce already-signed-in users. */
export async function redirectIfAuthed() {
  if (typeof window === "undefined") return;
  const session = await waitForAuthSession(getAuthSessionWaitMs());
  if (session) {
    const to = await getPostAuthRedirect(session.user.id);
    throw redirect({ to } as { to: "/setup" | "/dashboard" | "/ops" });
  }
}