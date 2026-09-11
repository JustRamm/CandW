import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
      toast.success("Connection restored", {
        description: "You are back online. Live sync and updates are active.",
      });
    }

    function handleOffline() {
      setIsOffline(true);
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

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-xs font-semibold text-amber-950 shadow-md animate-in slide-in-from-top duration-200">
      <WifiOff className="size-4 animate-pulse" />
      <span>Working Offline — Live queue feeds and database sync are paused until internet is restored.</span>
    </div>
  );
}
