import Skeleton from "./Skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function AssetsSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" data-testid="assets-skeleton">
      {[...Array(count)].map((_, i) => (
        <Card key={i} className="overflow-hidden rounded-xl border-border/80 bg-card shadow-xs">
          {/* Card Top / Image 4:5 unified preview */}
          <div className="relative aspect-[4/5] w-full bg-secondary/30">
            <Skeleton className="size-full rounded-none" />
          </div>

          <CardContent className="space-y-4 p-4">
            {/* Specs & Location info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>

            {/* Spec Chips / Tags */}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-14 rounded-md" />
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
