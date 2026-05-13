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
  if (m.includes("email")) return "البريد الإلكتروني غير صالح";
  if (m.includes("rate")) return "محاولات كثيرة، حاول لاحقاً";
  return "حدث خطأ، حاول مرة أخرى";
}

/** Decide where to send a freshly-authenticated user. */
export async function getPostAuthRedirect(userId: string): Promise<"/setup" | "/dashboard"> {
  // First, auto-accept any pending staff invitations for this user's email
  try {
    const { data: u } = await supabase.auth.getUser();
    const email = u.user?.email?.toLowerCase();
    if (email) {
      const { data: pending } = await supabase
        .from("staff_invitations")
        .select("id, restaurant_id, role")
        .eq("email", email)
        .eq("accepted", false);
      if (pending && pending.length) {
        for (const inv of pending) {
          await supabase.from("user_roles").insert({
            user_id: userId,
            restaurant_id: inv.restaurant_id,
            role: inv.role,
          });
          await supabase.from("staff_invitations").update({ accepted: true }).eq("id", inv.id);
        }
      }
    }
  } catch {
    // ignore
  }

  const { data } = await supabase
    .from("restaurants")
    .select("setup_completed")
    .eq("owner_id", userId)
    .limit(1);
  if (data && data.length > 0 && data[0].setup_completed) return "/dashboard";
  // If user has no restaurant of their own, but is staff somewhere → dashboard
  const { data: roles } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (roles && roles.length) return "/dashboard";
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
    throw redirect({ to });
  }
}