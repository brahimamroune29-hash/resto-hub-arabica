import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, UploadCloud } from "lucide-react";
import { createRestaurantSetup } from "@/server/setup.functions";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/setup")({
  beforeLoad: requireAuth,
  component: SetupPage,
});

function isValidUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setupRestaurant = useServerFn(createRestaurantSetup);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [googleUrl, setGoogleUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!logo) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[setup] submit clicked");
    setError(null);
    const trimmedName = name.trim();
    const trimmedUrl = googleUrl.trim();

    if (!trimmedName) {
      setError(t("setup.nameRequired"));
      toast.error(t("setup.nameRequired"));
      return;
    }
    if (!trimmedUrl || !isValidUrl(trimmedUrl)) {
      setError(t("setup.invalidGoogle"));
      toast.error(t("setup.invalidGoogle"));
      return;
    }

    setLoading(true);
    try {
      console.log("[setup] fetching session");
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      console.log("[setup] session", {
        hasSession: !!sessionData.session,
        userId: sessionData.session?.user?.id,
        sessErr,
      });
      if (sessErr || !sessionData.session?.user) throw new Error("anonymous");
      const userId = sessionData.session.user.id;

      let logoPayload: { name: string; type: string; base64: string } | null = null;
      if (logo) {
        console.log("[setup] preparing logo", {
          name: logo.name,
          size: logo.size,
          type: logo.type,
        });
        logoPayload = {
          name: logo.name,
          type: logo.type || "image/png",
          base64: await fileToBase64(logo),
        };
        console.log("[setup] logo prepared", { name: logoPayload.name, type: logoPayload.type });
      }

      console.log("[setup] auth.uid before insert", userId);
      const payload = { name: trimmedName, logo: logoPayload, googleMapsReviewUrl: trimmedUrl };
      console.log("[setup] payload", {
        name: payload.name,
        googleMapsReviewUrl: payload.googleMapsReviewUrl,
        logo: payload.logo ? { name: payload.logo.name, type: payload.logo.type } : null,
      });
      console.log("[setup] inserting restaurant via authenticated server function");
      const restaurant = await setupRestaurant({ data: payload });
      console.log("[setup] insert success", restaurant);

      console.log("[setup] success, navigating");
      toast.success(t("setup.saved"));
      navigate({ to: "/dashboard" });
    } catch (err) {
      console.error("[setup] caught error", err);
      const anyErr = err as { message?: string; code?: string; details?: string };
      const raw = anyErr?.message ?? String(err);
      const code = anyErr?.code ? ` [${anyErr.code}]` : "";
      let msg = t("setup.saveFailed");
      if (raw.includes("duplicate") || raw.includes("unique")) msg = t("setup.duplicate");
      else if (raw === "anonymous") msg = t("setup.expired");
      else if (raw) msg = `${msg}${code}: ${raw}`;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-8 rounded-2xl shadow-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">{t("setup.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("setup.subtitle")}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">{t("setup.restaurantName")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("setup.placeholderName")}
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">{t("setup.logo")}</Label>
            <label
              htmlFor="logo"
              className="flex items-center gap-3 border border-dashed border-input rounded-xl p-4 cursor-pointer hover:bg-muted/40 transition"
            >
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt={t("setup.logoPreview")}
                  className="w-14 h-14 rounded-lg object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                  <UploadCloud className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                {logo ? logo.name : t("setup.chooseLogo")}
              </div>
              <input
                id="logo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="google">{t("setup.googleLink")}</Label>
            <Input
              id="google"
              type="url"
              value={googleUrl}
              onChange={(e) => setGoogleUrl(e.target.value)}
              placeholder="https://g.page/r/..."
              dir="ltr"
              required
            />
            <p className="text-xs text-muted-foreground">
              {t("setup.googleHint")}
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                {t("setup.savingData")}
              </>
            ) : (
              t("setup.start")
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
