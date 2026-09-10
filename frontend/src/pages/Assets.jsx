import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Download, MapPinned, Pencil, Plus, Search, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import FileUploader from "@/components/shared/FileUploader";
import PhotoSlideshow from "@/components/shared/PhotoSlideshow";
import { AssetStatusBadge } from "@/components/shared/StatusBadges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAssetTypes, useAssets, useMe } from "@/lib/queries";
import { downloadCsv, errMessage, importAssetsCsv } from "@/lib/helpers";

const STATUS_FILTERS = [
  ["all", "All statuses"],
  ["available", "Available"],
  ["reserved", "In Queue"],
  ["onboarding", "Onboarding"],
  ["live", "Live"],
];

const BLANK = {
  asset_type: "",
  location_type: "Metro",
  location_code: "",
  location_name: "",
  city: "Delhi",
  width_ft: 6,
  height_ft: 3,
  description: "",
  notes: "",
};

function refreshAssets() {
  queryClient.invalidateQueries({ queryKey: ["assets"] });
}

/** Shared create/edit form. `asset` present = edit mode. */
export function AssetDialog({ asset, trigger }) {
  const { data: types } = useAssetTypes();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(
    asset
      ? {
          asset_type: asset.asset_type,
          location_type: asset.location_type ?? "Metro",
          location_code: asset.location_code,
          location_name: asset.location_name,
          city: asset.city,
          width_ft: asset.width_ft,
          height_ft: asset.height_ft,
          description: asset.description ?? "",
          notes: asset.notes ?? "",
        }
      : BLANK,
  );
  const [photos, setPhotos] = useState(
    (asset?.photo_ids ?? []).map((id) => ({ id, filename: "Existing photo" })),
  );

  const typeNames = (types ?? []).map((t) => t.name);
  const activeType = form.asset_type || typeNames[0] || "";

  const save = useMutation({
    mutationFn: (body) => (asset ? apiPut(`/assets/${asset.id}`, body) : apiPost("/assets", body)),
    onSuccess: (a) => {
      refreshAssets();
      if (asset) queryClient.invalidateQueries({ queryKey: ["asset", asset.id] });
      toast.success(asset ? `Asset ${a.asset_code} updated` : `Asset ${a.asset_code} created`);
      setOpen(false);
      if (!asset) {
        setForm(BLANK);
        setPhotos([]);
      }
    },
    onError: (err) => toast.error(errMessage(err, "Could not save the asset")),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? <Button size="sm" data-testid="add-asset-button" />
        }
      >
        {trigger ? undefined : (
          <>
            <Plus className="size-4" />
            New asset
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {asset ? `Edit ${asset.asset_code}` : "Onboard a new asset"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({
              ...form,
              asset_type: activeType,
              width_ft: Number(form.width_ft),
              height_ft: Number(form.height_ft),
              photo_ids: photos.map((p) => p.id),
              photo_url: asset?.photo_url ?? "",
            });
          }}
          data-testid={asset ? "edit-asset-form" : "add-asset-form"}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Asset type</Label>
              <Select value={activeType} onValueChange={(v) => setForm((f) => ({ ...f, asset_type: v }))}>
                <SelectTrigger data-testid="asset-type-select">
                  <SelectValue>{(v) => v || "Select type"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {typeNames.map((t) => (
                    <SelectItem key={t} value={t} data-testid={`asset-type-option-${t.replace(/\s+/g, "-").toLowerCase()}`}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location type</Label>
              <Select value={form.location_type} onValueChange={(v) => setForm((f) => ({ ...f, location_type: v }))}>
                <SelectTrigger data-testid="location-type-select">
                  <SelectValue>{(v) => v || "Metro"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {["Metro", "Mall"].map((t) => (
                    <SelectItem key={t} value={t} data-testid={`location-type-option-${t.toLowerCase()}`}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="location_code">Location code</Label>
              <Input
                id="location_code"
                required
                value={form.location_code}
                onChange={set("location_code")}
                placeholder="RJPM"
                data-testid="asset-location-code-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={set("city")} data-testid="asset-city-input" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location_name">Location name</Label>
            <Input
              id="location_name"
              required
              value={form.location_name}
              onChange={set("location_name")}
              placeholder="Rajiv Chowk Metro — Platform 2"
              data-testid="asset-location-name-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="width_ft">Width (ft)</Label>
              <Input
                id="width_ft"
                type="number"
                step="0.5"
                value={form.width_ft}
                onChange={set("width_ft")}
                data-testid="asset-width-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="height_ft">Height (ft)</Label>
              <Input
                id="height_ft"
                type="number"
                step="0.5"
                value={form.height_ft}
                onChange={set("height_ft")}
                data-testid="asset-height-input"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Photo attachments</Label>
            <FileUploader
              value={photos}
              onChange={setPhotos}
              multiple
              label="Attach asset photos"
              testId="asset-photo-uploader"
            />
            <p className="text-[11px] text-muted-foreground">
              Attach several angles — they play as a slideshow on the asset page.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              value={form.description}
              onChange={set("description")}
              placeholder="Footfall, visibility, orientation…"
              data-testid="asset-description-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} value={form.notes} onChange={set("notes")} data-testid="asset-notes-input" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending} data-testid="submit-asset-button">
              {save.isPending ? "Saving…" : asset ? "Save changes" : "Create asset"}
            </Button>
          </DialogFooter>
        </form>
        {!asset && (
          <p className="mono-label text-muted-foreground">Asset ID is generated as TYPE-LOCATION-SEQ</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteAssetDialog({ asset }) {
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: () => apiDelete(`/assets/${asset.id}`),
    onSuccess: () => {
      refreshAssets();
      toast.success(`Asset ${asset.asset_code} deleted`);
      setOpen(false);
    },
    onError: (err) => toast.error(errMessage(err, "Could not delete the asset")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="xs"
            className="text-muted-foreground hover:border-destructive/60 hover:text-destructive"
            data-testid="delete-asset-button"
          />
        }
      >
        <Trash2 className="size-3.5" />
        Delete
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Delete {asset.asset_code}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This removes the asset from inventory. Assets that are reserved, onboarding or live — or that
          carry historical campaigns — cannot be deleted, because those records must be retained.
        </p>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" data-testid="cancel-delete-asset-button" />}>
            Keep asset
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={del.isPending}
            onClick={() => del.mutate()}
            data-testid="confirm-delete-asset-button"
          >
            {del.isPending ? "Deleting…" : "Delete asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CsvImport() {
  const [busy, setBusy] = useState(false);
  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const res = await importAssetsCsv(file);
      refreshAssets();
      toast.success(`${res.created} asset(s) imported`, {
        description: res.errors?.length ? `${res.errors.length} row(s) skipped` : undefined,
      });
    } catch (err) {
      toast.error(errMessage(err, "Import failed"));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  return (
    <label
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/70 bg-secondary/40 px-2.5 py-1.5 text-xs transition-colors duration-150 hover:border-primary/50"
      data-testid="csv-import-label"
    >
      <Upload className="size-3.5" />
      {busy ? "Importing…" : "CSV import"}
      <input type="file" accept=".csv" className="hidden" onChange={onFile} data-testid="csv-import-input" />
    </label>
  );
}

export default function Assets() {
  const { data: me } = useMe();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const { data: assets, isError, isLoading } = useAssets({ status, q });
  const canManage = me?.role === "ops" || me?.role === "admin";

  return (
    <AppShell
      title="Asset inventory"
      subtitle="Metro and mall bench displays across the network"
      actions={
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            onClick={() =>
              downloadCsv(
                "assets.csv",
                (assets ?? []).map((a) => ({
                  asset_code: a.asset_code,
                  asset_type: a.asset_type,
                  location_type: a.location_type ?? "",
                  location_name: a.location_name,
                  city: a.city,
                  status: a.status,
                  current_brand: a.current_brand ?? "",
                  queue_count: a.queue_count,
                  next_gtp_date: a.next_gtp_date ?? "",
                })),
              )
            }
            data-testid="export-assets-button"
          >
            <Download className="size-3.5" />
            Export
          </Button>
          {canManage && <CsvImport />}
          {canManage && <AssetDialog />}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by asset ID or location"
              className="pl-9"
              data-testid="asset-search-input"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-48" data-testid="asset-status-filter">
              <SelectValue>
                {(v) => STATUS_FILTERS.find(([k]) => k === v)?.[1] ?? "All statuses"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map(([k, label]) => (
                <SelectItem key={k} value={k} data-testid={`asset-status-option-${k}`}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isError && (
          <EmptyState
            title="Inventory unavailable"
            hint="The asset service could not be reached. Try again shortly."
            testId="assets-error-state"
          />
        )}

        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-xl border border-border/60 bg-card/40" />
            ))}
          </div>
        )}

        {!isLoading && !isError && assets?.length === 0 && (
          <EmptyState
            title="No assets match this filter"
            hint="Clear the search or import your inventory with a CSV."
            icon={MapPinned}
            testId="assets-empty-state"
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="asset-grid">
          {(assets ?? []).map((a) => (
            <Card
              key={a.id}
              className="group h-full overflow-hidden border-border/70 bg-card/80 p-0 transition-colors duration-200 hover:border-primary/45"
              data-testid={`asset-card-${a.asset_code}`}
            >
              <Link to={`/assets/${a.id}`} className="block">
                <div className="relative h-36 overflow-hidden">
                  <PhotoSlideshow asset={a} variant="card" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0B0F17] to-transparent" />
                  <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2">
                    <span className="mono-label truncate text-foreground">{a.asset_code}</span>
                    <AssetStatusBadge status={a.status} />
                  </div>
                </div>
                <CardContent className="px-4 py-3">
                  <p className="truncate font-heading text-sm font-semibold">{a.location_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.asset_type} · {a.city} · {a.width_ft}×{a.height_ft} ft
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {a.current_brand && (
                      <Badge variant="outline" className="mono-label border-emerald-800 bg-emerald-950/50 text-emerald-300">
                        {a.current_brand}
                      </Badge>
                    )}
                    {a.queue_count > 0 && (
                      <Badge
                        variant="outline"
                        className="mono-label border-sky-800 bg-sky-950/50 text-sky-300"
                        data-testid={`asset-queue-count-${a.asset_code}`}
                      >
                        <Users className="mr-1 size-3" />
                        {a.queue_count} in queue
                      </Badge>
                    )}
                    {a.next_gtp_date && (
                      <Badge
                        variant="outline"
                        className={
                          a.gtp_overdue
                            ? "mono-label border-red-800 bg-red-950/40 text-red-300"
                            : "mono-label border-border/70 text-muted-foreground"
                        }
                        data-testid={`asset-next-gtp-${a.asset_code}`}
                      >
                        GTP {a.next_gtp_date}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Link>
              {canManage && (
                <div className="flex items-center gap-1.5 border-t border-border/60 px-4 py-2.5">
                  <AssetDialog
                    asset={a}
                    trigger={
                      <Button variant="outline" size="xs" data-testid={`edit-asset-button-${a.asset_code}`}>
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                    }
                  />
                  {me?.role === "admin" && <DeleteAssetDialog asset={a} />}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
