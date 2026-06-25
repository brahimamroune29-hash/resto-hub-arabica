import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, Upload, UserPlus, X, Mail, Users, Calculator, Copy, Shuffle, Power, ChefHat, Palette, Check, Bike, RefreshCw, Send, Bell, ShoppingBag, QrCode, Sparkles, Plus as PlusIcon, Image as ImageIcon, Video as VideoIcon, UtensilsCrossed, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { setCashierPin, disableCashier, getCashierStatus } from "@/lib/cashier.functions";
import { setChefPin, disableChef, getChefStatus } from "@/lib/chef.functions";
import {
  listIndividualChefs,
  addIndividualChef,
  updateIndividualChefPin,
  toggleIndividualChef,
  deleteIndividualChef,
} from "@/lib/individual-chef.functions";
import {
  listWaiters,
  addWaiter,
  updateWaiterPin,
  toggleWaiter,
  deleteWaiter,
} from "@/lib/waiter.functions";
import { updateRestaurantSettings, updateMenuTheme, getSplashSettings, updateSplashSettings, createStaffAccount, deleteStaffAccount, updateStaffPassword, listStaffAccounts } from "@/lib/settings.functions";
import {
  getDeliveryStatus,
  enableDelivery,
  disableDelivery,
  regenerateDeliveryToken,
} from "@/lib/delivery.functions";
import {
  getTakeawayStatus,
  enableTakeaway,
  disableTakeaway,
  regenerateTakeawayToken,
} from "@/lib/takeaway.functions";
import {
  getTelegramStatus,
  generateTelegramLinkToken,
  unlinkTelegram,
  setRestaurantBotToken,
  clearRestaurantBotToken,
} from "@/lib/telegram.functions";
import {
  listDeliveryDrivers,
  addDeliveryDriver,
  removeDeliveryDriver,
  toggleDeliveryDriver,
} from "@/lib/delivery-drivers.functions";
import {
  getDailySummaryStatus,
  setDailySummaryEnabled,
  sendDailySummaryNow,
} from "@/lib/daily-summary.functions";
import {
  getSummaryBotStatus,
  setSummaryBotToken,
  clearSummaryBotToken,
  generateSummaryLinkToken,
  unlinkSummaryTelegram,
} from "@/lib/summary-bot.functions";
import {
  MENU_LAYOUTS,
  MENU_THEMES,
  DEFAULT_MENU_COLOR,
  DEFAULT_MENU_LAYOUT,
  DEFAULT_MENU_THEME,
  serializeMenuAppearance,
  parseMenuAppearance,
  type MenuLayoutId,
  type MenuThemeId,
} from "@/lib/menu-themes";

export const Route = createFileRoute("/dashboard/settings")({
  component: Page,
});

type Restaurant = {
  id: string;
  name: string;
  logo_url: string | null;
  google_maps_review_url: string | null;
};

type ManagerRole = "staff" | "production_manager" | "operations_manager" | "hr_manager" | "purchasing_manager";
type StaffMember = { id: string; user_id: string; role: string; email: string };

const MANAGER_ROLE_LABELS: Record<ManagerRole, string> = {
  staff: "موظف (وصول محدود)",
  production_manager: "مسؤول الإنتاج",
  operations_manager: "مسؤول التشغيل",
  hr_manager: "مسؤول الموارد البشرية",
  purchasing_manager: "مسؤول المشتريات",
};

function Page() {
  const navigate = useNavigate();
  const [r, setR] = useState<Restaurant | null>(null);
  const [name, setName] = useState("");
  const [gUrl, setGUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [inviteRole, setInviteRole] = useState<ManagerRole>("staff");
  const [inviting, setInviting] = useState(false);
  const [staffPwEdit, setStaffPwEdit] = useState<{ userId: string; email: string } | null>(null);
  const [staffNewPw, setStaffNewPw] = useState("");
  const [savingStaffPw, setSavingStaffPw] = useState(false);
  // Cashier
  const setPin = useServerFn(setCashierPin);
  const disable = useServerFn(disableCashier);
  const getStatus = useServerFn(getCashierStatus);
  const [cashierEnabled, setCashierEnabled] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);
  // Chef
  const setChefPinFn = useServerFn(setChefPin);
  const disableChefFn = useServerFn(disableChef);
  const getChefStatusFn = useServerFn(getChefStatus);
  const [chefEnabled, setChefEnabled] = useState(false);
  const [chefPinInput, setChefPinInput] = useState("");
  const [savingChefPin, setSavingChefPin] = useState(false);
  const [showChefPinDialog, setShowChefPinDialog] = useState<string | null>(null);
  const [confirmDisableChef, setConfirmDisableChef] = useState(false);
  const createStaffFn = useServerFn(createStaffAccount);
  const deleteStaffFn = useServerFn(deleteStaffAccount);
  const updateStaffPwFn = useServerFn(updateStaffPassword);
  const listStaffFn = useServerFn(listStaffAccounts);
  // Menu theme
  const updateThemeFn = useServerFn(updateMenuTheme);
  const [menuTheme, setMenuTheme] = useState<MenuThemeId>(DEFAULT_MENU_THEME);
  const [menuColor, setMenuColor] = useState(DEFAULT_MENU_COLOR);
  const [menuLayout, setMenuLayout] = useState<MenuLayoutId>(DEFAULT_MENU_LAYOUT);
  const [headerColor, setHeaderColor] = useState(DEFAULT_MENU_COLOR);
  const [categoryColor, setCategoryColor] = useState(DEFAULT_MENU_COLOR);
  const [buttonColor, setButtonColor] = useState(DEFAULT_MENU_COLOR);
  const [savingAppearance, setSavingAppearance] = useState(false);
  // Delivery
  const getDeliveryStatusFn = useServerFn(getDeliveryStatus);
  const enableDeliveryFn = useServerFn(enableDelivery);
  const disableDeliveryFn = useServerFn(disableDelivery);
  const regenDeliveryFn = useServerFn(regenerateDeliveryToken);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryToken, setDeliveryToken] = useState<string | null>(null);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [confirmDisableDelivery, setConfirmDisableDelivery] = useState(false);
  // Takeaway
  const getTakeawayStatusFn = useServerFn(getTakeawayStatus);
  const enableTakeawayFn = useServerFn(enableTakeaway);
  const disableTakeawayFn = useServerFn(disableTakeaway);
  const regenTakeawayFn = useServerFn(regenerateTakeawayToken);
  const [takeawayEnabled, setTakeawayEnabled] = useState(false);
  const [takeawayToken, setTakeawayToken] = useState<string | null>(null);
  const [takeawayBusy, setTakeawayBusy] = useState(false);
  const [confirmDisableTakeaway, setConfirmDisableTakeaway] = useState(false);
  // Daily summary
  const getDailySummaryStatusFn = useServerFn(getDailySummaryStatus);
  const setDailySummaryEnabledFn = useServerFn(setDailySummaryEnabled);
  const sendDailySummaryNowFn = useServerFn(sendDailySummaryNow);
  const [dailySummaryEnabled, setDailySummaryEnabledState] = useState(true);
  const [dailySummaryBusy, setDailySummaryBusy] = useState(false);
  // Summary bot (separate from delivery bot)
  const getSummaryBotStatusFn = useServerFn(getSummaryBotStatus);
  const setSummaryBotTokenFn = useServerFn(setSummaryBotToken);
  const clearSummaryBotTokenFn = useServerFn(clearSummaryBotToken);
  const genSummaryLinkFn = useServerFn(generateSummaryLinkToken);
  const unlinkSummaryFn = useServerFn(unlinkSummaryTelegram);
  const [summaryBotConfigured, setSummaryBotConfigured] = useState(false);
  const [summaryBotUsername, setSummaryBotUsername] = useState<string | null>(null);
  const [summaryLinked, setSummaryLinked] = useState(false);
  const [summaryUsername, setSummaryUsername] = useState<string | null>(null);
  const [summaryBotTokenInput, setSummaryBotTokenInput] = useState("");
  const [summaryDeepLink, setSummaryDeepLink] = useState<string | null>(null);
  const summaryPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Telegram notifications
  const getTgStatusFn = useServerFn(getTelegramStatus);
  const genTgLinkFn = useServerFn(generateTelegramLinkToken);
  const unlinkTgFn = useServerFn(unlinkTelegram);
  const [tgLinked, setTgLinked] = useState(false);
  const [tgUsername, setTgUsername] = useState<string | null>(null);
  const [tgBotUsername, setTgBotUsername] = useState<string>("");
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const [confirmUnlinkTg, setConfirmUnlinkTg] = useState(false);
  // Custom restaurant bot
  const setBotFn = useServerFn(setRestaurantBotToken);
  const clearBotFn = useServerFn(clearRestaurantBotToken);
  const [usingCustomBot, setUsingCustomBot] = useState(false);
  const [customBotUsername, setCustomBotUsername] = useState<string | null>(null);
  const [botTokenInput, setBotTokenInput] = useState("");
  const [botBusy, setBotBusy] = useState(false);
  // Delivery drivers
  const listDriversFn = useServerFn(listDeliveryDrivers);
  const addDriverFn = useServerFn(addDeliveryDriver);
  const removeDriverFn = useServerFn(removeDeliveryDriver);
  const toggleDriverFn = useServerFn(toggleDeliveryDriver);
  type DriverRow = {
    id: string;
    display_name: string;
    telegram_username: string | null;
    linked: boolean;
    is_active: boolean;
    link_token: string | null;
    deep_link: string | null;
  };
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [driverName, setDriverName] = useState("");
  const [driverBusy, setDriverBusy] = useState(false);
  const [newDriverLink, setNewDriverLink] = useState<string | null>(null);
  const driversPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Individual chef accounts
  const listIndividualChefsFn = useServerFn(listIndividualChefs);
  const addIndividualChefFn = useServerFn(addIndividualChef);
  const updateIndividualChefPinFn = useServerFn(updateIndividualChefPin);
  const toggleIndividualChefFn = useServerFn(toggleIndividualChef);
  const deleteIndividualChefFn = useServerFn(deleteIndividualChef);
  type IndividualChef = { id: string; name: string; is_active: boolean; employee_id: string | null; created_at: string };
  const [individualChefs, setIndividualChefs] = useState<IndividualChef[]>([]);
  const [newChefName, setNewChefName] = useState("");
  const [newChefPin, setNewChefPin] = useState("");
  const [addingChef, setAddingChef] = useState(false);
  const [chefPinEdit, setChefPinEdit] = useState<{ id: string; pin: string } | null>(null);
  const [savingChefPinEdit, setSavingChefPinEdit] = useState(false);
  const [showChefPin, setShowChefPin] = useState<string | null>(null);

  // Individual waiter accounts
  const listWaitersFn = useServerFn(listWaiters);
  const addWaiterFn = useServerFn(addWaiter);
  const updateWaiterPinFn = useServerFn(updateWaiterPin);
  const toggleWaiterFn = useServerFn(toggleWaiter);
  const deleteWaiterFn = useServerFn(deleteWaiter);
  type WaiterRow = { id: string; name: string; is_active: boolean; employee_id: string | null; created_at: string };
  const [waiters, setWaiters] = useState<WaiterRow[]>([]);
  const [newWaiterName, setNewWaiterName] = useState("");
  const [newWaiterPin, setNewWaiterPin] = useState("");
  const [addingWaiter, setAddingWaiter] = useState(false);
  const [waiterPinEdit, setWaiterPinEdit] = useState<{ id: string; pin: string } | null>(null);
  const [savingWaiterPinEdit, setSavingWaiterPinEdit] = useState(false);
  const [showWaiterPin, setShowWaiterPin] = useState<string | null>(null);

  // Splash settings
  const getSplashFn = useServerFn(getSplashSettings);
  const updateSplashFn = useServerFn(updateSplashSettings);
  type SplashFeature = { icon: string; text: string };
  const [splashLoaded, setSplashLoaded] = useState(false);
  const [splashSaving, setSplashSaving] = useState(false);
  const [splashEnabled, setSplashEnabled] = useState(true);
  const [splashAlwaysShow, setSplashAlwaysShow] = useState(false);
  const [coverType, setCoverType] = useState<"image" | "video">("image");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverVideoUrl, setCoverVideoUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [tagline, setTagline] = useState("");
  const [splashDescription, setSplashDescription] = useState("");
  const [splashFeatures, setSplashFeatures] = useState<SplashFeature[]>([]);
  const [newFeatureIcon, setNewFeatureIcon] = useState("Sparkles");
  const [newFeatureText, setNewFeatureText] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [brandColor, setBrandColor] = useState("#7c5cff");
  const coverFileRef = useRef<HTMLInputElement>(null);

  async function getServerAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("الجلسة منتهية، سجّل دخولك من جديد");
    return { Authorization: `Bearer ${token}` };
  }

  function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const isVideo = f.type.startsWith("video/");
    const isImage = f.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("صورة أو فيديو فقط");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast.error("الحجم الأقصى 25MB");
      return;
    }
    setCoverFile(f);
    setCoverType(isVideo ? "video" : "image");
    setCoverPreview(URL.createObjectURL(f));
  }

  function addFeature() {
    const text = newFeatureText.trim();
    if (!text) return;
    if (splashFeatures.length >= 8) {
      toast.error("الحد الأقصى 8 مميزات");
      return;
    }
    setSplashFeatures([...splashFeatures, { icon: newFeatureIcon || "Sparkles", text }]);
    setNewFeatureText("");
  }

  function removeFeature(idx: number) {
    setSplashFeatures(splashFeatures.filter((_, i) => i !== idx));
  }

  async function onSaveSplash() {
    setSplashSaving(true);
    try {
      let upload: { name: string; type: string; base64: string } | null = null;
      if (coverFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] ?? "");
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(coverFile);
        });
        upload = {
          name: coverFile.name,
          type: coverFile.type || (coverType === "video" ? "video/mp4" : "image/jpeg"),
          base64,
        };
      }
      const headers = await getServerAuthHeaders();
      const res = await updateSplashFn({
        data: {
          splash_enabled: splashEnabled,
          splash_always_show: splashAlwaysShow,
          cover_type: coverType,
          cover_image_url: coverImageUrl,
          cover_video_url: coverVideoUrl,
          cover_upload: upload,
          tagline: tagline.trim() || null,
          splash_description: splashDescription.trim() || null,
          features: splashFeatures,
          instagram_url: instagramUrl.trim() || null,
          facebook_url: facebookUrl.trim() || null,
          whatsapp_number: whatsappNumber.trim() || null,
          brand_color: brandColor || null,
        },
        headers,
      });
      if (res?.cover_image_url !== undefined) setCoverImageUrl(res.cover_image_url);
      if (res?.cover_video_url !== undefined) setCoverVideoUrl(res.cover_video_url);
      setCoverFile(null);
      toast.success("تم حفظ صفحة الترحيب");
    } catch (e) {
      toast.error((e as Error).message || "فشل الحفظ");
    } finally {
      setSplashSaving(false);
    }
  }

  async function refreshDrivers() {
    try {
      const headers = await getServerAuthHeaders();
      const res = await listDriversFn({ headers });
      setDrivers(res.drivers as DriverRow[]);
    } catch {
      // ignore
    }
  }

  async function refreshIndividualChefs() {
    try {
      const headers = await getServerAuthHeaders();
      const res = await listIndividualChefsFn({ headers });
      setIndividualChefs(res.chefs as IndividualChef[]);
    } catch { /* ignore */ }
  }

  async function refreshWaiters() {
    try {
      const headers = await getServerAuthHeaders();
      const res = await listWaitersFn({ headers });
      setWaiters(res.waiters as WaiterRow[]);
    } catch { /* ignore */ }
  }

  async function onAddIndividualChef() {
    if (!newChefName.trim()) { toast.error("اكتب اسم الطاهي"); return; }
    if (newChefPin.length < 4) { toast.error("PIN من 4 إلى 6 أرقام"); return; }
    setAddingChef(true);
    try {
      const headers = await getServerAuthHeaders();
      await addIndividualChefFn({ data: { name: newChefName.trim(), pin: newChefPin }, headers });
      setNewChefName(""); setNewChefPin("");
      await refreshIndividualChefs();
      toast.success("تم إضافة الطاهي");
    } catch (e) { toast.error((e as Error).message || "فشل"); }
    finally { setAddingChef(false); }
  }

  async function onSaveChefPinEdit() {
    if (!chefPinEdit || chefPinEdit.pin.length < 4) { toast.error("PIN من 4 إلى 6 أرقام"); return; }
    setSavingChefPinEdit(true);
    try {
      const headers = await getServerAuthHeaders();
      await updateIndividualChefPinFn({ data: { chefId: chefPinEdit.id, pin: chefPinEdit.pin }, headers });
      setChefPinEdit(null);
      toast.success("تم تحديث الرمز");
    } catch (e) { toast.error((e as Error).message || "فشل"); }
    finally { setSavingChefPinEdit(false); }
  }

  async function onToggleIndividualChef(chefId: string, is_active: boolean) {
    try {
      const headers = await getServerAuthHeaders();
      await toggleIndividualChefFn({ data: { chefId, is_active }, headers });
      setIndividualChefs((prev) => prev.map((c) => c.id === chefId ? { ...c, is_active } : c));
    } catch (e) { toast.error((e as Error).message || "فشل"); }
  }

  async function onDeleteIndividualChef(chefId: string) {
    try {
      const headers = await getServerAuthHeaders();
      await deleteIndividualChefFn({ data: { chefId }, headers });
      setIndividualChefs((prev) => prev.filter((c) => c.id !== chefId));
      toast.success("تم الحذف");
    } catch (e) { toast.error((e as Error).message || "فشل"); }
  }

  async function onAddWaiter() {
    if (!newWaiterName.trim()) { toast.error("اكتب اسم الويتر"); return; }
    if (newWaiterPin.length < 4) { toast.error("PIN من 4 إلى 6 أرقام"); return; }
    setAddingWaiter(true);
    try {
      const headers = await getServerAuthHeaders();
      await addWaiterFn({ data: { name: newWaiterName.trim(), pin: newWaiterPin }, headers });
      setNewWaiterName(""); setNewWaiterPin("");
      await refreshWaiters();
      toast.success("تم إضافة الويتر");
    } catch (e) { toast.error((e as Error).message || "فشل"); }
    finally { setAddingWaiter(false); }
  }

  async function onSaveWaiterPinEdit() {
    if (!waiterPinEdit || waiterPinEdit.pin.length < 4) { toast.error("PIN من 4 إلى 6 أرقام"); return; }
    setSavingWaiterPinEdit(true);
    try {
      const headers = await getServerAuthHeaders();
      await updateWaiterPinFn({ data: { waiterId: waiterPinEdit.id, pin: waiterPinEdit.pin }, headers });
      setWaiterPinEdit(null);
      toast.success("تم تحديث الرمز");
    } catch (e) { toast.error((e as Error).message || "فشل"); }
    finally { setSavingWaiterPinEdit(false); }
  }

  async function onToggleWaiter(waiterId: string, is_active: boolean) {
    try {
      const headers = await getServerAuthHeaders();
      await toggleWaiterFn({ data: { waiterId, is_active }, headers });
      setWaiters((prev) => prev.map((w) => w.id === waiterId ? { ...w, is_active } : w));
    } catch (e) { toast.error((e as Error).message || "فشل"); }
  }

  async function onDeleteWaiter(waiterId: string) {
    try {
      const headers = await getServerAuthHeaders();
      await deleteWaiterFn({ data: { waiterId }, headers });
      setWaiters((prev) => prev.filter((w) => w.id !== waiterId));
      toast.success("تم الحذف");
    } catch (e) { toast.error((e as Error).message || "فشل"); }
  }

  async function onAddDriver() {
    const name = driverName.trim();
    if (!name) {
      toast.error("اكتب اسم الديلفري");
      return;
    }
    setDriverBusy(true);
    try {
      const headers = await getServerAuthHeaders();
      const res = await addDriverFn({ data: { display_name: name }, headers });
      setDriverName("");
      setNewDriverLink(res.deep_link);
      await refreshDrivers();
      // Poll to detect when the driver completes linking
      if (driversPollRef.current) clearInterval(driversPollRef.current);
      const start = Date.now();
      driversPollRef.current = setInterval(async () => {
        await refreshDrivers();
        if (Date.now() - start > 5 * 60 * 1000) {
          if (driversPollRef.current) clearInterval(driversPollRef.current);
        }
      }, 4000);
    } catch (e) {
      toast.error((e as Error).message || "فشل الإضافة");
    } finally {
      setDriverBusy(false);
    }
  }

  async function onRemoveDriver(id: string) {
    try {
      const headers = await getServerAuthHeaders();
      await removeDriverFn({ data: { id }, headers });
      await refreshDrivers();
      toast.success("تم الحذف");
    } catch (e) {
      toast.error((e as Error).message || "فشل الحذف");
    }
  }

  async function onToggleDriver(id: string, next: boolean) {
    try {
      const headers = await getServerAuthHeaders();
      await toggleDriverFn({ data: { id, is_active: next }, headers });
      await refreshDrivers();
    } catch (e) {
      toast.error((e as Error).message || "فشل التحديث");
    }
  }

  useEffect(() => {
    (async () => {
      try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        navigate({ to: "/login" });
        setLoading(false);
        return;
      }
      const { data: rows, error } = await supabase
        .from("restaurants")
        .select("id, name, logo_url, google_maps_review_url")
        .eq("owner_id", u.user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      const data = rows?.[0];
      if (error) {
        toast.error("فشل تحميل بيانات المطعم");
        setLoading(false);
        return;
      }
      if (!data) {
        // No restaurant yet — show the setup CTA instead of an error
        setLoading(false);
        return;
      }
      setR(data);
      setName(data.name);
      setGUrl(data.google_maps_review_url ?? "");
      setLogoPreview(data.logo_url);
      void loadTeam(data.id);
      // Load splash settings
      try {
        const headers = await getServerAuthHeaders();
        const sp = await getSplashFn({ headers });
        setSplashEnabled(sp.splash_enabled ?? true);
        setSplashAlwaysShow(sp.splash_always_show ?? false);
        setCoverType((sp.cover_type as "image" | "video") || "image");
        setCoverImageUrl(sp.cover_image_url);
        setCoverVideoUrl(sp.cover_video_url);
        setCoverPreview(sp.cover_type === "video" ? sp.cover_video_url : sp.cover_image_url);
        setTagline(sp.tagline ?? "");
        setSplashDescription(sp.splash_description ?? "");
        setSplashFeatures(sp.features ?? []);
        setInstagramUrl(sp.instagram_url ?? "");
        setFacebookUrl(sp.facebook_url ?? "");
        setWhatsappNumber(sp.whatsapp_number ?? "");
        setBrandColor(sp.brand_color || "#7c5cff");
        setSplashLoaded(true);
      } catch {
        setSplashLoaded(true);
      }
      try {
        const { data: rest } = await supabase
          .from("restaurants")
          .select("cashier_enabled, chef_enabled, menu_theme")
          .eq("id", data.id)
          .maybeSingle();
        setCashierEnabled(!!rest?.cashier_enabled);
        setChefEnabled(!!rest?.chef_enabled);
        if (rest?.menu_theme) {
          const appearance = parseMenuAppearance(rest.menu_theme);
          setMenuTheme(appearance.theme);
          setMenuColor(appearance.color);
          setMenuLayout(appearance.layout);
          setHeaderColor(appearance.headerColor ?? appearance.color);
          setCategoryColor(appearance.categoryColor ?? appearance.color);
          setButtonColor(appearance.buttonColor ?? appearance.color);
        }
      } catch {
        // ignore
      }
      try {
        const headers = await getServerAuthHeaders();
        const ds = await getDeliveryStatusFn({ headers });
        setDeliveryEnabled(!!ds.enabled);
        setDeliveryToken(ds.token ?? null);
      } catch {
        // ignore
      }
      try {
        const headers = await getServerAuthHeaders();
        const ts = await getTakeawayStatusFn({ headers });
        setTakeawayEnabled(!!ts.enabled);
        setTakeawayToken(ts.token ?? null);
      } catch {
        // ignore
      }
      try {
        const headers = await getServerAuthHeaders();
        const ts = await getTgStatusFn({ headers });
        setTgLinked(!!ts.linked);
        setTgUsername(ts.username ?? null);
        setTgBotUsername(ts.botUsername ?? "");
        setUsingCustomBot(!!(ts as any).usingCustomBot);
        setCustomBotUsername((ts as any).customBotUsername ?? null);
      } catch {
        // ignore
      }
      try {
        const headers = await getServerAuthHeaders();
        const ds = await getDailySummaryStatusFn({ headers });
        setDailySummaryEnabledState(!!ds.enabled);
      } catch {
        // ignore
      }
      try {
        const headers = await getServerAuthHeaders();
        const sb = await getSummaryBotStatusFn({ headers });
        setSummaryBotConfigured(!!sb.botConfigured);
        setSummaryBotUsername(sb.botUsername ?? null);
        setSummaryLinked(!!sb.linked);
        setSummaryUsername(sb.username ?? null);
      } catch {
        // ignore
      }
      void refreshDrivers();
      void refreshIndividualChefs();
      void refreshWaiters();
      setLoading(false);
      } catch (e) {
        toast.error((e as Error).message || "فشل تحميل الإعدادات");
        setLoading(false);
      }
    })();
  }, [navigate]);

  function genPin() {
    const n = Math.floor(1000 + Math.random() * 9000).toString();
    setPinInput(n);
  }

  async function onSavePin() {
    if (!/^\d{4}$/.test(pinInput)) {
      toast.error("يجب أن يكون الرمز 4 أرقام");
      return;
    }
    setSavingPin(true);
    try {
      const headers = await getServerAuthHeaders();
      await setPin({ data: { pin: pinInput }, headers });
      setCashierEnabled(true);
      setShowPinDialog(pinInput);
      setPinInput("");
      toast.success("تم حفظ رمز الكاشير");
    } catch (e) {
      toast.error((e as Error).message || "فشل الحفظ");
    } finally {
      setSavingPin(false);
    }
  }

  async function onDisableCashier() {
    try {
      const headers = await getServerAuthHeaders();
      await disable({ headers });
      setCashierEnabled(false);
      setConfirmDisable(false);
      toast.success("تم تعطيل نظام الكاشير");
    } catch (e) {
      toast.error((e as Error).message || "فشل التعطيل");
    }
  }

  const cashierUrl =
    typeof window !== "undefined" && r ? `${window.location.origin}/cashier-login?r=${r.id}` : "";
  const chefUrl =
    typeof window !== "undefined" && r ? `${window.location.origin}/kitchen-login?r=${r.id}` : "";

  function genChefPin() {
    setChefPinInput(Math.floor(1000 + Math.random() * 9000).toString());
  }

  async function onSaveChefPin() {
    if (!/^\d{4}$/.test(chefPinInput)) {
      toast.error("يجب أن يكون الرمز 4 أرقام");
      return;
    }
    setSavingChefPin(true);
    try {
      const headers = await getServerAuthHeaders();
      await setChefPinFn({ data: { pin: chefPinInput }, headers });
      setChefEnabled(true);
      setShowChefPinDialog(chefPinInput);
      setChefPinInput("");
      toast.success("تم حفظ رمز المطبخ");
    } catch (e) {
      toast.error((e as Error).message || "فشل الحفظ");
    } finally {
      setSavingChefPin(false);
    }
  }

  async function onDisableChef() {
    try {
      const headers = await getServerAuthHeaders();
      await disableChefFn({ headers });
      setChefEnabled(false);
      setConfirmDisableChef(false);
      toast.success("تم تعطيل نظام المطبخ");
    } catch (e) {
      toast.error((e as Error).message || "فشل التعطيل");
    }
  }
  void getChefStatusFn;

  async function onEnableDelivery() {
    setDeliveryBusy(true);
    try {
      const headers = await getServerAuthHeaders();
      const res = await enableDeliveryFn({ headers });
      setDeliveryEnabled(true);
      setDeliveryToken(res.token);
      toast.success("تم تفعيل نظام التوصيل");
    } catch (e) {
      toast.error((e as Error).message || "فشل التفعيل");
    } finally {
      setDeliveryBusy(false);
    }
  }

  async function onDisableDelivery() {
    setDeliveryBusy(true);
    try {
      const headers = await getServerAuthHeaders();
      await disableDeliveryFn({ headers });
      setDeliveryEnabled(false);
      setConfirmDisableDelivery(false);
      toast.success("تم تعطيل نظام التوصيل");
    } catch (e) {
      toast.error((e as Error).message || "فشل التعطيل");
    } finally {
      setDeliveryBusy(false);
    }
  }

  async function onRegenDelivery() {
    setDeliveryBusy(true);
    try {
      const headers = await getServerAuthHeaders();
      const res = await regenDeliveryFn({ headers });
      setDeliveryToken(res.token);
      setDeliveryEnabled(true);
      toast.success("تم توليد رابط جديد");
    } catch (e) {
      toast.error((e as Error).message || "فشل التوليد");
    } finally {
      setDeliveryBusy(false);
    }
  }

  const deliveryUrl =
    typeof window !== "undefined" && deliveryToken
      ? `${window.location.origin}/d/${deliveryToken}`
      : "";

  async function onEnableTakeaway() {
    setTakeawayBusy(true);
    try {
      const headers = await getServerAuthHeaders();
      const res = await enableTakeawayFn({ headers });
      setTakeawayEnabled(true);
      setTakeawayToken(res.token);
      toast.success("تم تفعيل الطلب السريع");
    } catch (e) {
      toast.error((e as Error).message || "فشل التفعيل");
    } finally {
      setTakeawayBusy(false);
    }
  }
  async function onDisableTakeaway() {
    setTakeawayBusy(true);
    try {
      const headers = await getServerAuthHeaders();
      await disableTakeawayFn({ headers });
      setTakeawayEnabled(false);
      setConfirmDisableTakeaway(false);
      toast.success("تم تعطيل الطلب السريع");
    } catch (e) {
      toast.error((e as Error).message || "فشل التعطيل");
    } finally {
      setTakeawayBusy(false);
    }
  }
  async function onRegenTakeaway() {
    setTakeawayBusy(true);
    try {
      const headers = await getServerAuthHeaders();
      const res = await regenTakeawayFn({ headers });
      setTakeawayToken(res.token);
      setTakeawayEnabled(true);
      toast.success("تم توليد رابط جديد");
    } catch (e) {
      toast.error((e as Error).message || "فشل التوليد");
    } finally {
      setTakeawayBusy(false);
    }
  }
  const takeawayUrl =
    typeof window !== "undefined" && takeawayToken
      ? `${window.location.origin}/t/${takeawayToken}`
      : "";
  const takeawayQrUrl = takeawayUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(takeawayUrl)}`
    : "";

  async function onGenerateTgLink() {
    setTgBusy(true);
    try {
      const headers = await getServerAuthHeaders();
      const res = await genTgLinkFn({ headers });
      setTgDeepLink(res.deepLink);
      setTgBotUsername(res.botUsername);
      // Start polling status to detect link completion
      const start = Date.now();
      const poll = setInterval(async () => {
        try {
          const pollHeaders = await getServerAuthHeaders();
          const ts = await getTgStatusFn({ headers: pollHeaders });
          if (ts.linked) {
            setTgLinked(true);
            setTgUsername(ts.username ?? null);
            setTgDeepLink(null);
            toast.success("تم ربط تليجرام بنجاح!");
            clearInterval(poll);
          } else if (Date.now() - start > 5 * 60 * 1000) {
            clearInterval(poll);
          }
        } catch {
          // ignore
        }
      }, 3000);
    } catch (e) {
      toast.error((e as Error).message || "فشل توليد الرابط");
    } finally {
      setTgBusy(false);
    }
  }

  async function onUnlinkTg() {
    setTgBusy(true);
    try {
      const headers = await getServerAuthHeaders();
      await unlinkTgFn({ headers });
      setTgLinked(false);
      setTgUsername(null);
      setTgDeepLink(null);
      setConfirmUnlinkTg(false);
      toast.success("تم إلغاء ربط تليجرام");
    } catch (e) {
      toast.error((e as Error).message || "فشل الإلغاء");
    } finally {
      setTgBusy(false);
    }
  }

  async function onSaveBotToken() {
    const tok = botTokenInput.trim();
    if (!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(tok)) {
      toast.error("صيغة التوكن غير صحيحة. مثال: 123456789:ABC...");
      return;
    }
    setBotBusy(true);
    try {
      const headers = await getServerAuthHeaders();
      const res = await setBotFn({
        data: { bot_token: tok, app_origin: window.location.origin },
        headers,
      });
      setUsingCustomBot(true);
      setCustomBotUsername(res.botUsername);
      setTgBotUsername(res.botUsername);
      setTgLinked(false);
      setTgUsername(null);
      setTgDeepLink(null);
      setBotTokenInput("");
      toast.success(`تم ربط بوتك @${res.botUsername} بنجاح`);
    } catch (e) {
      toast.error((e as Error).message || "فشل الحفظ");
    } finally {
      setBotBusy(false);
    }
  }

  async function onClearBotToken() {
    setBotBusy(true);
    try {
      const headers = await getServerAuthHeaders();
      await clearBotFn({ headers });
      setUsingCustomBot(false);
      setCustomBotUsername(null);
      setTgLinked(false);
      setTgUsername(null);
      setTgDeepLink(null);
      setTgBotUsername("");
      toast.success("تم العودة للبوت المشترك");
    } catch (e) {
      toast.error((e as Error).message || "فشل");
    } finally {
      setBotBusy(false);
    }
  }

  async function saveMenuAppearance(next: Partial<{
    theme: MenuThemeId;
    color: string;
    layout: MenuLayoutId;
    headerColor: string;
    categoryColor: string;
    buttonColor: string;
    syncAll: boolean;
  }>) {
    const nextTheme = next.theme ?? menuTheme;
    const nextColor = (next.color ?? menuColor).toUpperCase();
    const nextLayout = next.layout ?? menuLayout;
    const sync = next.syncAll || next.color !== undefined || next.theme !== undefined;
    const nextHeader = (next.headerColor ?? (sync ? nextColor : headerColor)).toUpperCase();
    const nextCategory = (next.categoryColor ?? (sync ? nextColor : categoryColor)).toUpperCase();
    const nextButton = (next.buttonColor ?? (sync ? nextColor : buttonColor)).toUpperCase();
    setSavingAppearance(true);
    try {
      const headers = await getServerAuthHeaders();
      await updateThemeFn({
        data: {
          menu_theme: serializeMenuAppearance({
            theme: nextTheme,
            color: nextColor,
            layout: nextLayout,
            headerColor: nextHeader,
            categoryColor: nextCategory,
            buttonColor: nextButton,
          }),
        },
        headers,
      });
      setMenuTheme(nextTheme);
      setMenuColor(nextColor);
      setMenuLayout(nextLayout);
      setHeaderColor(nextHeader);
      setCategoryColor(nextCategory);
      setButtonColor(nextButton);
      toast.success("تم حفظ شكل المنيو");
    } catch (e) {
      toast.error((e as Error).message || "فشل الحفظ");
    } finally {
      setSavingAppearance(false);
    }
  }

  async function loadTeam(_rid?: string) {
    const headers = await getServerAuthHeaders();
    const res = await listStaffFn({ headers });
    setStaff(res.staff as StaffMember[]);
  }

  const onCreateStaff = async () => {
    if (!r) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) { toast.error("البريد غير صالح"); return; }
    if (invitePassword.length < 6) { toast.error("كلمة السر 6 أحرف على الأقل"); return; }
    setInviting(true);
    try {
      const headers = await getServerAuthHeaders();
      await createStaffFn({ data: { email, password: invitePassword, role: inviteRole }, headers });
      toast.success(`تم إنشاء حساب ${MANAGER_ROLE_LABELS[inviteRole]} ✅`);
      setInviteEmail("");
      setInvitePassword("");
      await loadTeam();
    } catch (e) {
      toast.error((e as Error).message || "فشل الإنشاء");
    } finally {
      setInviting(false);
    }
  };

  const onRemoveStaff = async (userId: string) => {
    if (!confirm("هل تريد حذف هذا الحساب نهائياً؟")) return;
    try {
      const headers = await getServerAuthHeaders();
      await deleteStaffFn({ data: { staffUserId: userId }, headers });
      setStaff((x) => x.filter((s) => s.user_id !== userId));
      toast.success("تم حذف الحساب");
    } catch (e) {
      toast.error((e as Error).message || "فشل الحذف");
    }
  };

  const onUpdateStaffPw = async () => {
    if (!staffPwEdit) return;
    if (staffNewPw.length < 6) { toast.error("كلمة السر 6 أحرف على الأقل"); return; }
    setSavingStaffPw(true);
    try {
      const headers = await getServerAuthHeaders();
      await updateStaffPwFn({ data: { staffUserId: staffPwEdit.userId, newPassword: staffNewPw }, headers });
      toast.success("تم تغيير كلمة السر");
      setStaffPwEdit(null);
      setStaffNewPw("");
    } catch (e) {
      toast.error((e as Error).message || "فشل التغيير");
    } finally {
      setSavingStaffPw(false);
    }
  };

  const onPickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(String(reader.result));
    reader.readAsDataURL(f);
  };

  const onSave = async () => {
    if (!r) return;
    if (!name.trim()) {
      toast.error("اسم المطعم مطلوب");
      return;
    }
    setSaving(true);
    try {
      let logoUpload: { name: string; type: string; base64: string } | null = null;
      if (logoFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] ?? "");
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(logoFile);
        });
        logoUpload = {
          name: logoFile.name,
          type: logoFile.type || "image/png",
          base64,
        };
      }
      const headers = await getServerAuthHeaders();
      const result = await updateRestaurantSettings({
        data: {
          name: name.trim(),
          logo_url: r.logo_url,
          logo_upload: logoUpload,
          google_maps_review_url: gUrl.trim() || null,
        },
        headers,
      });
      const newLogoUrl = result?.logo_url ?? r.logo_url;
      setR({
        ...r,
        name: name.trim(),
        logo_url: newLogoUrl,
        google_maps_review_url: gUrl.trim() || null,
      });
      setLogoFile(null);
      toast.success("تم حفظ التغييرات بنجاح");
    } catch (e) {
      toast.error((e as Error).message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!r || confirmText.trim() !== r.name.trim()) return;
    setDeleting(true);
    try {
      // Delete dependent rows first (no FK cascade in schema)
      const { data: orderRows } = await supabase
        .from("orders")
        .select("id")
        .eq("restaurant_id", r.id);
      const orderIds = (orderRows ?? []).map((o) => o.id);
      if (orderIds.length) {
        await supabase.from("order_items").delete().in("order_id", orderIds);
      }
      await supabase.from("reviews").delete().eq("restaurant_id", r.id);
      await supabase.from("orders").delete().eq("restaurant_id", r.id);
      await supabase.from("menu_items").delete().eq("restaurant_id", r.id);
      await supabase.from("categories").delete().eq("restaurant_id", r.id);
      await supabase.from("tables").delete().eq("restaurant_id", r.id);
      const { error } = await supabase.from("restaurants").delete().eq("id", r.id);
      if (error) throw new Error(error.message);
      await supabase.auth.signOut();
      toast.success("تم حذف الحساب");
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message || "فشل الحذف");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-2xl bg-muted animate-pulse" />
        <div className="h-12 rounded-2xl bg-muted animate-pulse" />
        <div className="h-12 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (!r) {
    return (
      <div className="max-w-2xl rounded-2xl bg-background border p-6 text-center space-y-3">
        <h1 className="text-xl font-bold">لم يتم العثور على بيانات المطعم</h1>
        <p className="text-sm text-muted-foreground">سجّل الدخول بحساب صاحب المطعم أو أكمل إعداد المطعم أولاً.</p>
        <Button onClick={() => navigate({ to: "/setup" })}>إعداد المطعم</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">إعدادات المطعم</h1>
        <p className="text-sm text-muted-foreground">
          عدّل معلومات مطعمك في أي وقت
        </p>
      </div>

      <div className="rounded-2xl bg-background border p-6 space-y-5">
        {/* Logo */}
        <div className="space-y-2">
          <Label>شعار المطعم</Label>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="logo"
                className="w-20 h-20 rounded-2xl object-cover border"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground text-xl font-bold">
                {name?.[0] ?? "م"}
              </div>
            )}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickLogo}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-4 h-4 ml-2" />
                تغيير الشعار
              </Button>
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">اسم المطعم</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم المطعم"
          />
        </div>

        {/* Google URL */}
        <div className="space-y-2">
          <Label htmlFor="gurl">رابط تقييم Google Maps</Label>
          <Input
            id="gurl"
            value={gUrl}
            onChange={(e) => setGUrl(e.target.value)}
            placeholder="https://g.page/r/..."
            dir="ltr"
          />
        </div>

        <div className="pt-2">
          <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            حفظ التغييرات
          </Button>
        </div>
      </div>

      {/* Splash page settings */}
      <div className="rounded-2xl bg-background border p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">صفحة الترحيب (Splash)</h3>
          {!splashLoaded && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
        <p className="text-sm text-muted-foreground">
          أول ما يراه العميل عند مسح QR. يظهر مرة واحدة كل 24 ساعة.
        </p>

        {/* Enable/disable + always show toggles */}
        <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div className="space-y-0.5">
              <div className="font-semibold">تفعيل صفحة الترحيب</div>
              <p className="text-xs text-muted-foreground">
                إذا أوقفتها، سيدخل العميل مباشرة إلى المنيو دون رؤية صفحة الترحيب.
              </p>
            </div>
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-primary"
              checked={splashEnabled}
              onChange={(e) => setSplashEnabled(e.target.checked)}
            />
          </label>
          <label className={`flex items-start justify-between gap-4 cursor-pointer ${!splashEnabled ? "opacity-50" : ""}`}>
            <div className="space-y-0.5">
              <div className="font-semibold">إظهار الصفحة في كل زيارة (24 ساعة)</div>
              <p className="text-xs text-muted-foreground">
                عند التفعيل، تظهر صفحة الترحيب للعميل في كل مرة يفتح فيها المنيو حتى خلال نفس اليوم. عند الإيقاف، تظهر مرة واحدة فقط كل 24 ساعة.
              </p>
            </div>
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-primary"
              checked={splashAlwaysShow}
              disabled={!splashEnabled}
              onChange={(e) => setSplashAlwaysShow(e.target.checked)}
            />
          </label>
        </div>

        {/* Cover type */}
        <div className="space-y-2">
          <Label>نوع الغلاف</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={coverType === "image" ? "default" : "outline"}
              onClick={() => setCoverType("image")}
              size="sm"
            >
              <ImageIcon className="w-4 h-4 ml-2" />
              صورة
            </Button>
            <Button
              type="button"
              variant={coverType === "video" ? "default" : "outline"}
              onClick={() => setCoverType("video")}
              size="sm"
            >
              <VideoIcon className="w-4 h-4 ml-2" />
              فيديو
            </Button>
          </div>
        </div>

        {/* Cover preview */}
        <div className="space-y-2">
          <Label>{coverType === "video" ? "فيديو الغلاف" : "صورة الغلاف"}</Label>
          <div className="flex items-center gap-4">
            <div className="w-32 h-24 rounded-xl overflow-hidden bg-muted border flex items-center justify-center">
              {coverPreview ? (
                coverType === "video" ? (
                  <video src={coverPreview} muted className="w-full h-full object-cover" />
                ) : (
                  <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                )
              ) : (
                <span className="text-xs text-muted-foreground">لا يوجد</span>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={coverFileRef}
                type="file"
                accept={coverType === "video" ? "video/*" : "image/*"}
                className="hidden"
                onChange={onPickCover}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => coverFileRef.current?.click()}>
                <Upload className="w-4 h-4 ml-2" />
                اختر ملف
              </Button>
              <p className="text-xs text-muted-foreground">حد أقصى 25MB</p>
            </div>
          </div>
        </div>

        {/* Brand color */}
        <div className="space-y-2">
          <Label>لون العلامة (يحرّك الخلفية)</Label>
          <div className="flex items-center gap-3">
            <Input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-10 w-14 p-1 cursor-pointer"
            />
            <Input
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              dir="ltr"
              className="font-mono"
              placeholder="#7c5cff"
            />
          </div>
        </div>

        {/* Tagline */}
        <div className="space-y-2">
          <Label>الشعار القصير</Label>
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="نكهة لا تُنسى"
            maxLength={140}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label>وصف قصير</Label>
          <textarea
            value={splashDescription}
            onChange={(e) => setSplashDescription(e.target.value)}
            placeholder="عن المطعم..."
            maxLength={500}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Features */}
        <div className="space-y-2">
          <Label>المميزات (حد أقصى 8)</Label>
          <div className="flex flex-wrap gap-2">
            {splashFeatures.map((f, idx) => (
              <div key={idx} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm">
                <span className="text-xs text-muted-foreground">{f.icon}</span>
                <span>{f.text}</span>
                <button onClick={() => removeFeature(idx)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-2 pt-2">
            <Input
              value={newFeatureIcon}
              onChange={(e) => setNewFeatureIcon(e.target.value)}
              placeholder="Sparkles"
              dir="ltr"
            />
            <Input
              value={newFeatureText}
              onChange={(e) => setNewFeatureText(e.target.value)}
              placeholder="مثل: حلال 100%"
              maxLength={80}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addFeature();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addFeature}>
              <PlusIcon className="w-4 h-4 ml-1" />
              إضافة
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            اسم الأيقونة من <a href="https://lucide.dev/icons" target="_blank" rel="noopener noreferrer" className="underline">lucide</a> (مثل: Sparkles, Leaf, Award).
          </p>
        </div>

        {/* Social */}
        <div className="space-y-3">
          <Label>روابط التواصل</Label>
          <div className="space-y-2">
            <Input
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/..."
              dir="ltr"
            />
            <Input
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              placeholder="https://facebook.com/..."
              dir="ltr"
            />
            <Input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="213555..."
              dir="ltr"
            />
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={onSaveSplash} disabled={splashSaving || !splashLoaded} className="w-full sm:w-auto">
            {splashSaving && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            حفظ صفحة الترحيب
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-background border p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">شكل منيو العميل</h3>
          {savingAppearance && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
        <p className="text-sm text-muted-foreground">
          اختر لون رئيسي يطبّق على كل العناصر، أو خصّص لون كل قسم على حدة (الهيدر، الفئات، أزرار +).
        </p>

        <div className="space-y-3">
          <Label>اللون الرئيسي (يطبّق على الكل)</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="color"
              value={menuColor}
              disabled={savingAppearance}
              onChange={(e) => saveMenuAppearance({ color: e.target.value })}
              className="h-12 w-16 p-1 cursor-pointer"
              aria-label="لون المنيو"
            />
            {Object.values(MENU_THEMES).map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={savingAppearance}
                onClick={() => saveMenuAppearance({ theme: t.id, color: t.primary })}
                className={`h-10 min-w-10 rounded-full border-2 transition ${
                  menuTheme === t.id && menuColor === t.primary ? "border-primary scale-105" : "border-border"
                }`}
                style={{ background: `linear-gradient(135deg, ${t.preview[0]}, ${t.preview[1]}, ${t.preview[2]})` }}
                aria-label={t.label}
                title={t.label}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-dashed p-4">
          <Label className="text-sm font-bold">تخصيص متقدّم — لون لكل قسم</Label>
          <p className="text-xs text-muted-foreground">
            ضع لون مختلف لكل عنصر تشاهده في صفحة العميل.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {[
              { key: "header", label: "لون الهيدر العلوي", value: headerColor, setter: (v: string) => saveMenuAppearance({ headerColor: v }) },
              { key: "category", label: "لون الفئات", value: categoryColor, setter: (v: string) => saveMenuAppearance({ categoryColor: v }) },
              { key: "button", label: "لون أزرار + والسلة", value: buttonColor, setter: (v: string) => saveMenuAppearance({ buttonColor: v }) },
            ].map((slot) => (
              <div key={slot.key} className="space-y-2">
                <Label className="text-xs">{slot.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={slot.value}
                    disabled={savingAppearance}
                    onChange={(e) => slot.setter(e.target.value)}
                    className="h-10 w-14 p-1 cursor-pointer"
                    aria-label={slot.label}
                  />
                  <div
                    className="flex-1 h-10 rounded-lg border"
                    style={{ background: `linear-gradient(135deg, ${slot.value}, ${slot.value}cc)` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>واجهة شاشة العميل</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.values(MENU_LAYOUTS).map((layout) => {
              const active = menuLayout === layout.id;
              return (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => saveMenuAppearance({ layout: layout.id })}
                  disabled={savingAppearance}
                  className={`relative text-right rounded-2xl border-2 p-3 transition-all ${
                    active ? "border-primary shadow-md" : "border-border hover:border-primary/40"
                  } ${savingAppearance ? "opacity-70" : ""}`}
                >
                  <div className={`grid ${layout.previewClass} gap-2 h-20 mb-3`}>
                    <span className="rounded-xl" style={{ background: menuColor }} />
                    <span className="rounded-xl bg-muted" />
                    <span className="rounded-xl bg-muted/70" />
                  </div>
                  <div className="space-y-1">
                    <span className="block font-bold text-sm">{layout.label}</span>
                    <span className="block text-xs text-muted-foreground">{layout.description}</span>
                  </div>
                  {active && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center shadow">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-background border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">نظام الكاشير</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          فعّل شاشة كاشير منفصلة بـ PIN — يستخدمها الموظف على تابلت الكاشير
        </p>

        {cashierEnabled ? (
          <>
            <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-center gap-2 text-sm text-green-800">
              <Power className="w-4 h-4" />
              نظام الكاشير مفعّل
            </div>

            {r && (
              <div className="space-y-2">
                <Label>رابط الكاشير المخصص</Label>
                <div className="flex gap-2">
                  <Input value={cashierUrl} readOnly dir="ltr" className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(cashierUrl);
                      toast.success("تم نسخ الرابط");
                    }}
                    aria-label="copy"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  افتحه على تابلت الكاشير واحفظه في bookmarks
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>تغيير PIN</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="• • • •"
                  className="text-center text-2xl tracking-[0.5em] font-bold"
                />
                <Button variant="outline" onClick={genPin} aria-label="random">
                  <Shuffle className="w-4 h-4" />
                </Button>
                <Button onClick={onSavePin} disabled={savingPin || pinInput.length !== 4}>
                  {savingPin && <Loader2 className="w-4 h-4 animate-spin ms-2" />}
                  تحديث
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setConfirmDisable(true)}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <Power className="w-4 h-4 ms-2" />
              تعطيل النظام
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            <Label>أدخل PIN لتفعيل النظام</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4 أرقام"
                className="text-center text-2xl tracking-[0.5em] font-bold"
              />
              <Button variant="outline" onClick={genPin} aria-label="random">
                <Shuffle className="w-4 h-4" />
              </Button>
              <Button onClick={onSavePin} disabled={savingPin || pinInput.length !== 4}>
                {savingPin && <Loader2 className="w-4 h-4 animate-spin ms-2" />}
                تفعيل
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!showPinDialog} onOpenChange={(o) => !o && setShowPinDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>احفظ هذا الرمز</DialogTitle>
            <DialogDescription>
              لن تتمكن من رؤيته مرة أخرى. غيّره من الإعدادات إذا فقدته.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-6">
            <div className="text-6xl font-bold tracking-widest text-primary">
              {showPinDialog}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (showPinDialog) {
                  navigator.clipboard.writeText(showPinDialog);
                  toast.success("تم النسخ");
                }
              }}
            >
              <Copy className="w-4 h-4 ms-2" />
              نسخ
            </Button>
            <Button onClick={() => setShowPinDialog(null)}>تم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعطيل نظام الكاشير؟</DialogTitle>
            <DialogDescription>
              سيتم حذف الـ PIN وكل جلسات الكاشير النشطة. تقدر تفعّله مرة ثانية في أي وقت.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisable(false)}>
              إلغاء
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={onDisableCashier}
            >
              تعطيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl bg-background border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">نظام المطبخ</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          فعّل شاشة مطبخ منفصلة بـ PIN — يستخدمها الطباخ على تابلت في المطبخ
        </p>

        {chefEnabled ? (
          <>
            <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-center gap-2 text-sm text-green-800">
              <Power className="w-4 h-4" />
              نظام المطبخ مفعّل
            </div>

            {r && (
              <div className="space-y-2">
                <Label>رابط شاشة المطبخ</Label>
                <div className="flex gap-2">
                  <Input value={chefUrl} readOnly dir="ltr" className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(chefUrl);
                      toast.success("تم نسخ الرابط");
                    }}
                    aria-label="copy"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>تغيير PIN</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={chefPinInput}
                  onChange={(e) => setChefPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="• • • •"
                  className="text-center text-2xl tracking-[0.5em] font-bold"
                />
                <Button variant="outline" onClick={genChefPin} aria-label="random">
                  <Shuffle className="w-4 h-4" />
                </Button>
                <Button onClick={onSaveChefPin} disabled={savingChefPin || chefPinInput.length !== 4}>
                  {savingChefPin && <Loader2 className="w-4 h-4 animate-spin ms-2" />}
                  تحديث
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setConfirmDisableChef(true)}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <Power className="w-4 h-4 ms-2" />
              تعطيل النظام
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            <Label>أدخل PIN لتفعيل النظام</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={chefPinInput}
                onChange={(e) => setChefPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4 أرقام"
                className="text-center text-2xl tracking-[0.5em] font-bold"
              />
              <Button variant="outline" onClick={genChefPin} aria-label="random">
                <Shuffle className="w-4 h-4" />
              </Button>
              <Button onClick={onSaveChefPin} disabled={savingChefPin || chefPinInput.length !== 4}>
                {savingChefPin && <Loader2 className="w-4 h-4 animate-spin ms-2" />}
                تفعيل
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!showChefPinDialog} onOpenChange={(o) => !o && setShowChefPinDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>احفظ هذا الرمز</DialogTitle>
            <DialogDescription>لن تتمكن من رؤيته مرة أخرى.</DialogDescription>
          </DialogHeader>
          <div className="text-center py-6">
            <div className="text-6xl font-bold tracking-widest text-primary">{showChefPinDialog}</div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (showChefPinDialog) {
                  navigator.clipboard.writeText(showChefPinDialog);
                  toast.success("تم النسخ");
                }
              }}
            >
              <Copy className="w-4 h-4 ms-2" />
              نسخ
            </Button>
            <Button onClick={() => setShowChefPinDialog(null)}>تم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDisableChef} onOpenChange={setConfirmDisableChef}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعطيل نظام المطبخ؟</DialogTitle>
            <DialogDescription>
              سيتم حذف الـ PIN وكل جلسات المطبخ النشطة.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisableChef(false)}>
              إلغاء
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={onDisableChef}>
              تعطيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Individual Chef Accounts ─────────────────────────────── */}
      <div className="rounded-2xl bg-background border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-bold">حسابات الطهاة الفردية</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          كل طاهي بحسابه الخاص — يسجّل دخوله بـ PIN ويرى أوامر المطبخ. تتبع إنتاجية كل واحد.
        </p>

        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="اسم الطاهي"
            value={newChefName}
            onChange={(e) => setNewChefName(e.target.value)}
            className="flex-1 min-w-0"
          />
          <Input
            type="text"
            inputMode="numeric"
            placeholder="PIN (4–6 أرقام)"
            maxLength={6}
            value={newChefPin}
            onChange={(e) => setNewChefPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-36 text-center font-mono tracking-widest"
          />
          <Button onClick={onAddIndividualChef} disabled={addingChef}>
            {addingChef ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
            <span className="mr-1">إضافة</span>
          </Button>
        </div>

        {individualChefs.length > 0 && (
          <div className="space-y-2">
            {individualChefs.map((chef) => (
              <div key={chef.id} className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ChefHat className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="font-medium truncate">{chef.name}</span>
                  {!chef.is_active && <span className="text-xs text-muted-foreground">(موقوف)</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {chefPinEdit?.id === chef.id ? (
                    <>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={chefPinEdit.pin}
                        onChange={(e) => setChefPinEdit({ ...chefPinEdit, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                        className="w-28 text-center font-mono h-8 text-sm"
                        placeholder="PIN جديد"
                        autoFocus
                      />
                      <Button size="sm" onClick={onSaveChefPinEdit} disabled={savingChefPinEdit}>
                        {savingChefPinEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setChefPinEdit(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setChefPinEdit({ id: chef.id, pin: "" })} title="تغيير PIN">
                      <KeyRound className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onToggleIndividualChef(chef.id, !chef.is_active)}
                    title={chef.is_active ? "تعطيل" : "تفعيل"}
                  >
                    <Power className={`w-3 h-3 ${chef.is_active ? "text-green-600" : "text-muted-foreground"}`} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDeleteIndividualChef(chef.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {r && (
          <p className="text-xs text-muted-foreground">
            رابط دخول المطبخ الفردي:{" "}
            <span className="font-mono">{`${window.location.origin}/kitchen-login?rid=${r.id}&mode=individual`}</span>
          </p>
        )}
      </div>

      {/* ─── Individual Waiter Accounts ───────────────────────────── */}
      <div className="rounded-2xl bg-background border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-bold">حسابات الويترات</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          كل ويتر بحسابه الخاص — يرى الطلبات الجاهزة ويعلّم الطلب كمُسلَّم. تتبع أداء كل واحد.
        </p>

        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="اسم الويتر"
            value={newWaiterName}
            onChange={(e) => setNewWaiterName(e.target.value)}
            className="flex-1 min-w-0"
          />
          <Input
            type="text"
            inputMode="numeric"
            placeholder="PIN (4–6 أرقام)"
            maxLength={6}
            value={newWaiterPin}
            onChange={(e) => setNewWaiterPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-36 text-center font-mono tracking-widest"
          />
          <Button onClick={onAddWaiter} disabled={addingWaiter}>
            {addingWaiter ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
            <span className="mr-1">إضافة</span>
          </Button>
        </div>

        {waiters.length > 0 && (
          <div className="space-y-2">
            {waiters.map((w) => (
              <div key={w.id} className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UtensilsCrossed className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="font-medium truncate">{w.name}</span>
                  {!w.is_active && <span className="text-xs text-muted-foreground">(موقوف)</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {waiterPinEdit?.id === w.id ? (
                    <>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={waiterPinEdit.pin}
                        onChange={(e) => setWaiterPinEdit({ ...waiterPinEdit, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                        className="w-28 text-center font-mono h-8 text-sm"
                        placeholder="PIN جديد"
                        autoFocus
                      />
                      <Button size="sm" onClick={onSaveWaiterPinEdit} disabled={savingWaiterPinEdit}>
                        {savingWaiterPinEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setWaiterPinEdit(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setWaiterPinEdit({ id: w.id, pin: "" })} title="تغيير PIN">
                      <KeyRound className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onToggleWaiter(w.id, !w.is_active)}
                    title={w.is_active ? "تعطيل" : "تفعيل"}
                  >
                    <Power className={`w-3 h-3 ${w.is_active ? "text-green-600" : "text-muted-foreground"}`} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDeleteWaiter(w.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {r && (
          <p className="text-xs text-muted-foreground">
            رابط دخول الويتر:{" "}
            <span className="font-mono">{`${window.location.origin}/waiter-login?rid=${r.id}`}</span>
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-background border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">الطلب السريع عبر QR (Takeaway)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          ضع رمز QR على طاولة الكاشير. العميل يمسح الرمز، يطلب الأكل، يدخل اسمه ورقمه، ويأخذ رمز طلبه (مثلاً <span className="font-mono font-bold">007</span>) لمتابعته. الرمز يُعاد ترقيمه تلقائياً كل يوم الساعة 6 صباحاً.
        </p>

        {takeawayEnabled ? (
          <>
            <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-center gap-2 text-sm text-green-800">
              <Power className="w-4 h-4" />
              الطلب السريع مفعّل
            </div>

            {takeawayQrUrl && (
              <div className="flex flex-col items-center gap-2 rounded-xl border bg-white p-4">
                <img
                  src={takeawayQrUrl}
                  alt="QR للطلب السريع"
                  className="w-56 h-56 object-contain"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const w = window.open("", "_blank");
                      if (w) {
                        w.document.write(`<html dir="rtl"><head><title>QR الطلب السريع</title></head><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;"><h2>${name || "اطلب من هنا"}</h2><img src="${takeawayQrUrl.replace("320x320", "600x600")}" style="width:480px;height:480px;"/><p style="font-size:14px;color:#555;">امسح الرمز للطلب</p><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
                        w.document.close();
                      }
                    }}
                  >
                    <QrCode className="w-4 h-4 ms-2" />
                    طباعة الرمز
                  </Button>
                  <a href={takeawayQrUrl.replace("320x320", "800x800")} download="takeaway-qr.png">
                    <Button variant="outline" size="sm">
                      <Upload className="w-4 h-4 ms-2 rotate-180" />
                      تنزيل
                    </Button>
                  </a>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>الرابط</Label>
              <div className="flex gap-2">
                <Input value={takeawayUrl} readOnly dir="ltr" className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (takeawayUrl) {
                      navigator.clipboard.writeText(takeawayUrl);
                      toast.success("تم نسخ الرابط");
                    }
                  }}
                  aria-label="copy"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onRegenTakeaway} disabled={takeawayBusy}>
                {takeawayBusy ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <RefreshCw className="w-4 h-4 ms-2" />}
                توليد رابط جديد
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmDisableTakeaway(true)}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <Power className="w-4 h-4 ms-2" />
                تعطيل النظام
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={onEnableTakeaway} disabled={takeawayBusy}>
            {takeawayBusy && <Loader2 className="w-4 h-4 animate-spin ms-2" />}
            <ShoppingBag className="w-4 h-4 ms-2" />
            تفعيل الطلب السريع
          </Button>
        )}
      </div>

      <Dialog open={confirmDisableTakeaway} onOpenChange={setConfirmDisableTakeaway}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعطيل الطلب السريع؟</DialogTitle>
            <DialogDescription>
              لن يتمكن العملاء من المسح والطلب حتى تعيد التفعيل.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisableTakeaway(false)}>
              إلغاء
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={onDisableTakeaway}>
              تعطيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl bg-background border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bike className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">نظام التوصيل (Delivery)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          فعّل رابطًا مخصصًا للطلب من البيت — انسخه وضعه في Bio على Instagram أو شاركه عبر WhatsApp. سيظهر الطلب لدى الطباخ مع اسم العميل ورقم الهاتف وعنوان التوصيل.
        </p>

        {deliveryEnabled ? (
          <>
            <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-center gap-2 text-sm text-green-800">
              <Power className="w-4 h-4" />
              نظام التوصيل مفعّل
            </div>

            <div className="space-y-2">
              <Label>رابط التوصيل المخصص</Label>
              <div className="flex gap-2">
                <Input value={deliveryUrl} readOnly dir="ltr" className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (deliveryUrl) {
                      navigator.clipboard.writeText(deliveryUrl);
                      toast.success("تم نسخ الرابط");
                    }
                  }}
                  aria-label="copy"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ضع هذا الرابط في الـ Bio على Instagram أو شاركه مع زبائنك.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={onRegenDelivery}
                disabled={deliveryBusy}
              >
                {deliveryBusy ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <RefreshCw className="w-4 h-4 ms-2" />}
                توليد رابط جديد
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmDisableDelivery(true)}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <Power className="w-4 h-4 ms-2" />
                تعطيل النظام
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={onEnableDelivery} disabled={deliveryBusy}>
            {deliveryBusy && <Loader2 className="w-4 h-4 animate-spin ms-2" />}
            <Bike className="w-4 h-4 ms-2" />
            تفعيل نظام التوصيل
          </Button>
        )}
      </div>

      <Dialog open={confirmDisableDelivery} onOpenChange={setConfirmDisableDelivery}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعطيل نظام التوصيل؟</DialogTitle>
            <DialogDescription>
              لن يتمكن العملاء من إرسال طلبات توصيل جديدة عبر الرابط حتى تعيد التفعيل.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisableDelivery(false)}>
              إلغاء
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={onDisableDelivery}>
              تعطيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl bg-background border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">إشعارات تليجرام للتوصيل</h3>
        </div>

        {/* Custom bot card */}
        <div className="rounded-xl border border-dashed p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-bold text-sm">بوت تليجرام الخاص بمطعمك</div>
              <div className="text-xs text-muted-foreground">
                {usingCustomBot && customBotUsername
                  ? <>مفعّل: <span dir="ltr" className="font-bold">@{customBotUsername}</span></>
                  : "اختياري — استخدم بوتك الخاص بدل البوت المشترك."}
              </div>
            </div>
            {usingCustomBot && (
              <Button
                variant="outline"
                size="sm"
                disabled={botBusy}
                onClick={onClearBotToken}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                {botBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "إزالة"}
              </Button>
            )}
          </div>

          {!usingCustomBot && (
            <>
              <ol className="list-decimal pr-5 space-y-1 text-xs text-muted-foreground">
                <li>افتح <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary underline">@BotFather</a> في تليجرام</li>
                <li>أرسل <code>/newbot</code> واتبع التعليمات</li>
                <li>انسخ التوكن (Token) والصقه هنا</li>
              </ol>
              <div className="flex gap-2">
                <Input
                  value={botTokenInput}
                  onChange={(e) => setBotTokenInput(e.target.value)}
                  placeholder="123456789:ABCdef..."
                  dir="ltr"
                  className="font-mono text-xs"
                />
                <Button onClick={onSaveBotToken} disabled={botBusy || !botTokenInput.trim()}>
                  {botBusy && <Loader2 className="w-4 h-4 animate-spin ms-2" />}
                  حفظ
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                عند الحفظ سيتم ربط البوت تلقائياً وإعادة تعيين أي ربط سابق (سائقين/مالك).
              </p>
            </>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          اربط حساب تليجرام لاستقبال إشعار فوري عند كل طلب توصيل جديد — حتى لو لم يكن المتصفح مفتوحاً. يصلك الإشعار على هاتفك مباشرة مع كامل تفاصيل الطلب.
        </p>

        {tgLinked ? (
          <>
            <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-center justify-between gap-2 text-sm text-green-800">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>
                  مرتبط بحساب{" "}
                  <span className="font-bold" dir="ltr">
                    @{tgUsername ?? "telegram"}
                  </span>
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setConfirmUnlinkTg(true)}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4 ms-2" />
              إلغاء الربط
            </Button>
          </>
        ) : tgDeepLink ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
              <div className="font-bold mb-1">📱 خطوة أخيرة:</div>
              <ol className="list-decimal pr-5 space-y-1 text-xs">
                <li>اضغط على الزر أدناه لفتح تليجرام</li>
                <li>اضغط على زر <b>START</b> داخل البوت</li>
                <li>سيتم الربط تلقائياً وستعود هنا</li>
              </ol>
            </div>
            <a href={tgDeepLink} target="_blank" rel="noreferrer">
              <Button className="w-full bg-[#229ED9] hover:bg-[#1a8bc1] text-white">
                <Send className="w-4 h-4 ms-2" />
                فتح تليجرام لإكمال الربط
              </Button>
            </a>
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">في انتظار الربط…</span>
            </div>
          </div>
        ) : (
          <Button onClick={onGenerateTgLink} disabled={tgBusy}>
            {tgBusy ? (
              <Loader2 className="w-4 h-4 animate-spin ms-2" />
            ) : (
              <Send className="w-4 h-4 ms-2" />
            )}
            ربط حساب تليجرام
          </Button>
        )}

        {tgBotUsername && !tgLinked && (
          <p className="text-xs text-muted-foreground">
            البوت:{" "}
            <a
              href={`https://t.me/${tgBotUsername}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
              dir="ltr"
            >
              @{tgBotUsername}
            </a>
          </p>
        )}
      </div>

      <Dialog open={confirmUnlinkTg} onOpenChange={setConfirmUnlinkTg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إلغاء ربط تليجرام؟</DialogTitle>
            <DialogDescription>
              لن تصلك إشعارات الطلبات الجديدة على تليجرام بعد الإلغاء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUnlinkTg(false)}>
              إلغاء
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={onUnlinkTg}>
              نعم، إلغاء الربط
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl bg-background border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">الملخص اليومي على تليجرام</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          كل ليلة الساعة 23:30 يصلك على تليجرام ملخص مفصّل: إجمالي الإيرادات، عدد الطلبات (صالة / توصيل / سريع)،
          الأكثر والأقل مبيعاً، ونقاط ذكية للانتباه والتطوير.
        </p>

        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
          ℹ️ هذا بوت <b>منفصل تماماً</b> عن بوت الديلفري. أنشئ بوتاً جديداً عبر BotFather مخصصاً للملخص اليومي.
        </div>

        {/* Step 1: Bot token */}
        <div className="rounded-xl border border-dashed p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-bold text-sm">1️⃣ بوت الملخص اليومي</div>
              <div className="text-xs text-muted-foreground">
                {summaryBotConfigured && summaryBotUsername
                  ? <>مفعّل: <span dir="ltr" className="font-bold">@{summaryBotUsername}</span></>
                  : "ألصق توكن البوت الجديد من BotFather هنا."}
              </div>
            </div>
            {summaryBotConfigured && (
              <Button
                variant="outline"
                size="sm"
                disabled={dailySummaryBusy}
                onClick={async () => {
                  setDailySummaryBusy(true);
                  try {
                    const headers = await getServerAuthHeaders();
                    await clearSummaryBotTokenFn({ headers });
                    setSummaryBotConfigured(false);
                    setSummaryBotUsername(null);
                    setSummaryLinked(false);
                    setSummaryUsername(null);
                    setSummaryDeepLink(null);
                    toast.success("تم إزالة بوت الملخص");
                  } catch (e) {
                    toast.error((e as Error).message || "فشل الإزالة");
                  } finally {
                    setDailySummaryBusy(false);
                  }
                }}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                {dailySummaryBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "إزالة"}
              </Button>
            )}
          </div>

          {!summaryBotConfigured && (
            <>
              <ol className="list-decimal pr-5 space-y-1 text-xs text-muted-foreground">
                <li>افتح <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary underline">@BotFather</a> وأرسل <code>/newbot</code></li>
                <li>اختر اسماً (مثلاً: ملخص مطعمي) ويوزرنيم ينتهي بـ <code>bot</code></li>
                <li>انسخ التوكن (Token) والصقه هنا</li>
              </ol>
              <div className="flex gap-2">
                <Input
                  value={summaryBotTokenInput}
                  onChange={(e) => setSummaryBotTokenInput(e.target.value)}
                  placeholder="123456789:ABCdef..."
                  dir="ltr"
                  className="font-mono text-xs"
                />
                <Button
                  disabled={dailySummaryBusy || !summaryBotTokenInput.trim()}
                  onClick={async () => {
                    setDailySummaryBusy(true);
                    try {
                      const headers = await getServerAuthHeaders();
                      const res = await setSummaryBotTokenFn({
                        data: {
                          bot_token: summaryBotTokenInput.trim(),
                          app_origin: window.location.origin,
                        },
                        headers,
                      });
                      setSummaryBotConfigured(true);
                      setSummaryBotUsername(res.botUsername);
                      setSummaryBotTokenInput("");
                      toast.success("تم تفعيل بوت الملخص");
                    } catch (e) {
                      toast.error((e as Error).message || "فشل الحفظ");
                    } finally {
                      setDailySummaryBusy(false);
                    }
                  }}
                >
                  {dailySummaryBusy && <Loader2 className="w-4 h-4 animate-spin ms-2" />}
                  حفظ
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Step 2: Link owner chat */}
        {summaryBotConfigured && (
          <div className="rounded-xl border border-dashed p-4 space-y-3 bg-muted/30">
            <div className="font-bold text-sm">2️⃣ اربط حسابك مع البوت</div>
            {summaryLinked ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-center justify-between gap-2 text-sm text-green-800">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>مرتبط بحساب <span className="font-bold" dir="ltr">@{summaryUsername ?? "telegram"}</span></span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  disabled={dailySummaryBusy}
                  onClick={async () => {
                    setDailySummaryBusy(true);
                    try {
                      const headers = await getServerAuthHeaders();
                      await unlinkSummaryFn({ headers });
                      setSummaryLinked(false);
                      setSummaryUsername(null);
                      setSummaryDeepLink(null);
                      toast.success("تم إلغاء الربط");
                    } catch (e) {
                      toast.error((e as Error).message || "فشل");
                    } finally {
                      setDailySummaryBusy(false);
                    }
                  }}
                >
                  <X className="w-4 h-4 ms-2" />
                  إلغاء الربط
                </Button>
              </div>
            ) : summaryDeepLink ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
                  اضغط على الزر، ثم START داخل البوت — سيتم الربط تلقائياً.
                </div>
                <a href={summaryDeepLink} target="_blank" rel="noreferrer">
                  <Button className="w-full bg-[#229ED9] hover:bg-[#1a8bc1] text-white">
                    <Send className="w-4 h-4 ms-2" />
                    فتح تليجرام لإكمال الربط
                  </Button>
                </a>
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">في انتظار الربط…</span>
                </div>
              </div>
            ) : (
              <Button
                disabled={dailySummaryBusy}
                onClick={async () => {
                  setDailySummaryBusy(true);
                  try {
                    const headers = await getServerAuthHeaders();
                    const res = await genSummaryLinkFn({
                      data: { app_origin: window.location.origin },
                      headers,
                    });
                    setSummaryDeepLink(res.deepLink);
                    if (summaryPollRef.current) clearInterval(summaryPollRef.current);
                    summaryPollRef.current = setInterval(async () => {
                      try {
                        const pollHeaders = await getServerAuthHeaders();
                        const st = await getSummaryBotStatusFn({ headers: pollHeaders });
                        if (st.linked) {
                          setSummaryLinked(true);
                          setSummaryUsername(st.username ?? null);
                          setSummaryDeepLink(null);
                          if (summaryPollRef.current) {
                            clearInterval(summaryPollRef.current);
                            summaryPollRef.current = null;
                          }
                          toast.success("تم الربط بنجاح");
                        }
                      } catch { /* ignore */ }
                    }, 2500);
                  } catch (e) {
                    toast.error((e as Error).message || "فشل التوليد");
                  } finally {
                    setDailySummaryBusy(false);
                  }
                }}
              >
                {dailySummaryBusy ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Send className="w-4 h-4 ms-2" />}
                توليد رابط الربط
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div>
            <div className="font-bold text-sm">
              {dailySummaryEnabled ? "✅ مفعّل" : "⛔ معطّل"}
            </div>
            <div className="text-xs text-muted-foreground">
              يُرسل تلقائياً كل يوم في الساعة 23:30 (توقيت الجزائر).
            </div>
          </div>
          <Button
            variant="outline"
            disabled={dailySummaryBusy}
            onClick={async () => {
              setDailySummaryBusy(true);
              try {
                const headers = await getServerAuthHeaders();
                const next = !dailySummaryEnabled;
                await setDailySummaryEnabledFn({ data: { enabled: next }, headers });
                setDailySummaryEnabledState(next);
                toast.success(next ? "تم تفعيل الملخص اليومي" : "تم تعطيل الملخص اليومي");
              } catch (e) {
                toast.error((e as Error).message || "فشل التحديث");
              } finally {
                setDailySummaryBusy(false);
              }
            }}
          >
            {dailySummaryBusy && <Loader2 className="w-4 h-4 animate-spin ms-2" />}
            {dailySummaryEnabled ? "تعطيل" : "تفعيل"}
          </Button>
        </div>

        <Button
          variant="outline"
          className="w-full"
          disabled={dailySummaryBusy || !summaryLinked}
          onClick={async () => {
            setDailySummaryBusy(true);
            try {
              const headers = await getServerAuthHeaders();
              await sendDailySummaryNowFn({ headers });
              toast.success("تم إرسال ملخص تجريبي إلى تليجرام");
            } catch (e) {
              toast.error((e as Error).message || "فشل الإرسال");
            } finally {
              setDailySummaryBusy(false);
            }
          }}
        >
          {dailySummaryBusy ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : <Send className="w-4 h-4 ms-2" />}
          إرسال ملخص تجريبي الآن
        </Button>
      </div>

      <div className="rounded-2xl bg-background border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bike className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">حسابات الديلفري</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          أضف سائقي التوصيل لاستقبال إشعارات الطلبات الجديدة على تليجرام مع زر «استلام الطلب».
          أول من يضغط الزر يصبح المسؤول عن الطلب، وسيتم سؤاله لاحقاً لتأكيد تحصيل المبلغ.
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="اسم الديلفري (مثلاً: محمد)"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            disabled={driverBusy}
          />
          <Button onClick={onAddDriver} disabled={driverBusy}>
            {driverBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          </Button>
        </div>

        {newDriverLink && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-2 text-sm text-blue-900">
            <div className="font-bold">📲 شارك هذا الرابط مع الديلفري:</div>
            <div className="flex gap-2">
              <Input value={newDriverLink} readOnly dir="ltr" className="text-xs" />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(newDriverLink);
                  toast.success("تم نسخ الرابط");
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs">عند ضغط الديلفري على الرابط وزر START سيتم ربط حسابه تلقائياً.</p>
          </div>
        )}

        {drivers.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد ديلفري مسجل بعد.</p>
        ) : (
          <div className="space-y-2">
            {drivers.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-xl border p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{d.display_name}</div>
                  {d.linked ? (
                    <div className="text-xs text-green-700 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      مرتبط{" "}
                      {d.telegram_username && (
                        <span dir="ltr" className="font-mono">
                          @{d.telegram_username}
                        </span>
                      )}
                      {!d.is_active && <span className="text-amber-700">— موقوف</span>}
                    </div>
                  ) : d.deep_link ? (
                    <div className="text-xs text-amber-700 flex items-center gap-1 flex-wrap">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      بانتظار الربط —
                      <a
                        href={d.deep_link}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-primary"
                      >
                        فتح الرابط
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(d.deep_link!);
                          toast.success("تم نسخ الرابط");
                        }}
                        className="underline text-primary"
                      >
                        نسخ
                      </button>
                      {d.link_token && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(d.link_token!);
                            toast.success("تم نسخ كود الربط");
                          }}
                          className="underline text-primary"
                        >
                          نسخ الكود فقط
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">رابط الربط غير متوفر</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {d.linked && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onToggleDriver(d.id, !d.is_active)}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => onRemoveDriver(d.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-background border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">إدارة الفريق (مديرون)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          أنشئ حسابات للمديرين مباشرة — كل دور يرى فقط ما يخصه في لوحة التحكم
        </p>

        <div className="flex flex-col gap-3">
          {/* Role selection */}
          <div className="flex flex-wrap gap-1">
            {(Object.entries(MANAGER_ROLE_LABELS) as [ManagerRole, string][]).map(([role, label]) => (
              <button
                key={role}
                onClick={() => setInviteRole(role)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  inviteRole === role
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-transparent hover:border-primary/30"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Email */}
          <Input
            type="email"
            placeholder="manager@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            dir="ltr"
          />
          {/* Password */}
          <div className="relative">
            <Input
              type={showInvitePassword ? "text" : "password"}
              placeholder="كلمة السر (6 أحرف على الأقل)"
              value={invitePassword}
              onChange={(e) => setInvitePassword(e.target.value)}
              dir="ltr"
              className="pl-10"
            />
            <button
              type="button"
              onClick={() => setShowInvitePassword((v) => !v)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showInvitePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button onClick={onCreateStaff} disabled={inviting} className="w-full">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <UserPlus className="w-4 h-4 ml-2" />}
            إنشاء حساب {MANAGER_ROLE_LABELS[inviteRole]}
          </Button>
        </div>

        {staff.length > 0 && (
          <div>
            <h4 className="text-sm font-bold mb-2 text-muted-foreground">أعضاء الفريق ({staff.length})</h4>
            <ul className="space-y-2">
              {staff.map((s) => (
                <li key={s.user_id} className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2 gap-2 flex-wrap">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-mono truncate" dir="ltr">{s.email}</span>
                    <span className="text-xs text-primary mt-0.5">{MANAGER_ROLE_LABELS[s.role as ManagerRole] ?? s.role}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => { setStaffPwEdit({ userId: s.user_id, email: s.email }); setStaffNewPw(""); }}
                    >
                      <KeyRound className="w-3 h-3 ml-1" />
                      تغيير الباسورد
                    </Button>
                    <button
                      onClick={() => onRemoveStaff(s.user_id)}
                      className="text-muted-foreground hover:text-red-600 p-1"
                      aria-label="remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Change staff password dialog */}
      <Dialog open={!!staffPwEdit} onOpenChange={(o) => { if (!o) setStaffPwEdit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغيير كلمة السر</DialogTitle>
            <DialogDescription dir="ltr">{staffPwEdit?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>كلمة السر الجديدة</Label>
            <Input
              type="text"
              placeholder="6 أحرف على الأقل"
              value={staffNewPw}
              onChange={(e) => setStaffNewPw(e.target.value)}
              dir="ltr"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaffPwEdit(null)}>إلغاء</Button>
            <Button onClick={onUpdateStaffPw} disabled={savingStaffPw}>
              {savingStaffPw && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl bg-background border-2 border-red-200 p-6 space-y-3">
        <h3 className="text-lg font-bold text-red-700">المنطقة الحساسة</h3>
        <p className="text-sm text-muted-foreground">
          حذف الحساب سيؤدي إلى إزالة المطعم وكل البيانات نهائياً.
        </p>
        <Button
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
          onClick={() => {
            setConfirmText("");
            setConfirmOpen(true);
          }}
        >
          <Trash2 className="w-4 h-4 ml-2" />
          حذف الحساب
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>هل أنت متأكد؟</DialogTitle>
            <DialogDescription>سيتم حذف:</DialogDescription>
          </DialogHeader>
          <ul className="text-sm list-disc pr-5 text-muted-foreground space-y-1">
            <li>المطعم</li>
            <li>كل المنيو</li>
            <li>كل الطاولات</li>
            <li>كل الطلبات</li>
            <li>كل التقييمات</li>
          </ul>
          <div className="space-y-2 mt-2">
            <Label htmlFor="confirm">اكتب اسم المطعم للتأكيد</Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={r.name}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              إلغاء
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={confirmText.trim() !== r.name.trim() || deleting}
              onClick={onDelete}
            >
              {deleting && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              حذف نهائياً
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
