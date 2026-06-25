import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPostAuthRedirect } from "@/lib/auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handle() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { data, error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchErr) {
          setError(exchErr.message);
          return;
        }
        if (data.session) {
          const to = await getPostAuthRedirect(data.session.user.id);
          navigate({ to });
          return;
        }
      }

      // fallback: check existing session
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const to = await getPostAuthRedirect(data.session.user.id);
        navigate({ to });
      } else {
        navigate({ to: "/login" });
      }
    }

    handle();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <a href="/login" className="text-primary underline">
            العودة لتسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground text-sm">جار تسجيل الدخول...</p>
    </div>
  );
}
