import { useState, useEffect } from "react";
import { Link, NavLink, Navigate, useLocation } from "react-router-dom";
import {
  Briefcase,
  Building2,
  Clock,
  History,
  LayoutGrid,
  LogOut,
  MapPin,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BrandDoodles from "@/components/shared/BrandDoodles";
import NotificationCenter from "@/components/shared/NotificationCenter";
import OfflineSyncModal from "@/components/shared/OfflineSyncModal";
import { useMe } from "@/lib/queries";

import { endSession } from "@/lib/session";
import { initRealtimeFeed } from "@/lib/realtime";
import sound from "@/lib/sound";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, roles: "*" },
  { to: "/assets", label: "Assets", icon: MapPin, roles: "*" },
  { to: "/queue", label: "Interest Queue", icon: Clock, roles: "*" },
  { to: "/campaigns", label: "Campaigns", icon: Briefcase, roles: "*" },
  { to: "/brands", label: "Brands", icon: Building2, roles: "*" },
  { to: "/audit", label: "Audit Trail", icon: History, roles: "*" },
  { to: "/admin", label: "Admin", icon: SlidersHorizontal, roles: ["admin"] },
];

function visibleNav(role) {
  return NAV.filter((n) => n.roles === "*" || n.roles.includes(role));
}

export default function AppShell({ children, title, subtitle, actions }) {
  const { data: me } = useMe();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);
  const [soundOn, setSoundOn] = useState(sound.isEnabled());

  const isDashboard = location.pathname === "/dashboard" || location.pathname === "/";

  useEffect(() => {
    if (me?.id) {
      initRealtimeFeed(me);
    }
  }, [me?.id]);


  if (!me || !me.id) {
    // Not authenticated — send visitor straight to sign in
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const role = me?.role ?? "";
  const nav = visibleNav(role);

  async function signOut() {
    setSigningOut(true);
    toast.info("Signing out…");
    await endSession("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-[248px] shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col h-screen select-none">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border/60 shrink-0">
          <div className="flex size-9 items-center justify-center rounded-xl bg-slate-900 p-1.5 shadow-xs">
            <img src="/brand/logo.svg" alt="Carbon & Whale" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-bold leading-tight tracking-tight text-foreground truncate">Carbon &amp; Whale</p>
            <p className="mono-label text-[10px] text-muted-foreground">OOH-Sync · Asset IMS</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-3 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));
            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => sound.click()}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                  isActive
                    ? "font-semibold text-[#00668a]"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                )}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebarActive"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    className="absolute inset-0 rounded-lg bg-sky-50 border border-sky-200/80 shadow-xs dark:bg-sky-950/40 dark:border-sky-800"
                  />
                )}
                {isActive && (
                  <motion.span
                    layoutId="sidebarIndicator"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#00668a]"
                  />
                )}
                <Icon className={cn("size-4 relative z-10", isActive && "stroke-[2.25] text-[#00668a]")} />
                <span className="relative z-10">{label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border px-4 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-medium" data-testid="sidebar-user-name">
                {me?.name ?? "…"}
              </p>
              <Badge variant="outline" className="mono-label mt-1 border-primary/40 text-primary" data-testid="sidebar-user-role">
                {me?.role_label ?? ""}
              </Badge>
            </div>
            <button
              type="button"
              onClick={() => setSoundOn(sound.toggle())}
              title={soundOn ? "Mute interface sound effects" : "Enable interface sound effects"}
              className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              data-testid="sound-toggle-button"
            >
              {soundOn ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4 opacity-50" />}
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={signingOut}
            onClick={() => {
              sound.click();
              signOut();
            }}
            className="mt-3 w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            data-testid="sign-out-button"
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0 h-[100dvh] md:h-screen overflow-y-auto overflow-x-hidden">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-4 py-3 sm:py-4 backdrop-blur-xl md:px-8">
          {/* Mobile view only */}
          {isDashboard ? (
            /* Dashboard Mobile: Carbon & Whale Logo + User Name on left; Bell + Logout on right */
            <div className="flex sm:hidden items-center justify-between gap-3 min-w-0 w-full py-0.5">
              <button
                type="button"
                onClick={() => {
                  sound.refresh();
                  setTimeout(() => window.location.reload(), 120);
                }}
                title="Click logo to refresh application"
                className="group flex items-center gap-2.5 min-w-0 cursor-pointer rounded-xl text-left transition-transform active:scale-95 focus:outline-hidden"
                data-testid="mobile-dashboard-logo-refresh"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 p-1.5 shadow-xs ring-1 ring-white/10 transition-transform group-hover:rotate-6 group-active:scale-90">
                  <img src="/brand/logo.svg" alt="Carbon & Whale" className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-heading text-base font-bold tracking-tight text-foreground">
                    {me?.name ?? "User"}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                <OfflineSyncModal />
                <NotificationCenter />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Sign out"
                  disabled={signingOut}
                  onClick={() => {
                    sound.click();
                    signOut();
                  }}
                  data-testid="mobile-sign-out-button"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            /* Other screens Mobile: Title + Subtitle + OfflineSyncModal + NotificationCenter + SignOut */
            <div className="flex sm:hidden items-center justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <h1 className="font-heading text-lg font-bold tracking-tight truncate" data-testid="mobile-page-title">
                  {title}
                </h1>
                {subtitle && <p className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <OfflineSyncModal />
                <NotificationCenter />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Sign out"
                  disabled={signingOut}
                  onClick={() => {
                    sound.click();
                    signOut();
                  }}
                  data-testid="mobile-sign-out-button"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Desktop view: Always renders title, subtitle, actions, OfflineSyncModal and notification center */}
          <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-lg font-bold tracking-tight sm:text-xl md:text-2xl truncate" data-testid="page-title">
                {title}
              </h1>
              {subtitle && <p className="mt-0.5 text-xs text-muted-foreground truncate sm:whitespace-normal">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {actions && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {actions}
                </div>
              )}
              <OfflineSyncModal />
              <NotificationCenter />
            </div>
          </div>

          {/* If mobile and NOT dashboard and actions exist, render them */}
          {!isDashboard && actions && (
            <div className="mt-2.5 flex sm:hidden items-center gap-1.5 flex-wrap">
              {actions}
            </div>
          )}
        </header>
        <main className="relative flex-1 px-4 py-4 md:px-8 md:py-6 max-w-full pb-40 md:pb-12">
          <BrandDoodles />
          <div className="relative z-10 pb-6 md:pb-0">
            {children}
            {/* Safe area spacer to guarantee last cards are never hidden behind fixed mobile nav */}
            <div className="h-20 md:hidden w-full pointer-events-none" aria-hidden="true" />
          </div>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-sidebar-border bg-sidebar/95 backdrop-blur-xl px-1 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden overflow-x-auto scrollbar-none shadow-lg"
        data-testid="mobile-tab-bar"
      >
        {nav.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));
          const shortLabel =
            label === "Interest Queue"
              ? "Queue"
              : label === "Audit Trail"
                ? "Audit"
                : label === "Dashboard"
                  ? "Dash"
                  : label.split(" ")[0];
          return (
            <Link
              key={to}
              to={to}
              onClick={() => sound.click()}
              className={cn(
                "relative flex flex-1 min-w-[48px] max-w-[68px] flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors duration-150 text-center select-none",
                active ? "text-[#00668a] font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`mobile-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {active && (
                <motion.div
                  layoutId="mobileActiveTab"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute inset-x-1 inset-y-0.5 rounded-xl bg-sky-100/70 border border-sky-200/80 shadow-xs dark:bg-sky-950/50 dark:border-sky-800"
                />
              )}
              <Icon className={cn("size-4.5 shrink-0 relative z-10 transition-transform duration-200", active && "scale-110 stroke-[2.25] text-[#00668a]")} />
              <span className="truncate max-w-full relative z-10">{shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
