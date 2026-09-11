import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  X,
} from "lucide-react";
import {
  subscribeToNotificationFeed,
  markAllNotificationsRead,
  markNotificationRead,
  clearAllNotifications,
  triggerTestNotification,
} from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function timeAgo(isoString) {
  if (!isoString) return "";
  const sec = Math.floor((new Date() - new Date(isoString)) / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeToNotificationFeed((list) => {
      setNotifications(list);
    });
    return unsubscribe;
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((prev) => !prev)}
        className="relative size-9 rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
        aria-label="View notifications"
        data-testid="notifications-bell-button"
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-background animate-in zoom-in-75 duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Popover */}
      {open && (
        <div
          className={cn(
            "absolute right-0 mt-2 z-50 w-80 sm:w-96 rounded-2xl border border-border/80 bg-card p-0 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150",
            // Mobile alignment
            "max-sm:fixed max-sm:inset-x-3 max-sm:top-14 max-sm:w-auto"
          )}
          data-testid="notifications-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/25 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-semibold text-foreground">
                Live updates
              </span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-4.5">
                  {unreadCount} new
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={markAllNotificationsRead}
                  className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  title="Mark all as read"
                >
                  <CheckCheck className="size-3 mr-1" />
                  Read all
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearAllNotifications}
                  className="size-6 text-muted-foreground hover:text-destructive"
                  title="Clear all"
                >
                  <Trash2 className="size-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="size-6 text-muted-foreground hover:text-foreground sm:hidden"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40 p-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <div className="rounded-full bg-muted/60 p-3 mb-2">
                  <Sparkles className="size-5 text-muted-foreground/60" />
                </div>
                <p className="text-xs font-medium">All caught up!</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5 max-w-[240px]">
                  Live queue promotions, approvals, and campaign stage updates will surface here.
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={triggerTestNotification}
                  className="mt-3 text-[11px] gap-1 cursor-pointer"
                  data-testid="test-notification-button"
                >
                  <Sparkles className="size-3 text-primary" />
                  Test live alert
                </Button>
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !item.read;
                const Icon =
                  item.type === "success"
                    ? CheckCircle2
                    : item.type === "warning"
                    ? AlertTriangle
                    : Info;

                const iconColor =
                  item.type === "success"
                    ? "text-emerald-600 bg-emerald-500/10"
                    : item.type === "warning"
                    ? "text-amber-600 bg-amber-500/10"
                    : "text-sky-600 bg-sky-500/10";

                const content = (
                  <div
                    className={cn(
                      "group flex items-start gap-3 rounded-xl p-3 transition-colors duration-150 cursor-pointer",
                      isUnread
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/50 text-muted-foreground"
                    )}
                    onClick={() => {
                      markNotificationRead(item.id);
                      if (item.link) setOpen(false);
                    }}
                  >
                    <div className={cn("size-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", iconColor)}>
                      <Icon className="size-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn("text-xs font-semibold truncate", isUnread ? "text-foreground" : "text-foreground/80")}>
                          {item.title}
                        </p>
                        <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">
                          {timeAgo(item.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {item.message}
                      </p>
                    </div>

                    {isUnread && (
                      <span className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
                  </div>
                );

                return item.link ? (
                  <Link key={item.id} to={item.link} className="block">
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
