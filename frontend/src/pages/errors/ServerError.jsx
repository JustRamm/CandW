import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Copy, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { endSession } from "@/lib/session";
import sound from "@/lib/sound";

export default function ServerError({ error, onReset }) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleClearAndReset = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    await endSession("/login");
  };

  const handleCopyDiagnostic = async () => {
    try {
      const errorText = `${error?.toString() || "Unknown Error"}\n\nStack:\n${error?.stack || "No stack trace available"}\n\nURL: ${window.location.href}\nTime: ${new Date().toISOString()}`;
      await navigator.clipboard.writeText(errorText);
      sound.success();
      setCopied(true);
      toast.success("Technical diagnostic copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      sound.warning();
      toast.error("Failed to copy diagnostic to clipboard");
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-12 text-center select-none">
      {/* Visual Accent */}
      <div className="relative mb-6 flex items-center justify-center">
        <div className="size-24 rounded-full bg-destructive/10 flex items-center justify-center ring-8 ring-destructive/5">
          <AlertTriangle className="size-12 text-destructive" />
        </div>
        <span className="absolute -bottom-2 font-mono text-xs font-bold uppercase tracking-widest text-destructive bg-background px-2.5 py-0.5 rounded-full border border-destructive/20 shadow-xs">
          500 Error
        </span>
      </div>

      {/* Headings */}
      <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
        An unexpected application error occurred. Your database records and inventory are safe.
      </p>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          size="sm"
          onClick={() => (onReset ? onReset() : window.location.reload())}
          className="gap-2 shadow-xs cursor-pointer"
        >
          <RefreshCw className="size-4" />
          Reload page
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearAndReset}
          className="gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <LogOut className="size-4" />
          Clear cache & re-login
        </Button>
      </div>

      {/* Collapsible Error Debug Details */}
      {error && (
        <div className="mt-8 w-full max-w-lg text-left">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="flex items-center gap-1 text-xs font-mono text-muted-foreground/80 hover:text-foreground transition-colors mx-auto cursor-pointer"
          >
            {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {showDetails ? "Hide technical diagnostic" : "Show technical diagnostic"}
          </button>

          {showDetails && (
            <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs font-mono text-destructive/90 overflow-x-auto max-h-60">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-destructive/15">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-destructive/80">
                  Diagnostic Stack Trace
                </span>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleCopyDiagnostic}
                  className="h-7 gap-1.5 text-xs border-destructive/30 hover:bg-destructive/10 text-destructive cursor-pointer"
                  data-testid="copy-diagnostic-button"
                >
                  {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                  <span>{copied ? "Copied" : "Copy diagnostic"}</span>
                </Button>
              </div>
              <p className="font-bold select-text">{error.toString()}</p>
              {error.stack && (
                <pre className="mt-2 text-[11px] text-muted-foreground/90 whitespace-pre-wrap leading-relaxed select-text">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mt-12 text-xs font-mono text-muted-foreground/60">
        Carbon & Whale &middot; Inventory Management System
      </p>
    </div>
  );
}
