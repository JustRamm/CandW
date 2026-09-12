import React, { useState } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Camera,
  MapPin,
  Clock,
  DownloadCloud,
  ChevronRight,
  Sparkles,
  Smartphone,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useOnlineStatus, useOfflineQueue, usePwaInstall } from "@/lib/pwa";
import { syncOfflineGtpQueue, removeOfflineGtp, clearOfflineQueue } from "@/lib/offlineStore";
import { fmtDateTime } from "@/lib/helpers";
import sound from "@/lib/sound";
import { cn } from "@/lib/utils";

export default function OfflineSyncModal({ trigger }) {
  const isOnline = useOnlineStatus();
  const { queue, pendingCount, refreshQueue } = useOfflineQueue();
  const { isInstallable, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);

  const handleSyncNow = async () => {
    if (!isOnline) {
      toast.warning("Cannot sync while offline. Please connect to Wi-Fi or mobile data first.");
      sound?.warning?.();
      return;
    }

    setSyncing(true);
    setSyncProgress({ percentage: 0, current: 0, total: pendingCount });
    sound?.click?.();

    try {
      const result = await syncOfflineGtpQueue((prog) => {
        setSyncProgress(prog);
      });

      if (result.synced > 0) {
        sound?.success?.();
        toast.success(`Successfully uploaded & synced ${result.synced} field record${result.synced === 1 ? "" : "s"}!`);
      } else if (result.failed > 0) {
        sound?.warning?.();
        toast.error(`Sync finished with ${result.failed} error(s). Please check details below.`);
      } else {
        toast.info("No pending items to sync.");
      }
      refreshQueue();
    } catch (err) {
      sound?.warning?.();
      toast.error(err.message || "Failed to sync offline queue");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleDeleteItem = async (id, e) => {
    e?.stopPropagation();
    try {
      await removeOfflineGtp(id);
      toast.success("Queued item removed");
      refreshQueue();
    } catch {
      toast.error("Failed to remove item");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger || (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-2 rounded-full px-3 text-xs font-medium transition-all",
                !isOnline
                  ? "border-amber-400 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                  : pendingCount > 0
                    ? "border-sky-400 bg-sky-500/10 text-sky-500 hover:bg-sky-500/20"
                    : "border-border/70 text-muted-foreground hover:bg-secondary/60"
              )}
              data-testid="offline-sync-pill"
            >
              {isOnline ? (
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                </span>
              ) : (
                <WifiOff className="size-3.5 text-amber-500 animate-pulse" />
              )}

              <span>{isOnline ? (pendingCount > 0 ? `${pendingCount} Queued` : "Live") : "Field Mode"}</span>

              {pendingCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 px-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full"
                >
                  {pendingCount}
                </Badge>
              )}
            </Button>
          )
        }
      />

      <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden p-0 sm:max-w-lg">
        {/* Header with Connectivity Status */}
        <div
          className={cn(
            "p-5 pb-4 border-b flex items-start justify-between gap-4",
            !isOnline
              ? "bg-amber-500/10 border-amber-500/20"
              : "bg-secondary/40 border-border/70"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2.5 rounded-xl border flex items-center justify-center",
                !isOnline
                  ? "bg-amber-500/20 border-amber-500/30 text-amber-500"
                  : "bg-emerald-500/20 border-emerald-500/30 text-emerald-500"
              )}
            >
              {isOnline ? <Wifi className="size-5" /> : <WifiOff className="size-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="font-heading text-base font-bold">
                  {isOnline ? "Field Ops Sync Center" : "Offline Field Mode Active"}
                </DialogTitle>
                <Badge
                  variant={isOnline ? "outline" : "secondary"}
                  className={cn(
                    "text-[10px] uppercase tracking-wider font-semibold",
                    isOnline ? "border-emerald-500/40 text-emerald-500" : "bg-amber-500 text-white"
                  )}
                >
                  {isOnline ? "Connected" : "Offline"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isOnline
                  ? "All field photos and checklists sync directly to the cloud."
                  : "Metro concourses & basements: Photos are stored safely on device."}
              </p>
            </div>
          </div>
        </div>

        {/* Sync Progress Bar */}
        {syncProgress && (
          <div className="p-4 bg-sky-500/10 border-b border-sky-500/20 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-sky-500">
              <span>Syncing records ({syncProgress.current}/{syncProgress.total})...</span>
              <span>{syncProgress.percentage}%</span>
            </div>
            <div className="h-2 w-full bg-sky-950/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-300 rounded-full"
                style={{ width: `${syncProgress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* PWA Install Banner */}
          {isInstallable && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="size-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">Install OOH-Sync App</p>
                    <p className="text-[11px] text-muted-foreground">Faster offline access from home screen.</p>
                  </div>
                </div>
                <Button size="xs" onClick={promptInstall} className="shrink-0 gap-1.5">
                  <DownloadCloud className="size-3.5" />
                  Install
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Queue List Header */}
          <div className="flex items-center justify-between">
            <span className="mono-label text-xs font-semibold text-muted-foreground uppercase">
              Pending Field Captures ({pendingCount})
            </span>
            {queue.length > 0 && (
              <button
                type="button"
                onClick={() => clearOfflineQueue().then(refreshQueue)}
                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Empty State or Items List */}
          {queue.length === 0 ? (
            <div className="py-8 text-center space-y-2 border border-dashed rounded-xl border-border/80">
              <CheckCircle2 className="size-8 text-emerald-500/60 mx-auto" />
              <p className="font-heading text-sm font-semibold">All Field Records Synced</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                No offline uploads waiting. Any photos captured underground or without internet will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {queue.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setPreviewItem(item)}
                  className={cn(
                    "group p-3 rounded-xl border transition-all cursor-pointer hover:border-primary/40",
                    item.status === "failed"
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border/80 bg-card hover:bg-secondary/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-heading text-xs font-bold text-foreground truncate">
                          {item.campaignName || "Campaign Field Duty"}
                        </p>
                        {item.assetCode && (
                          <Badge variant="outline" className="text-[10px] mono-label px-1 py-0">
                            {item.assetCode}
                          </Badge>
                        )}
                        {item.gtpSeq ? (
                          <Badge className="text-[10px] bg-primary/20 text-primary px-1.5 py-0">
                            GTP #{item.gtpSeq}
                          </Badge>
                        ) : item.checklistItemLabel ? (
                          <Badge className="text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0">
                            {item.checklistItemLabel}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Camera className="size-3 text-primary" />
                          {item.files?.length || 0} photo{(item.files?.length || 0) === 1 ? "" : "s"}
                        </span>
                        {item.files?.[0]?.geo && (
                          <span className="flex items-center gap-1 text-sky-400 truncate max-w-[140px]">
                            <MapPin className="size-3 shrink-0" />
                            {item.files[0].geo}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {fmtDateTime(item.timestamp)}
                        </span>
                      </div>

                      {item.error && (
                        <p className="mt-1 text-[11px] text-destructive flex items-center gap-1">
                          <AlertTriangle className="size-3" />
                          {item.error}
                        </p>
                      )}
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDeleteItem(item.id, e)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  {/* Thumbnail Previews */}
                  {item.files?.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1">
                      {item.files.map((f, idx) => (
                        <div
                          key={idx}
                          className="size-12 rounded-lg border border-border/80 overflow-hidden shrink-0 bg-slate-900/50"
                        >
                          <img
                            src={f.base64Data}
                            alt={f.filename}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 border-t bg-secondary/20 flex sm:justify-between items-center gap-2">
          <div className="text-[11px] text-muted-foreground hidden sm:block">
            {isOnline ? "Auto-syncs automatically when connected" : "Will auto-upload upon reconnection"}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              className="flex-1 sm:flex-none gap-2 font-semibold"
              disabled={syncing || pendingCount === 0 || !isOnline}
              onClick={handleSyncNow}
              data-testid="sync-now-button"
            >
              <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
              {syncing ? "Syncing..." : `Sync Now (${pendingCount})`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
