import Skeleton from "./Skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function BrandDetailSkeleton() {
  return (
    <div className="space-y-6" data-testid="brand-detail-skeleton">
      {/* Brand Profile Banner */}
      <Card className="rounded-xl border-border/80 bg-card p-6 shadow-xs">
        <CardContent className="p-0">
          <div className="flex items-start gap-4">
            <Skeleton className="size-12 rounded-xl shrink-0" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-8 w-56 max-w-sm" />
              <div className="grid gap-4 sm:grid-cols-3 pt-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-3.5 w-3/4 pt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns History Panel */}
      <Card className="rounded-xl border-border/80 bg-card shadow-xs">
        <CardHeader className="border-b border-border/50 pb-3">
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-3.5"
            >
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="size-4 rounded-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
