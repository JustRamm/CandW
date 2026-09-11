import { useState } from "react";
import { Link, NavLink, Navigate, useLocation } from "react-router-dom";
import {
  Bell,
  Briefcase,
  Building2,
  Clock,
  History,
  LayoutGrid,
  LogOut,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import { motion } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/skeletons";
import BrandDoodles from "@/components/shared/BrandDoodles";
import { useMe, useNotifications } from "@/lib/queries";
import { supabase } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { endSession } from "@/lib/session";
import { fmtDateTime } from "@/lib/helpers";
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

function NotificationDrawer() {
  const { data } = useNotifications();
  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;
  const readAll = useMutation({
    mutationFn: async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", authData.user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Notifications"
            className="relative"
            data-testid="notifications-trigger"
          />
        }
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white"
            data-testid="notifications-unread-count"
          >
            {unread}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-heading">Notifications</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          <Button
            variant="outline"
            size="xs"
            disabled={!unread || readAll.isPending}
            onClick={() => readAll.mutate()}
            data-testid="notifications-mark-all-read"
          >
            Mark all read
          </Button>
        </div>
        <ul className="space-y-2 px-4 pb-8" data-testid="notifications-list">
          {items.length === 0 && (
            <li className="text-sm text-muted-foreground" data-testid="notifications-empty">
              Nothing yet — workflow events will appear here.
            </li>
          )}
          {items.map((n) => (
            <li
              key={n.id}
              className={cn(
                "rounded-lg border px-3 py-2.5 transition-colors duration-150",
                n.read ? "border-border/60 bg-card/40" : "border-primary/40 bg-primary/5",
              )}
              data-testid="notification-item"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading text-sm font-medium">{n.title}</p>
                {!n.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
              <p className="mono-label mt-1.5 text-muted-foreground">{fmtDateTime(n.created_at)}</p>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

export default function AppShell({ children, title, subtitle, actions }) {
  const { data: me, isError, isLoading } = useMe();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  if (isError) {
    // Not authenticated (or the session expired) — send the visitor straight to sign in
    // instead of parking them on a dead-end panel.
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
          <p className="truncate font-heading text-sm font-medium" data-testid="sidebar-user-name">
            {me?.name ?? "…"}
          </p>
          <Badge variant="outline" className="mono-label mt-1 border-primary/40 text-primary" data-testid="sidebar-user-role">
            {me?.role_label ?? ""}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            disabled={signingOut}
            onClick={signOut}
            className="mt-3 w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            data-testid="sign-out-button"
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-y-auto pb-20 md:pb-0">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-4 py-3 sm:py-4 backdrop-blur-xl md:px-8">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <h1 className="font-heading text-lg font-bold tracking-tight sm:text-xl md:text-2xl truncate" data-testid="page-title">
                  {title}
                </h1>
                {subtitle && <p className="mt-0.5 text-xs text-muted-foreground truncate sm:whitespace-normal">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-1 sm:hidden shrink-0">
                <NotificationDrawer />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Sign out"
                  disabled={signingOut}
                  onClick={signOut}
                  data-testid="mobile-sign-out-button"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap min-w-0">
              {actions && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {actions}
                </div>
              )}
              <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                <NotificationDrawer />
              </div>
            </div>
          </div>
        </header>
        <main className="relative flex-1 px-4 py-4 md:px-8 md:py-6 max-w-full min-h-full">
          <BrandDoodles />
          <div className="relative z-10">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-48 rounded-lg" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Skeleton className="h-44 rounded-xl" />
                  <Skeleton className="h-44 rounded-xl" />
                  <Skeleton className="h-44 rounded-xl" />
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-sidebar-border bg-sidebar/95 backdrop-blur-xl px-1 py-1.5 md:hidden overflow-x-auto scrollbar-none"
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
