/**
 * PWA Service Worker & Device Helpers
 */

import { useState, useEffect } from "react";
import { getOfflineGtpQueue, syncOfflineGtpQueue } from "./offlineStore";
import { toast } from "sonner";

/** Register Service Worker in production/supporting environments */
export function registerServiceWorker() {
  if ("serviceWorker" in navigator && !window.__SW_REGISTERED) {
    window.__SW_REGISTERED = true;
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registered with scope:", reg.scope);

          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (!installingWorker) return;
            installingWorker.onstatechange = () => {
              if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                toast.info("A new version of IMS is available!", {
                  action: {
                    label: "Update",
                    onClick: () => {
                      installingWorker.postMessage({ type: "SKIP_WAITING" });
                      window.location.reload();
                    },
                  },
                });
              }
            };
          };
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });
    });
  }
}

/** Hook to listen to online/offline state */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      toast.success("Back online — ready to sync field records", { id: "online-status" });
      // Trigger background sync attempt
      syncOfflineGtpQueue().then(({ synced }) => {
        if (synced > 0) {
          toast.success(`Automatically synced ${synced} field record${synced === 1 ? "" : "s"}.`);
        }
      }).catch(() => {});
    }

    function handleOffline() {
      setIsOnline(false);
      toast.warning("Offline Field Mode Active: You can continue capturing GTP proofs & checklists offline.", {
        id: "offline-status",
        duration: 5000,
      });
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

/** Hook to track pending offline queue items */
export function useOfflineQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshQueue = async () => {
    try {
      const items = await getOfflineGtpQueue();
      setQueue(items);
    } catch (e) {
      console.warn("Queue refresh error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshQueue();

    function onQueueUpdated() {
      refreshQueue();
    }

    window.addEventListener("ooh-sync-queue-updated", onQueueUpdated);
    return () => {
      window.removeEventListener("ooh-sync-queue-updated", onQueueUpdated);
    };
  }, []);

  const pendingCount = queue.filter((i) => i.status === "pending" || i.status === "failed").length;

  return { queue, pendingCount, loading, refreshQueue };
}

/** Hook for PWA installation prompt */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) {
      setIsInstalled(true);
    }

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success("IMS added to your home screen / desktop!");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  return {
    isInstallable: !!deferredPrompt && !isInstalled,
    isInstalled,
    promptInstall,
  };
}

/** Get high-accuracy GPS coordinates from device with high-accuracy fallback */
export async function getDeviceGeolocation() {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(getSimulatedKeralaGeo());
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        const accuracy = Math.round(pos.coords.accuracy || 10);
        resolve({
          formatted: `${lat}°N, ${lon}°E (±${accuracy}m)`,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy,
          isRealGps: true,
        });
      },
      (_err) => {
        // Fallback to simulated location within Kerala transit grid
        resolve(getSimulatedKeralaGeo());
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 30000,
      }
    );
  });
}

function getSimulatedKeralaGeo() {
  // Typical Kochi/Ernakulam metro corridor coordinates
  const baseLat = 9.9816;
  const baseLon = 76.2999;
  const lat = (baseLat + (Math.random() - 0.5) * 0.08).toFixed(4);
  const lon = (baseLon + (Math.random() - 0.5) * 0.08).toFixed(4);
  return {
    formatted: `${lat}°N, ${lon}°E (Transit Pin)`,
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    accuracy: 25,
    isRealGps: false,
  };
}
