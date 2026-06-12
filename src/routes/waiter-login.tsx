import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { UtensilsCrossed, ArrowRight, ArrowLeft, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { getPublicWaiterList, verifyWaiterPin } from "@/lib/waiter.functions";

export const Route = createFileRoute("/waiter-login")({
  validateSearch: (s) => ({
    rid: typeof s.rid === "string" ? s.rid : "",
  }),
  component: Page,
});

function PinInput({
  onSubmit,
  submitting,
}: {
  onSubmit: (pin: string) => void;
  submitting: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      const chars = clean.slice(0, 6 - i).split("");
      setDigits((prev) => {
        const next = [...prev];
        chars.forEach((ch, offset) => { next[i + offset] = ch; });
        return next;
      });
      inputs.current[Math.min(i + chars.length, 5)]?.focus();
      return;
    }
    setDigits((prev) => { const next = [...prev]; next[i] = clean; return next; });
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "Enter") {
      const pin = inputs.current.map((el) => el?.value ?? "").join("").replace(/\s/g, "");
      if (pin.length >= 4) onSubmit(pin);
    }
  }

  function handleSubmit() {
    const pin = inputs.current.map((el) => el?.value ?? "").join("").replace(/\s/g, "");
    onSubmit(pin);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2" dir="ltr">
        {Array.from({ length: 6 }).map((_, i) => (
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
            disabled={submitting}
            className="w-11 h-14 text-center text-2xl font-bold rounded-xl border-2 border-muted focus:border-primary outline-none transition"
          />
        ))}
      </div>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
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
  const { rid } = Route.useSearch();
  const navigate = useNavigate();
  const fetchList = useServerFn(getPublicWaiterList);
  const verify = useServerFn(verifyWaiterPin);

  const [restaurantName, setRestaurantName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  type WaiterItem = { id: string; name: string };
  const [waiters, setWaiters] = useState<WaiterItem[]>([]);
  const [selected, setSelected] = useState<WaiterItem | null>(null);

  useEffect(() => {
    if (!rid) { setLoading(false); return; }
    fetchList({ data: { restaurantId: rid } })
      .then((res) => {
        if (!res.found) { toast.error("المطعم غير موجود"); return; }
        setRestaurantName(res.name);
        setLogoUrl(res.logo_url);
        setWaiters(res.waiters);
      })
      .catch(() => toast.error("فشل التحميل"))
      .finally(() => setLoading(false));
  }, [rid]);

  async function handleSubmit(pin: string) {
    if (!selected) return;
    if (submitting) return;
    if (pin.length < 4) { toast.error("PIN من 4 إلى 6 أرقام"); return; }
    setSubmitting(true);
    try {
      const res = await verify({ data: { waiterId: selected.id, pin } });
      localStorage.setItem("waiter_token", res.token);
      localStorage.setItem("waiter_expires", res.expiresAt);
      localStorage.setItem("waiter_name", res.waiterName);
      localStorage.setItem("waiter_id", res.waiterId);
      localStorage.setItem("waiter_restaurant", JSON.stringify(res.restaurant));
      toast.success(`أهلاً ${res.waiterName}`);
      navigate({ to: "/waiter-screen" });
    } catch (e) {
      toast.error((e as Error).message || "رمز خاطئ");
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
            <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
              <UtensilsCrossed className="w-10 h-10 text-blue-600" />
            </div>
          )}
          <h1 className="text-2xl font-bold">دخول الويتر</h1>
          {restaurantName && <p className="text-sm text-muted-foreground mt-1">{restaurantName}</p>}
        </div>

        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && !rid && (
          <p className="text-sm text-center text-destructive">رابط غير صحيح</p>
        )}

        {!loading && rid && !selected && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">اختر حسابك</p>
            {waiters.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-4">
                لا توجد حسابات — أضفها من لوحة التحكم
              </p>
            ) : (
              waiters.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelected(w)}
                  className="w-full flex items-center gap-3 rounded-xl border-2 border-muted hover:border-primary px-4 py-3 transition-colors text-right"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="font-medium">{w.name}</span>
                </button>
              ))
            )}
          </div>
        )}

        {!loading && selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <span className="font-medium">{selected.name}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">أدخل رمز PIN الخاص بك</p>
            <PinInput onSubmit={handleSubmit} submitting={submitting} />
          </div>
        )}

        <div className="text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
