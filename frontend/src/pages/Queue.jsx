import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Download, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import FileUploader from "@/components/shared/FileUploader";
import { UrgencyBadge } from "@/components/shared/StatusBadges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useMe, useQueueList } from "@/lib/queries";
import { REASON_LABELS, downloadCsv, errMessage, fmtDate } from "@/lib/helpers";
import { cn } from "@/lib/utils";

function ConfirmDialog({ entry }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("advance_payment");
  const [docs, setDocs] = useState([]);
  const [days, setDays] = useState(entry.proposed_duration_days);
  const [comment, setComment] = useState("");

  const confirm = useMutation({
    mutationFn: (body) => apiPost(`/queue/${entry.id}/confirm`, body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Interest confirmed — onboarding task created", {
        description: res.cancelled_entries
          ? `${res.cancelled_entries} waitlist entr${res.cancelled_entries === 1 ? "y" : "ies"} auto-cancelled`
          : undefined,
      });
      setOpen(false);
    },
    onError: (err) => toast.error(errMessage(err, "Confirmation failed")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="xs" data-testid={`confirm-entry-button-${entry.brand.replace(/\s+/g, "-")}`} />}>
        <CheckCircle2 className="size-3.5" />
        Confirm
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Confirm {entry.brand} on {entry.asset_code}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!docs.length) {
              toast.error("A supporting document is required");
              return;
            }
            confirm.mutate({
              reason_type: reason,
              doc_ids: docs.map((d) => d.id),
              final_duration_days: Number(days),
              comment,
            });
          }}
          data-testid="confirm-entry-form"
        >
          <div className="space-y-1.5">
            <Label>Confirmation basis</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger data-testid="confirm-reason-select">
                <SelectValue>{(v) => REASON_LABELS[v] ?? "Select"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REASON_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k} data-testid={`confirm-reason-option-${k}`}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="final-days">Final campaign duration (days)</Label>
            <Input
              id="final-days"
              type="number"
              min={1}
              required
              value={days}
              onChange={(e) => setDays(e.target.value)}
              data-testid="confirm-duration-input"
            />
            <p className="text-xs text-muted-foreground">
              Sales proposed {entry.proposed_duration_days} days — the original is preserved for audit.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Supporting document (required)</Label>
            <FileUploader value={docs} onChange={setDocs} label="Attach agreement / PO / receipt" testId="confirm-doc-uploader" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-comment">Comment</Label>
            <Textarea
              id="confirm-comment"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              data-testid="confirm-comment-input"
            />
          </div>
          <p className="rounded-lg border border-amber-800/60 bg-amber-950/25 px-3 py-2 text-xs text-amber-300">
            Confirming auto-cancels every other pending waitlist entry on this asset and notifies those
            salespersons.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={confirm.isPending} data-testid="submit-confirm-button">
              {confirm.isPending ? "Confirming…" : "Confirm interest"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Queue() {
  const { data: me } = useMe();
  const { data: entries, isError, isLoading } = useQueueList();
  const [onlyMine, setOnlyMine] = useState(false);

  const withdraw = useMutation({
    mutationFn: (id) => apiPost(`/queue/${id}/withdraw`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Interest withdrawn");
    },
    onError: (err) => toast.error(errMessage(err, "Could not withdraw")),
  });

  const list = (entries ?? []).filter((e) => !onlyMine || e.salesperson_id === me?.id);
  const grouped = list.reduce((acc, e) => {
    acc[e.asset_code] = acc[e.asset_code] ?? [];
    acc[e.asset_code].push(e);
    return acc;
  }, {});

  const isFm = me?.role === "finance_manager" || me?.role === "admin";

  return (
    <AppShell
      title="Interest queue"
      subtitle="One active slot per asset, plus an ordered waitlist visible to the whole sales team"
      actions={
        <div className="flex items-center gap-1.5">
          {me?.role === "sales" && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setOnlyMine((v) => !v)}
              data-testid="toggle-my-entries-button"
            >
              {onlyMine ? "Show all" : "Only mine"}
            </Button>
          )}
          <Button
            variant="outline"
            size="xs"
            onClick={() =>
              downloadCsv(
                "interest-queue.csv",
                list.map((e) => ({
                  asset_code: e.asset_code,
                  location: e.asset_location,
                  brand: e.brand,
                  salesperson: e.salesperson_name,
                  state: e.state,
                  position: e.position,
                  proposed_days: e.proposed_duration_days,
                  proposed_start: e.proposed_start_date ?? "",
                  proposed_end: e.proposed_end_date ?? "",
                  expires_on: e.expires_on ?? "",
                  days_remaining: e.days_remaining ?? "",
                })),
              )
            }
            data-testid="export-queue-button"
          >
            <Download className="size-3.5" />
            Export
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {isError && (
          <EmptyState
            title="Queue unavailable"
            hint="The queue service could not be reached. Try again shortly."
            testId="queue-error-state"
          />
        )}
        {isLoading && <div className="h-40 animate-pulse rounded-xl border border-border/60 bg-card/40" />}
        {!isLoading && !isError && list.length === 0 && (
          <EmptyState
            title="No open interest"
            hint="Sales adds brands from an asset's page — the first entry takes the active slot."
            icon={ListOrdered}
            testId="queue-empty-state"
          />
        )}

        <div className="space-y-4" data-testid="queue-board">
          {Object.entries(grouped).map(([assetCode, group]) => {
            const active = group.find((e) => e.state === "active");
            const pending = group.filter((e) => e.state === "pending").sort((a, b) => a.position - b.position);
            return (
              <Card
                key={assetCode}
                className={cn(
                  "border-border/70 bg-card/70 transition-colors duration-200",
                  active?.urgency === "urgent" && "border-red-700/60",
                  active?.urgency === "warning" && "border-amber-700/60",
                )}
                data-testid={`queue-group-${assetCode}`}
              >
                <CardContent className="space-y-3 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/assets/${group[0].asset_id}`}
                        className="mono-label text-primary transition-colors duration-150 hover:text-sky-300"
                        data-testid={`queue-asset-link-${assetCode}`}
                      >
                        {assetCode}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{group[0].asset_location}</p>
                    </div>
                    <Badge variant="outline" className="mono-label border-border/70 text-muted-foreground">
                      {group.length} in queue
                    </Badge>
                  </div>

                  {active && (
                    <div
                      className={cn(
                        "rounded-xl border px-4 py-3",
                        active.urgency === "urgent"
                          ? "border-red-700/70 bg-red-950/25 animate-urgent-pulse"
                          : active.urgency === "warning"
                            ? "border-amber-700/70 bg-amber-950/20"
                            : "border-primary/50 bg-primary/5",
                      )}
                      data-testid={`queue-active-slot-${assetCode}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-heading text-sm font-semibold">{active.brand}</p>
                            <Badge variant="outline" className="mono-label border-primary/50 text-primary">
                              Active slot
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {active.salesperson_name} · proposed {active.proposed_duration_days} days
                            {active.proposed_start_date
                              ? ` (${fmtDate(active.proposed_start_date)} → ${fmtDate(active.proposed_end_date)})`
                              : ""}{" "}
                            · expires {fmtDate(active.expires_on)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <UrgencyBadge urgency={active.urgency} daysRemaining={active.days_remaining} />
                          {isFm && <ConfirmDialog entry={active} />}
                          {me?.role === "sales" && active.salesperson_id === me.id && (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => withdraw.mutate(active.id)}
                              className="text-muted-foreground hover:text-destructive"
                              data-testid="withdraw-active-button"
                            >
                              Withdraw
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {pending.length > 0 && (
                    <ul className="space-y-1.5" data-testid={`queue-waitlist-${assetCode}`}>
                      {pending.map((e) => (
                        <li
                          key={e.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2"
                          data-testid="queue-waitlist-entry"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="mono-label shrink-0 text-muted-foreground">#{e.position}</span>
                            <span className="truncate text-sm">{e.brand}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {e.salesperson_name} · {e.proposed_duration_days}d
                            </span>
                          </div>
                          {me?.role === "sales" && e.salesperson_id === me.id && (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => withdraw.mutate(e.id)}
                              className="text-muted-foreground hover:text-destructive"
                              data-testid="withdraw-waitlist-button"
                            >
                              Withdraw
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
