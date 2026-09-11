/**
 * Carbon & Whale · OOH-Sync Offline Store (IndexedDB)
 * Handles offline caching of campaigns, assets, and offline GTP photo queue
 * with automatic background sync when reconnected.
 */

import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import sound from "@/lib/sound";

const DB_NAME = "OOH_SYNC_OFFLINE_DB";
const DB_VERSION = 1;
const STORE_GTP_QUEUE = "gtp_queue";
const STORE_CACHED_CAMPAIGNS = "cached_campaigns";

/** Open or initialize the IndexedDB instance */
function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not supported on this device."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_GTP_QUEUE)) {
        const gtpStore = db.createObjectStore(STORE_GTP_QUEUE, { keyPath: "id" });
        gtpStore.createIndex("timestamp", "timestamp", { unique: false });
        gtpStore.createIndex("status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CACHED_CAMPAIGNS)) {
        db.createObjectStore(STORE_CACHED_CAMPAIGNS, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Broadcast local queue changes so UI components update reactively */
function notifyQueueChange() {
  window.dispatchEvent(new CustomEvent("ooh-sync-queue-updated"));
}

/** Convert a File or Blob into Base64 string for safe IndexedDB storage */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Convert a Base64 data string back into a File object */
export function base64ToFile(base64Data, filename, contentType) {
  const arr = base64Data.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || contentType || "image/jpeg";
  const bstr = atob(arr[1] || arr[0]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/** Save a pending GTP or checklist submission to the offline queue */
export async function enqueueOfflineGtp({
  campaignId,
  campaignName = "",
  assetCode = "",
  gtpId = null,
  gtpSeq = null,
  checklistKey = null,
  checklistItemLabel = "",
  notes = "",
  files = [], // array of { filename, type, size, base64Data, geo, label }
  userProfile = {},
}) {
  const db = await openDB();
  const queueItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    campaignId,
    campaignName,
    assetCode,
    gtpId,
    gtpSeq,
    checklistKey,
    checklistItemLabel,
    notes,
    files,
    userName: userProfile.name || "Field Officer",
    userRole: userProfile.role || "ops",
    userId: userProfile.id || null,
    timestamp: new Date().toISOString(),
    status: "pending", // "pending" | "syncing" | "failed" | "synced"
    error: null,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GTP_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_GTP_QUEUE);
    const request = store.put(queueItem);

    request.onsuccess = () => {
      notifyQueueChange();
      sound?.success?.();
      resolve(queueItem);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Retrieve all queued items */
export async function getOfflineGtpQueue() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_GTP_QUEUE, "readonly");
      const store = tx.objectStore(STORE_GTP_QUEUE);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result || [];
        // Sort newest first
        items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Failed to fetch offline queue:", err);
    return [];
  }
}

/** Delete a single item from the queue */
export async function removeOfflineGtp(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GTP_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_GTP_QUEUE);
    const request = store.delete(id);

    request.onsuccess = () => {
      notifyQueueChange();
      resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Clear all completed or all items from queue */
export async function clearOfflineQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_GTP_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_GTP_QUEUE);
    const request = store.clear();

    request.onsuccess = () => {
      notifyQueueChange();
      resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Cache campaigns locally for offline access */
export async function cacheCampaignsOffline(campaigns = []) {
  if (!Array.isArray(campaigns) || campaigns.length === 0) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CACHED_CAMPAIGNS, "readwrite");
    const store = tx.objectStore(STORE_CACHED_CAMPAIGNS);
    for (const c of campaigns) {
      store.put({ ...c, _cached_at: new Date().toISOString() });
    }
  } catch (e) {
    console.warn("Failed to cache campaigns offline:", e);
  }
}

/** Get cached campaigns when offline */
export async function getCachedCampaignsOffline() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_CACHED_CAMPAIGNS, "readonly");
      const store = tx.objectStore(STORE_CACHED_CAMPAIGNS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Sync engine: Iterates through pending offline GTP/checklist records,
 * uploads photos to Supabase Storage, registers documents in the database,
 * updates the campaign record, and records audit trails.
 */
export async function syncOfflineGtpQueue(onProgress) {
  if (!navigator.onLine) {
    throw new Error("Cannot sync while offline. Please check your internet connection.");
  }

  const queue = await getOfflineGtpQueue();
  const pending = queue.filter((item) => item.status === "pending" || item.status === "failed");

  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;

  const db = await openDB();

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    onProgress?.({
      current: i + 1,
      total: pending.length,
      item,
      percentage: Math.round(((i + 1) / pending.length) * 100),
    });

    try {
      // Step 1: Upload each file to Supabase Storage & documents table
      const uploadedDocIds = [];

      for (const fileItem of item.files || []) {
        const fileObj = base64ToFile(fileItem.base64Data, fileItem.filename, fileItem.type);
        const cleanExt = (fileItem.filename.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const fileId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        const path = `${fileId}.${cleanExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage.from("documents").upload(path, fileObj, {
          contentType: fileItem.type || "image/jpeg",
          upsert: true,
        });
        if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

        // Record in documents table
        const { error: docInsertError } = await supabase.from("documents").insert({
          id: fileId,
          filename: fileItem.filename,
          content_type: fileItem.type || "image/jpeg",
          size: fileItem.size || fileObj.size || 0,
          label: fileItem.label || "Offline GTP Capture",
          geo: fileItem.geo || "",
          storage_path: path,
          url: urlData.publicUrl,
          created_at: fileItem.timestamp || item.timestamp || new Date().toISOString(),
        });

        if (docInsertError) {
          console.warn("Doc table insert warning:", docInsertError);
        }

        uploadedDocIds.push(fileId);
      }

      // Step 2: Update Campaign record depending on whether it's a GTP slot or Checklist item
      if (item.gtpId) {
        // GTP Slot submission
        const { data: c, error: fetchErr } = await supabase
          .from("campaigns")
          .select("gtps")
          .eq("id", item.campaignId)
          .single();

        if (fetchErr) throw new Error(`Campaign fetch failed: ${fetchErr.message}`);

        const gtps = (c?.gtps ?? []).map((g) =>
          g.id === item.gtpId
            ? {
                ...g,
                status: "submitted",
                doc_ids: [...(g.doc_ids || []), ...uploadedDocIds],
                notes: item.notes || g.notes,
                submitted_by: item.userName,
                submitted_at: item.timestamp,
                offline_synced: true,
              }
            : g
        );

        const { error: updateErr } = await supabase
          .from("campaigns")
          .update({ gtps })
          .eq("id", item.campaignId);

        if (updateErr) throw new Error(`GTP update failed: ${updateErr.message}`);
      } else if (item.checklistKey) {
        // Checklist step completion
        const { data: c, error: fetchErr } = await supabase
          .from("campaigns")
          .select("checklist")
          .eq("id", item.campaignId)
          .single();

        if (fetchErr) throw new Error(`Campaign fetch failed: ${fetchErr.message}`);

        const checklist = (c?.checklist ?? []).map((ci) =>
          ci.key === item.checklistKey
            ? {
                ...ci,
                status: "done",
                notes: item.notes || ci.notes,
                doc_ids: [...(ci.doc_ids || []), ...uploadedDocIds],
                completed_by: item.userName,
                completed_at: item.timestamp,
                offline_synced: true,
              }
            : ci
        );

        const { error: updateErr } = await supabase
          .from("campaigns")
          .update({ checklist })
          .eq("id", item.campaignId);

        if (updateErr) throw new Error(`Checklist update failed: ${updateErr.message}`);
      }

      // Step 3: Insert Audit Trail Entry
      try {
        await supabase.from("audit_logs").insert({
          action: "offline_gtp_synced",
          entity_type: "campaign",
          entity_id: item.campaignId,
          details: {
            gtp_id: item.gtpId,
            gtp_seq: item.gtpSeq,
            checklist_key: item.checklistKey,
            files_count: uploadedDocIds.length,
            captured_at: item.timestamp,
            synced_at: new Date().toISOString(),
            captured_by: item.userName,
          },
        });
      } catch (auditErr) {
        console.warn("Non-fatal audit log error:", auditErr);
      }

      // Step 4: Remove item from IndexedDB on successful sync
      const tx = db.transaction(STORE_GTP_QUEUE, "readwrite");
      tx.objectStore(STORE_GTP_QUEUE).delete(item.id);
      syncedCount++;
    } catch (err) {
      console.error(`Sync failed for item ${item.id}:`, err);
      failedCount++;

      // Update item status to failed
      const tx = db.transaction(STORE_GTP_QUEUE, "readwrite");
      const store = tx.objectStore(STORE_GTP_QUEUE);
      store.put({
        ...item,
        status: "failed",
        error: err.message || "Sync failed",
      });
    }
  }

  notifyQueueChange();

  // Invalidate relevant React Queries so screens refresh automatically
  queryClient.invalidateQueries({ queryKey: ["campaigns"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["audit"] });

  return { synced: syncedCount, failed: failedCount };
}
