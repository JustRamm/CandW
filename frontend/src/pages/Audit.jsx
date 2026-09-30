import { useState } from "react";
import { Upload, ShieldCheck, UserCheck, Cpu, FilterX } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import AuditTrail from "@/components/shared/AuditTrail";
import { AuditSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuditLog, useMe, useUsers } from "@/lib/queries";
import { downloadCsv } from "@/lib/helpers";

const ENTITY_TYPES = [
  ["all", "All entities"],
  ["campaign", "Campaigns & Closures"],
  ["asset", "Assets & Displays"],
  ["queue_entry", "Interest Queue & Holds"],
  ["gtp", "GTP Records & Proofs"],
  ["brand", "Brands & Clients"],
  ["user", "Users & Permissions"],
  ["settings", "System Settings"],
];

export default function Audit() {
  const { data: me } = useMe();
  const [entityType, setEntityType] = useState("all");
  const [actorId, setActorId] = useState("all");
  const [limit, setLimit] = useState(100);
  const { data: entries, isError, isLoading } = useAuditLog({ entity_type: entityType, actor_id: actorId, limit });
  const { data: users } = useUsers(me?.role === "admin");

  return (
    <AppShell
      title="Audit trail"
      subtitle="Immutable corporate ledger of every status change, upload, approval, rejection, and SLA event"
      actions={
        <Button
          variant="outline"
          size="xs"
          onClick={() =>
            downloadCsv(
              "audit-trail.csv",
              (entries ?? []).map((a) => ({
                created_at: a.created_at,
                entity_type: a.entity_type,
                action: a.action,
                actor: a.actor_name,
                actor_role: a.actor_role,
                comment: a.comment,
                before: JSON.stringify(a.before ?? ""),
                after: JSON.stringify(a.after ?? ""),
              })),
            )
          }
          data-testid="export-audit-button"
        >
          <Upload className="size-3.5" />
          Export CSV
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Informational Ledger Overview Card */}
        <Card className="border-border/70 bg-secondary/20">
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-500" />
                <span className="font-heading font-semibold text-foreground">
                  Automated Non-Repudiation Audit Ledger
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                ● Live & Recording
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-muted-foreground">
              <div className="flex items-start gap-2 bg-card/60 p-2.5 rounded-lg border border-border/50">
                <UserCheck className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block mb-0.5">Who writes entries?</strong>
                  All authenticated roles (<span className="text-foreground font-medium">Sales</span>, <span className="text-foreground font-medium">Operations</span>, <span className="text-foreground font-medium">Finance</span>, <span className="text-foreground font-medium">Admin</span>) and the <span className="text-foreground font-medium">Automated SLA Engine</span>.
                </div>
              </div>

              <div className="flex items-start gap-2 bg-card/60 p-2.5 rounded-lg border border-border/50">
                <Cpu className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block mb-0.5">How are values entered?</strong>
                  <strong className="text-foreground">100% Automated.</strong> Entries are permanently recorded in the background whenever a state change, upload, approval, payment, or SLA expiration occurs.
                </div>
              </div>

              <div className="flex items-start gap-2 bg-card/60 p-2.5 rounded-lg border border-border/50">
                <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block mb-0.5">Integrity Guarantee</strong>
                  Append-only immutable record. Past audit events cannot be edited or purged by any user.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filter Controls */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-full sm:w-60" data-testid="audit-entity-filter">
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map(([k, label]) => (
                <SelectItem key={k} value={k} data-testid={`audit-entity-option-${k}`}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {me?.role === "admin" && (
            <Select value={actorId} onValueChange={setActorId}>
              <SelectTrigger className="w-full sm:w-56" data-testid="audit-actor-filter">
                <SelectValue placeholder="All actors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actors</SelectItem>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {entityType !== "all" && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setEntityType("all");
                setActorId("all");
              }}
              className="text-xs text-muted-foreground hover:text-foreground h-9 gap-1.5"
            >
              <FilterX className="size-3.5" />
              Reset filters
            </Button>
          )}
        </div>

        {isLoading ? (
          <AuditSkeleton count={5} />
        ) : (
          <>
            <AuditTrail
              entries={isError ? [] : (entries ?? [])}
              emptyHint={
                isError
                  ? "The audit service could not be reached. Try again shortly."
                  : entityType !== "all"
                  ? `No audit entries recorded for "${ENTITY_TYPES.find(([k]) => k === entityType)?.[1]}". Try switching the filter to "All entities".`
                  : "No audit events recorded yet. Actions across Sales, Ops, Finance, and System automations will appear here automatically."
              }
            />
            {entries && entries.length >= limit && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLimit((prev) => prev + 100)}
                  data-testid="audit-load-more-btn"
                >
                  Load next 100 entries (showing {entries.length})
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
