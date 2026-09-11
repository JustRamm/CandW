export default function PageLoadingFallback() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background select-none">
      {/* Top progress line */}
      <div className="fixed top-0 inset-x-0 h-0.5 bg-primary/20 overflow-hidden z-50">
        <div className="h-full bg-primary w-full origin-left animate-indeterminate-bar" />
      </div>

      <div className="flex flex-col items-center gap-3 animate-in fade-in duration-150">
        <div className="relative flex items-center justify-center">
          <div className="size-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
        <p className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Loading view…
        </p>
      </div>
    </div>
  );
}
