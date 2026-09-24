import Skeleton from "./Skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function AssetsSkeleton({ count = 8 }) {
  return (
    <div className="columns-1 sm:columns-2 md:columns-3 xl:columns-4 gap-4" data-testid="assets-skeleton">
      {[...Array(count)].map((_, i) => {
        const isLandscape = i % 2 === 0;
        return (
          <Card key={i} className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
            {/* Uniform 4:5 aspect ratio placeholder */}
            <div className="relative w-full bg-secondary/40 border-b border-border/50 aspect-[4/5]">
              <Skeleton className="size-full rounded-none" />
            </div>

            <CardContent className="space-y-3 p-3.5">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <Skeleton className="h-6 w-14 rounded-md" />
                <Skeleton className="h-6 w-14 rounded-md" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

