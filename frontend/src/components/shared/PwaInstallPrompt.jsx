import React, { useState, useEffect } from "react";
import { Download, Smartphone, X, CheckCircle2, Share } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/pwa";
import sound from "@/lib/sound";

export default function PwaInstallPrompt() {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if already running as standalone PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (isStandalone || isInstalled) {
      return;
    }

    // Check if user dismissed it in this session
    const isDismissed = sessionStorage.getItem("ooh_pwa_prompt_dismissed");
    if (isDismissed) {
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Show prompt after a short initial load delay
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 1800);

    return () => clearTimeout(timer);
  }, [isInstalled]);

  const handleInstall = async () => {
    sound?.click?.();
    if (isInstallable) {
      await promptInstall();
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    sound?.click?.();
    sessionStorage.setItem("ooh_pwa_prompt_dismissed", "true");
    setShowPrompt(false);
  };

  if (!showPrompt || isInstalled) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:max-w-md z-50 pointer-events-auto"
        data-testid="pwa-install-banner"
      >
        <div className="relative rounded-2xl border border-border/90 bg-card/95 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-start gap-3.5 pr-6">
            {/* App Icon */}
            <div className="size-14 shrink-0 rounded-2xl border border-border/80 bg-slate-950 p-1 shadow-md overflow-hidden">
              <img
                src="/brand/icon-512.png"
                alt="IMS App Icon"
                className="h-full w-full object-cover rounded-xl"
              />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-heading text-sm font-bold text-foreground truncate">
                  Install IMS App
                </p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Install on your device for fast offline photo capture, real-time inventory management, and instant notifications.
              </p>
            </div>
          </div>

          {/* Action buttons or iOS guidance */}
          <div className="mt-3.5 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors"
            >
              Not now
            </button>

            {isIos && !isInstallable ? (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-secondary/60 px-2.5 py-1.5 rounded-lg border border-border/60">
                <Share className="size-3 text-primary shrink-0" />
                <span>Tap Share then <strong>Add to Home Screen</strong></span>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={handleInstall}
                className="gap-1.5 font-semibold text-xs h-8 px-3.5 shadow-sm"
                data-testid="pwa-install-button"
              >
                <Download className="size-3.5" />
                Install App
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
