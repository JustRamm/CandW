import Skeleton from "./Skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AdminSkeleton() {
  return (
    <div className="space-y-6" data-testid="admin-skeleton">
      {/* Tabs list */}
      <div className="flex gap-4 border-b border-border/60 pb-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      {/* 2-column layout: Table / List + Form Card */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Table / List card */}
        <Card className="rounded-xl border-border/80 bg-card shadow-xs">
          <CardHeader className="border-b border-border/50 pb-3">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 p-3.5"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-44" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-16 rounded-md" />
                  <Skeleton className="size-7 rounded-md" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Form Card */}
        <Card className="h-fit rounded-xl border-border/80 bg-card p-5 shadow-xs">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <Skeleton className="h-9 w-full rounded-lg mt-2" />
          </div>
        </Card>
      </div>
    </div>
  );
}
