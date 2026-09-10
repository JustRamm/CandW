import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE = {
  high: "border-red-200 bg-red-50 text-[#ba1a1a]",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-slate-200 bg-slate-100 text-slate-600",
};

const ICON = { high: ArrowUp, medium: Minus, low: ArrowDown };

export default function PriorityBadge({ priority = "medium", className }) {
  const Icon = ICON[priority] ?? Minus;
  return (
    <Badge
      variant="outline"
      className={cn("mono-label rounded-full border px-2.5 py-0.5 shadow-xs", TONE[priority] ?? TONE.medium, className)}
      data-testid={`priority-badge-${priority}`}
    >
      <Icon className="mr-1 size-3" />
      {priority}
    </Badge>
  );
}
