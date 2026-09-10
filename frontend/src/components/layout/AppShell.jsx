import { useState } from "react";
import { Link, NavLink, Navigate, useLocation } from "react-router-dom";
import {
  Bell,
  Building2,
  ClipboardList,
  Cog,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MapPinned,
  ScrollText,
  Radio,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMe, useNotifications } from "@/lib/queries";
import { apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { endSession } from "@/lib/session";
import { fmtDateTime } from "@/lib/helpers";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: "*" },
  { to: "/assets", label: "Assets", icon: MapPinned, roles: "*" },
  { to: "/queue", label: "Interest Queue", icon: ListOrdered, roles: "*" },
  { to: "/campaigns", label: "Campaigns", icon: ClipboardList, roles: "*" },
  { to: "/brands", label: "Brands", icon: Building2, roles: "*" },
  { to: "/audit", label: "Audit Trail", icon: ScrollText, roles: "*" },
  { to: "/admin", label: "Admin", icon: Cog, roles: ["admin"] },
];

function visibleNav(role) {
  return NAV.filter((n) => n.roles === "*" || n.roles.includes(role));
}

function NotificationDrawer() {
  const { data } = useNotifications();
  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;
  const readAll = useMutation({
    mutationFn: () => apiPost("/notifications/read-all"),
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
    <div className="min-h-screen bg-background md:grid md:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="flex items-center gap-2 px-5 py-5">
          <Radio className="size-5 text-primary" />
          <div>
            <p className="font-heading text-sm font-bold leading-tight tracking-tight">OOH-Sync</p>
            <p className="mono-label text-muted-foreground">Asset IMS</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )
              }
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-4 py-4">
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

      <div className="flex min-h-screen flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-3 border-b border-border/70 bg-background/85 px-4 py-4 backdrop-blur-xl md:px-8">
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl" data-testid="page-title">
              {title}
            </h1>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {actions}
            <NotificationDrawer />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              disabled={signingOut}
              onClick={signOut}
              className="md:hidden"
              data-testid="mobile-sign-out-button"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 md:px-8 md:py-7">
          {isLoading ? (
            <div className="h-32 animate-pulse rounded-xl border border-border/60 bg-card/40" />
          ) : (
            children
          )}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-sidebar-border bg-sidebar/95 backdrop-blur-xl md:hidden"
        data-testid="mobile-tab-bar"
      >
        {nav.slice(0, 5).map(({ to, label, icon: Icon }) => {
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition-colors duration-150",
                active ? "text-primary" : "text-sidebar-foreground/60",
              )}
              data-testid={`mobile-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Icon className="size-5" />
              {label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
