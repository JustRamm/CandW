import Skeleton from "./Skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function CampaignsSkeleton({ count = 4 }) {
  return (
    <div className="space-y-4" data-testid="campaigns-skeleton">
      {/* Stage filter skeleton */}
      <Skeleton className="h-9 w-52 rounded-lg" />

      {/* Campaign Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {[...Array(count)].map((_, i) => (
          <Card key={i} className="rounded-xl border-border/80 bg-card p-2.5 sm:p-4 shadow-xs">
            <CardContent className="space-y-2.5 sm:space-y-3 p-0">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 border-b border-border/50 pb-2 sm:pb-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <Skeleton className="h-4 sm:h-5 w-24 sm:w-36" />
                  <Skeleton className="h-3 sm:h-3.5 w-16 sm:w-24" />
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-4 sm:h-5 w-12 sm:w-16 rounded-full" />
                  <Skeleton className="h-4 sm:h-5 w-14 sm:w-20 rounded-full" />
                </div>
              </div>

              {/* 4-column metric info */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 sm:grid-cols-4 sm:gap-2">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="space-y-0.5">
                    <Skeleton className="h-2.5 sm:h-3 w-10 sm:w-14" />
                    <Skeleton className="h-3 sm:h-3.5 w-14 sm:w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
