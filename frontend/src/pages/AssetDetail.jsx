import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Camera, History, MapPinned, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import FileUploader from "@/components/shared/FileUploader";
import { AssetStatusBadge, StageBadge, UrgencyBadge } from "@/components/shared/StatusBadges";
import PhotoSlideshow from "@/components/shared/PhotoSlideshow";
import AuditTrail from "@/components/shared/AuditTrail";
import sound from "@/lib/sound";
import { Button, buttonVariants } from "@/components/ui/button";
import { AssetDetailSkeleton } from "@/components/skeletons";
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
import { supabase } from "@/lib/supabase";
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
    mutationFn: async (body) => {
      // 1. Resolve or create the brand
      let brandId = body.brand_id;
      let brandName = body.brand;
      if (!brandId) {
        const { data: existing } = await supabase.from("brands").select("id, name").ilike("name", body.brand.trim()).maybeSingle();
        if (existing) { brandId = existing.id; brandName = existing.name; }
        else {
          const { data: newBrand, error: bErr } = await supabase.from("brands").insert({ id: crypto.randomUUID(), name: body.brand.trim(), created_at: new Date().toISOString() }).select().single();
          if (bErr) {
            // Bug #18 fix: handle race condition — another user may have created the brand between our check and insert
            if (bErr.code === "23505") {
              // unique violation — fetch the one that was just created
              const { data: raceWinner } = await supabase.from("brands").select("id, name").ilike("name", body.brand.trim()).maybeSingle();
              if (raceWinner) { brandId = raceWinner.id; brandName = raceWinner.name; }
              else throw { body: { detail: bErr.message } };
            } else {
              throw { body: { detail: bErr.message } };
            }
          } else {
            brandId = newBrand.id; brandName = newBrand.name;
          }
        }
      }
      // 2. Check for existing open entry from same brand
      const { data: dupe } = await supabase.from("queue_entries").select("id").eq("asset_id", body.asset_id).eq("brand", brandName).in("state", ["active", "pending"]).maybeSingle();
      if (dupe) throw { body: { detail: "This brand is already in the queue for this asset" } };

      // 3. Check if there's already an active slot
      const { data: existingActive } = await supabase.from("queue_entries").select("id").eq("asset_id", body.asset_id).eq("state", "active").maybeSingle();
      const { count: pendingCount } = await supabase.from("queue_entries").select("*", { count: "exact", head: true }).eq("asset_id", body.asset_id).eq("state", "pending");

      // 4. Calculate expiry (5 business days by default)
      const { data: settingsArr } = await supabase.from("settings").select("queue_active_business_days").eq("id", "global").maybeSingle();
      const holdDays = settingsArr?.queue_active_business_days ?? 5;
      const { data: holidays } = await supabase.from("holidays").select("date");
      const holidaySet = new Set((holidays ?? []).map((h) => h.date));
      let expiresOn = null;
      const isActive = !existingActive;
      if (isActive) {
        // Count forward holdDays business days
        let d = new Date(); let counted = 0;
        while (counted < holdDays) {
          d.setDate(d.getDate() + 1);
          const ds = d.toISOString().split("T")[0];
          const dow = d.getDay();
          if (dow !== 0 && dow !== 6 && !holidaySet.has(ds)) counted++;
        }
        expiresOn = d.toISOString().split("T")[0];
      }

      // Bug #9 fix: call getUser() once and reuse
      const { data: { user } } = await supabase.auth.getUser();
      const { data: myProfile } = await supabase.from("profiles").select("name").eq("id", user?.id).single();

      const entry = {
        id: crypto.randomUUID(),
        asset_id: body.asset_id,
        // Bug #2 fix: store asset_code and asset_location so Queue page and ConfirmDialog can read them
        asset_code: asset.asset_code,
        asset_location: asset.location_name ?? "",
        brand_id: brandId,
        brand: brandName,
        salesperson_id: user?.id,
        salesperson_name: myProfile?.name ?? user?.email?.split("@")[0] ?? "",
        proposed_duration_days: body.proposed_duration_days,
        proposed_start_date: body.proposed_start_date || null,
        proposed_end_date: body.proposed_end_date || null,
        notes: body.notes || "",
        state: isActive ? "active" : "pending",
        position: isActive ? 0 : (pendingCount ?? 0) + 1,
        expires_on: expiresOn,
        created_at: new Date().toISOString(),
      };
      const { data: inserted, error } = await supabase.from("queue_entries").insert(entry).select().single();
      if (error) throw { body: { detail: error.message } };
      // Update asset status to reserved
      await supabase.from("assets").update({ status: "reserved" }).eq("id", body.asset_id);
      return inserted;
    },
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

export function UploadProofDialog({ asset }) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState("");

  const upload = useMutation({
    mutationFn: async () => {
      if (!photos.length) throw { body: { detail: "Please capture or select at least one photo" } };

      const newPhotoIds = photos.map((p) => p.id);
      const existingPhotoIds = asset.photo_ids ?? [];
      const updatedPhotoIds = Array.from(new Set([...existingPhotoIds, ...newPhotoIds]));

      // 1. Update asset photo_ids
      const { error: aErr } = await supabase
        .from("assets")
        .update({
          photo_ids: updatedPhotoIds,
          photo_url: photos[0]?.url || asset.photo_url || "",
          notes: notes ? `${asset.notes ? asset.notes + "\n" : ""}Installation Proof: ${notes}` : asset.notes,
        })
        .eq("id", asset.id);

      if (aErr) throw { body: { detail: aErr.message } };

      // 2. Also link to any active campaigns on this asset
      const { data: camps } = await supabase
        .from("campaigns")
        .select("*")
        .eq("asset_id", asset.id)
        .neq("stage", "closed");

      for (const c of camps ?? []) {
        const gtps = c.gtps ?? [];
        if (gtps.length) {
          const targetGtp = gtps.find((g) => ["pending", "submitted"].includes(g.status)) || gtps[0];
          targetGtp.doc_ids = Array.from(new Set([...(targetGtp.doc_ids ?? []), ...newPhotoIds]));
          targetGtp.status = "approved";
          targetGtp.reviewed_at = new Date().toISOString();
          targetGtp.submitted_at = new Date().toISOString();
        } else {
          gtps.push({
            id: crypto.randomUUID(),
            seq: 1,
            status: "approved",
            due_date: new Date().toISOString().split("T")[0],
            is_final: false,
            doc_ids: newPhotoIds,
            priority: "high",
            notes: notes || "Installation mounting proof",
            submitted_at: new Date().toISOString(),
            reviewed_at: new Date().toISOString(),
          });
        }
        await supabase.from("campaigns").update({ gtps }).eq("id", c.id);
      }

      return { ok: true };
    },
    onSuccess: () => {
      sound.success();
      queryClient.invalidateQueries({ queryKey: ["asset", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["client-portal"] });
      toast.success("Installation photo proof uploaded! Synced to Client Portal.");
      setOpen(false);
      setPhotos([]);
      setNotes("");
    },
    onError: (err) => {
      sound.warning();
      toast.error(errMessage(err, "Could not upload proof"));
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="xs"
            className="gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
            data-testid="upload-proof-button"
          />
        }
      >
        <Camera className="size-3.5" />
        Upload Proof (GTP)
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2 text-base">
            <Camera className="size-4 text-emerald-500" />
            Upload Installation Proof (GTP)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2 text-xs">
          <p className="text-muted-foreground text-xs">
            Capture or upload geo-tagged installation photos for{" "}
            <strong className="text-foreground">{asset.asset_code}</strong> ({asset.location_name}).
            These photos appear in the client’s Proof-of-Performance portal.
          </p>

          <FileUploader
            value={photos}
            onChange={setPhotos}
            multiple
            geotag
            label="Capture or Upload Geo-Tagged Photo"
            testId="proof-file-uploader"
          />

          <div className="space-y-1">
            <Label htmlFor="proof-notes">Site & Mounting Notes</Label>
            <Input
              id="proof-notes"
              placeholder="e.g. Flex mounted cleanly, night illumination 100%"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={upload.isPending || !photos.length}
              onClick={() => upload.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              {upload.isPending ? "Uploading…" : "Save & Sync to Portal"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QueuePanel({ asset }) {
  const { data: me } = useMe();
  const { data: entries } = useAssetQueue(asset.id);
  const withdraw = useMutation({
    mutationFn: async (id) => {
      const { data: entry, error: fetchErr } = await supabase.from("queue_entries").select("*").eq("id", id).single();
      if (fetchErr) throw { body: { detail: fetchErr.message } };
      const { error } = await supabase.from("queue_entries").update({ state: "cancelled", closed_at: new Date().toISOString(), cancel_reason: "Withdrawn by sales" }).eq("id", id);
      if (error) throw { body: { detail: error.message } };
      // If withdrawn was the active slot, promote next pending
      if (entry.state === "active") {
        const { data: next } = await supabase.from("queue_entries").select("*").eq("asset_id", entry.asset_id).eq("state", "pending").order("created_at").limit(1).maybeSingle();
        if (next) {
          const { data: settingsArr } = await supabase.from("settings").select("queue_active_business_days").eq("id", "global").maybeSingle();
          const holdDays = settingsArr?.queue_active_business_days ?? 5;
          const { data: holidays } = await supabase.from("holidays").select("date");
          const holidaySet = new Set((holidays ?? []).map((h) => h.date));
          let d = new Date(); let counted = 0;
          while (counted < holdDays) { d.setDate(d.getDate() + 1); const ds = d.toISOString().split("T")[0]; const dow = d.getDay(); if (dow !== 0 && dow !== 6 && !holidaySet.has(ds)) counted++; }
          await supabase.from("queue_entries").update({ state: "active", position: 0, expires_on: d.toISOString().split("T")[0] }).eq("id", next.id);
        } else {
          await supabase.from("assets").update({ status: "available" }).eq("id", entry.asset_id).eq("status", "reserved");
        }
      }
      return { ok: true };
    },
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
                    ? "border-red-200 bg-red-50/90 animate-urgent-pulse shadow-xs"
                    : e.urgency === "warning"
                      ? "border-amber-200 bg-amber-50 shadow-xs"
                      : "border-sky-200/80 bg-sky-50/50 shadow-xs"
                  : "border-border/80 bg-card shadow-xs",
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
          {asset && <UploadProofDialog asset={asset} />}
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
      {isLoading && <AssetDetailSkeleton />}

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
                {asset.current_brand && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="mono-label text-[11px] text-muted-foreground">
                      {asset.asset_type?.includes("Digital") || asset.location_type === "DOOH"
                        ? "Digital Ad Loop Brands:"
                        : "Active Brand:"}
                    </span>
                    {asset.current_brand.split(",").map((b) => (
                      <Badge
                        key={b.trim()}
                        variant="outline"
                        className="mono-label rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold px-2.5 py-0.5"
                      >
                        {b.trim()}
                      </Badge>
                    ))}
                  </div>
                )}
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
