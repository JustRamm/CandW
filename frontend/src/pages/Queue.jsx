import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ListOrdered, Upload } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import FileUploader from "@/components/shared/FileUploader";
import { UrgencyBadge } from "@/components/shared/StatusBadges";
import { Button } from "@/components/ui/button";
import { QueueSkeleton } from "@/components/skeletons";
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
import { supabase } from "@/lib/supabase";
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
    mutationFn: async (body) => {
      // 1. Close the active entry as confirmed
      const { error: updErr } = await supabase.from("queue_entries").update({
        state: "confirmed",
        closed_at: new Date().toISOString(),
        confirmation: {
          reason_type: body.reason_type,
          doc_ids: body.doc_ids,
          final_duration_days: body.final_duration_days,
          original_proposed_days: entry.proposed_duration_days,
          comment: body.comment,
          confirmed_at: new Date().toISOString(),
        },
      }).eq("id", entry.id);
      if (updErr) throw { body: { detail: updErr.message } };

      // 2. Auto-cancel other pending entries
      const { data: losers } = await supabase.from("queue_entries").select("id").eq("asset_id", entry.asset_id).eq("state", "pending");
      for (const l of losers ?? []) {
        await supabase.from("queue_entries").update({ state: "cancelled", closed_at: new Date().toISOString(), cancel_reason: "Asset confirmed to another brand" }).eq("id", l.id);
      }

      // 3. Move asset to onboarding
      await supabase.from("assets").update({ status: "onboarding" }).eq("id", entry.asset_id);

      // 4. Create campaign
      const campaignId = crypto.randomUUID();
      const checklistItems = [
        { key: "creative_brief", label: "Creative brief", mandatory: true, status: "pending" },
        { key: "site_inspection", label: "Site inspection", mandatory: true, status: "pending" },
        { key: "printing_dispatch", label: "Printing & dispatch", mandatory: true, status: "pending" },
        { key: "installation_photo", label: "Installation photo", mandatory: true, status: "pending" },
      ];
      const { error: cErr } = await supabase.from("campaigns").insert({
        id: campaignId,
        asset_id: entry.asset_id,
        asset_code: entry.asset_code,
        brand: entry.brand,
        brand_id: entry.brand_id ?? null,
        salesperson_id: entry.salesperson_id,
        salesperson_name: entry.salesperson_name,
        duration_days: body.final_duration_days,
        proposed_duration_days: entry.proposed_duration_days,
        stage: "onboarding",
        priority: "high",
        checklist: checklistItems,
        gtps: [],
        created_at: new Date().toISOString(),
      });
      if (cErr) throw { body: { detail: cErr.message } };

      return { campaign_id: campaignId, cancelled_entries: (losers ?? []).length };
    },
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
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-xs">
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
    mutationFn: async (id) => {
      const { data: e } = await supabase.from("queue_entries").select("*").eq("id", id).single();
      await supabase
        .from("queue_entries")
        .update({ state: "cancelled", closed_at: new Date().toISOString(), cancel_reason: "Withdrawn by sales" })
        .eq("id", id);

      if (e?.state === "active") {
        // Active slot withdrawn — promote next pending entry by position
        const { data: next } = await supabase
          .from("queue_entries").select("*").eq("asset_id", e.asset_id)
          .eq("state", "pending").order("position").limit(1).maybeSingle();
        if (next) {
          const { data: settingsArr } = await supabase.from("settings").select("queue_active_business_days").eq("id", "global").maybeSingle();
          const holdDays = settingsArr?.queue_active_business_days ?? 5;
          const { data: holidays } = await supabase.from("holidays").select("date");
          const holidaySet = new Set((holidays ?? []).map((h) => h.date));
          let d = new Date(); let counted = 0;
          while (counted < holdDays) {
            d.setDate(d.getDate() + 1);
            const ds = d.toISOString().split("T")[0];
            const dow = d.getDay();
            if (dow !== 0 && dow !== 6 && !holidaySet.has(ds)) counted++;
          }
          await supabase.from("queue_entries")
            .update({ state: "active", position: 0, expires_on: d.toISOString().split("T")[0] })
            .eq("id", next.id);
          // Bug #4 fix: resequence remaining pending entries (1, 2, 3…)
          const { data: remaining } = await supabase
            .from("queue_entries").select("id").eq("asset_id", e.asset_id)
            .eq("state", "pending").neq("id", next.id).order("position");
          for (let i = 0; i < (remaining ?? []).length; i++) {
            await supabase.from("queue_entries").update({ position: i + 1 }).eq("id", remaining[i].id);
          }
        } else {
          await supabase.from("assets").update({ status: "available" }).eq("id", e.asset_id);
        }
      } else if (e?.state === "pending") {
        // Bug #4 fix: compact positions for remaining pending entries to remove gap
        const { data: remaining } = await supabase
          .from("queue_entries").select("id, position").eq("asset_id", e.asset_id)
          .eq("state", "pending").order("position");
        for (let i = 0; i < (remaining ?? []).length; i++) {
          if (remaining[i].position !== i + 1) {
            await supabase.from("queue_entries").update({ position: i + 1 }).eq("id", remaining[i].id);
          }
        }
        // If no active slot and no more pending entries, free the asset
        const { count: activeCount } = await supabase
          .from("queue_entries").select("*", { count: "exact", head: true })
          .eq("asset_id", e.asset_id).eq("state", "active");
        if (!activeCount && !(remaining ?? []).length) {
          await supabase.from("assets").update({ status: "available" }).eq("id", e.asset_id);
        }
      }
      return { ok: true };
    },
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
            <Upload className="size-3.5" />
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
        {isLoading && <QueueSkeleton count={3} />}
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
                          ? "border-red-200 bg-red-50/90 animate-urgent-pulse shadow-xs"
                          : active.urgency === "warning"
                            ? "border-amber-200 bg-amber-50 shadow-xs"
                            : "border-sky-200/80 bg-sky-50/50 shadow-xs",
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
