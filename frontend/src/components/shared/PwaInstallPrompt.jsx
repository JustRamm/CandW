import React, { useState, useEffect } from "react";
import { Download, Smartphone, X, Share, PlusSquare, Sparkles, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/pwa";
import sound from "@/lib/sound";

export default function PwaInstallPrompt() {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isIosExpanded, setIsIosExpanded] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone || isInstalled) {
      return;
    }

    // 2. Check if dismissed in this session
    const isDismissed = sessionStorage.getItem("cw_pwa_prompt_dismissed");
    if (isDismissed) {
      return;
    }

    // 3. Detect iOS / iPadOS accurately (including iPad Pro on iPadOS)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

    setIsIos(isIosDevice);

    // 4. Delay prompt slightly so the page content settles first
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 2000);

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
    sessionStorage.setItem("cw_pwa_prompt_dismissed", "true");
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
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="fixed bottom-4 inset-x-3 sm:inset-x-auto sm:right-6 sm:max-w-md z-50 pointer-events-auto"
        data-testid="pwa-install-banner"
      >
        <div className="relative rounded-2xl border border-primary/30 bg-card/95 p-4 sm:p-4.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden">
          {/* Subtle brand glow accent */}
          <div className="absolute top-0 right-0 -mr-12 -mt-12 size-36 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>

          {/* Header Info */}
          <div className="flex items-start gap-3.5 pr-6">
            <div className="size-13 shrink-0 rounded-2xl border border-primary/20 bg-gradient-to-br from-sky-400 to-sky-600 p-0.5 shadow-md overflow-hidden flex items-center justify-center">
              <img
                src="/brand/icon-192.png"
                alt="Carbon & Whale IMS"
                className="size-full object-cover rounded-[14px]"
              />
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-heading text-sm font-bold text-foreground">
                  Install Carbon &amp; Whale
                </span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[9px] font-semibold text-primary">
                  {isIos ? "iOS App" : "PWA"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isIos
                  ? "Add to your iPhone / iPad Home Screen for fullscreen mode and instant access."
                  : "Install on your device for lightning-fast offline workflows and instant launch."}
              </p>
            </div>
          </div>

          {/* iOS-specific Step-by-Step Installation Visual Guide */}
          {isIos && (
            <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-2.5">
              <div className="font-semibold text-primary text-[11px] uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="size-3" /> How to install on iOS / Safari:
              </div>

              <div className="space-y-2 text-[12px] text-foreground">
                <div className="flex items-center gap-2.5">
                  <div className="size-6 shrink-0 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-[11px]">
                    1
                  </div>
                  <div className="flex-1">
                    Tap the <strong className="text-primary inline-flex items-center gap-1 bg-primary/10 px-1.5 py-0.5 rounded"><Share className="size-3" /> Share</strong> button in Safari's bottom toolbar.
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="size-6 shrink-0 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-[11px]">
                    2
                  </div>
                  <div className="flex-1">
                    Scroll down and select <strong className="text-foreground inline-flex items-center gap-1 bg-secondary px-1.5 py-0.5 rounded border border-border/70"><PlusSquare className="size-3 text-primary" /> Add to Home Screen</strong>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="mt-3.5 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors cursor-pointer"
            >
              Maybe later
            </button>

            {isIos ? (
              <Button
                size="sm"
                variant="default"
                onClick={handleDismiss}
                className="gap-1.5 font-semibold text-xs h-8 px-3.5 bg-primary hover:bg-primary/90 cursor-pointer shadow-xs"
              >
                Got it!
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleInstall}
                className="gap-1.5 font-semibold text-xs h-8 px-3.5 bg-primary hover:bg-primary/90 cursor-pointer shadow-xs"
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
