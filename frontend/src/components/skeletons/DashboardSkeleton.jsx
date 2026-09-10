import Skeleton from "./Skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6" data-testid="dashboard-skeleton">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="rounded-xl border-border/80 bg-card p-4 shadow-xs">
            <Skeleton className="h-9 w-20 rounded-lg" />
            <Skeleton className="mt-2.5 h-3.5 w-28" />
          </Card>
        ))}
      </div>

      {/* Two operational panels */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Panel 1 */}
        <Card className="rounded-xl border-border/80 bg-card shadow-xs">
          <CardHeader className="border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-5 w-44" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3.5 py-3"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="size-7 rounded-md" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Panel 2 */}
        <Card className="rounded-xl border-border/80 bg-card shadow-xs">
          <CardHeader className="border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-5 w-48" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3.5 py-3"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="size-4 rounded-full" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
