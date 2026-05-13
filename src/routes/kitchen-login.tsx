import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChefHat, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { verifyChefPin, getPublicChefLoginInfo } from "@/server/chef.functions";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/kitchen-login")({
  validateSearch: (s) => ({ r: typeof s.r === "string" ? s.r : "" }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  const { r: restaurantId } = Route.useSearch();
  const navigate = useNavigate();
  const verify = useServerFn(verifyChefPin);
  const fetchInfo = useServerFn(getPublicChefLoginInfo);
  const [restaurantName, setRestaurantName] = useState("");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!restaurantId) {
      setEnabled(false);
      return;
    }
    fetchInfo({ data: { restaurantId } })
      .then((info) => {
        if (!info.found) {
          toast.error(t("common.restaurantNotFound"));
          setEnabled(false);
          return;
        }
        setRestaurantName(info.name);
        setEnabled(info.enabled);
      })
      .catch(() => {
        toast.error(t("common.restaurantNotFound"));
        setEnabled(false);
      });
    inputs.current[0]?.focus();
  }, [restaurantId]);

  function readPin() {
    const statePin = digits.join("");
    const domPin = inputs.current.map((input) => input?.value ?? "").join("");
    return /^\d{4}$/.test(statePin) ? statePin : domPin;
  }

  async function submit(pin = readPin()) {
    if (submitting) return;
    if (!/^\d{4}$/.test(pin)) {
      toast.error("أدخل رمز PIN من 4 أرقام");
      return;
    }
    if (!restaurantId) {
      toast.error(t("common.invalidLink"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await verify({ data: { restaurantId, pin } });
      localStorage.setItem("chef_token", res.token);
      localStorage.setItem("chef_expires", res.expiresAt);
      localStorage.setItem("chef_restaurant", JSON.stringify(res.restaurant));
      toast.success(t("common.welcome"));
      navigate({ to: "/kitchen-screen" });
    } catch (e) {
      toast.error((e as Error).message || t("common.wrongPin"));
      setDigits(["", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      const chars = clean.slice(0, 4 - i).split("");
      setDigits((prev) => {
        const next = [...prev];
        chars.forEach((ch, offset) => {
          next[i + offset] = ch;
        });
        return next;
      });
      inputs.current[Math.min(i + chars.length, 3)]?.focus();
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      next[i] = clean;
      return next;
    });
    if (clean && i < 3) inputs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md bg-background rounded-3xl shadow-lg p-8 space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <ChefHat className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t("kitchen.title")}</h1>
          {restaurantName && <p className="text-sm text-muted-foreground mt-1">{restaurantName}</p>}
          <p className="text-sm text-muted-foreground mt-2">{t("common.enterPin")}</p>
        </div>

          <div className="flex justify-center gap-3" dir="ltr">
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digits[i]}
              onChange={(e) => setDigit(i, e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                setDigit(i, e.clipboardData.getData("text"));
              }}
              onKeyDown={(e) => onKeyDown(i, e)}
              disabled={submitting || enabled === false}
              className="w-14 h-16 text-center text-3xl font-bold rounded-xl border-2 border-muted focus:border-primary outline-none transition"
            />
          ))}
        </div>

        {enabled === false && (
          <div className="rounded-xl bg-destructive/10 text-destructive text-sm p-4 text-center leading-6">
            {!restaurantId ? (
              <>الرابط غير صحيح. الرجاء استخدام رابط شاشة المطبخ من صفحة الإعدادات.</>
            ) : (
              <>
                {t("kitchen.disabled")}
                <br />
                {t("kitchen.enableHint")}
              </>
            )}
          </div>
        )}

        <Button
          type="button"
          onClick={() => submit()}
          disabled={submitting || enabled === false}
          className="w-full h-12 text-lg"
        >
          {submitting && <Loader2 className="w-5 h-5 animate-spin ms-2" />}
          {t("common.login")}
          <ArrowRight className="w-5 h-5 ms-2" />
        </Button>

        <div className="text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
            {t("common.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}