import { useRef, useState } from "react";
import { Paperclip, Upload, X, MapPin, WifiOff, Cloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errMessage, uploadMany } from "@/lib/helpers";
import { getDeviceGeolocation } from "@/lib/pwa";
import { fileToBase64 } from "@/lib/offlineStore";
import sound from "@/lib/sound";
import { cn } from "@/lib/utils";

/**
 * Uploads images/PDFs and hands the resulting document ids back via onChange.
 * Supports online Supabase direct upload as well as offline PWA field mode with GPS tagging.
 */
export default function FileUploader({
  value = [],
  onChange,
  label = "Attach document",
  multiple = false,
  geotag = false,
  testId = "file-uploader",
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(e) {
    const files = e.target.files;
    if (!files?.length) return;
    sound.upload?.();
    setBusy(true);

    try {
      let geo = "";
      if (geotag) {
        const geoInfo = await getDeviceGeolocation();
        geo = geoInfo.formatted;
      }

      // If online, attempt direct upload
      if (navigator.onLine) {
        try {
          const docs = await uploadMany(files, { label, geo });
          onChange?.([...value, ...docs]);
          sound.success?.();
          toast.success(`${docs.length} file${docs.length === 1 ? "" : "s"} uploaded`);
          return;
        } catch (uploadErr) {
          console.warn("Online upload failed, falling back to offline buffer:", uploadErr);
          // Fall through to offline handling
        }
      }

      // Offline mode handling: read as base64 and create local mock document objects
      const offlineDocs = [];
      for (const file of Array.from(files)) {
        const base64Data = await fileToBase64(file);
        const localId = `local_doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        offlineDocs.push({
          id: localId,
          filename: file.name,
          content_type: file.type || "image/jpeg",
          size: file.size,
          label,
          geo,
          url: base64Data, // previewable base64
          base64Data,
          isOffline: true,
          timestamp: new Date().toISOString(),
        });
      }

      onChange?.([...value, ...offlineDocs]);
      sound.success?.();
      toast.info(
        `Captured ${offlineDocs.length} photo${offlineDocs.length === 1 ? "" : "s"} in Offline Field Mode.`
      );
    } catch (err) {
      sound.warning?.();
      toast.error(errMessage(err, "Upload failed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2" data-testid={testId}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple={multiple}
        capture={geotag ? "environment" : undefined}
        onChange={handleFiles}
        className="hidden"
        data-testid={`${testId}-input`}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="w-full justify-start gap-2 border-dashed border-border/80 bg-secondary/40 py-5 transition-colors duration-200 hover:border-primary/50 hover:bg-secondary/70 sm:w-auto"
        data-testid={`${testId}-button`}
      >
        {geotag ? <MapPin className="size-4 text-sky-400" /> : <Upload className="size-4" />}
        {busy
          ? "Processing…"
          : label || (geotag ? "Capture Geo-Tagged Photo (GPS)" : "Attach document")}
      </Button>

      {value.length > 0 && (
        <ul className="space-y-1.5" data-testid={`${testId}-list`}>
          {value.map((doc) => (
            <li
              key={doc.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs animate-fade-in",
                doc.isOffline
                  ? "border-amber-400/50 bg-amber-500/10 text-foreground"
                  : "border-border/70 bg-secondary/40"
              )}
              data-testid={`${testId}-item`}
            >
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">{doc.filename}</span>
              {doc.geo && <span className="mono-label shrink-0 text-sky-400">{doc.geo}</span>}
              {doc.isOffline && (
                <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-500 font-semibold shrink-0">
                  <WifiOff className="size-3" /> Offline
                </span>
              )}
              <button
                type="button"
                aria-label={`Remove ${doc.filename}`}
                onClick={() => onChange?.(value.filter((d) => d.id !== doc.id))}
                className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                data-testid={`${testId}-remove`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
