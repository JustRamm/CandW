import Skeleton from "./Skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function QueueSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3" data-testid="queue-skeleton">
      {[...Array(count)].map((_, i) => (
        <Card key={i} className="rounded-xl border-border/80 bg-card p-2.5 sm:p-4 shadow-xs">
          <CardContent className="space-y-2.5 sm:space-y-4 p-0">
            {/* Header: Asset Code & Location */}
            <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2 sm:pb-3">
              <div className="space-y-1 min-w-0 flex-1">
                <Skeleton className="h-4 sm:h-5 w-20 sm:w-28 rounded-md" />
                <Skeleton className="h-3 sm:h-3.5 w-24 sm:w-36" />
              </div>
              <Skeleton className="h-4 sm:h-6 w-16 sm:w-20 rounded-full shrink-0" />
            </div>

            {/* Active Slot Box */}
            <div className="rounded-lg border border-border/70 bg-secondary/30 p-2 sm:p-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1.5">
                  <Skeleton className="h-4 w-20 sm:w-28" />
                  <Skeleton className="h-3.5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32 sm:w-44" />
                <div className="flex items-center gap-1.5 pt-1">
                  <Skeleton className="h-5 sm:h-6 w-16 rounded-md" />
                  <Skeleton className="h-5 sm:h-6 w-14 rounded-md" />
                </div>
              </div>
            </div>

            {/* Pending Slots */}
            <div className="space-y-1 sm:space-y-1.5 pt-1">
              {[...Array(2)].map((_, j) => (
                <div
                  key={j}
                  className="flex items-center justify-between rounded-md border border-border/40 bg-secondary/20 px-2 py-1.5 sm:px-3 sm:py-2"
                >
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="size-3.5 sm:size-4 rounded-full" />
                    <Skeleton className="h-3 sm:h-3.5 w-16 sm:w-24" />
                  </div>
                  <Skeleton className="h-4 sm:h-5 w-10 sm:w-12 rounded-md" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
