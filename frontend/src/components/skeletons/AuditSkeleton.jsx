import Skeleton from "./Skeleton";

export default function AuditSkeleton({ count = 5 }) {
  return (
    <div className="space-y-4" data-testid="audit-skeleton">
      {/* Timeline items */}
      <ol className="relative space-y-3 border-l border-border/60 pl-4">
        {[...Array(count)].map((_, i) => (
          <li key={i} className="relative">
            {/* Dot on line */}
            <span className="absolute -left-[21px] top-3.5 size-2.5 rounded-full bg-primary/40 ring-4 ring-background" />

            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-3 w-28" />
              </div>

              <div className="mt-2.5 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
