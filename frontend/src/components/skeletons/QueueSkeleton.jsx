import Skeleton from "./Skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function QueueSkeleton({ count = 3 }) {
  return (
    <div className="space-y-4" data-testid="queue-skeleton">
      {[...Array(count)].map((_, i) => (
        <Card key={i} className="rounded-xl border-border/80 bg-card p-4 shadow-xs">
          <CardContent className="space-y-4 p-0">
            {/* Header: Asset Code & Location */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24 rounded-md" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-3.5 w-48" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>

            {/* Active Slot Box */}
            <div className="rounded-lg border border-border/70 bg-secondary/30 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-5 w-36" />
                  </div>
                  <Skeleton className="h-3.5 w-56" />
                </div>

                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-24 rounded-md" />
                  <Skeleton className="h-7 w-20 rounded-md" />
                  <Skeleton className="h-7 w-20 rounded-md" />
                </div>
              </div>
            </div>

            {/* Pending Slots */}
            <div className="space-y-2 pt-1">
              {[...Array(2)].map((_, j) => (
                <div
                  key={j}
                  className="flex items-center justify-between rounded-md border border-border/40 bg-secondary/20 px-3 py-2"
                >
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="size-5 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3.5 w-36" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-md" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
