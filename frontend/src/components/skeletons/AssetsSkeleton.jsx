import Skeleton from "./Skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function AssetsSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 items-start gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" data-testid="assets-skeleton">
      {[...Array(count)].map((_, i) => {
        return (
          <Card key={i} className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
            {/* Uniform 4:5 aspect ratio placeholder */}
            <div className="relative w-full bg-secondary/40 border-b border-border/50 aspect-[4/5]">
              <Skeleton className="size-full rounded-none" />
            </div>

            <CardContent className="space-y-2 p-2 sm:p-3">
              <div className="space-y-1 sm:space-y-1.5">
                <Skeleton className="h-3.5 sm:h-4 w-3/4" />
                <Skeleton className="h-3 sm:h-3.5 w-1/2" />
                <Skeleton className="h-2.5 sm:h-3 w-1/3" />
              </div>

              <div className="flex flex-wrap gap-1 sm:gap-1.5 pt-1 border-t border-border/40">
                <Skeleton className="h-4 sm:h-5 w-12 sm:w-16 rounded-md" />
                <Skeleton className="h-4 sm:h-5 w-14 sm:w-20 rounded-md" />
              </div>

              <div className="flex items-center justify-between pt-1 sm:pt-2 border-t border-border/40">
                <Skeleton className="h-5 sm:h-6 w-12 sm:w-14 rounded-md" />
                <Skeleton className="h-5 sm:h-6 w-12 sm:w-14 rounded-md" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

