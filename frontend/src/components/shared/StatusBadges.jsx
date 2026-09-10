import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ASSET_STATUS_LABELS, STAGE_LABELS } from "@/lib/helpers";

const ASSET_TONE = {
  available: "bg-blue-950/60 text-blue-300 border-blue-800",
  reserved: "bg-sky-950/60 text-sky-300 border-sky-800",
  onboarding: "bg-amber-950/60 text-amber-300 border-amber-800",
  live: "bg-emerald-950/60 text-emerald-300 border-emerald-800",
};

const STAGE_TONE = {
  onboarding: "bg-amber-950/60 text-amber-300 border-amber-800",
  invoicing: "bg-violet-950/60 text-violet-300 border-violet-800",
  live: "bg-emerald-950/60 text-emerald-300 border-emerald-800",
  closing: "bg-orange-950/60 text-orange-300 border-orange-800",
  closed: "bg-slate-800/60 text-slate-400 border-slate-700",
};

const URGENCY_TONE = {
  normal: "bg-sky-950/60 text-sky-300 border-sky-800",
  warning: "bg-amber-950/60 text-amber-300 border-amber-700",
  urgent: "bg-red-950/60 text-red-300 border-red-700 animate-urgent-pulse",
};

const GTP_TONE = {
  pending: "bg-slate-800/60 text-slate-300 border-slate-700",
  submitted: "bg-sky-950/60 text-sky-300 border-sky-800",
  approved: "bg-emerald-950/60 text-emerald-300 border-emerald-800",
  rejected: "bg-red-950/60 text-red-300 border-red-800",
};

export function AssetStatusBadge({ status, className }) {
  return (
    <Badge
      variant="outline"
      data-testid={`asset-status-${status}`}
      className={cn("mono-label border", ASSET_TONE[status] ?? ASSET_TONE.available, className)}
    >
      {ASSET_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function StageBadge({ stage, className }) {
  return (
    <Badge
      variant="outline"
      data-testid={`stage-badge-${stage}`}
      className={cn("mono-label border", STAGE_TONE[stage] ?? STAGE_TONE.closed, className)}
    >
      {STAGE_LABELS[stage] ?? stage}
    </Badge>
  );
}

export function UrgencyBadge({ urgency, daysRemaining, className }) {
  if (urgency === "none" || daysRemaining == null) return null;
  const label =
    daysRemaining <= 0
      ? "Expires today"
      : `${daysRemaining} business day${daysRemaining === 1 ? "" : "s"} left`;
  return (
    <Badge
      variant="outline"
      data-testid={`queue-urgency-${urgency}`}
      className={cn("mono-label border", URGENCY_TONE[urgency] ?? URGENCY_TONE.normal, className)}
    >
      {label}
    </Badge>
  );
}

export function GtpStatusBadge({ status, className }) {
  return (
    <Badge
      variant="outline"
      data-testid={`gtp-status-${status}`}
      className={cn("mono-label border", GTP_TONE[status] ?? GTP_TONE.pending, className)}
    >
      {status}
    </Badge>
  );
}
