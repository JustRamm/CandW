import Skeleton from "./Skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function BrandsSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="brands-skeleton">
      {[...Array(count)].map((_, i) => (
        <Card key={i} className="rounded-xl border-border/80 bg-card p-4 shadow-xs">
          <CardContent className="space-y-4 p-0">
            {/* Brand Header */}
            <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-3">
              <div className="space-y-1.5 min-w-0 flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3.5 w-20" />
              </div>
              <Skeleton className="size-8 rounded-lg" />
            </div>

            {/* Contact details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-3.5 rounded-full" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="size-3.5 rounded-full" />
                <Skeleton className="h-3.5 w-40" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="size-3.5 rounded-full" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
