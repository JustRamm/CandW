import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import sound from "@/lib/sound";
import { fmtDate } from "@/lib/helpers";

const STORAGE_KEY = "ims_notifications_v2";

let activeChannel = null;
let backgroundIntervalId = null;

// In-memory subscribers for UI updates
const listeners = new Set();

function isUuid(str) {
  return typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

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

/**
 * Multi-Device Sync: Fetches user notifications directly from Supabase user_notifications table.
 */
export async function syncNotificationsFromDatabase() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    let query = supabase
      .from("user_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    } else {
      query = query.is("user_id", null);
    }

    const { data, error } = await query;
    if (!error && data) {
      const normalized = data.map((d) => ({
        id: d.id,
        key: d.key,
        title: d.title,
        message: d.message,
        link: d.link,
        category: d.category,
        type: d.type,
        timestamp: d.created_at,
        read: d.read,
        user_id: d.user_id,
      }));
      saveNotifications(normalized);
      return normalized;
    }
  } catch (err) {
    console.warn("Could not sync notifications from database:", err);
  }
  return getStoredNotifications();
}

export function subscribeToNotificationFeed(callback) {
  listeners.add(callback);
  callback(getStoredNotifications());
  // Background sync from Supabase
  syncNotificationsFromDatabase();
  return () => listeners.delete(callback);
}

export function addNotification(notif) {
  const current = getStoredNotifications();
  const rawId = notif.id || (notif.key ? `notif_${notif.key}` : crypto.randomUUID());
  const notifKey = notif.key || (typeof rawId === "string" && !isUuid(rawId) ? rawId : null);

  // Prevent duplicate notifications if key exists
  const existing = current.find((n) => (notifKey && n.key === notifKey) || n.id === rawId);
  if (existing) {
    return existing;
  }

  const newItem = {
    id: isUuid(rawId) ? rawId : crypto.randomUUID(),
    key: notifKey,
    title: notif.title || "Update",
    message: notif.message || "",
    link: notif.link || null,
    category: notif.category || "general",
    type: notif.type || "info",
    timestamp: notif.timestamp || new Date().toISOString(),
    read: false,
    user_id: notif.user_id || null,
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

  // Persist to Supabase for multi-device sync
  (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = newItem.user_id || session?.user?.id || null;

      await supabase.from("user_notifications").upsert(
        {
          id: newItem.id,
          user_id: currentUserId,
          key: newItem.key,
          title: newItem.title,
          message: newItem.message,
          link: newItem.link,
          category: newItem.category,
          type: newItem.type,
          read: newItem.read,
          created_at: newItem.timestamp,
        },
        { onConflict: "id" }
      );
    } catch (err) {
      console.warn("Could not save notification to Supabase:", err);
    }
  })();

  return newItem;
}

export function markAllNotificationsRead() {
  const current = getStoredNotifications();
  const updated = current.map((n) => ({ ...n, read: true }));
  saveNotifications(updated);

  // Sync to database
  (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) {
        await supabase
          .from("user_notifications")
          .update({ read: true })
          .or(`user_id.eq.${userId},user_id.is.null`);
      } else {
        await supabase.from("user_notifications").update({ read: true }).is("user_id", null);
      }
    } catch (err) {
      console.warn("Could not mark all notifications as read in Supabase:", err);
    }
  })();
}

export function markNotificationRead(id) {
  const current = getStoredNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifications(updated);

  // Sync to database
  (async () => {
    try {
      if (isUuid(id)) {
        await supabase.from("user_notifications").update({ read: true }).eq("id", id);
      } else {
        await supabase.from("user_notifications").update({ read: true }).eq("key", id);
      }
    } catch (err) {
      console.warn("Could not mark notification as read in Supabase:", err);
    }
  })();
}

export function toggleNotificationRead(id) {
  const current = getStoredNotifications();
  let nextRead = true;
  const updated = current.map((n) => {
    if (n.id === id) {
      nextRead = !n.read;
      return { ...n, read: nextRead };
    }
    return n;
  });
  saveNotifications(updated);

  // Sync to database
  (async () => {
    try {
      if (isUuid(id)) {
        await supabase.from("user_notifications").update({ read: nextRead }).eq("id", id);
      } else {
        await supabase.from("user_notifications").update({ read: nextRead }).eq("key", id);
      }
    } catch (err) {
      console.warn("Could not toggle notification read state in Supabase:", err);
    }
  })();
}

export function deleteNotification(id) {
  const current = getStoredNotifications();
  const updated = current.filter((n) => n.id !== id && n.key !== id);
  saveNotifications(updated);

  // Sync to database
  (async () => {
    try {
      if (isUuid(id)) {
        await supabase.from("user_notifications").delete().eq("id", id);
      } else {
        await supabase.from("user_notifications").delete().eq("key", id);
      }
    } catch (err) {
      console.warn("Could not delete notification in Supabase:", err);
    }
  })();
}

export function clearAllNotifications() {
  saveNotifications([]);

  // Sync to database
  (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) {
        await supabase
          .from("user_notifications")
          .delete()
          .or(`user_id.eq.${userId},user_id.is.null`);
      } else {
        await supabase.from("user_notifications").delete().is("user_id", null);
      }
    } catch (err) {
      console.warn("Could not clear notifications in Supabase:", err);
    }
  })();
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

  try {
    const existing = supabase.getChannels().find((c) => c.topic === "realtime:ims-realtime-feed-v2");
    if (existing) {
      activeChannel = existing;
      return activeChannel;
    }
  } catch {}

  const channel = supabase.channel("ims-realtime-feed-v2");
  activeChannel = channel;

  channel
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
      { event: "*", schema: "public", table: "user_notifications" },
      (payload) => {
        const { eventType, new: record, old: oldRecord } = payload;
        const current = getStoredNotifications();
        if (eventType === "INSERT" && record) {
          const exists = current.some((n) => n.id === record.id || (record.key && n.key === record.key));
          if (!exists) {
            const item = {
              id: record.id,
              key: record.key,
              title: record.title,
              message: record.message,
              link: record.link,
              category: record.category,
              type: record.type,
              timestamp: record.created_at,
              read: record.read,
              user_id: record.user_id,
            };
            saveNotifications([item, ...current].slice(0, 60));
            sound?.notification?.();
            if (item.type === "success") {
              toast.success(item.title, { description: item.message });
            } else if (item.type === "warning") {
              toast.warning(item.title, { description: item.message });
            } else {
              toast.info(item.title, { description: item.message });
            }
          }
        } else if (eventType === "UPDATE" && record) {
          const updated = current.map((n) =>
            n.id === record.id || (record.key && n.key === record.key)
              ? { ...n, read: record.read, title: record.title, message: record.message }
              : n
          );
          saveNotifications(updated);
        } else if (eventType === "DELETE" && oldRecord) {
          const updated = current.filter((n) => n.id !== oldRecord.id && n.key !== oldRecord.id);
          saveNotifications(updated);
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
