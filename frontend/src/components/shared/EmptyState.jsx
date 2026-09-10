import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EmptyState({ title, hint, icon: Icon = Inbox, className, testId = "empty-state" }) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-xl border border-dashed border-border/70 bg-card/40 px-5 py-8",
        className,
      )}
      data-testid={testId}
    >
      <Icon className="size-5 text-muted-foreground" />
      <p className="font-heading text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
