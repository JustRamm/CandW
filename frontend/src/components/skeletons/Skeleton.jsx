import { cn } from "@/lib/utils";

export default function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "skeleton-shimmer rounded-md bg-muted/80 dark:bg-muted/40",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
