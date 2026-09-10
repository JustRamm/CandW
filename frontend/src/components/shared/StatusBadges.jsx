import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ASSET_STATUS_LABELS, STAGE_LABELS } from "@/lib/helpers";

const ASSET_TONE = {
  available: "bg-sky-50 text-[#004c69] border-sky-200",
  reserved: "bg-cyan-50 text-cyan-800 border-cyan-200",
  onboarding: "bg-amber-50 text-amber-800 border-amber-200",
  live: "bg-emerald-50 text-[#006d37] border-emerald-200 font-semibold",
};

const STAGE_TONE = {
  onboarding: "bg-amber-50 text-amber-800 border-amber-200",
  invoicing: "bg-indigo-50 text-indigo-800 border-indigo-200",
  live: "bg-emerald-50 text-[#006d37] border-emerald-200 font-semibold",
  closing: "bg-orange-50 text-orange-800 border-orange-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200",
};

const URGENCY_TONE = {
  normal: "bg-sky-50 text-[#004c69] border-sky-200",
  warning: "bg-amber-50 text-amber-800 border-amber-300",
  urgent: "bg-red-50 text-[#ba1a1a] border-red-200 animate-urgent-pulse",
};

const GTP_TONE = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  submitted: "bg-sky-50 text-[#004c69] border-sky-200",
  approved: "bg-emerald-50 text-[#006d37] border-emerald-200",
  rejected: "bg-red-50 text-[#ba1a1a] border-red-200",
};

export function AssetStatusBadge({ status, className }) {
  return (
    <Badge
      variant="outline"
      data-testid={`asset-status-${status}`}
      className={cn("mono-label rounded-full border px-2.5 py-0.5 shadow-xs", ASSET_TONE[status] ?? ASSET_TONE.available, className)}
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
      className={cn("mono-label rounded-full border px-2.5 py-0.5 shadow-xs", STAGE_TONE[stage] ?? STAGE_TONE.closed, className)}
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
      className={cn("mono-label rounded-full border px-2.5 py-0.5 shadow-xs", URGENCY_TONE[urgency] ?? URGENCY_TONE.normal, className)}
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
      className={cn("mono-label rounded-full border px-2.5 py-0.5 shadow-xs", GTP_TONE[status] ?? GTP_TONE.pending, className)}
    >
      {status}
    </Badge>
  );
}
