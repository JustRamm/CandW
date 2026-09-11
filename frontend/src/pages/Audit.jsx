import { useState } from "react";
import { Download } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import AuditTrail from "@/components/shared/AuditTrail";
import { AuditSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuditLog, useMe, useUsers } from "@/lib/queries";
import { downloadCsv } from "@/lib/helpers";

const ENTITY_TYPES = [
  ["all", "All entities"],
  ["asset", "Assets"],
  ["queue_entry", "Queue entries"],
  ["campaign", "Campaigns"],
  ["gtp", "GTP records"],
  ["user", "Users"],
  ["settings", "Settings"],
];

export default function Audit() {
  const { data: me } = useMe();
  const [entityType, setEntityType] = useState("all");
  const [actorId, setActorId] = useState("all");
  const { data: entries, isError, isLoading } = useAuditLog({ entity_type: entityType, actor_id: actorId });
  const { data: users } = useUsers(me?.role === "admin");

  return (
    <AppShell
      title="Audit trail"
      subtitle="Immutable record of every status change, upload, approval and rejection"
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
          <Download className="size-3.5" />
          Export
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-full sm:w-56" data-testid="audit-entity-filter">
              <SelectValue>{(v) => ENTITY_TYPES.find(([k]) => k === v)?.[1] ?? "All entities"}</SelectValue>
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
                <SelectValue>
                  {(v) => (v === "all" ? "All actors" : users?.find((u) => u.id === v)?.name ?? "Actor")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actors</SelectItem>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <AuditSkeleton count={5} />
        ) : (
          <AuditTrail
            entries={isError ? [] : (entries ?? [])}
            emptyHint={
              isError
                ? "The audit service could not be reached. Try again shortly."
                : "Nothing recorded for this filter yet."
            }
          />
        )}
      </div>
    </AppShell>
  );
}
