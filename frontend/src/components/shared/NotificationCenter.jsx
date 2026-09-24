import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Briefcase,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import {
  subscribeToNotificationFeed,
  markAllNotificationsRead,
  markNotificationRead,
  toggleNotificationRead,
  deleteNotification,
  clearAllNotifications,
  evaluateSystemAlerts,
} from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/lib/queries";
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
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const containerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeToNotificationFeed((list) => {
      setNotifications(list);
    });
    return unsubscribe;
  }, []);

  // Check system alerts when opened
  useEffect(() => {
    if (open) {
      evaluateSystemAlerts(me);
    }
  }, [open, me]);

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

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "inventory") return item.category === "inventory" || item.category === "brand";
    if (activeTab === "expiry") return item.category === "queue_expiry";
    if (activeTab === "gtp") return item.category === "gtp_overdue";
    if (activeTab === "campaigns") return item.category === "campaign_stage" || item.category === "new_interest";
    return true;
  });

  const getCategoryBadge = (category) => {
    switch (category) {
      case "inventory":
        return <Badge variant="outline" className="text-[9px] px-1 py-0 text-cyan-500 border-cyan-500/30">Asset</Badge>;
      case "brand":
        return <Badge variant="outline" className="text-[9px] px-1 py-0 text-purple-500 border-purple-500/30">Brand</Badge>;
      case "queue_expiry":
        return <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-500 border-amber-500/30">Queue Expiry</Badge>;
      case "gtp_overdue":
        return <Badge variant="outline" className="text-[9px] px-1 py-0 text-rose-500 border-rose-500/30">GTP Overdue</Badge>;
      case "campaign_stage":
        return <Badge variant="outline" className="text-[9px] px-1 py-0 text-sky-500 border-sky-500/30">Campaign</Badge>;
      case "new_interest":
        return <Badge variant="outline" className="text-[9px] px-1 py-0 text-emerald-500 border-emerald-500/30">Interest</Badge>;
      default:
        return null;
    }
  };

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
            "absolute right-0 mt-2 z-50 w-80 sm:w-[490px] md:w-[520px] rounded-2xl border border-border/80 bg-card p-0 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150",
            // Mobile alignment
            "max-sm:fixed max-sm:inset-x-3 max-sm:top-14 max-sm:w-auto"
          )}
          data-testid="notifications-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/25 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-semibold text-foreground">
                Notification Center
              </span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-4.5">
                  {unreadCount} unread
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={markAllNotificationsRead}
                  className="h-6 px-2 text-[11px] font-medium text-primary hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="size-3.5 mr-1" />
                  Mark all read
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

          {/* Category Tabs — Fitted horizontally without scroll */}
          <div className="px-3 py-2 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-1.5 justify-start text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0",
                  activeTab === "all" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/60"
                )}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("inventory")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0",
                  activeTab === "inventory" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/60"
                )}
              >
                Assets & Brands
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("expiry")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0",
                  activeTab === "expiry" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/60"
                )}
              >
                Queue Expiry
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("gtp")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0",
                  activeTab === "gtp" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/60"
                )}
              >
                GTP Alerts
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("campaigns")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0",
                  activeTab === "campaigns" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-secondary/60"
                )}
              >
                Campaigns
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40 p-1">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <div className="rounded-full bg-muted/60 p-3 mb-2">
                  <Sparkles className="size-5 text-muted-foreground/60" />
                </div>
                <p className="text-xs font-medium">All caught up</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5 max-w-[260px]">
                  New assets, brand updates, queue expiry warnings, and campaign updates will surface here.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
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
                      "group relative flex items-start gap-2.5 rounded-xl p-2.5 transition-colors duration-150 cursor-pointer",
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

                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className={cn("text-xs font-semibold truncate", isUnread ? "text-foreground" : "text-foreground/80")}>
                            {item.title}
                          </p>
                          {getCategoryBadge(item.category)}
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">
                          {timeAgo(item.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                        {item.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      {isUnread ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markNotificationRead(item.id);
                          }}
                          className="rounded-md p-1 text-primary hover:bg-primary/15 transition-colors cursor-pointer"
                          title="Mark as read"
                          aria-label="Mark as read"
                        >
                          <Check className="size-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleNotificationRead(item.id);
                          }}
                          className="rounded-md p-1 text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                          title="Mark as unread"
                          aria-label="Mark as unread"
                        >
                          <span className="size-2 rounded-full border border-muted-foreground/60 inline-block" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteNotification(item.id);
                        }}
                        className="rounded-md p-1 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                        title="Delete notification"
                        aria-label="Delete notification"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
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
