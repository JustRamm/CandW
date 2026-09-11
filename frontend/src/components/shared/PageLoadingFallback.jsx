import Skeleton from "@/components/skeletons/Skeleton";

export default function PageLoadingFallback() {
  return (
    <div className="flex h-screen w-screen bg-background overflow-hidden select-none">
      {/* Sidebar Skeleton */}
      <aside className="hidden w-[248px] shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col h-screen p-4 space-y-4">
        <div className="flex items-center gap-2.5 px-2 py-3 border-b border-sidebar-border/60">
          <Skeleton className="size-9 rounded-xl" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <div className="space-y-2 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="border-b border-border/70 px-4 py-4 md:px-8 flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3.5 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </header>
        <main className="p-4 md:p-8 space-y-5 flex-1 overflow-hidden">
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          {/* Panels */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </main>
      </div>
    </div>
  );
}
