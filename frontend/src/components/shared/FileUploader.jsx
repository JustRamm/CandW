import { useRef, useState } from "react";
import { Paperclip, Upload, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errMessage, uploadMany } from "@/lib/helpers";
import sound from "@/lib/sound";
import { cn } from "@/lib/utils";

/**
 * Uploads images/PDFs and hands the resulting document ids back via onChange.
 * `geotag` mode stamps a simulated GPS coordinate onto each file (field capture).
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
    sound.upload();
    setBusy(true);
    try {
      const geo = geotag
        ? `${(19.05 + Math.random() * 0.12).toFixed(4)}N, ${(72.85 + Math.random() * 0.12).toFixed(4)}E`
        : "";
      const docs = await uploadMany(files, { label, geo });
      onChange?.([...value, ...docs]);
      sound.success();
      toast.success(`${docs.length} file${docs.length === 1 ? "" : "s"} uploaded`);
    } catch (err) {
      sound.warning();
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
        {geotag ? <MapPin className="size-4" /> : <Upload className="size-4" />}
        {busy ? "Uploading…" : geotag ? "Capture geo-tagged photo" : label}
      </Button>
      {value.length > 0 && (
        <ul className="space-y-1.5" data-testid={`${testId}-list`}>
          {value.map((doc) => (
            <li
              key={doc.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-xs animate-fade-in",
              )}
              data-testid={`${testId}-item`}
            >
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{doc.filename}</span>
              {doc.geo && <span className="mono-label shrink-0 text-sky-400">{doc.geo}</span>}
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
