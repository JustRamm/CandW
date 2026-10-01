import { useState, useEffect } from "react";
import { Link, NavLink, Navigate, useLocation } from "react-router-dom";
import {
  Briefcase,
  Building2,
  ChevronLeft,
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

const NAV_GROUPS = [
  {
    category: "Workspace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, roles: "*" },
      { to: "/assets", label: "Assets", icon: MapPin, roles: "*" },
      { to: "/queue", label: "Interest Queue", icon: Clock, roles: "*" },
      { to: "/campaigns", label: "Campaigns", icon: Briefcase, roles: "*" },
      { to: "/brands", label: "Brands", icon: Building2, roles: "*" },
    ],
  },
  {
    category: "System",
    items: [
      { to: "/audit", label: "Audit Trail", icon: History, roles: "*" },
      { to: "/admin", label: "Admin", icon: SlidersHorizontal, roles: ["admin"] },
    ],
  },
];

function visibleNav(role) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((n) => n.roles === "*" || n.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

function flatVisibleNav(role) {
  return NAV_GROUPS.flatMap((g) => g.items).filter((n) => n.roles === "*" || n.roles.includes(role));
}

export default function AppShell({
  children,
  title,
  subtitle,
  actions,
  backTo,
  backLabel,
  backTestId,
}) {
  const { data: me } = useMe();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);
  const [soundOn, setSoundOn] = useState(sound.isEnabled());

  const isDashboard = location.pathname === "/dashboard" || location.pathname === "/";

  // Auto-resolve backTo if on a detail screen
  let resolvedBackTo = backTo;
  let resolvedBackLabel = backLabel;
  let resolvedBackTestId = backTestId;

  if (!resolvedBackTo) {
    if (location.pathname.startsWith("/campaigns/") && location.pathname !== "/campaigns") {
      resolvedBackTo = "/campaigns";
      resolvedBackLabel = "Campaigns";
      resolvedBackTestId = "back-to-campaigns";
    } else if (location.pathname.startsWith("/brands/") && location.pathname !== "/brands") {
      resolvedBackTo = "/brands";
      resolvedBackLabel = "Brands";
      resolvedBackTestId = "back-to-brands";
    } else if (location.pathname.startsWith("/assets/") && location.pathname !== "/assets") {
      resolvedBackTo = "/assets";
      resolvedBackLabel = "Assets";
      resolvedBackTestId = "back-to-assets";
    }
  }

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
  const navGroups = visibleNav(role);
  const mobileNav = flatVisibleNav(role);

  async function signOut() {
    setSigningOut(true);
    toast.info("Signing out…");
    await endSession("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-[236px] shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col h-screen select-none">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border/60 shrink-0">
          <img
            src="/brand/logo.svg"
            alt="Carbon & Whale"
            className="size-9 object-contain shrink-0 transition-transform duration-200 hover:scale-105"
          />
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-bold leading-tight tracking-tight text-foreground truncate">
              Carbon &amp; Whale
            </p>
          </div>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 space-y-4 px-3 py-3 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.category} className="space-y-1">
              <p className="px-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.category}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => {
                  const isActive = location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => sound.click()}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
                        isActive
                          ? "font-semibold text-primary"
                          : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                      )}
                      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebarActive"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20 shadow-2xs dark:bg-primary/20"
                        />
                      )}
                      <Icon className={cn("size-4 relative z-10 shrink-0", isActive ? "stroke-[2.25] text-primary" : "text-muted-foreground")} />
                      <span className="relative z-10 truncate">{label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile Card Footer */}
        <div className="border-t border-sidebar-border p-3 shrink-0">
          <div className="rounded-xl border border-border/70 bg-card/60 p-2.5 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-7 rounded-lg bg-primary/15 text-primary font-heading font-bold text-xs flex items-center justify-center shrink-0">
                {me?.name?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
              <div className="min-w-0">
                <p className="truncate font-heading text-xs font-semibold text-foreground leading-none" data-testid="sidebar-user-name">
                  {me?.name ?? "…"}
                </p>
                <Badge variant="outline" className="mono-label text-[9px] px-1 py-0 border-primary/30 text-primary mt-1" data-testid="sidebar-user-role">
                  {me?.role_label ?? ""}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setSoundOn(sound.toggle())}
                title={soundOn ? "Mute sound FX" : "Enable sound FX"}
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                data-testid="sound-toggle-button"
              >
                {soundOn ? <Volume2 className="size-3.5 text-primary" /> : <VolumeX className="size-3.5 opacity-50" />}
              </button>
              <button
                type="button"
                disabled={signingOut}
                onClick={() => {
                  sound.click();
                  signOut();
                }}
                title="Sign out"
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                data-testid="sign-out-button"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          </div>
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
                <img
                  src="/brand/logo.svg"
                  alt="Carbon & Whale"
                  className="size-9 shrink-0 object-contain transition-transform group-hover:rotate-6 group-active:scale-90"
                />
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
            /* Other screens Mobile: Back button + Title + Subtitle on left, and OfflineSyncModal + NotificationCenter + SignOut on right (all in same horizontal header bar) */
            <div className="flex sm:hidden items-center justify-between gap-2.5 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {resolvedBackTo && (
                  <Link
                    to={resolvedBackTo}
                    onClick={() => sound.click()}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-secondary/60 text-foreground transition-all duration-150 hover:bg-secondary hover:text-primary active:scale-90 shadow-2xs"
                    data-testid={resolvedBackTestId || "back-to-parent"}
                    aria-label={resolvedBackLabel ? `Back to ${resolvedBackLabel}` : "Go back"}
                    title={resolvedBackLabel ? `Back to ${resolvedBackLabel}` : "Go back"}
                  >
                    <ChevronLeft className="size-5 stroke-[2.5] -translate-x-0.5" />
                  </Link>
                )}
                <div className="min-w-0 flex-1">
                  <h1 className="font-heading text-lg font-bold tracking-tight truncate leading-tight" data-testid="mobile-page-title">
                    {title}
                  </h1>
                  {subtitle && <p className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</p>}
                </div>
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

          {/* Desktop view: Always renders back button, title, subtitle, actions, OfflineSyncModal and notification center */}
          <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {resolvedBackTo && (
                <Link
                  to={resolvedBackTo}
                  onClick={() => sound.click()}
                  className="flex size-8.5 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-secondary/50 text-foreground transition-all duration-150 hover:bg-secondary hover:text-primary hover:border-primary/40 active:scale-90 shadow-2xs"
                  data-testid={resolvedBackTestId || "desktop-back-to-parent"}
                  aria-label={resolvedBackLabel ? `Back to ${resolvedBackLabel}` : "Go back"}
                  title={resolvedBackLabel ? `Back to ${resolvedBackLabel}` : "Go back"}
                >
                  <ChevronLeft className="size-5 stroke-[2.5] -translate-x-0.5" />
                </Link>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="font-heading text-lg font-bold tracking-tight sm:text-xl md:text-2xl truncate" data-testid="page-title">
                  {title}
                </h1>
                {subtitle && <p className="mt-0.5 text-xs text-muted-foreground truncate sm:whitespace-normal">{subtitle}</p>}
              </div>
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

          {/* If mobile and NOT dashboard and actions exist, render them with smooth horizontal scrolling */}
          {!isDashboard && actions && (
            <div className="mt-2.5 flex sm:hidden items-center gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 pb-0.5 pt-0.5">
              {actions}
            </div>
          )}
        </header>
        <main className="relative flex-1 px-4 py-4 md:px-8 md:py-6 max-w-full pb-20 md:pb-12 flex flex-col">
          <BrandDoodles />
          <div className="relative z-10 flex-1 flex flex-col">
            {children}
          </div>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-sidebar-border bg-sidebar/95 backdrop-blur-xl px-1 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden overflow-x-auto scrollbar-none shadow-lg"
        data-testid="mobile-tab-bar"
      >
        {mobileNav.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));
          const isCampaign = to === "/campaigns";
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
                "relative flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors duration-150 text-center select-none overflow-visible",
                isCampaign ? "flex-[1.35] min-w-[64px] max-w-[84px]" : "flex-1 min-w-[42px] max-w-[62px]",
                active ? "text-[#00668a] font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`mobile-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {active && (
                <motion.div
                  layoutId="mobileActiveTab"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className={cn(
                    "absolute -inset-y-1 rounded-xl bg-sky-100/80 border border-sky-200/90 shadow-xs dark:bg-sky-950/60 dark:border-sky-800 pointer-events-none",
                    isCampaign ? "w-[76px] left-1/2 -translate-x-1/2" : "-inset-x-1",
                  )}
                />
              )}
              <Icon className={cn("size-4.5 shrink-0 relative z-10 transition-transform duration-200", active && "scale-110 stroke-[2.25] text-[#00668a]")} />
              <span className="truncate max-w-full relative z-10 px-0.5">{shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
