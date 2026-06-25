import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Truck,
  Users,
  Trash2,
  LogOut,
  ArrowRight,
  ChefHat,
  BarChart3,
  Wallet,
  TrendingUp,
  Heart,
  MessageSquareWarning,
  ClipboardCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AdminChatBot } from "@/components/AdminChatBot";
import { tx } from "@/lib/ops-tx";
import { useTranslation } from "react-i18next";


export const Route = createFileRoute("/ops")({
  beforeLoad: requireAuth,
  component: OpsLayout,
});

type NavItem = {
  to:
    | "/ops"
    | "/ops/inventory"
    | "/ops/recipes"
    | "/ops/suppliers"
    | "/ops/employees"
    | "/ops/waste"
    | "/ops/expenses"
    | "/ops/reports"
    | "/ops/staff-performance"
    | "/ops/customers"
    | "/ops/complaints"
    | "/ops/inventory-count"
    ;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  roles?: string[]; // which roles can see this item (undefined = all)
};

const ALL_NAV: NavItem[] = [
  { to: "/ops", label: tx("نظرة عامة"), icon: LayoutDashboard, exact: true, roles: ["admin", "operations_manager", "hr_manager", "purchasing_manager"] },
  { to: "/ops/inventory", label: tx("المخزون"), icon: Package, roles: ["admin", "operations_manager", "production_manager", "purchasing_manager"] },
  { to: "/ops/inventory-count", label: tx("جرد المخزون"), icon: ClipboardCheck, roles: ["admin", "operations_manager", "production_manager", "purchasing_manager"] },
  { to: "/ops/recipes", label: tx("الوصفات"), icon: ChefHat, roles: ["admin", "operations_manager", "production_manager"] },
  { to: "/ops/suppliers", label: tx("الموردين"), icon: Truck, roles: ["admin", "operations_manager", "purchasing_manager"] },
  { to: "/ops/employees", label: tx("الموظفين"), icon: Users, roles: ["admin", "hr_manager", "operations_manager"] },
  { to: "/ops/staff-performance", label: tx("أداء الموظفين"), icon: TrendingUp, roles: ["admin", "hr_manager", "operations_manager", "production_manager"] },
  { to: "/ops/customers", label: tx("العملاء والولاء"), icon: Heart, roles: ["admin", "operations_manager"] },
  { to: "/ops/expenses", label: tx("المصاريف"), icon: Wallet, roles: ["admin", "operations_manager", "purchasing_manager"] },
  { to: "/ops/waste", label: tx("سجل الهدر"), icon: Trash2, roles: ["admin", "operations_manager", "production_manager"] },
  { to: "/ops/complaints", label: tx("الشكاوى"), icon: MessageSquareWarning, roles: ["admin", "operations_manager"] },
  { to: "/ops/reports", label: tx("التقارير"), icon: BarChart3, roles: ["admin", "operations_manager", "hr_manager"] },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "مالك",
  staff: "موظف",
  production_manager: "مسؤول الإنتاج",
  operations_manager: "مسؤول التشغيل",
  hr_manager: "مسؤول الموارد البشرية",
  purchasing_manager: "مسؤول المشتريات",
};

// Roles that should land on their first allowed page instead of the overview
const REDIRECT_FROM_OVERVIEW: Record<string, string> = {
  production_manager: "/ops/inventory",
  purchasing_manager: "/ops/inventory",
  hr_manager: "/ops/employees",
};

function OpsLayout() {
  useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  // null = still loading, avoids showing wrong nav items before role is fetched
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      const role = data?.role ?? "admin";
      setUserRole(role);
      // If this role can't access the overview page and the user landed there, redirect
      if ((pathname === "/ops" || pathname === "/ops/") && REDIRECT_FROM_OVERVIEW[role]) {
        navigate({ to: REDIRECT_FROM_OVERVIEW[role] as "/ops/inventory" | "/ops/employees", replace: true });
      }
    })();
  }, []);

  // Don't render nav until role is known — prevents flicker showing wrong items
  const NAV = userRole === null
    ? []
    : ALL_NAV.filter((item) => !item.roles || item.roles.includes(userRole));

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const current = NAV.find((n) => isActive(n.to, n.exact));

  return (
    <div className="min-h-screen flex md:gap-5 md:p-5 bg-background" dir="rtl">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col glass shadow-glass rounded-2xl md:w-[84px] lg:w-[256px] shrink-0 sticky top-5 h-[calc(100vh-2.5rem)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 lg:px-5 h-[72px] border-b border-border/60">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold shrink-0 shadow-sm">
            Op
          </div>
          <div className="leading-tight hidden lg:block min-w-0">
            <div className="font-bold text-sm truncate text-foreground">{tx("إدارة العمليات")}</div>
            <div className="text-[11px] font-medium text-muted-foreground">
              {ROLE_LABELS[userRole] ?? "Ops"}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all lg:justify-start justify-center ${
                  active
                    ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20"
                    : "text-muted-foreground font-medium hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/60 space-y-1.5">
          {userRole === "admin" && (
            <Link
              to="/dashboard"
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground font-medium hover:bg-muted hover:text-foreground transition lg:justify-start justify-center"
            >
              <ArrowRight className="w-[18px] h-[18px] shrink-0" />
              <span className="hidden lg:inline">{tx("لوحة التحكم")}</span>
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground font-medium hover:bg-muted hover:text-foreground transition lg:justify-start justify-center"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className="hidden lg:inline">{tx("خروج")}</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 md:gap-5">
        <header className="h-[72px] glass shadow-glass md:rounded-2xl flex items-center justify-between px-4 md:px-6 sticky top-0 md:top-5 z-30">
          <div className="min-w-0">
            <h2 className="font-bold text-lg md:text-xl text-foreground truncate tracking-tight">
              {current?.label ?? tx("إدارة العمليات")}
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              {ROLE_LABELS[userRole] ?? tx("إدارة العمليات اليومية")}
            </p>
          </div>
          {userRole === "admin" && (
            <Link
              to="/dashboard"
              className="md:hidden text-xs text-muted-foreground hover:text-foreground"
            >
              {tx("لوحة التحكم")}
            </Link>
          )}
        </header>

        <main className="flex-1 px-4 md:px-2 pb-24 md:pb-2">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 glass shadow-glass rounded-2xl z-30 flex justify-between gap-1 py-2 px-2 overflow-x-auto">
        {NAV.map((item) => {
          const active = isActive(item.to, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 shrink-0 min-w-[58px] px-2 py-1.5 rounded-xl text-[10px] whitespace-nowrap transition ${
                active ? "text-primary font-semibold bg-primary/10" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <AdminChatBot />
    </div>
  );
}
