import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE = {
  high: "border-red-700 bg-red-950/40 text-red-300",
  medium: "border-amber-700 bg-amber-950/35 text-amber-300",
  low: "border-slate-700 bg-slate-800/50 text-slate-300",
};

const ICON = { high: ArrowUp, medium: Minus, low: ArrowDown };

export default function PriorityBadge({ priority = "medium", className }) {
  const Icon = ICON[priority] ?? Minus;
  return (
    <Badge
      variant="outline"
      className={cn("mono-label border", TONE[priority] ?? TONE.medium, className)}
      data-testid={`priority-badge-${priority}`}
    >
      <Icon className="mr-1 size-3" />
      {priority}
    </Badge>
  );
}
