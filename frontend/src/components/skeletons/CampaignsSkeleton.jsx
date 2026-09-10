import Skeleton from "./Skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function CampaignsSkeleton({ count = 4 }) {
  return (
    <div className="space-y-4" data-testid="campaigns-skeleton">
      {/* Stage filter skeleton */}
      <Skeleton className="h-9 w-52 rounded-lg" />

      {/* Campaign Cards Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[...Array(count)].map((_, i) => (
          <Card key={i} className="rounded-xl border-border/80 bg-card p-4 shadow-xs">
            <CardContent className="space-y-3 p-0">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-3">
                <div className="space-y-1 min-w-0">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>

              {/* 4-column metric info */}
              <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="space-y-1">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-3.5 w-20" />
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
