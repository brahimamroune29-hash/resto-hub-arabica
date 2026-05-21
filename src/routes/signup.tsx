import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AuthShell } from "@/components/AuthShell";
import { getPostAuthRedirect, redirectIfAuthed, translateAuthError } from "@/lib/auth";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/signup")({
  beforeLoad: redirectIfAuthed,
  component: SignupPage,
});

function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
        },
      });
      if (error) {
        setError(translateAuthError(error.message));
        return;
      }
      if (!data.session) {
        setInfo(
          "تم إنشاء حسابك بنجاح! أرسلنا رسالة تأكيد إلى بريدك الإلكتروني. افتحها واضغط على الرابط لتفعيل الحساب، ثم سجّل الدخول.",
        );
        return;
      }
      const to = await getPostAuthRedirect(data.session.user.id);
      navigate({ to });
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/login`,
      });
      if (result.error) {
        setError(translateAuthError((result.error as Error).message ?? "google"));
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const to = await getPostAuthRedirect(data.session.user.id);
        navigate({ to });
      }
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.signupTitle")}
      subtitle={t("auth.signupSubtitle")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            {t("auth.login")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label={t("auth.email")}
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          label={t("auth.password")}
          type="password"
          value={password}
          onChange={setPassword}
          required
          hint={t("auth.passwordHint")}
        />
        {info && (
          <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-foreground">
            {info}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !!info}
          className="w-full rounded-xl bg-primary py-3 text-primary-foreground font-semibold transition-transform hover:opacity-95 active:scale-[0.97] disabled:opacity-60"
        >
          {loading ? t("auth.creating") : t("auth.create")}
        </button>
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">أو</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onGoogle}
          disabled={loading || !!info}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-input bg-background py-3 font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07Z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
            <path fill="#FBBC05" d="M5.85 14.12a6.6 6.6 0 0 1 0-4.24V7.04H2.18a11 11 0 0 0 0 9.92l3.67-2.84Z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.67 2.84C6.72 7.31 9.14 5.38 12 5.38Z"/>
          </svg>
          التسجيل باستخدام Google
        </button>
        <button
          type="button"
          onClick={async () => {
            setError(null);
            setInfo(null);
            setLoading(true);
            try {
              const result = await lovable.auth.signInWithOAuth("apple", {
                redirect_uri: `${window.location.origin}/login`,
              });
              if (result.error) {
                setError(translateAuthError((result.error as Error).message ?? "apple"));
                return;
              }
              if (result.redirected) return;
              const { data } = await supabase.auth.getSession();
              if (data.session) {
                const to = await getPostAuthRedirect(data.session.user.id);
                navigate({ to });
              }
            } catch {
              setError(t("common.error"));
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading || !!info}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-input bg-foreground py-3 font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"/>
          </svg>
          التسجيل باستخدام Apple
        </button>
      </form>
    </AuthShell>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  required,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
