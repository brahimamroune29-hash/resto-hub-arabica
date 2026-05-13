import { useEffect, useState } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  ShoppingBag,
  UtensilsCrossed,
  LayoutGrid,
  BarChart3,
  Star,
  Settings,
  LogOut,
  User,
  Boxes,
} from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { AdminChatBot } from "@/components/AdminChatBot";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationsBell } from "@/components/NotificationsBell";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: requireAuth,
  component: DashboardLayout,
});

const NAV_ITEMS = [
  { to: "/dashboard/orders", key: "orders", icon: ShoppingBag },
  { to: "/dashboard/menu", key: "menu", icon: UtensilsCrossed },
  { to: "/dashboard/tables", key: "tables", icon: LayoutGrid },
  { to: "/dashboard/analytics", key: "analytics", icon: BarChart3 },
  { to: "/ops", key: "ops", icon: Boxes },
  { to: "/dashboard/reviews", key: "reviews", icon: Star },
  { to: "/dashboard/settings", key: "settings", icon: Settings },
] as const;

type Restaurant = { name: string; logo_url: string | null };

function DashboardLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const { t } = useTranslation();
  const [staffRestaurantIds, setStaffRestaurantIds] = useState<Set<string>>(new Set());
  const [isStaffOnly, setIsStaffOnly] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      // Auto-accept any pending invitations matching this user's email
      try {
        const email = u.user.email;
        if (email) {
          const { data: pending } = await supabase
            .from("staff_invitations")
            .select("id, restaurant_id, role")
            .eq("email", email.toLowerCase())
            .eq("accepted", false);
          if (pending && pending.length) {
            for (const inv of pending) {
              await supabase.from("user_roles").insert({
                user_id: u.user.id,
                restaurant_id: inv.restaurant_id,
                role: inv.role,
              });
              await supabase
                .from("staff_invitations")
                .update({ accepted: true })
                .eq("id", inv.id);
            }
          }
        }
      } catch {
        // ignore - user might not have any invitations
      }
      const { data } = await supabase
        .from("restaurants")
        .select("id, name, logo_url")
        .eq("owner_id", u.user.id)
        .maybeSingle();
      if (data) {
        setRestaurant({ name: data.name, logo_url: data.logo_url });
        setRestaurantId(data.id);
        return;
      }
      // If user has no owned restaurant, check if they're staff somewhere
      const { data: roles } = await supabase
        .from("user_roles")
        .select("restaurant_id, restaurants:restaurant_id(name, logo_url)")
        .eq("user_id", u.user.id);
      if (roles && roles.length) {
        setIsStaffOnly(true);
        setStaffRestaurantIds(new Set(roles.map((r) => r.restaurant_id)));
        const first = roles[0] as unknown as {
          restaurants: { name: string; logo_url: string | null } | null;
        };
        if (first.restaurants) setRestaurant(first.restaurants);
        return;
      }
      // No restaurant and no staff role — send to setup
      navigate({ to: "/setup" });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const isActive = (to: string) =>
    pathname === to || pathname.startsWith(to + "/");

  const navItems = isStaffOnly
    ? NAV_ITEMS.filter((i) => i.to === "/dashboard/orders" || i.to === "/dashboard/menu")
    : NAV_ITEMS;

  const currentNav = navItems.find((i) => isActive(i.to)) ?? navItems[0];

  return (
    <div className="min-h-screen flex md:gap-5 md:p-5">
      {/* Floating Glass Sidebar (Desktop + Tablet) */}
      <aside className="hidden md:flex flex-col glass shadow-glass rounded-2xl md:w-[84px] lg:w-[256px] shrink-0 sticky top-5 h-[calc(100vh-2.5rem)] overflow-hidden">
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 lg:px-5 h-[72px] border-b border-border/60">
          {restaurant?.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-10 h-10 rounded-xl object-cover shrink-0 ring-1 ring-border"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold shrink-0 shadow-sm">
              {restaurant?.name?.[0] ?? "م"}
            </div>
          )}
          <div className="leading-tight hidden lg:block min-w-0">
            <div className="font-bold text-sm truncate text-foreground">
              {restaurant?.name ?? t("nav.myRestaurant")}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground">{t("nav.dashboard")}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all lg:justify-start justify-center ${
                  active
                    ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20"
                    : "text-muted-foreground font-medium hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="hidden lg:inline">{t(`nav.${item.key}`)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border/60">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground font-medium hover:bg-muted hover:text-foreground transition lg:justify-start justify-center"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className="hidden lg:inline">{t("nav.logout")}</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 md:gap-5">
        {/* Top Bar */}
        <header className="h-[72px] glass shadow-glass md:rounded-2xl flex items-center justify-between px-4 md:px-6 sticky top-0 md:top-5 z-30">
          <div className="min-w-0">
            <h2 className="font-bold text-lg md:text-xl text-foreground truncate tracking-tight">{t(`nav.${currentNav.key}`)}</h2>
            <p className="text-xs text-muted-foreground truncate">{t(`nav.sub.${currentNav.key}`)}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationsBell restaurantId={restaurantId} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30 flex items-center justify-center transition ring-1 ring-border">
                  <User className="w-5 h-5 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{t("nav.account")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="w-4 h-4 ml-2" />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 px-4 md:px-2 pb-24 md:pb-2">
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 glass shadow-glass rounded-2xl z-30 flex justify-between gap-1 py-2 px-2 overflow-x-auto">
        {navItems.map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 shrink-0 min-w-[58px] px-2 py-1.5 rounded-xl text-[10px] whitespace-nowrap transition ${
                active
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-muted-foreground"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span>{t(`nav.${item.key}`)}</span>
            </Link>
          );
        })}
      </nav>
      <AdminChatBot />
    </div>
  );
}