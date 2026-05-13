import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { translateAuthError } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase auto-handles the recovery token from URL hash and sets a session
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("كلمة المرور قصيرة جداً (6 أحرف على الأقل)");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(translateAuthError(error.message));
        return;
      }
      setDone(true);
      setTimeout(() => navigate({ to: "/dashboard" }), 1500);
    } catch {
      setError("حدث خطأ، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="كلمة مرور جديدة"
      subtitle="اختر كلمة مرور جديدة لحسابك"
      footer={
        <Link to="/login" className="text-primary font-semibold hover:underline">
          العودة لتسجيل الدخول
        </Link>
      }
    >
      {done ? (
        <div className="rounded-lg bg-primary/10 px-4 py-4 text-sm text-foreground text-center">
          تم تحديث كلمة المرور بنجاح. جاري التحويل...
        </div>
      ) : !ready ? (
        <div className="rounded-lg bg-muted px-4 py-4 text-sm text-muted-foreground text-center">
          جاري التحقق من الرابط...
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">كلمة المرور الجديدة</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">تأكيد كلمة المرور</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-primary-foreground font-semibold transition-transform hover:opacity-95 active:scale-[0.97] disabled:opacity-60"
          >
            {loading ? "جاري الحفظ..." : "تحديث كلمة المرور"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
