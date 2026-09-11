import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import sound from "@/lib/sound";

const STORAGE_KEY = "ims_notifications_v1";

// In-memory subscribers for UI updates
const listeners = new Set();

export function getStoredNotifications() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)));
  } catch {}
  listeners.forEach((fn) => fn(notifications));
}

export function subscribeToNotificationFeed(callback) {
  listeners.add(callback);
  callback(getStoredNotifications());
  return () => listeners.delete(callback);
}

export function addNotification(notif) {
  const current = getStoredNotifications();
  const newItem = {
    id: notif.id || crypto.randomUUID(),
    title: notif.title || "Update",
    message: notif.message || "",
    link: notif.link || null,
    type: notif.type || "info", // "info" | "success" | "warning" | "error"
    timestamp: notif.timestamp || new Date().toISOString(),
    read: false,
  };

  const updated = [newItem, ...current.filter((n) => n.id !== newItem.id)].slice(0, 50);
  saveNotifications(updated);

  // Play gentle crystal glass notification chime
  sound.notification();

  // Surface modern toast notification
  if (newItem.type === "success") {
    toast.success(newItem.title, { description: newItem.message });
  } else if (newItem.type === "warning") {
    toast.warning(newItem.title, { description: newItem.message });
  } else {
    toast.info(newItem.title, { description: newItem.message });
  }

  return newItem;
}

export function markAllNotificationsRead() {
  const current = getStoredNotifications();
  const updated = current.map((n) => ({ ...n, read: true }));
  saveNotifications(updated);
}

export function markNotificationRead(id) {
  const current = getStoredNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifications(updated);
}

export function clearAllNotifications() {
  saveNotifications([]);
}

let activeChannel = null;

/**
 * Initializes Supabase Realtime Channel
 * Listens to postgres_changes across queue_entries, campaigns, and audit_logs
 */
export function initRealtimeFeed() {
  if (activeChannel) return activeChannel;

  activeChannel = supabase
    .channel("ims-realtime-feed")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "queue_entries" },
      (payload) => {
        // Auto-refresh affected queries
        queryClient.invalidateQueries({ queryKey: ["queue"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["assets"] });

        const { eventType, new: record, old: oldRecord } = payload;

        if (eventType === "INSERT") {
          addNotification({
            title: "New Queue Interest",
            message: `${record.brand || "A brand"} added to queue for ${record.asset_code || "an asset"}.`,
            link: "/queue",
            type: "info",
          });
        } else if (eventType === "UPDATE") {
          if (oldRecord.state !== record.state) {
            if (record.state === "active") {
              addNotification({
                title: "Queue Slot Promoted",
                message: `${record.brand || "Brand"} is now ACTIVE for asset ${record.asset_code || ""}.`,
                link: "/queue",
                type: "warning",
              });
            } else if (record.state === "confirmed") {
              addNotification({
                title: "Queue Slot Confirmed",
                message: `${record.brand || "Brand"} confirmed into live campaign!`,
                link: "/campaigns",
                type: "success",
              });
            } else if (record.state === "cancelled") {
              addNotification({
                title: "Queue Slot Withdrawn",
                message: `Reservation for ${record.brand || "Brand"} was closed or withdrawn.`,
                link: "/queue",
                type: "info",
              });
            }
          }
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "campaigns" },
      (payload) => {
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        if (payload.new?.id) {
          queryClient.invalidateQueries({ queryKey: ["campaign", payload.new.id] });
        }

        const { eventType, new: record, old: oldRecord } = payload;
        if (eventType === "UPDATE") {
          if (oldRecord && oldRecord.stage !== record.stage) {
            addNotification({
              title: `Campaign Stage: ${record.stage.toUpperCase()}`,
              message: `${record.brand} advanced from ${oldRecord.stage} to ${record.stage}.`,
              link: `/campaigns/${record.id}`,
              type: "info",
            });
          }
        } else if (eventType === "INSERT") {
          addNotification({
            title: "New Campaign Created",
            message: `Campaign for ${record.brand} initialized on asset ${record.asset_code || ""}.`,
            link: `/campaigns/${record.id}`,
            type: "success",
          });
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "assets" },
      (payload) => {
        queryClient.invalidateQueries({ queryKey: ["assets"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });

        const { eventType, new: record, old: oldRecord } = payload;
        if (eventType === "INSERT") {
          addNotification({
            title: "New Asset Added",
            message: `${record.asset_code || "Asset"} (${record.location_name || "New Location"}) added to network inventory.`,
            link: `/assets/${record.id}`,
            type: "success",
          });
        } else if (eventType === "UPDATE") {
          if (oldRecord && oldRecord.status !== record.status) {
            addNotification({
              title: "Asset Status Changed",
              message: `${record.asset_code} moved from ${oldRecord.status} to ${record.status}.`,
              link: `/assets/${record.id}`,
              type: "info",
            });
          }
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "audit_logs" },
      () => {
        queryClient.invalidateQueries({ queryKey: ["audit"] });
      }
    )
    .subscribe((_status) => {
      // Realtime subscription status
    });

  return activeChannel;
}

/** Utility to test sound chime, sonner toast, and live panel updates */
export function triggerTestNotification() {
  return addNotification({
    title: "Realtime Notification Connected",
    message: "Live telemetry and operational alerts are active across queues, campaigns, and assets.",
    link: "/dashboard",
    type: "success",
  });
}
