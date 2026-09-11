import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  Building2,
  Camera,
  Download,
  FileSpreadsheet,
  LayoutGrid,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import FileUploader from "@/components/shared/FileUploader";
import PhotoSlideshow from "@/components/shared/PhotoSlideshow";
import AssetMap from "@/components/assets/AssetMap";
import { AssetStatusBadge } from "@/components/shared/StatusBadges";
import { Button } from "@/components/ui/button";
import { AssetsSkeleton } from "@/components/skeletons";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { queryClient } from "@/lib/queryClient";
import { useAssetTypes, useAssets, useBrands, useMe } from "@/lib/queries";
import { downloadAssetCsvTemplate, downloadCsv, errMessage, importAssetsCsv } from "@/lib/helpers";
import sound from "@/lib/sound";

const STATUS_FILTERS = [
  ["all", "All statuses"],
  ["available", "Available"],
  ["reserved", "In Queue"],
  ["onboarding", "Onboarding"],
  ["live", "Live"],
];

/** 14 Official Districts of Kerala */
export const KERALA_DISTRICTS = [
  "Alappuzha",
  "Ernakulam",
  "Idukki",
  "Kannur",
  "Kasaragod",
  "Kollam",
  "Kottayam",
  "Kozhikode",
  "Malappuram",
  "Palakkad",
  "Pathanamthitta",
  "Thiruvananthapuram",
  "Thrissur",
  "Wayanad",
];

/** Kerala Malls mapped to their respective districts */
export const KERALA_MALLS = [
  { name: "Center Square Mall Kochi", district: "Ernakulam" },
  { name: "Gokulam Mall Kozhikode", district: "Kozhikode" },
  { name: "Hilite Kozhikode", district: "Kozhikode" },
  { name: "Hilite Thrissur", district: "Thrissur" },
  { name: "Lulu Kottayam", district: "Kottayam" },
  { name: "Lulu Kozhikode", district: "Kozhikode" },
  { name: "Lulu Mall TVM", district: "Thiruvananthapuram" },
  { name: "Market City Malappuram", district: "Malappuram" },
  { name: "MOT Trivandrum", district: "Thiruvananthapuram" },
  { name: "Oberon Mall Kochi", district: "Ernakulam" },
  { name: "Secura Centre Kannur", district: "Kannur" },
  { name: "Shobha City Thrissur", district: "Thrissur" },
];

/**
 * Intelligently derives the Mall name from asset data.
 * Prioritizes matching against known Kerala malls, then falls back to venue prefixes.
 */
export function extractMallName(asset) {
  if (!asset) return null;
  if (asset.mall_name) return asset.mall_name.trim();
  if (asset.mall) return asset.mall.trim();

  const locName = (asset.location_name || "").trim();
  if (!locName) return null;

  // 1. Direct match with Kerala malls
  for (const km of KERALA_MALLS) {
    if (locName.toLowerCase().includes(km.name.toLowerCase())) {
      return km.name;
    }
  }

  // 2. Common Kerala Mall name aliases
  if (/sobha\s*city/i.test(locName)) return "Shobha City Thrissur";
  if (/mall\s*of\s*travancore/i.test(locName)) return "MOT Trivandrum";
  if (/center\s*square/i.test(locName)) return "Center Square Mall Kochi";
  if (/oberon/i.test(locName)) return "Oberon Mall Kochi";
  if (/secura/i.test(locName)) return "Secura Centre Kannur";
  if (/market\s*city/i.test(locName)) return "Market City Malappuram";
  if (/gokulam/i.test(locName)) return "Gokulam Mall Kozhikode";

  const locType = (asset.location_type || "").toLowerCase();
  const assetType = (asset.asset_type || "").toLowerCase();

  const hasMallKeyword = /mall|marketcity|citywalk|plaza|galleria|forum|centre|center|mot/i.test(locName);
  const isMallType = locType.includes("mall") || assetType.includes("mall");

  if (!isMallType && !hasMallKeyword) return null;

  // Split by common separators: " — ", " – ", " - ", " | ", or ","
  const parts = locName.split(/\s*[\u2014\u2013\-|,\s]\s*/);
  if (parts.length > 1) {
    return parts[0].trim();
  }
  return locName;
}

/**
 * Derives the Kerala District from asset data (uses district if available, otherwise city)
 */
export function extractDistrict(asset) {
  if (!asset) return "";
  const raw = (asset.district || asset.city || "").trim();
  const lower = raw.toLowerCase();

  // Kerala aliases
  if (lower === "kochi" || lower === "cochin") return "Ernakulam";
  if (lower === "trivandrum" || lower === "tvm") return "Thiruvananthapuram";
  if (lower === "calicut") return "Kozhikode";

  const match = KERALA_DISTRICTS.find((d) => d.toLowerCase() === lower);
  return match || raw;
}

const BLANK = {
  asset_type: "",
  location_type: "Mall",
  location_code: "",
  location_name: "",
  brand_name: "",
  brand_names: [],
  city: "Ernakulam",
  district: "Ernakulam",
  width_ft: 8,
  height_ft: 3,
  description: "",
  notes: "",
  start_date: "",
  end_date: "",
  latitude: "",
  longitude: "",
  geofence_radius_m: 500,
};

function refreshAssets() {
  queryClient.invalidateQueries({ queryKey: ["assets"] });
}

/** Shared create/edit form. `asset` present = edit mode. */
export function AssetDialog({ asset, trigger }) {
  const { data: types } = useAssetTypes();
  const { data: brands = [] } = useBrands();
  const [open, setOpen] = useState(false);

  const getInitialForm = () => {
    const existingBrands = asset?.current_brand
      ? asset.current_brand.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    return asset
      ? {
          asset_type: asset.asset_type,
          location_type: asset.location_type ?? "Metro",
          location_code: asset.location_code,
          location_name: asset.location_name,
          brand_name: existingBrands[0] ?? "",
          brand_names: existingBrands,
          city: asset.city ?? "",
          // Bug #21 fix: include district so it's not wiped on edit-save
          district: asset.district ?? asset.city ?? "",
          width_ft: asset.width_ft,
          height_ft: asset.height_ft,
          description: asset.description ?? "",
          notes: asset.notes ?? "",
          start_date: asset.start_date ?? "",
          end_date: asset.end_date ?? "",
          latitude: asset.latitude ?? "",
          longitude: asset.longitude ?? "",
          geofence_radius_m: asset.geofence_radius_m ?? 500,
        }
      : { ...BLANK, brand_names: [] };
  };


  const [form, setForm] = useState(getInitialForm);
  const [photos, setPhotos] = useState(
    (asset?.photo_ids ?? []).map((id) => ({ id, filename: "Existing photo" })),
  );
  const [proofPhotos, setProofPhotos] = useState([]);
  const [isCustomMall, setIsCustomMall] = useState(false);
  const [newMall, setNewMall] = useState({
    name: "",
    district: "Ernakulam",
    city: "",
    section: "",
    latitude: "",
    longitude: "",
  });

  const resetAll = () => {
    setForm(getInitialForm());
    setPhotos((asset?.photo_ids ?? []).map((id) => ({ id, filename: "Existing photo" })));
    setProofPhotos([]);
    setIsCustomMall(false);
    setNewMall({
      name: "",
      district: "Ernakulam",
      city: "",
      section: "",
      latitude: "",
      longitude: "",
    });
  };

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    resetAll();
  };

  const handleNewMallChange = (key, val) => {
    const updated = { ...newMall, [key]: val };
    setNewMall(updated);

    const code = (updated.name || "MALL")
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 4);

    const section = updated.section ? ` — ${updated.section}` : " — ";
    const locName = updated.name ? `${updated.name.trim()}${section}` : "";

    setForm((f) => ({
      ...f,
      location_name: locName || f.location_name,
      location_code: code || f.location_code,
      district: updated.district || f.district,
      city: updated.city || updated.district || f.city,
      latitude: updated.latitude || f.latitude,
      longitude: updated.longitude || f.longitude,
    }));
  };

  const DEFAULT_TYPES = [
    "Mall Bench",
    "Metro Bench",
    "Digital Screen",
    "Digital Totem",
    "Unipole",
    "Hoarding",
    "Bus Shelter",
    "Backlit Static",
  ];
  const dbTypeNames = (types ?? []).map((t) => t.name);
  const typeNames = Array.from(new Set([...dbTypeNames, ...DEFAULT_TYPES]));
  const activeType = form.asset_type || typeNames[0] || "";
  const isDigital =
    activeType === "Digital Screen" ||
    activeType === "Digital Totem" ||
    form.location_type === "DOOH";

  const save = useMutation({
    mutationFn: async (body) => {
      const { supabase } = await import("@/lib/supabase");

      const isDigitalAsset =
        body.asset_type === "Digital Screen" ||
        body.asset_type === "Digital Totem" ||
        body.location_type === "DOOH";

      const selectedBrands = isDigitalAsset
        ? (form.brand_names ?? []).filter(Boolean)
        : (body.brand_name ? [body.brand_name.trim()] : []);

      if (!selectedBrands.length && !asset) {
        throw {
          body: {
            detail: isDigitalAsset
              ? "Please select at least one brand partner for the digital ad loop (required)."
              : "Please select a registered brand partner (required).",
          },
        };
      }

      const brandSummary = selectedBrands.join(", ");
      const notesWithBrand = brandSummary
        ? `${body.notes ? body.notes + " · " : ""}${isDigitalAsset ? "Digital Ad Loop: " : "Brand Partner: "}${brandSummary}`
        : body.notes;

      const { brand_name, brand_names, ...dbFields } = body;

      const payload = {
        ...dbFields,
        notes: notesWithBrand,
        current_brand: brandSummary || null,
        latitude: body.latitude && !isNaN(Number(body.latitude)) ? Number(body.latitude) : null,
        longitude: body.longitude && !isNaN(Number(body.longitude)) ? Number(body.longitude) : null,
        geofence_radius_m: body.geofence_radius_m ? Number(body.geofence_radius_m) : 500,
      };

      const proofIds = body.proof_photo_ids ?? [];
      const gtpList = proofIds.length
        ? [
            {
              id: crypto.randomUUID(),
              seq: 1,
              status: "approved",
              due_date: new Date().toISOString().split("T")[0],
              is_final: false,
              doc_ids: proofIds,
              priority: "high",
              notes: "Initial Geo-Tagged Installation Proof",
              submitted_at: new Date().toISOString(),
              reviewed_at: new Date().toISOString(),
            },
          ]
        : [];

      if (asset) {
        // Update existing
        const { data, error } = await supabase.from("assets").update(payload).eq("id", asset.id).select().single();
        if (error) throw { body: { detail: error.message } };

        if (proofIds.length) {
          const { data: camps } = await supabase
            .from("campaigns")
            .select("*")
            .eq("asset_id", asset.id)
            .neq("stage", "closed");
          for (const c of camps ?? []) {
            const existingGtps = c.gtps ?? [];
            if (existingGtps.length) {
              const target = existingGtps[0];
              target.doc_ids = Array.from(new Set([...(target.doc_ids ?? []), ...proofIds]));
              target.status = "approved";
              target.reviewed_at = new Date().toISOString();
            } else {
              existingGtps.push({
                id: crypto.randomUUID(),
                seq: 1,
                status: "approved",
                due_date: new Date().toISOString().split("T")[0],
                is_final: false,
                doc_ids: proofIds,
                priority: "high",
                notes: "Installation Mounting Proof",
                submitted_at: new Date().toISOString(),
                reviewed_at: new Date().toISOString(),
              });
            }
            await supabase.from("campaigns").update({ gtps: existingGtps }).eq("id", c.id);
          }
        }
        return data;
      }
      // Create new — generate asset code
      const assetType = body.asset_type;
      const locationCode = body.location_code.toUpperCase();
      const prefix = `${assetType.toUpperCase().replace(/\s+/g, "").slice(0, 5)}-${locationCode}`;
      const { count } = await supabase.from("assets").select("*", { count: "exact", head: true }).like("asset_code", `${prefix}-%`);
      const code = `${prefix}-${String((count ?? 0) + 1).padStart(3, "0")}`;
      const { data, error } = await supabase.from("assets").insert({
        id: crypto.randomUUID(),
        asset_code: code,
        ...payload,
        status: "available",
        created_at: new Date().toISOString(),
      }).select().single();
      if (error) throw { body: { detail: error.message } };

      // Link brand campaign(s) automatically
      const campaignStartDate = body.start_date || new Date().toISOString().split("T")[0];
      const campaignEndDate = body.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const calculatedDuration = Math.max(1, Math.round((new Date(campaignEndDate) - new Date(campaignStartDate)) / (1000 * 60 * 60 * 24)));

      for (const bName of selectedBrands) {
        const matched = brands.find((b) => b.name.toLowerCase() === bName.toLowerCase());
        await supabase.from("campaigns").insert({
          id: crypto.randomUUID(),
          asset_id: data.id,
          asset_code: data.asset_code,
          brand: bName,
          brand_id: matched?.id || null,
          duration_days: calculatedDuration,
          proposed_duration_days: calculatedDuration,
          stage: "live",
          priority: "high",
          start_date: campaignStartDate,
          end_date: campaignEndDate,
          notes: isDigitalAsset ? "Digital Screen Rotating Ad Loop Slot" : "Exclusive Static Slot",
          gtps: gtpList,
        });
      }


      return data;
    },
    onSuccess: (a) => {
      sound.success();
      refreshAssets();
      if (asset) queryClient.invalidateQueries({ queryKey: ["asset", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success(asset ? `Asset ${a.asset_code} updated` : `Asset ${a.asset_code} created`);
      setOpen(false);
      resetAll();
    },
    onError: (err) => {
      sound.warning();
      toast.error(errMessage(err, "Could not save the asset"));
    },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            const allPhotoIds = Array.from(
              new Set([...photos.map((p) => p.id), ...proofPhotos.map((p) => p.id)]),
            );
            const primaryPhoto = proofPhotos[0]?.url || photos[0]?.url || asset?.photo_url || "";
            save.mutate({
              ...form,
              asset_type: activeType,
              width_ft: Number(form.width_ft),
              height_ft: Number(form.height_ft),
              photo_ids: allPhotoIds,
              proof_photo_ids: proofPhotos.map((p) => p.id),
              photo_url: primaryPhoto,
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
                  {["Mall", "Metro", "Highway", "Commercial", "Transit", "DOOH"].map((t) => (
                    <SelectItem key={t} value={t} data-testid={`location-type-option-${t.toLowerCase()}`}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Brand Partner Section: Multi-brand loop for Digital Screens, Single-brand for Static */}
          {isDigital ? (
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3" data-testid="digital-loop-brand-section">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                    <span>Digital Screen Ad Loop Brands</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Digital displays showcase rotating ad slots (e.g. 10–20s loop). Select all brands running on this screen.
                  </p>
                </div>
                <Badge variant="outline" className="mono-label text-[10px] border-primary/40 text-primary">
                  {form.brand_names?.length || 0} in rotation
                </Badge>
              </div>

              {/* Selected Brands Roster */}
              <div className="flex flex-wrap items-center gap-1.5 min-h-[34px] p-1.5 rounded-md border border-input bg-background">
                {form.brand_names && form.brand_names.length > 0 ? (
                  form.brand_names.map((bName) => (
                    <Badge
                      key={bName}
                      variant="secondary"
                      className="gap-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-foreground hover:bg-primary/20"
                    >
                      <span>{bName}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            brand_names: (f.brand_names || []).filter((b) => b !== bName),
                          }))
                        }
                        className="rounded-full hover:bg-destructive/20 hover:text-destructive p-0.5 ml-0.5 text-muted-foreground transition-colors cursor-pointer"
                        title={`Remove ${bName}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-[11px] text-muted-foreground italic px-1">
                    No brands in rotation yet. Select below to add.
                  </span>
                )}
              </div>

              {/* Brand Selector to Add */}
              <Select
                value=""
                onValueChange={(val) => {
                  if (val && !(form.brand_names || []).includes(val)) {
                    setForm((f) => ({
                      ...f,
                      brand_names: [...(f.brand_names || []), val],
                      brand_name: val,
                    }));
                  }
                }}
              >
                <SelectTrigger className="bg-background text-xs h-8" data-testid="digital-brand-select">
                  <SelectValue placeholder="+ Add registered brand to loop rotation..." />
                </SelectTrigger>
                <SelectContent>
                  {brands
                    .filter((b) => !(form.brand_names || []).includes(b.name))
                    .map((b) => (
                      <SelectItem key={b.id} value={b.name} className="cursor-pointer text-xs">
                        <span className="font-semibold text-foreground">{b.name}</span>
                        {b.industry && (
                          <span className="ml-2 text-[11px] text-muted-foreground">({b.industry})</span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {(!form.brand_names || form.brand_names.length === 0) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  At least one brand partner is required for this digital screen.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="asset-brand-select" className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Placeholder Brand Partner <span className="text-destructive">*</span>
                </span>
                <span className="text-[10px] text-muted-foreground">Required</span>
              </Label>
              <Select
                value={form.brand_name}
                onValueChange={(val) => setForm((f) => ({ ...f, brand_name: val, brand_names: [val] }))}
              >
                <SelectTrigger id="asset-brand-select" className="bg-background text-xs" data-testid="asset-brand-select">
                  <SelectValue placeholder="Select registered brand partner (required)..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.name} className="cursor-pointer text-xs">
                      <span className="font-semibold text-foreground">{b.name}</span>
                      {b.industry && (
                        <span className="ml-2 text-[11px] text-muted-foreground">({b.industry})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!form.brand_name && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  A registered brand partner is required for all new assets.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="location_code">Location code</Label>
              <Input
                id="location_code"
                required
                value={form.location_code}
                onChange={set("location_code")}
                placeholder="e.g. CSMK"
                data-testid="asset-location-code-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kerala District</Label>
              <Select
                value={form.city}
                onValueChange={(v) => setForm((f) => ({ ...f, city: v, district: v }))}
              >
                <SelectTrigger data-testid="asset-district-select">
                  <SelectValue>{(v) => v || "Ernakulam"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {KERALA_DISTRICTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.location_type === "Mall" && (
            <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-primary">Kerala Mall Preset</Label>
                <span className="text-[10px] text-muted-foreground">Auto-fills name & code</span>
              </div>
              
              {!isCustomMall ? (
                <Select
                  value=""
                  onValueChange={(mName) => {
                    if (mName === "__new__") {
                      setIsCustomMall(true);
                      return;
                    }
                    const km = KERALA_MALLS.find((m) => m.name === mName);
                    if (km) {
                      setForm((f) => ({
                        ...f,
                        location_name: `${km.name} — `,
                        city: km.district,
                        district: km.district,
                        location_code: km.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 4),
                      }));
                    }
                  }}
                >
                  <SelectTrigger className="bg-background text-xs" data-testid="kerala-mall-picker">
                    <SelectValue>Select known mall or add new…</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__" className="font-semibold text-primary cursor-pointer">
                      + Add new mall...
                    </SelectItem>
                    {KERALA_MALLS.map((m) => (
                      <SelectItem key={m.name} value={m.name}>
                        {m.name} ({m.district})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2 rounded-md border border-border/70 bg-background/90 p-2.5 text-xs animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <span className="font-semibold text-foreground">New Mall Location Details</span>
                    <button
                      type="button"
                      onClick={() => setIsCustomMall(false)}
                      className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Back to known malls
                    </button>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Mall name</Label>
                    <Input
                      placeholder="e.g. Nexus Mall Kochi"
                      value={newMall.name}
                      onChange={(e) => handleNewMallChange("name", e.target.value)}
                      className="h-7 text-xs bg-background"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Kerala District</Label>
                      <Select
                        value={newMall.district}
                        onValueChange={(v) => handleNewMallChange("district", v)}
                      >
                        <SelectTrigger className="h-7 text-xs bg-background">
                          <SelectValue>{newMall.district}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {KERALA_DISTRICTS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">City / Area</Label>
                      <Input
                        placeholder="e.g. Maradu"
                        value={newMall.city}
                        onChange={(e) => handleNewMallChange("city", e.target.value)}
                        className="h-7 text-xs bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Mall Section / Atrium</Label>
                      <Input
                        placeholder="e.g. Ground Atrium"
                        value={newMall.section}
                        onChange={(e) => handleNewMallChange("section", e.target.value)}
                        className="h-7 text-xs bg-background"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Location Code</Label>
                      <Input
                        placeholder="Auto-generated (e.g. NMK)"
                        value={form.location_code}
                        onChange={set("location_code")}
                        className="h-7 text-xs uppercase bg-background"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">GPS Latitude (optional)</Label>
                      <Input
                        placeholder="e.g. 9.9676"
                        value={newMall.latitude}
                        onChange={(e) => handleNewMallChange("latitude", e.target.value)}
                        className="h-6 text-[11px] bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">GPS Longitude (optional)</Label>
                      <Input
                        placeholder="e.g. 76.3195"
                        value={newMall.longitude}
                        onChange={(e) => handleNewMallChange("longitude", e.target.value)}
                        className="h-6 text-[11px] bg-background"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="location_name">Location name</Label>
            <Input
              id="location_name"
              required
              value={form.location_name}
              onChange={set("location_name")}
              placeholder={
                form.location_type === "Mall"
                  ? "e.g. Center Square Mall Kochi — Ground Atrium"
                  : "e.g. Kochi Metro — MG Road Platform 1"
              }
              data-testid="asset-location-name-input"
            />
            {form.location_type === "Mall" && (
              <p className="text-[11px] text-muted-foreground">
                Format: <span className="font-semibold text-foreground">Mall Name — Section</span> (e.g. Center Square Mall Kochi — Ground Atrium)
              </p>
            )}
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

          {/* Active Display Schedule (Start & Stop) */}
          <div className="rounded-lg border border-border/70 bg-secondary/30 p-3 space-y-2" data-testid="asset-schedule-section">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">Display Schedule (Start & Stop)</Label>
              <span className="text-[10px] text-muted-foreground">Active run dates</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="asset_start_date" className="text-[11px]">Start Date</Label>
                <Input
                  id="asset_start_date"
                  type="date"
                  value={form.start_date}
                  onChange={set("start_date")}
                  data-testid="asset-start-date-input"
                  className="bg-background text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="asset_end_date" className="text-[11px]">Stop / End Date</Label>
                <Input
                  id="asset_end_date"
                  type="date"
                  value={form.end_date}
                  onChange={set("end_date")}
                  data-testid="asset-end-date-input"
                  className="bg-background text-xs"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Define the campaign run window. Anchors interest queues and live occupancy.
            </p>
          </div>

          {/* Photo Attachments & Geo-Tagged Proof Section */}
          <div className="space-y-3 pt-1">
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

            {/* Geo-Tagged Installation Proof (GTP) Placeholder & Upload */}
            <div
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2"
              data-testid="asset-gtp-proof-section"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Camera className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <Label className="text-xs font-semibold text-foreground">
                    Geo-Tagged Proof (GTP)
                  </Label>
                </div>
                <Badge
                  variant="outline"
                  className="mono-label text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                >
                  Client POP Portal Proof
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Capture or upload physical mounting proof stamped with live GPS coordinates. Directly populates the Client Proof-of-Performance portal.
              </p>
              <FileUploader
                value={proofPhotos}
                onChange={setProofPhotos}
                multiple
                geotag
                label="Upload Geo-Tagged Proof (GTP)"
                testId="asset-gtp-uploader"
              />
            </div>
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

          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary" />
                Map GPS & Geofencing
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">Optional</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="a-lat" className="text-[11px]">Latitude</Label>
                <Input
                  id="a-lat"
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 9.9816"
                  className="h-8 text-xs font-mono"
                  value={form.latitude}
                  onChange={set("latitude")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="a-lng" className="text-[11px]">Longitude</Label>
                <Input
                  id="a-lng"
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 76.2999"
                  className="h-8 text-xs font-mono"
                  value={form.longitude}
                  onChange={set("longitude")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="a-radius" className="text-[11px]">Geofence (m)</Label>
                <Input
                  id="a-radius"
                  type="number"
                  placeholder="500"
                  className="h-8 text-xs font-mono"
                  value={form.geofence_radius_m}
                  onChange={set("geofence_radius_m")}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              If left blank, the interactive map automatically derives location from city / district.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} value={form.notes} onChange={set("notes")} data-testid="asset-notes-input" />
          </div>
          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
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
    mutationFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      // Business rule checks
      if (asset.status !== "available") throw { body: { detail: `Only an Available asset can be deleted — this one is ${asset.status}` } };
      const { count: qCount } = await supabase.from("queue_entries").select("*", { count: "exact", head: true }).eq("asset_id", asset.id).in("state", ["active", "pending"]);
      if (qCount) throw { body: { detail: "Withdraw the open interest queue entries first" } };
      const { count: cCount } = await supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("asset_id", asset.id);
      if (cCount) throw { body: { detail: "This asset has historical campaigns — records must be retained" } };
      const { error } = await supabase.from("assets").delete().eq("id", asset.id);
      if (error) throw { body: { detail: error.message } };
      return { ok: true };
    },
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
  // Bug #22 fix: use a ref to reliably reset the file input (plain `e.target.value = ""` fails on Safari iOS)
  const inputRef = useRef(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    sound.upload();
    setBusy(true);
    try {
      const res = await importAssetsCsv(file);
      refreshAssets();
      if (res.total > 0) {
        sound.success();
        const parts = [];
        if (res.created > 0) parts.push(`${res.created} created`);
        if (res.updated > 0) parts.push(`${res.updated} updated`);
        toast.success(`Import complete: ${parts.join(", ")}`, {
          description: res.errors?.length ? `${res.errors.length} row(s) skipped due to errors.` : undefined,
        });
      } else {
        sound.warning();
        toast.error("No assets were imported", {
          description: res.errors?.length ? res.errors.slice(0, 3).join("; ") : "Check CSV formatting.",
        });
      }
    } catch (err) {
      sound.warning();
      toast.error(errMessage(err, "Import failed"));
    } finally {
      setBusy(false);
      // Reset via ref so the same file can be re-imported on all browsers
      if (inputRef.current) inputRef.current.value = null;
    }
  }

  return (
    <div className="flex items-center gap-1">
      <label
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/70 bg-secondary/40 px-2.5 py-1.5 text-xs transition-colors duration-150 hover:border-primary/50"
        data-testid="csv-import-label"
      >
        <Upload className="size-3.5" />
        {busy ? "Importing…" : "CSV import"}
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onFile} data-testid="csv-import-input" />
      </label>
      <Button
        variant="ghost"
        size="xs"
        type="button"
        onClick={downloadAssetCsvTemplate}
        title="Download CSV import template"
        className="hidden sm:inline-flex text-muted-foreground hover:text-foreground text-[11px] gap-1 px-1.5"
        data-testid="download-template-button"
      >
        <FileSpreadsheet className="size-3.5" />
        Template
      </Button>
    </div>
  );
}

export default function Assets() {
  const { data: me } = useMe();
  const [status, setStatus] = useState("all");
  const [district, setDistrict] = useState("all");
  const [mall, setMall] = useState("all");
  const [q, setQ] = useState("");

  const { data: rawAssets, isError, isLoading } = useAssets({ q });
  const canManage = me?.role === "ops" || me?.role === "admin";

  // Count of active assets in each district for badge indicators
  const districtCounts = useMemo(() => {
    const counts = {};
    for (const a of rawAssets ?? []) {
      const d = extractDistrict(a);
      if (d) counts[d] = (counts[d] ?? 0) + 1;
    }
    return counts;
  }, [rawAssets]);

  // List of districts: All 14 Kerala districts
  const districts = KERALA_DISTRICTS;

  // Derived malls: If district is selected, show Kerala malls in that district, otherwise show all Kerala malls
  const malls = useMemo(() => {
    const set = new Set();

    // 1. Add from known Kerala Malls matching selected district (or all)
    for (const km of KERALA_MALLS) {
      if (district === "all" || km.district.toLowerCase() === district.toLowerCase()) {
        set.add(km.name);
      }
    }

    // 2. Also check if any rawAssets has a custom mall name
    for (const a of rawAssets ?? []) {
      if (district !== "all" && extractDistrict(a).toLowerCase() !== district.toLowerCase()) continue;
      const m = extractMallName(a);
      if (m) set.add(m);
    }

    return Array.from(set).sort();
  }, [rawAssets, district]);

  // If the currently selected mall is not in the updated malls list, reset it
  useEffect(() => {
    if (mall !== "all" && !malls.includes(mall)) {
      setMall("all");
    }
  }, [malls, mall]);

  // Filter assets by status, district, and mall
  const assets = useMemo(() => {
    return (rawAssets ?? []).filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (district !== "all" && extractDistrict(a).toLowerCase() !== district.toLowerCase()) return false;
      if (mall !== "all" && extractMallName(a)?.toLowerCase() !== mall.toLowerCase()) return false;
      return true;
    });
  }, [rawAssets, status, district, mall]);

  const [viewMode, setViewMode] = useState("grid");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeFilterCount =
    (district !== "all" ? 1 : 0) + (mall !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0);

  const hasActiveFilters =
    status !== "all" || district !== "all" || mall !== "all" || Boolean(q.trim());

  function clearFilters() {
    setStatus("all");
    setDistrict("all");
    setMall("all");
    setQ("");
  }

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
                  location_code: a.location_code ?? (a.asset_code?.split("-")?.[1] || "LOC"),
                  location_name: a.location_name,
                  location_type: a.location_type ?? "Mall",
                  city: a.city,
                  district: a.district ?? a.city ?? "Ernakulam",
                  width_ft: a.width_ft ?? 6,
                  height_ft: a.height_ft ?? 3,
                  status: a.status,
                  latitude: a.latitude ?? "",
                  longitude: a.longitude ?? "",
                  geofence_radius_m: a.geofence_radius_m ?? 500,
                  current_brand: a.current_brand ?? "",
                  queue_count: a.queue_count ?? 0,
                  next_gtp_date: a.next_gtp_date ?? "",
                  description: a.description ?? "",
                  notes: a.notes ?? "",
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
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="relative w-full flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by asset ID or location"
              className="pl-9 pr-8 w-full"
              data-testid="asset-search-input"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Bar & View Toggle (sm:hidden) */}
          <div className="flex sm:hidden items-center justify-between gap-2 w-full">
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant={activeFilterCount > 0 ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 gap-1.5 px-3 text-xs font-medium border-border/80"
                    data-testid="mobile-filter-trigger"
                  />
                }
              >
                <SlidersHorizontal className="size-3.5 text-primary" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </SheetTrigger>

              <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto p-4 space-y-4">
                <SheetHeader className="pb-2 border-b border-border/60">
                  <div className="flex items-center justify-between">
                    <SheetTitle className="text-base font-heading font-bold">Filter Assets</SheetTitle>
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={clearFilters}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Reset all
                      </Button>
                    )}
                  </div>
                </SheetHeader>

                <div className="space-y-3.5 pt-1">
                  {/* 1. District Filter */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-primary" />
                      District
                    </label>
                    <Select value={district} onValueChange={setDistrict}>
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue placeholder="All Kerala districts">
                          {(v) => (v === "all" ? "All Kerala districts" : v)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Kerala districts</SelectItem>
                        {districts.map((d) => {
                          const cnt = districtCounts[d];
                          return (
                            <SelectItem key={d} value={d}>
                              <span className="flex items-center justify-between w-full gap-2">
                                <span>{d}</span>
                                {cnt ? (
                                  <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold">
                                    {cnt}
                                  </span>
                                ) : null}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 2. Mall Filter */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-primary" />
                      Mall / Venue
                    </label>
                    <Select value={mall} onValueChange={setMall}>
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue placeholder="All Kerala malls">
                          {(v) => (v === "all" ? "All Kerala malls" : v)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Kerala malls</SelectItem>
                        {malls.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 3. Status Filter */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Status</label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue placeholder="All statuses">
                          {(v) => STATUS_FILTERS.find(([k]) => k === v)?.[1] ?? "All statuses"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_FILTERS.map(([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50">
                  <Button
                    className="w-full"
                    onClick={() => setMobileFiltersOpen(false)}
                  >
                    Apply · Show {assets.length} {assets.length === 1 ? "asset" : "assets"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Mobile View Switcher */}
            <div className="relative flex items-center rounded-xl border border-border/80 bg-muted/60 p-0.5 shrink-0 shadow-inner">
              <button
                type="button"
                onClick={() => {
                  sound.click();
                  setViewMode("grid");
                }}
                className={cn(
                  "relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                  viewMode === "grid"
                    ? "text-primary-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid="view-grid-btn-mobile"
              >
                {viewMode === "grid" && (
                  <motion.div
                    layoutId="active-viewmode-pill-mobile"
                    className="absolute inset-0 rounded-lg bg-primary shadow-xs"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <LayoutGrid className="size-3.5" />
                  Grid
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.click();
                  setViewMode("map");
                }}
                className={cn(
                  "relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                  viewMode === "map"
                    ? "text-primary-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid="view-map-btn-mobile"
              >
                {viewMode === "map" && (
                  <motion.div
                    layoutId="active-viewmode-pill-mobile"
                    className="absolute inset-0 rounded-lg bg-primary shadow-xs"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  Map & Geofence
                </span>
              </button>
            </div>
          </div>

          {/* Desktop Filter Bar (hidden sm:flex) */}
          <div className="hidden sm:flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* 1. Filter by District (Kerala's 14 districts) */}
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger className="w-48" data-testid="asset-district-filter">
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue>
                    {(v) => (v === "all" ? "All Kerala districts" : v)}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="asset-district-option-all">
                  All Kerala districts
                </SelectItem>
                {districts.map((d) => {
                  const cnt = districtCounts[d];
                  return (
                    <SelectItem
                      key={d}
                      value={d}
                      data-testid={`asset-district-option-${d.toLowerCase()}`}
                    >
                      <span className="flex items-center justify-between w-full gap-2">
                        <span>{d}</span>
                        {cnt ? (
                          <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold">
                            {cnt}
                          </span>
                        ) : null}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* 2. Filter by Mall (Kerala malls) */}
            <Select value={mall} onValueChange={setMall}>
              <SelectTrigger className="w-52" data-testid="asset-mall-filter">
                <div className="flex items-center gap-1.5 truncate">
                  <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue>
                    {(v) => (v === "all" ? "All Kerala malls" : v)}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="asset-mall-option-all">
                  All Kerala malls
                </SelectItem>
                {malls.map((m) => (
                  <SelectItem
                    key={m}
                    value={m}
                    data-testid={`asset-mall-option-${m.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40" data-testid="asset-status-filter">
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

            {/* Reset Button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                data-testid="reset-asset-filters-button"
              >
                <X className="mr-1 size-3.5" />
                Reset
              </Button>
            )}

            {/* View Mode Switcher: Grid vs Map */}
            <div className="relative flex items-center rounded-xl border border-border/80 bg-muted/60 p-1 shrink-0 ml-auto shadow-inner">
              <button
                type="button"
                onClick={() => {
                  sound.click();
                  setViewMode("grid");
                }}
                className={cn(
                  "relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                  viewMode === "grid"
                    ? "text-primary-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid="view-grid-btn"
              >
                {viewMode === "grid" && (
                  <motion.div
                    layoutId="active-viewmode-pill-desktop"
                    className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <LayoutGrid className="size-3.5" />
                  Grid View
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.click();
                  setViewMode("map");
                }}
                className={cn(
                  "relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                  viewMode === "map"
                    ? "text-primary-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid="view-map-btn"
              >
                {viewMode === "map" && (
                  <motion.div
                    layoutId="active-viewmode-pill-desktop"
                    className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  Map & Geofence
                </span>
              </button>
            </div>
          </div>
        </div>

        {isError && (
          <EmptyState
            title="Inventory unavailable"
            hint="The asset service could not be reached. Try again shortly."
            testId="assets-error-state"
          />
        )}

        {isLoading && <AssetsSkeleton count={6} />}

        {!isLoading && !isError && assets?.length === 0 && (
          <EmptyState
            title="No assets match this filter"
            hint="Clear the search or import your inventory with a CSV."
            icon={MapPinned}
            testId="assets-empty-state"
          />
        )}

        {!isLoading && !isError && assets?.length > 0 && (
          viewMode === "map" ? (
            <AssetMap assets={assets} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="asset-grid">
          {(assets ?? []).map((a) => (
            <Card
              key={a.id}
              className="group h-full overflow-hidden border-border/80 bg-card p-0 shadow-xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/45 rounded-xl"
              data-testid={`asset-card-${a.asset_code}`}
            >
              <Link to={`/assets/${a.id}`} className="block">
                <div className="relative h-36 overflow-hidden">
                  <PhotoSlideshow asset={a} variant="card" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
                  <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2">
                    <span className="mono-label truncate text-white drop-shadow-xs font-semibold">{a.asset_code}</span>
                    <AssetStatusBadge status={a.status} />
                  </div>
                </div>
                <CardContent className="px-4 py-3">
                  <p className="truncate font-heading text-sm font-semibold">{a.location_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.asset_type} · {a.city} · {a.width_ft}×{a.height_ft} ft
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {a.current_brand &&
                      a.current_brand.split(",").map((b) => (
                        <Badge
                          key={b.trim()}
                          variant="outline"
                          className="mono-label rounded-full border-emerald-200 bg-emerald-50 text-[#006d37] shadow-xs"
                        >
                          {b.trim()}
                        </Badge>
                      ))}
                    {a.queue_count > 0 && (
                      <Badge
                        variant="outline"
                        className="mono-label rounded-full border-sky-200 bg-sky-50 text-[#004c69] shadow-xs"
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
                            ? "mono-label rounded-full border-red-200 bg-red-50 text-[#ba1a1a] shadow-xs"
                            : "mono-label rounded-full border-slate-200 bg-slate-100 text-slate-600 shadow-xs"
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
          )
        )}
      </div>
    </AppShell>
  );
}
