import Skeleton from "./Skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function CampaignDetailSkeleton() {
  return (
    <div className="space-y-6" data-testid="campaign-detail-skeleton">
      {/* Top Campaign Summary Card */}
      <Card className="rounded-xl border-border/80 bg-card shadow-xs">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-8 w-64 max-w-sm" />
              <Skeleton className="h-3.5 w-32" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
          </div>

          {/* Metric specs */}
          <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-4 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stage Progression Pipeline */}
      <Card className="rounded-xl border-border/80 bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 overflow-x-auto py-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 flex-1 min-w-[120px]">
              <Skeleton className="size-7 rounded-full shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-2.5 w-14" />
              </div>
              {i < 4 && <Skeleton className="h-0.5 w-6 shrink-0" />}
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border/60 pb-2">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* Main Tab Content Card */}
      <Card className="rounded-xl border-border/80 bg-card p-6 shadow-xs">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2 border-b border-border/40 pb-4 last:border-none">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
