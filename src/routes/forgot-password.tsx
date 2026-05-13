import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { redirectIfAuthed, translateAuthError } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: redirectIfAuthed,
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(translateAuthError(error.message));
        return;
      }
      setSent(true);
    } catch {
      setError("حدث خطأ، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="استعادة كلمة المرور"
      subtitle="أدخل بريدك الإلكتروني لإرسال رابط إعادة التعيين"
      footer={
        <>
          تذكرت كلمة المرور؟{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            تسجيل الدخول
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-lg bg-primary/10 px-4 py-4 text-sm text-foreground text-center">
          تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني. تحقّق من صندوق الوارد.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">البريد الإلكتروني</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {loading ? "جاري الإرسال..." : "إرسال الرابط"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
