import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  Camera,
  CheckCircle2,
  CircleDot,
  Receipt,
  Rocket,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import FileUploader from "@/components/shared/FileUploader";
import DocumentList from "@/components/shared/DocumentList";
import AuditTrail from "@/components/shared/AuditTrail";
import { GtpStatusBadge, StageBadge } from "@/components/shared/StatusBadges";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useCampaign, useMe } from "@/lib/queries";
import { errMessage, fmtDate, fmtDateTime, fmtMoney } from "@/lib/helpers";
import { cn } from "@/lib/utils";

const STAGE_ORDER = ["onboarding", "invoicing", "live", "closing", "closed"];

function useRefresh(campaignId) {
  return () => {
    queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["assets"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };
}

function LifecycleTracker({ stage }) {
  const idx = STAGE_ORDER.indexOf(stage);
  return (
    <ol className="flex flex-wrap items-center gap-2" data-testid="lifecycle-tracker">
      {STAGE_ORDER.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors duration-200",
              i < idx
                ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                : i === idx
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/60 bg-card/40 text-muted-foreground",
            )}
            data-testid={`lifecycle-step-${s}`}
          >
            {i < idx ? <CheckCircle2 className="size-3" /> : <CircleDot className="size-3" />}
            {s}
          </span>
          {i < STAGE_ORDER.length - 1 && <span className="h-px w-3 bg-border/70" />}
        </li>
      ))}
    </ol>
  );
}

function PrioritySelect({ campaign, gtpId, value }) {
  const { data: me } = useMe();
  const refresh = useRefresh(campaign.id);
  const canEdit = me?.role === "ops" || me?.role === "admin";

  const save = useMutation({
    mutationFn: (priority) =>
      apiPost(`/campaigns/${campaign.id}/priority`, { priority, gtp_id: gtpId ?? null }),
    onSuccess: (_r, priority) => {
      refresh();
      toast.success(`Priority set to ${priority}`);
    },
    onError: (err) => toast.error(errMessage(err, "Could not change the priority")),
  });

  if (!canEdit) return <PriorityBadge priority={value} />;

  // Scope the option testids per select — several of these render on one page.
  const scope = gtpId ? `gtp-${gtpId}` : "campaign";

  return (
    <Select value={value} onValueChange={(v) => save.mutate(v)}>
      <SelectTrigger
        size="sm"
        className="h-7 w-28"
        data-testid={gtpId ? `gtp-priority-select-${gtpId}` : "campaign-priority-select"}
      >
        <SelectValue>{(v) => v ?? "medium"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {["high", "medium", "low"].map((p) => (
          <SelectItem key={p} value={p} data-testid={`priority-option-${scope}-${p}`}>
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ChecklistItem({ campaign, item }) {
  const { data: me } = useMe();
  const refresh = useRefresh(campaign.id);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [docs, setDocs] = useState([]);
  const canEdit = (me?.role === "ops" || me?.role === "admin") && campaign.stage === "onboarding";

  const save = useMutation({
    mutationFn: (body) => apiPost(`/campaigns/${campaign.id}/checklist/${item.key}`, body),
    onSuccess: () => {
      refresh();
      setDocs([]);
      toast.success(`${item.label} updated`);
    },
    onError: (err) => toast.error(errMessage(err, "Could not update the checklist")),
  });

  const done = item.status === "done";

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3.5 transition-colors duration-200",
        done ? "border-emerald-800/60 bg-emerald-950/15" : "border-border/60 bg-card/50",
      )}
      data-testid={`checklist-item-${item.key}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-sm font-medium">{item.label}</p>
          <p className="mono-label mt-0.5 text-muted-foreground">
            {done ? `Done · ${item.completed_by} · ${fmtDateTime(item.completed_at)}` : item.status}
            {item.mandatory ? " · mandatory" : ""}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "mono-label",
            done ? "border-emerald-800 text-emerald-300" : "border-border/70 text-muted-foreground",
          )}
        >
          {item.status}
        </Badge>
      </div>

      {item.notes && <p className="mt-2 text-xs text-muted-foreground">{item.notes}</p>}
      {item.doc_ids?.length > 0 && (
        <div className="mt-2">
          <DocumentList docIds={item.doc_ids} />
        </div>
      )}

      {canEdit && !done && (
        <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes for this step"
            data-testid={`checklist-notes-${item.key}`}
          />
          <FileUploader
            value={docs}
            onChange={setDocs}
            multiple
            geotag={item.key === "gtp_upload"}
            label="Attach proof"
            testId={`checklist-upload-${item.key}`}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({ status: "done", notes, doc_ids: docs.map((d) => d.id) })
              }
              data-testid={`checklist-complete-${item.key}`}
            >
              <CheckCircle2 className="size-4" />
              Mark complete
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({ status: "in_progress", notes, doc_ids: docs.map((d) => d.id) })
              }
              data-testid={`checklist-progress-${item.key}`}
            >
              Save progress
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            At least one attachment is required before a step can be completed.
          </p>
        </div>
      )}
    </div>
  );
}

function InvoiceDialog({ campaign }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoice_number: "", amount: "", gst_percent: 18, notes: "" });
  const [docs, setDocs] = useState([]);
  const refresh = useRefresh(campaign.id);

  const submit = useMutation({
    mutationFn: (body) => apiPost(`/campaigns/${campaign.id}/invoice`, body),
    onSuccess: () => {
      refresh();
      toast.success("Invoice recorded — campaign is now live");
      setOpen(false);
    },
    onError: (err) => toast.error(errMessage(err, "Could not raise the invoice")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" data-testid="raise-invoice-button" />}>
        <Receipt className="size-4" />
        Raise GST invoice
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">GST invoice · {campaign.brand}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate({
              invoice_number: form.invoice_number,
              amount: Number(form.amount),
              gst_percent: Number(form.gst_percent),
              notes: form.notes,
              doc_ids: docs.map((d) => d.id),
            });
          }}
          data-testid="invoice-form"
        >
          <div className="space-y-1.5">
            <Label htmlFor="invoice_number">Invoice number</Label>
            <Input
              id="invoice_number"
              required
              value={form.invoice_number}
              onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
              placeholder="INV-2026-0042"
              data-testid="invoice-number-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                required
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                data-testid="invoice-amount-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gst">GST %</Label>
              <Input
                id="gst"
                type="number"
                value={form.gst_percent}
                onChange={(e) => setForm((f) => ({ ...f, gst_percent: e.target.value }))}
                data-testid="invoice-gst-input"
              />
            </div>
          </div>
          <FileUploader value={docs} onChange={setDocs} label="Attach invoice PDF" testId="invoice-uploader" />
          <div className="space-y-1.5">
            <Label htmlFor="invoice-notes">Notes</Label>
            <Textarea
              id="invoice-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              data-testid="invoice-notes-input"
            />
          </div>
          <p className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300">
            Submitting flips the asset to Live and schedules the GTP cycle from today.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={submit.isPending} data-testid="submit-invoice-button">
              {submit.isPending ? "Submitting…" : "Submit & go live"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GtpCard({ campaign, gtp }) {
  const { data: me } = useMe();
  const refresh = useRefresh(campaign.id);
  const [docs, setDocs] = useState([]);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  const isOps = me?.role === "ops" || me?.role === "admin";
  const isFinance = ["finance", "finance_manager", "admin"].includes(me?.role);

  const submit = useMutation({
    mutationFn: (body) => apiPost(`/campaigns/${campaign.id}/gtp/${gtp.id}/submit`, body),
    onSuccess: () => {
      refresh();
      setDocs([]);
      toast.success(`GTP #${gtp.seq} submitted for approval`);
    },
    onError: (err) => toast.error(errMessage(err, "Could not submit the GTP")),
  });

  const review = useMutation({
    mutationFn: (body) => apiPost(`/campaigns/${campaign.id}/gtp/${gtp.id}/review`, body),
    onSuccess: (_res, vars) => {
      refresh();
      toast.success(vars.approve ? `GTP #${gtp.seq} approved` : `GTP #${gtp.seq} returned to Ops`);
    },
    onError: (err) => toast.error(errMessage(err, "Could not review the GTP")),
  });

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3.5",
        gtp.status === "approved"
          ? "border-emerald-800/60 bg-emerald-950/15"
          : gtp.status === "rejected"
            ? "border-red-800/60 bg-red-950/15"
            : "border-border/60 bg-card/50",
      )}
      data-testid={`gtp-card-${gtp.seq}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-heading text-sm font-medium">
            GTP #{gtp.seq}
            {gtp.is_final && <span className="ml-1.5 text-xs text-muted-foreground">(final)</span>}
          </p>
          <p className="mono-label mt-0.5 text-muted-foreground">Due {fmtDate(gtp.due_date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <GtpStatusBadge status={gtp.status} />
          {gtp.status !== "approved" ? (
            <PrioritySelect campaign={campaign} gtpId={gtp.id} value={gtp.priority ?? "medium"} />
          ) : (
            <PriorityBadge priority={gtp.priority ?? "medium"} />
          )}
        </div>
      </div>

      {gtp.notes && <p className="mt-2 text-xs text-muted-foreground">{gtp.notes}</p>}
      {gtp.submitted_by && (
        <p className="mono-label mt-1 text-muted-foreground">
          Submitted by {gtp.submitted_by} · {fmtDateTime(gtp.submitted_at)}
        </p>
      )}
      {gtp.reviewed_by && (
        <p className="mono-label mt-0.5 text-muted-foreground">
          Reviewed by {gtp.reviewed_by} · {fmtDateTime(gtp.reviewed_at)}
        </p>
      )}
      {gtp.reject_reason && (
        <p className="mt-2 rounded-lg border border-red-800/50 bg-red-950/25 px-3 py-2 text-xs text-red-300">
          Rejected: {gtp.reject_reason}
        </p>
      )}
      {gtp.doc_ids?.length > 0 && (
        <div className="mt-2">
          <DocumentList docIds={gtp.doc_ids} />
        </div>
      )}

      {isOps && ["pending", "rejected"].includes(gtp.status) && (
        <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
          <FileUploader
            value={docs}
            onChange={setDocs}
            multiple
            geotag
            label="Capture geo-tagged photos"
            testId={`gtp-uploader-${gtp.seq}`}
          />
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Site notes (optional)"
            data-testid={`gtp-notes-${gtp.seq}`}
          />
          <Button
            size="sm"
            disabled={submit.isPending || !docs.length}
            onClick={() => submit.mutate({ doc_ids: docs.map((d) => d.id), notes })}
            data-testid={`gtp-submit-${gtp.seq}`}
          >
            <Camera className="size-4" />
            {submit.isPending ? "Submitting…" : "Submit GTP"}
          </Button>
        </div>
      )}

      {isFinance && gtp.status === "submitted" && (
        <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason (required to reject)"
            data-testid={`gtp-reason-${gtp.seq}`}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={review.isPending}
              onClick={() => review.mutate({ approve: true, reason: "" })}
              data-testid={`gtp-approve-${gtp.seq}`}
            >
              <CheckCircle2 className="size-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={review.isPending}
              onClick={() => {
                if (!reason.trim()) {
                  toast.error("A rejection reason is required");
                  return;
                }
                review.mutate({ approve: false, reason });
              }}
              data-testid={`gtp-reject-${gtp.seq}`}
            >
              <XCircle className="size-4" />
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CancellationPanel({ campaign }) {
  const { data: me } = useMe();
  const refresh = useRefresh(campaign.id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ reason: "", proposed_cancel_date: "" });
  const [docs, setDocs] = useState([]);
  const [comment, setComment] = useState("");

  const canRequest =
    me?.role === "sales" &&
    ["onboarding", "invoicing", "live"].includes(campaign.stage) &&
    campaign.cancellation?.status !== "requested";
  const canReview =
    ["finance", "finance_manager", "admin"].includes(me?.role) &&
    campaign.cancellation?.status === "requested";

  const request = useMutation({
    mutationFn: (body) => apiPost(`/campaigns/${campaign.id}/cancellation`, body),
    onSuccess: () => {
      refresh();
      toast.success("Cancellation request sent to Finance");
      setOpen(false);
    },
    onError: (err) => toast.error(errMessage(err, "Could not request cancellation")),
  });

  const review = useMutation({
    mutationFn: (body) => apiPost(`/campaigns/${campaign.id}/cancellation/review`, body),
    onSuccess: (_r, vars) => {
      refresh();
      toast.success(vars.approve ? "Cancellation approved — closure GTP created" : "Cancellation rejected");
    },
    onError: (err) => toast.error(errMessage(err, "Could not review the request")),
  });

  const c = campaign.cancellation;

  return (
    <div className="space-y-3">
      {c ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3.5",
            c.status === "approved"
              ? "border-orange-800/60 bg-orange-950/20"
              : c.status === "rejected"
                ? "border-border/60 bg-card/50"
                : "border-amber-800/60 bg-amber-950/20",
          )}
          data-testid="cancellation-record"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-heading text-sm font-medium">Premature cancellation</p>
            <Badge variant="outline" className="mono-label border-border/70" data-testid={`cancellation-status-${c.status}`}>
              {c.status}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{c.reason}</p>
          <p className="mono-label mt-1.5 text-muted-foreground">
            Requested by {c.requested_by_name} · proposed cancel date {fmtDate(c.proposed_cancel_date)}
          </p>
          {c.reviewed_by && (
            <p className="mono-label mt-0.5 text-muted-foreground">
              Reviewed by {c.reviewed_by} · {fmtDateTime(c.reviewed_at)}
            </p>
          )}
          {c.comment && <p className="mt-1.5 text-xs text-foreground">{c.comment}</p>}
          {c.doc_ids?.length > 0 && (
            <div className="mt-2">
              <DocumentList docIds={c.doc_ids} />
            </div>
          )}

          {canReview && (
            <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
              <Textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Decision comment"
                data-testid="cancellation-comment-input"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ approve: true, comment })}
                  data-testid="approve-cancellation-button"
                >
                  Approve cancellation
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ approve: false, comment })}
                  data-testid="reject-cancellation-button"
                >
                  Reject
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="No cancellation request"
          hint="Sales can request a premature cancellation with a reason, a proposed date and optional documents."
          testId="cancellation-empty"
        />
      )}

      {canRequest && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" data-testid="request-cancellation-button" />}>
            <Ban className="size-4" />
            Request cancellation
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">Premature cancellation</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                request.mutate({ ...form, doc_ids: docs.map((d) => d.id) });
              }}
              data-testid="cancellation-form"
            >
              <div className="space-y-1.5">
                <Label htmlFor="cancel-reason">Reason</Label>
                <Textarea
                  id="cancel-reason"
                  rows={3}
                  required
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  data-testid="cancellation-reason-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cancel-date">Proposed cancel date</Label>
                <Input
                  id="cancel-date"
                  type="date"
                  required
                  value={form.proposed_cancel_date}
                  onChange={(e) => setForm((f) => ({ ...f, proposed_cancel_date: e.target.value }))}
                  data-testid="cancellation-date-input"
                />
              </div>
              <FileUploader value={docs} onChange={setDocs} multiple label="Attach supporting docs" testId="cancellation-uploader" />
              <DialogFooter>
                <Button type="submit" disabled={request.isPending} data-testid="submit-cancellation-button">
                  {request.isPending ? "Sending…" : "Send to Finance"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function CampaignDetail() {
  const { campaignId } = useParams();
  const { data: me } = useMe();
  const { data: campaign, isError, isLoading } = useCampaign(campaignId);
  const refresh = useRefresh(campaignId);

  const onboard = useMutation({
    mutationFn: () => apiPost(`/campaigns/${campaignId}/onboard`),
    onSuccess: () => {
      refresh();
      toast.success("Ad onboarded — invoice request raised with Finance");
    },
    onError: (err) => toast.error(errMessage(err, "Could not mark as onboarded")),
  });

  const isOps = me?.role === "ops" || me?.role === "admin";
  const isFinance = ["finance", "finance_manager", "admin"].includes(me?.role);
  const [tab, setTab] = useState("checklist");

  return (
    <AppShell
      title={campaign ? `${campaign.brand}` : "Campaign"}
      subtitle={campaign ? `${campaign.asset_code} · ${campaign.duration_days} day campaign` : "Loading…"}
      actions={
        <Link to="/campaigns" className={cn(buttonVariants({ variant: "outline", size: "xs" }))} data-testid="back-to-campaigns">
          <ArrowLeft className="size-3.5" />
          Campaigns
        </Link>
      }
    >
      {isError && (
        <EmptyState title="Campaign unavailable" hint="This campaign could not be loaded." testId="campaign-detail-error" />
      )}
      {isLoading && <div className="h-64 animate-pulse rounded-xl border border-border/60 bg-card/40" />}

      {campaign && (
        <div className="space-y-5">
          <Card className="border-border/70 bg-card/80">
            <CardContent className="space-y-4 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/assets/${campaign.asset_id}`}
                      className="mono-label text-primary hover:text-sky-300"
                      data-testid="campaign-asset-link"
                    >
                      {campaign.asset_code}
                    </Link>
                    <StageBadge stage={campaign.stage} />
                    <PriorityBadge priority={campaign.priority} />
                  </div>
                  <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight" data-testid="campaign-brand">
                    {campaign.brand}
                  </h2>
                  {campaign.brand_id && (
                    <Link
                      to={`/brands/${campaign.brand_id}`}
                      className="mono-label text-muted-foreground transition-colors duration-150 hover:text-primary"
                      data-testid="campaign-brand-link"
                    >
                      View brand record →
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="mono-label text-muted-foreground">Task priority</span>
                    <PrioritySelect campaign={campaign} value={campaign.priority ?? "high"} />
                  </div>
                  {isOps && campaign.stage === "onboarding" && (
                    <Button
                      size="sm"
                      disabled={onboard.isPending || !campaign.checklist_complete}
                      onClick={() => onboard.mutate()}
                      data-testid="mark-onboarded-button"
                    >
                      <Rocket className="size-4" />
                      {campaign.checklist_complete
                        ? "Mark ad onboarded"
                        : `Checklist ${campaign.checklist_done}/${campaign.checklist_total}`}
                    </Button>
                  )}
                  {isFinance && campaign.stage === "invoicing" && <InvoiceDialog campaign={campaign} />}
                </div>
              </div>

              <LifecycleTracker stage={campaign.stage} />

              <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                {[
                  ["Salesperson", campaign.salesperson_name || "—"],
                  ["Final duration", `${campaign.duration_days} days`],
                  ["Sales proposed", `${campaign.proposed_duration_days} days`],
                  [
                    "Window",
                    campaign.start_date ? `${fmtDate(campaign.start_date)} → ${fmtDate(campaign.end_date)}` : "Not started",
                  ],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="mono-label text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 truncate">{v}</dd>
                  </div>
                ))}
              </dl>

              {campaign.invoice && (
                <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3" data-testid="invoice-summary">
                  <p className="mono-label text-muted-foreground">GST invoice</p>
                  <p className="mt-1 text-sm">
                    {campaign.invoice.invoice_number} · {fmtMoney(campaign.invoice.total_amount)} (incl.{" "}
                    {campaign.invoice.gst_percent}% GST) · raised by {campaign.invoice.raised_by}
                  </p>
                  {campaign.invoice.doc_ids?.length > 0 && (
                    <div className="mt-2">
                      <DocumentList docIds={campaign.invoice.doc_ids} />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="line" data-testid="campaign-tabs">
              <TabsTrigger value="checklist" data-testid="tab-checklist">
                Checklist
              </TabsTrigger>
              <TabsTrigger value="gtp" data-testid="tab-gtp">
                GTP cycle
              </TabsTrigger>
              <TabsTrigger value="cancellation" data-testid="tab-cancellation">
                Cancellation
              </TabsTrigger>
              <TabsTrigger value="audit" data-testid="tab-campaign-audit">
                Audit
              </TabsTrigger>
            </TabsList>

            <TabsContent value="checklist" className="pt-4">
              <div className="mx-auto w-full max-w-2xl space-y-3" data-testid="checklist-flow">
                {(campaign.checklist ?? []).map((item) => (
                  <ChecklistItem key={item.key} campaign={campaign} item={item} />
                ))}
                {campaign.stage !== "onboarding" && (
                  <p className="text-xs text-muted-foreground">
                    Onboarding is complete — this checklist is preserved as a permanent record.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="gtp" className="pt-4">
              {(campaign.gtps ?? []).length === 0 ? (
                <EmptyState
                  title="GTP schedule not created yet"
                  hint="The 28-day GTP cadence is generated from the campaign start date once Finance raises the invoice and the asset goes live."
                  testId="gtp-empty-state"
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Schedule is anchored to the campaign start date — a delayed approval does not shift later
                    deadlines.
                  </p>
                  <div className="grid gap-3 lg:grid-cols-2" data-testid="gtp-list">
                    {campaign.gtps.map((g) => (
                      <GtpCard key={g.id} campaign={campaign} gtp={g} />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="cancellation" className="pt-4">
              <CancellationPanel campaign={campaign} />
            </TabsContent>

            <TabsContent value="audit" className="pt-4">
              <AuditTrail entries={campaign.audit ?? []} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AppShell>
  );
}
