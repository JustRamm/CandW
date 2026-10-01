import Skeleton from "./Skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function BrandsSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-2 items-stretch gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4" data-testid="brands-skeleton">
      {[...Array(count)].map((_, i) => (
        <Card key={i} className="rounded-xl border-border/80 bg-card p-2.5 sm:p-4 shadow-xs">
          <CardContent className="space-y-3 p-0">
            {/* Brand Header */}
            <div className="flex items-start justify-between gap-1.5 border-b border-border/50 pb-2">
              <div className="space-y-1 min-w-0 flex-1">
                <Skeleton className="h-4 sm:h-5 w-24 sm:w-32" />
                <Skeleton className="h-3 sm:h-3.5 w-16 sm:w-20" />
              </div>
              <Skeleton className="size-6 sm:size-8 rounded-lg" />
            </div>

            {/* Contact details */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Skeleton className="size-3 sm:size-3.5 rounded-full" />
                <Skeleton className="h-3 sm:h-3.5 w-20 sm:w-28" />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="size-3 sm:size-3.5 rounded-full" />
                <Skeleton className="h-3 sm:h-3.5 w-24 sm:w-40" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
