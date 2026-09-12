import { useState, useEffect } from "react";
import { WifiOff, X } from "lucide-react";
import { toast } from "sonner";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
      setDismissed(false);
      toast.success("Connection restored", {
        description: "You are back online. Live sync and updates are active.",
      });
    }

    function handleOffline() {
      setIsOffline(true);
      setDismissed(false);
      toast.warning("Connection lost", {
        description: "You are working offline. Real-time updates are paused.",
      });
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <div
      className="relative z-30 flex items-center justify-between gap-2 border-b border-amber-600/30 bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-xs"
      data-testid="offline-banner"
    >
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="size-3.5 shrink-0 animate-pulse" />
        <span className="truncate">Offline Mode &middot; Changes are queued locally and will sync when reconnected.</span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offline banner"
        className="shrink-0 rounded p-1 hover:bg-amber-600/20 text-amber-950 cursor-pointer"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
