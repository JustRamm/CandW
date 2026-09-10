import Skeleton from "./Skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function AssetDetailSkeleton() {
  return (
    <div className="space-y-6" data-testid="asset-detail-skeleton">
      {/* Top Hero Card */}
      <Card className="overflow-hidden rounded-xl border-border/80 bg-card shadow-xs">
        <div className="grid md:grid-cols-[320px_1fr]">
          {/* Photo banner skeleton */}
          <div className="h-56 bg-secondary/50 md:h-full">
            <Skeleton className="h-full w-full rounded-none" />
          </div>

          {/* Details & Specs */}
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>

            <Skeleton className="h-7 w-3/4 max-w-md" />

            {/* Spec definition grid */}
            <div className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-border/40">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Tabs navigation row */}
      <div className="flex gap-4 border-b border-border/60 pb-2">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* Tab panel card */}
      <Card className="rounded-xl border-border/80 bg-card p-5 shadow-xs">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-3.5"
            >
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
