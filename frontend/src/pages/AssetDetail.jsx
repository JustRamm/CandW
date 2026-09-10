import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, History, MapPinned, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import { AssetStatusBadge, StageBadge, UrgencyBadge } from "@/components/shared/StatusBadges";
import PhotoSlideshow from "@/components/shared/PhotoSlideshow";
import AuditTrail from "@/components/shared/AuditTrail";
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
import { apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAsset, useAssetQueue, useBrands, useMe } from "@/lib/queries";
import { AssetDialog } from "@/pages/Assets";
import { errMessage, fmtDate } from "@/lib/helpers";
import { cn } from "@/lib/utils";

function AddInterestDialog({ asset }) {
  const { data: brands } = useBrands();
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState("");
  const [brand, setBrand] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");

  // Duration is derived from the proposed window whenever both dates are set.
  const derivedDays =
    start && end ? Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000)) : 0;
  const [days, setDays] = useState(90);
  const effectiveDays = derivedDays || Number(days);
  const selectedBrandName = brands?.find((b) => b.id === brandId)?.name ?? "";

  const add = useMutation({
    mutationFn: (body) => apiPost("/queue", body),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      queryClient.invalidateQueries({ queryKey: ["asset", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(
        entry.state === "active"
          ? `${entry.brand} holds the active slot until ${entry.expires_on}`
          : `${entry.brand} added to the waitlist at position ${entry.position}`,
      );
      setOpen(false);
      setBrand("");
      setBrandId("");
    },
    onError: (err) => toast.error(errMessage(err, "Could not add interest")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" data-testid="add-interest-button" />}>
        <Plus className="size-4" />
        Add interest
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Add brand to interest queue</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const name = selectedBrandName || brand;
            if (!name.trim()) {
              toast.error("Pick an existing brand or type a new one");
              return;
            }
            add.mutate({
              asset_id: asset.id,
              brand_id: brandId,
              brand: name,
              proposed_start_date: start,
              proposed_end_date: end,
              proposed_duration_days: effectiveDays,
              notes,
            });
          }}
          data-testid="add-interest-form"
        >
          <div className="space-y-1.5">
            <Label>Existing brand</Label>
            <Select
              value={brandId}
              onValueChange={(v) => {
                setBrandId(v);
                setBrand("");
              }}
            >
              <SelectTrigger data-testid="interest-brand-select">
                <SelectValue>{(v) => brands?.find((b) => b.id === v)?.name ?? "Select a brand"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(brands ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id} data-testid={`interest-brand-option-${b.name.replace(/\s+/g, "-")}`}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand">…or add a new brand</Label>
            <Input
              id="brand"
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setBrandId("");
              }}
              placeholder="Tata Neu"
              data-testid="interest-brand-input"
            />
            <p className="text-[11px] text-muted-foreground">
              A brand record is created automatically — add contacts later from the Brands page.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-start">Proposed start</Label>
              <Input
                id="p-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                data-testid="interest-start-date-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-end">Proposed end</Label>
              <Input
                id="p-end"
                type="date"
                value={end}
                min={start || undefined}
                onChange={(e) => setEnd(e.target.value)}
                data-testid="interest-end-date-input"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="days">Proposed campaign duration (days)</Label>
            <Input
              id="days"
              type="number"
              min={1}
              required
              value={derivedDays || days}
              readOnly={Boolean(derivedDays)}
              onChange={(e) => setDays(e.target.value)}
              data-testid="interest-duration-input"
            />
            {derivedDays > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Calculated from the proposed start and end dates.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="interest-notes-input"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The active slot holds for 5 business days (IST, skipping weekends and configured holidays).
            Everyone else joins an ordered, visible waitlist.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={add.isPending} data-testid="submit-interest-button">
              {add.isPending ? "Adding…" : "Add to queue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QueuePanel({ asset }) {
  const { data: me } = useMe();
  const { data: entries } = useAssetQueue(asset.id);
  const withdraw = useMutation({
    mutationFn: (id) => apiPost(`/queue/${id}/withdraw`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      queryClient.invalidateQueries({ queryKey: ["asset", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Interest withdrawn");
    },
    onError: (err) => toast.error(errMessage(err, "Could not withdraw")),
  });

  const open = (entries ?? []).filter((e) => ["active", "pending"].includes(e.state));
  const history = (entries ?? []).filter((e) => !["active", "pending"].includes(e.state));

  return (
    <div className="space-y-4">
      {open.length === 0 ? (
        <EmptyState
          title="No open interest on this asset"
          hint="Sales can add a brand — the first entry takes the active slot."
          testId="asset-queue-empty"
        />
      ) : (
        <ul className="space-y-2" data-testid="asset-queue-list">
          {open.map((e) => (
            <li
              key={e.id}
              className={cn(
                "rounded-xl border px-4 py-3 transition-colors duration-200",
                e.state === "active"
                  ? e.urgency === "urgent"
                    ? "border-red-700/70 bg-red-950/25 animate-urgent-pulse"
                    : e.urgency === "warning"
                      ? "border-amber-700/70 bg-amber-950/20"
                      : "border-primary/50 bg-primary/5"
                  : "border-border/60 bg-card/50",
              )}
              data-testid={`asset-queue-entry-${e.brand.replace(/\s+/g, "-")}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-heading text-sm font-semibold">{e.brand}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "mono-label",
                        e.state === "active"
                          ? "border-primary/50 text-primary"
                          : "border-border/70 text-muted-foreground",
                      )}
                    >
                      {e.state === "active" ? "Active slot" : `Waitlist #${e.position}`}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.salesperson_name} · proposed {e.proposed_duration_days} days
                    {e.expires_on ? ` · expires ${fmtDate(e.expires_on)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <UrgencyBadge urgency={e.urgency} daysRemaining={e.days_remaining} />
                  {me?.role === "sales" && e.salesperson_id === me.id && (
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={withdraw.isPending}
                      onClick={() => withdraw.mutate(e.id)}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid="withdraw-interest-button"
                    >
                      Withdraw
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <div>
          <p className="mono-label mb-2 text-muted-foreground">Closed entries</p>
          <ul className="space-y-1.5" data-testid="asset-queue-history">
            {history.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-card/30 px-3 py-2 text-xs"
              >
                <span className="truncate">
                  {e.brand} · {e.salesperson_name}
                </span>
                <Badge variant="outline" className="mono-label border-border/60 text-muted-foreground">
                  {e.state}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AssetDetail() {
  const { assetId } = useParams();
  const { data: me } = useMe();
  const { data: asset, isError, isLoading } = useAsset(assetId);

  const canAddInterest =
    me?.role === "sales" && asset && ["available", "reserved"].includes(asset.status);

  return (
    <AppShell
      title={asset?.asset_code ?? "Asset"}
      subtitle={asset?.location_name ?? "Loading asset…"}
      actions={
        <div className="flex items-center gap-1.5">
          <Link to="/assets" className={cn(buttonVariants({ variant: "outline", size: "xs" }))} data-testid="back-to-assets">
            <ArrowLeft className="size-3.5" />
            Assets
          </Link>
          {canAddInterest && <AddInterestDialog asset={asset} />}
          {asset && (me?.role === "ops" || me?.role === "admin") && (
            <AssetDialog
              asset={asset}
              trigger={
                <Button variant="outline" size="xs" data-testid="edit-asset-detail-button">
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              }
            />
          )}
        </div>
      }
    >
      {isError && (
        <EmptyState
          title="Asset unavailable"
          hint="This asset could not be loaded. It may have been removed."
          testId="asset-detail-error"
        />
      )}
      {isLoading && <div className="h-64 animate-pulse rounded-xl border border-border/60 bg-card/40" />}

      {asset && (
        <div className="space-y-5">
          <Card className="overflow-hidden border-border/70 bg-card/80 p-0">
            <div className="grid md:grid-cols-[300px_1fr]">
              <div className="relative h-44 bg-secondary/60 md:h-full">
                <PhotoSlideshow asset={asset} />
              </div>
              <CardContent className="space-y-3 px-5 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono-label text-primary" data-testid="asset-detail-code">
                    {asset.asset_code}
                  </span>
                  <AssetStatusBadge status={asset.status} />
                </div>
                <h2 className="font-heading text-xl font-semibold tracking-tight">{asset.location_name}</h2>
                <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  {[
                    ["Type", asset.asset_type],
                    ["Location type", asset.location_type ?? "—"],
                    ["City", asset.city],
                    ["Location code", asset.location_code],
                    ["Size", `${asset.width_ft} × ${asset.height_ft} ft`],
                    ["Photos", String((asset.photo_ids ?? []).length + (asset.photo_url ? 1 : 0))],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="mono-label text-muted-foreground">{k}</dt>
                      <dd className="mt-0.5 text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
                {asset.description && <p className="text-xs text-foreground">{asset.description}</p>}
                {asset.notes && <p className="text-xs text-muted-foreground">{asset.notes}</p>}
              </CardContent>
            </div>
          </Card>

          <Tabs defaultValue="queue">
            <TabsList variant="line" data-testid="asset-detail-tabs">
              <TabsTrigger value="queue" data-testid="tab-queue">
                Interest queue
              </TabsTrigger>
              <TabsTrigger value="campaigns" data-testid="tab-campaigns">
                Campaign history
              </TabsTrigger>
              <TabsTrigger value="audit" data-testid="tab-audit">
                Audit trail
              </TabsTrigger>
            </TabsList>
            <TabsContent value="queue" className="pt-4">
              <QueuePanel asset={asset} />
            </TabsContent>
            <TabsContent value="campaigns" className="pt-4">
              {asset.campaigns?.length === 0 ? (
                <EmptyState
                  title="No campaigns yet"
                  hint="Confirmed interest creates a campaign record that is preserved forever."
                  icon={History}
                  testId="asset-campaigns-empty"
                />
              ) : (
                <ul className="space-y-2" data-testid="asset-campaign-history">
                  {asset.campaigns.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/campaigns/${c.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 transition-colors duration-150 hover:border-primary/45"
                        data-testid="asset-campaign-row"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-heading text-sm font-semibold">{c.brand}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {c.duration_days} days
                            {c.start_date ? ` · ${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}` : " · not started"}
                            {c.proposed_duration_days !== c.duration_days
                              ? ` · sales proposed ${c.proposed_duration_days}`
                              : ""}
                          </p>
                        </div>
                        <StageBadge stage={c.stage} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="audit" className="pt-4">
              <AuditTrail entries={asset.audit ?? []} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AppShell>
  );
}
