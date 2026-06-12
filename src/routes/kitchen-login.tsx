import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChefHat, ArrowRight, Loader2, ArrowLeft, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { verifyChefPin, getPublicChefLoginInfo } from "@/lib/chef.functions";
import { getPublicChefList, verifyIndividualChefPin } from "@/lib/individual-chef.functions";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/kitchen-login")({
  validateSearch: (s) => ({
    r: typeof s.r === "string" ? s.r : "",
    rid: typeof s.rid === "string" ? s.rid : "",
    mode: s.mode === "individual" ? "individual" : "shared",
  }),
  component: Page,
});

function PinInput({
  onSubmit,
  submitting,
  disabled,
  length = 4,
}: {
  onSubmit: (pin: string) => void;
  submitting: boolean;
  disabled?: boolean;
  length?: number;
}) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(""));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      const chars = clean.slice(0, length - i).split("");
      setDigits((prev) => {
        const next = [...prev];
        chars.forEach((ch, offset) => { next[i + offset] = ch; });
        return next;
      });
      inputs.current[Math.min(i + chars.length, length - 1)]?.focus();
      return;
    }
    setDigits((prev) => { const next = [...prev]; next[i] = clean; return next; });
    if (clean && i < length - 1) inputs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "Enter") {
      const pin = inputs.current.map((el) => el?.value ?? "").join("");
      if (pin.length >= 4) onSubmit(pin);
    }
  }

  function handleSubmit() {
    const pin = inputs.current.map((el) => el?.value ?? "").join("");
    onSubmit(pin);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-3" dir="ltr">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digits[i]}
            onChange={(e) => setDigit(i, e.target.value)}
            onPaste={(e) => { e.preventDefault(); setDigit(i, e.clipboardData.getData("text")); }}
            onKeyDown={(e) => onKeyDown(i, e)}
            disabled={submitting || disabled}
            className="w-14 h-16 text-center text-3xl font-bold rounded-xl border-2 border-muted focus:border-primary outline-none transition"
          />
        ))}
      </div>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || disabled}
        className="w-full h-12 text-lg"
      >
        {submitting && <Loader2 className="w-5 h-5 animate-spin ms-2" />}
        دخول
        <ArrowRight className="w-5 h-5 ms-2" />
      </Button>
    </div>
  );
}

function Page() {
  const { t } = useTranslation();
  // Support both ?r= (shared legacy) and ?rid= (individual)
  const { r: legacyRid, rid, mode } = Route.useSearch();
  const restaurantId = rid || legacyRid;
  const isIndividual = mode === "individual" && !!rid;

  const navigate = useNavigate();
  const verifyShared = useServerFn(verifyChefPin);
  const fetchSharedInfo = useServerFn(getPublicChefLoginInfo);
  const fetchChefList = useServerFn(getPublicChefList);
  const verifyIndividual = useServerFn(verifyIndividualChefPin);

  const [restaurantName, setRestaurantName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Individual mode state
  type ChefItem = { id: string; name: string };
  const [chefs, setChefs] = useState<ChefItem[]>([]);
  const [selectedChef, setSelectedChef] = useState<ChefItem | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    if (!restaurantId) { setEnabled(false); return; }

    if (isIndividual) {
      setLoadingList(true);
      fetchChefList({ data: { restaurantId } })
        .then((res) => {
          if (!res.found) { toast.error(t("common.restaurantNotFound")); setEnabled(false); return; }
          setRestaurantName(res.name);
          setLogoUrl(res.logo_url);
          setChefs(res.chefs);
          setEnabled(res.chefs.length > 0);
        })
        .catch(() => { toast.error(t("common.restaurantNotFound")); setEnabled(false); })
        .finally(() => setLoadingList(false));
    } else {
      fetchSharedInfo({ data: { restaurantId } })
        .then((info) => {
          if (!info.found) { toast.error(t("common.restaurantNotFound")); setEnabled(false); return; }
          setRestaurantName(info.name);
          setEnabled(info.enabled);
        })
        .catch(() => { toast.error(t("common.restaurantNotFound")); setEnabled(false); });
    }
  }, [restaurantId, isIndividual]);

  async function submitShared(pin: string) {
    if (submitting) return;
    if (!restaurantId) { toast.error(t("common.invalidLink")); return; }
    setSubmitting(true);
    try {
      const res = await verifyShared({ data: { restaurantId, pin } });
      localStorage.setItem("chef_token", res.token);
      localStorage.setItem("chef_expires", res.expiresAt);
      localStorage.setItem("chef_restaurant", JSON.stringify(res.restaurant));
      toast.success(t("common.welcome"));
      navigate({ to: "/kitchen-screen" });
    } catch (e) {
      toast.error((e as Error).message || t("common.wrongPin"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitIndividual(pin: string) {
    if (!selectedChef) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await verifyIndividual({ data: { chefId: selectedChef.id, pin } });
      localStorage.setItem("individual_chef_token", res.token);
      localStorage.setItem("individual_chef_expires", res.expiresAt);
      localStorage.setItem("individual_chef_name", res.chefName);
      localStorage.setItem("individual_chef_id", res.chefId);
      localStorage.setItem("individual_chef_restaurant", JSON.stringify(res.restaurant));
      toast.success(`أهلاً ${res.chefName}`);
      navigate({ to: "/kitchen-screen", search: { mode: "individual" } as any });
    } catch (e) {
      toast.error((e as Error).message || t("common.wrongPin"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md bg-background rounded-3xl shadow-lg p-8 space-y-6">
        <div className="flex flex-col items-center text-center">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-20 h-20 rounded-2xl object-cover mb-4" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <ChefHat className="w-10 h-10 text-primary" />
            </div>
          )}
          <h1 className="text-2xl font-bold">
            {isIndividual ? "دخول المطبخ" : t("kitchen.title")}
          </h1>
          {restaurantName && <p className="text-sm text-muted-foreground mt-1">{restaurantName}</p>}
        </div>

        {loadingList && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Individual mode: chef selection then PIN */}
        {isIndividual && !loadingList && (
          <>
            {!selectedChef ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">اختر حسابك</p>
                {chefs.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-4">
                    لا توجد حسابات طهاة — أضفها من لوحة التحكم
                  </p>
                ) : (
                  <div className="space-y-2">
                    {chefs.map((chef) => (
                      <button
                        key={chef.id}
                        onClick={() => setSelectedChef(chef)}
                        className="w-full flex items-center gap-3 rounded-xl border-2 border-muted hover:border-primary px-4 py-3 transition-colors text-right"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-medium">{chef.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedChef(null)} className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-medium">{selectedChef.name}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">أدخل رمز PIN الخاص بك</p>
                <PinInput onSubmit={submitIndividual} submitting={submitting} length={6} />
              </div>
            )}
          </>
        )}

        {/* Shared mode: direct PIN */}
        {!isIndividual && !loadingList && (
          <>
            <p className="text-sm text-muted-foreground text-center">{t("common.enterPin")}</p>
            <PinInput onSubmit={submitShared} submitting={submitting} disabled={enabled === false} />
            {enabled === false && (
              <div className="rounded-xl bg-destructive/10 text-destructive text-sm p-4 text-center leading-6">
                {!restaurantId ? (
                  <>الرابط غير صحيح. استخدم رابط شاشة المطبخ من صفحة الإعدادات.</>
                ) : (
                  <>{t("kitchen.disabled")}<br />{t("kitchen.enableHint")}</>
                )}
              </div>
            )}
          </>
        )}

        <div className="text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
            {t("common.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
