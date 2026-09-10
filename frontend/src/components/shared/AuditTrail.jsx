import { ArrowRight } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import DocumentList from "@/components/shared/DocumentList";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/helpers";

const ACTION_TONE = {
  asset_created: "border-blue-800 text-blue-300",
  interest_added: "border-sky-800 text-sky-300",
  queue_expired: "border-amber-800 text-amber-300",
  queue_promoted: "border-sky-800 text-sky-300",
  queue_confirmed: "border-emerald-800 text-emerald-300",
  queue_auto_cancelled: "border-orange-800 text-orange-300",
  queue_withdrawn: "border-slate-700 text-slate-300",
  campaign_created: "border-violet-800 text-violet-300",
  checklist_updated: "border-slate-700 text-slate-300",
  ad_onboarded: "border-violet-800 text-violet-300",
  invoice_raised: "border-emerald-800 text-emerald-300",
  campaign_live: "border-emerald-800 text-emerald-300",
  gtp_submitted: "border-sky-800 text-sky-300",
  gtp_approved: "border-emerald-800 text-emerald-300",
  gtp_rejected: "border-red-800 text-red-300",
  cancellation_requested: "border-amber-800 text-amber-300",
  cancellation_approved: "border-orange-800 text-orange-300",
  cancellation_rejected: "border-slate-700 text-slate-300",
  asset_released: "border-blue-800 text-blue-300",
};

function diffPairs(obj) {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj).map(([k, v]) => `${k}: ${String(v)}`);
}

export default function AuditTrail({ entries = [], emptyHint }) {
  if (!entries.length) {
    return (
      <EmptyState
        title="No audit entries yet"
        hint={emptyHint ?? "Every status change, upload, approval and rejection is recorded here permanently."}
        testId="audit-empty-state"
      />
    );
  }
  return (
    <ol className="relative space-y-2 border-l border-border/60 pl-4" data-testid="audit-trail">
      {entries.map((a) => (
        <li key={a.id} className="relative" data-testid="audit-entry">
          <span className="absolute -left-[21px] top-3 size-2 rounded-full bg-primary/70" />
          <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`mono-label ${ACTION_TONE[a.action] ?? "border-border/70 text-muted-foreground"}`}
                data-testid={`audit-action-${a.action}`}
              >
                {a.action.replace(/_/g, " ")}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {a.actor_name} · {a.actor_role}
              </span>
              <span className="mono-label ml-auto text-muted-foreground">{fmtDateTime(a.created_at)}</span>
            </div>
            {a.comment && <p className="mt-2 text-xs leading-relaxed text-foreground">{a.comment}</p>}
            {(a.before || a.after) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                {a.before && <span className="font-mono">{diffPairs(a.before).join(", ")}</span>}
                {a.before && a.after && <ArrowRight className="size-3" />}
                {a.after && <span className="font-mono text-foreground">{diffPairs(a.after).join(", ")}</span>}
              </div>
            )}
            {a.doc_ids?.length > 0 && (
              <div className="mt-2">
                <DocumentList docIds={a.doc_ids} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
