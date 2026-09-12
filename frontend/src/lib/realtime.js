import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import sound from "@/lib/sound";
import { fmtDate } from "@/lib/helpers";

const STORAGE_KEY = "ims_notifications_v2";

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 60)));
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
  const notifId = notif.id || (notif.key ? `notif_${notif.key}` : crypto.randomUUID());

  // Prevent duplicate notifications if key exists
  const existing = current.find((n) => (notif.key && n.key === notif.key) || n.id === notifId);
  if (existing) {
    return existing;
  }

  const newItem = {
    id: notifId,
    key: notif.key || null,
    title: notif.title || "Update",
    message: notif.message || "",
    link: notif.link || null,
    category: notif.category || "general", // "queue_expiry" | "gtp_overdue" | "campaign_stage" | "new_interest" | "general"
    type: notif.type || "info", // "info" | "success" | "warning" | "error"
    timestamp: notif.timestamp || new Date().toISOString(),
    read: false,
  };

  const updated = [newItem, ...current].slice(0, 60);
  saveNotifications(updated);

  // Play notification chime
  sound?.notification?.();

  // Surface toast notification
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

/**
 * Automated Queue SLA Expiry & Waitlist Promotion Engine
 * 1. Checks all active queue slots against SLA (business days excluding weekends/holidays, or expires_on).
 * 2. If expired (daysRemaining <= 0 or expires_on < today), marks active slot as forfeited.
 * 3. Records an immutable audit log record.
 * 4. Automatically promotes the next pending reservation (#1) to active with new 5-day expiration.
 * 5. Resequences remaining pending entries (1, 2, 3...).
 * 6. If no waitlist exists, frees the asset (status = "available").
 * 7. Broadcasts live notifications to all users.
 */
export async function processExpiredQueueEntries() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const { data: queueEntries } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("state", "active");

    if (!queueEntries || queueEntries.length === 0) return;

    const { data: settings } = await supabase
      .from("settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    const { data: holidays } = await supabase.from("holidays").select("date");
    const holidaySet = new Set((holidays ?? []).map((h) => h.date));
    const holdDays = settings?.queue_active_business_days ?? 5;

    for (const q of queueEntries) {
      let isExpired = false;

      if (q.expires_on && q.expires_on < todayStr) {
        isExpired = true;
      } else {
        const createdDate = new Date(q.created_at);
        let businessDaysUsed = 0;
        const cur = new Date(createdDate);
        cur.setHours(0, 0, 0, 0);

        while (cur < today) {
          cur.setDate(cur.getDate() + 1);
          const dayOfWeek = cur.getDay();
          const iso = cur.toISOString().split("T")[0];
          if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(iso)) {
            businessDaysUsed++;
          }
        }

        if (businessDaysUsed >= holdDays) {
          isExpired = true;
        }
      }

      if (isExpired) {
        // 1. Forfeit the expired slot
        await supabase
          .from("queue_entries")
          .update({
            state: "forfeited",
            closed_at: new Date().toISOString(),
            cancel_reason: "5-day SLA expired without confirmation",
          })
          .eq("id", q.id);

        // 2. Audit log
        await supabase.from("audit_logs").insert({
          id: crypto.randomUUID(),
          entity_type: "queue_entry",
          entity_id: q.id,
          action: "queue_forfeited",
          actor_name: "Automated System SLA Worker",
          actor_role: "system",
          comment: `Reservation for ${q.brand} on ${q.asset_code} expired after ${holdDays} business days and was forfeited.`,
          created_at: new Date().toISOString(),
        });

        // 3. Broadcast forfeiture
        broadcastNotification({
          key: `queue_forfeited_${q.id}`,
          title: "Queue Slot Forfeited",
          message: `Reservation for ${q.brand} on ${q.asset_code} expired after ${holdDays} business days without confirmation.`,
          link: "/queue",
          category: "queue_expiry",
          type: "warning",
        });

        // 4. Find next pending entry by position
        const { data: next } = await supabase
          .from("queue_entries")
          .select("*")
          .eq("asset_id", q.asset_id)
          .eq("state", "pending")
          .order("position")
          .limit(1)
          .maybeSingle();

        if (next) {
          // Calculate new 5-business-day expires_on date
          let d = new Date();
          let counted = 0;
          while (counted < holdDays) {
            d.setDate(d.getDate() + 1);
            const ds = d.toISOString().split("T")[0];
            const dow = d.getDay();
            if (dow !== 0 && dow !== 6 && !holidaySet.has(ds)) counted++;
          }
          const nextExpiry = d.toISOString().split("T")[0];

          await supabase
            .from("queue_entries")
            .update({
              state: "active",
              position: 0,
              expires_on: nextExpiry,
            })
            .eq("id", next.id);

          // Audit log for auto-promotion
          await supabase.from("audit_logs").insert({
            id: crypto.randomUUID(),
            entity_type: "queue_entry",
            entity_id: next.id,
            action: "queue_promoted",
            actor_name: "Automated System SLA Worker",
            actor_role: "system",
            comment: `Waitlist entry for ${next.brand} automatically promoted to active slot on ${next.asset_code}. SLA expiry set to ${nextExpiry}.`,
            created_at: new Date().toISOString(),
          });

          // Broadcast promotion
          broadcastNotification({
            key: `queue_promoted_${next.id}`,
            title: "Waitlist Promoted to Active",
            message: `${next.brand} is now ACTIVE for asset ${next.asset_code}. 5-day confirmation clock started.`,
            link: "/queue",
            category: "queue_expiry",
            type: "warning",
          });

          // Resequence remaining pending entries
          const { data: remaining } = await supabase
            .from("queue_entries")
            .select("id")
            .eq("asset_id", q.asset_id)
            .eq("state", "pending")
            .neq("id", next.id)
            .order("position");

          for (let i = 0; i < (remaining ?? []).length; i++) {
            await supabase
              .from("queue_entries")
              .update({ position: i + 1 })
              .eq("id", remaining[i].id);
          }
        } else {
          // No waitlist entries — mark asset available
          await supabase
            .from("assets")
            .update({ status: "available" })
            .eq("id", q.asset_id);
        }

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["queue"] });
        queryClient.invalidateQueries({ queryKey: ["assets"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      }
    }
  } catch (err) {
    console.warn("Error running automated queue expiry worker:", err);
  }
}

/**
 * Evaluates system state across:
 * 1. Queue expiry warnings (Slot expires in <= 2 days)
 * 2. GTP overdue alerts (Pending GTP with due_date <= today)
 * 3. Urgent onboarding & campaign tasks
 */
export async function evaluateSystemAlerts(currentUser = null) {
  try {
    // Run automated expiry & promotion check first
    await processExpiredQueueEntries();

    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Check Queue Expiry Warnings
    const { data: queueEntries } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("state", "active");

    const { data: settings } = await supabase
      .from("settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    const { data: holidays } = await supabase.from("holidays").select("date");
    const holidaySet = new Set((holidays ?? []).map((h) => h.date));
    const allowedDays = settings?.queue_active_business_days ?? 5;

    for (const q of queueEntries ?? []) {
      const createdDate = new Date(q.created_at);
      let businessDaysUsed = 0;
      const cur = new Date(createdDate);
      cur.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      while (cur < today) {
        cur.setDate(cur.getDate() + 1);
        const dayOfWeek = cur.getDay();
        const iso = cur.toISOString().split("T")[0];
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(iso)) {
          businessDaysUsed++;
        }
      }

      const daysRemaining = Math.max(0, allowedDays - businessDaysUsed);

      if (daysRemaining <= 2) {
        addNotification({
          key: `queue_expiry_${q.id}_day_${daysRemaining}`,
          title: "Queue Slot Expiring Soon",
          message: `Slot for ${q.brand} on ${q.asset_code} expires in ${daysRemaining} business day${daysRemaining === 1 ? "" : "s"}. Action required before forfeiture.`,
          link: "/queue",
          category: "queue_expiry",
          type: "warning",
        });
      }
    }

    // 2. Check GTP Overdue Alerts for Live Campaigns
    const { data: liveCampaigns } = await supabase
      .from("campaigns")
      .select("id, brand, asset_code, gtps, stage")
      .in("stage", ["live", "closing"]);

    for (const c of liveCampaigns ?? []) {
      for (const g of c.gtps ?? []) {
        if (g.status === "pending" && g.due_date) {
          const isOverdue = g.due_date <= todayStr;
          if (isOverdue) {
            addNotification({
              key: `gtp_overdue_${c.id}_${g.id}_${g.due_date}`,
              title: "GTP Overdue Alert",
              message: `GTP #${g.seq} for ${c.brand} (${c.asset_code}) is overdue since ${fmtDate(g.due_date)}. Field proof capture required.`,
              link: `/campaigns/${c.id}`,
              category: "gtp_overdue",
              type: "warning",
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn("Error evaluating system alerts:", err);
  }
}

let activeChannel = null;
let backgroundIntervalId = null;

/**
 * Initializes Supabase Realtime Channel
 * Listens to postgres_changes across queue_entries, campaigns, and assets
 */
export function initRealtimeFeed(currentUser = null) {
  // Always evaluate initial system alerts and process queue expiries
  evaluateSystemAlerts(currentUser);

  if (!backgroundIntervalId) {
    backgroundIntervalId = setInterval(() => {
      processExpiredQueueEntries();
    }, 5 * 60 * 1000);
  }

  if (activeChannel) return activeChannel;

  activeChannel = supabase
    .channel("ims-realtime-feed-v2")
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
            key: `new_queue_${record.id}`,
            title: "New Interest Queue Entry",
            message: `${record.salesperson_name || "Sales"} added ${record.brand || "Brand"} to interest queue for ${record.asset_code || "Asset"}.`,
            link: "/queue",
            category: "new_interest",
            type: "info",
          });
        } else if (eventType === "UPDATE") {
          if (oldRecord && oldRecord.state !== record.state) {
            if (record.state === "active") {
              addNotification({
                key: `queue_promoted_${record.id}`,
                title: "Queue Slot Promoted",
                message: `${record.brand || "Brand"} is now ACTIVE for asset ${record.asset_code || ""}.`,
                link: "/queue",
                category: "queue_expiry",
                type: "warning",
              });
            } else if (record.state === "confirmed") {
              addNotification({
                key: `queue_confirmed_${record.id}`,
                title: "Queue Slot Confirmed",
                message: `${record.brand || "Brand"} confirmed into live campaign!`,
                link: "/campaigns",
                category: "campaign_stage",
                type: "success",
              });
            } else if (record.state === "cancelled") {
              addNotification({
                key: `queue_cancelled_${record.id}`,
                title: "Queue Slot Withdrawn",
                message: `Reservation for ${record.brand || "Brand"} was closed or withdrawn.`,
                link: "/queue",
                category: "new_interest",
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
            const STAGE_NAMES = {
              onboarding: "Onboarding",
              invoicing: "Invoicing",
              live: "Live",
              closing: "Closing",
              closed: "Closed",
            };
            const stageLabel = STAGE_NAMES[record.stage] || record.stage;
            addNotification({
              key: `campaign_stage_${record.id}_${record.stage}`,
              title: `Campaign Stage: ${stageLabel}`,
              message: `Campaign '${record.brand}' (${record.asset_code}) moved to ${stageLabel}.`,
              link: `/campaigns/${record.id}`,
              category: "campaign_stage",
              type: record.stage === "live" ? "success" : "info",
            });
          }
        } else if (eventType === "INSERT") {
          addNotification({
            key: `new_campaign_${record.id}`,
            title: "New Campaign Initialized",
            message: `Campaign for ${record.brand} initialized on asset ${record.asset_code || ""}.`,
            link: `/campaigns/${record.id}`,
            category: "campaign_stage",
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
            key: `new_asset_${record.id}`,
            title: "New Asset Added",
            message: `${record.asset_code || "Asset"} (${record.location_name || "New Location"}) added to inventory.`,
            link: `/assets/${record.id}`,
            category: "inventory",
            type: "success",
          });
        } else if (eventType === "UPDATE") {
          if (oldRecord && oldRecord.status !== record.status) {
            addNotification({
              key: `asset_status_${record.id}_${record.status}`,
              title: "Asset Status Changed",
              message: `${record.asset_code} moved from ${oldRecord.status} to ${record.status}.`,
              link: `/assets/${record.id}`,
              category: "inventory",
              type: "info",
            });
          }
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "brands" },
      (payload) => {
        queryClient.invalidateQueries({ queryKey: ["brands"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });

        const { eventType, new: record } = payload;
        if (eventType === "INSERT") {
          addNotification({
            key: `new_brand_${record.id}`,
            title: "New Brand Added",
            message: `${record.name || "Brand"} was added to the client directory.`,
            link: `/brands/${record.id}`,
            category: "brand",
            type: "success",
          });
        }
      }
    )
    .on(
      "broadcast",
      { event: "system_notification" },
      ({ payload }) => {
        if (payload) {
          addNotification(payload);
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
      // Realtime subscription active
    });

  return activeChannel;
}

/** Broadcasts a notification locally and across Supabase Realtime channel to all connected users */
export function broadcastNotification(notif) {
  const item = addNotification(notif);
  if (activeChannel) {
    try {
      activeChannel.send({
        type: "broadcast",
        event: "system_notification",
        payload: item,
      });
    } catch (err) {
      console.warn("Failed to broadcast notification:", err);
    }
  }
  return item;
}

/** Utility to test sound chime, sonner toast, and live panel updates */
export function triggerTestNotification() {
  return broadcastNotification({
    title: "System Notification Connected",
    message: "Live telemetry and operational alerts are active across queues, campaigns, and assets.",
    link: "/dashboard",
    category: "general",
    type: "success",
  });
}
