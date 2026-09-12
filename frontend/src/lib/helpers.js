// File upload helpers — use Supabase Storage instead of the old /api/uploads endpoint.
import { supabase } from "@/lib/supabase";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";
import sound from "@/lib/sound";

function randomId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export async function uploadFile(file, { label = "", geo = "" } = {}) {
  const cleanExt = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const fileId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const path = `${fileId}.${cleanExt}`;
  
  const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (uploadError) throw new ApiError(400, { detail: uploadError.message });

  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      id: fileId,
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      size: file.size || 0,
      label,
      geo,
      storage_path: path,
      url: urlData.publicUrl,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    // Bug #3 fix: do NOT silently return — throw so callers know the document wasn't tracked.
    // The file is already in storage; the caller can retry or surface the error to the user.
    throw new ApiError(500, { detail: `File uploaded but record could not be saved: ${insertError.message}` });
  }
  return { id: doc.id, filename: doc.filename, content_type: doc.content_type, size: doc.size, url: doc.url };
}

export async function uploadMany(files, opts) {
  const out = [];
  for (const f of Array.from(files)) out.push(await uploadFile(f, opts));
  return out;
}

/**
 * RFC 4180 compliant CSV parser:
 * - Properly handles quoted fields containing commas and line breaks
 * - Unescapes double-double quotes ("" -> ")
 * - Strips UTF-8 Byte Order Mark (\uFEFF)
 */
export function parseCsv(text) {
  if (!text) return [];
  const clean = text.replace(/^\uFEFF/, "");
  const rows = [];
  let currentRow = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentVal.trim());
      if (currentRow.some((col) => col.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((col) => col.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export const KERALA_GEO_DATABASE = {
  "lulu mall tvm": { lat: 8.4975, lng: 76.9038, district: "Thiruvananthapuram" },
  "lulu tvm": { lat: 8.4975, lng: 76.9038, district: "Thiruvananthapuram" },
  "lulu trivandrum": { lat: 8.4975, lng: 76.9038, district: "Thiruvananthapuram" },
  "lulu mall kochi": { lat: 10.0275, lng: 76.3081, district: "Ernakulam" },
  "lulu kochi": { lat: 10.0275, lng: 76.3081, district: "Ernakulam" },
  "lulu edappally": { lat: 10.0275, lng: 76.3081, district: "Ernakulam" },
  "lulu kozhikode": { lat: 11.2625, lng: 75.7820, district: "Kozhikode" },
  "lulu calicut": { lat: 11.2625, lng: 75.7820, district: "Kozhikode" },
  "lulu kottayam": { lat: 9.5916, lng: 76.5222, district: "Kottayam" },
  "center square mall kochi": { lat: 9.9765, lng: 76.2825, district: "Ernakulam" },
  "center square mall": { lat: 9.9765, lng: 76.2825, district: "Ernakulam" },
  "center square": { lat: 9.9765, lng: 76.2825, district: "Ernakulam" },
  "mall of travancore": { lat: 8.4878, lng: 76.9388, district: "Thiruvananthapuram" },
  "mot trivandrum": { lat: 8.4878, lng: 76.9388, district: "Thiruvananthapuram" },
  "mot tvm": { lat: 8.4878, lng: 76.9388, district: "Thiruvananthapuram" },
  "forum mall kochi": { lat: 9.9678, lng: 76.3195, district: "Ernakulam" },
  "forum kochi": { lat: 9.9678, lng: 76.3195, district: "Ernakulam" },
  "forum maradu": { lat: 9.9678, lng: 76.3195, district: "Ernakulam" },
  "oberon mall kochi": { lat: 10.0125, lng: 76.315, district: "Ernakulam" },
  "oberon mall": { lat: 10.0125, lng: 76.315, district: "Ernakulam" },
  "hilite mall kozhikode": { lat: 11.2588, lng: 75.8342, district: "Kozhikode" },
  "hilite calicut": { lat: 11.2588, lng: 75.8342, district: "Kozhikode" },
  "hilite kozhikode": { lat: 11.2588, lng: 75.8342, district: "Kozhikode" },
  "gokulam mall kozhikode": { lat: 11.2612, lng: 75.7804, district: "Kozhikode" },
  "gokulam mall": { lat: 11.2612, lng: 75.7804, district: "Kozhikode" },
  "hilite thrissur": { lat: 10.5276, lng: 76.2144, district: "Thrissur" },
  "hilite mall thrissur": { lat: 10.5276, lng: 76.2144, district: "Thrissur" },
  "shobha city thrissur": { lat: 10.5518, lng: 76.1776, district: "Thrissur" },
  "sobha city thrissur": { lat: 10.5518, lng: 76.1776, district: "Thrissur" },
  "secura centre kannur": { lat: 11.8745, lng: 75.3704, district: "Kannur" },
  "market city malappuram": { lat: 11.051, lng: 76.0711, district: "Malappuram" },
  "kochi metro mg road": { lat: 9.9723, lng: 76.2845, district: "Ernakulam" },
  "mg road metro": { lat: 9.9723, lng: 76.2845, district: "Ernakulam" },
  "aluva metro": { lat: 10.1098, lng: 76.3533, district: "Ernakulam" },
  "edappally metro": { lat: 10.0255, lng: 76.3085, district: "Ernakulam" },
  "kaloor metro": { lat: 9.9984, lng: 76.2917, district: "Ernakulam" },
  "maharajas metro": { lat: 9.968, lng: 76.284, district: "Ernakulam" },
  "palarivattom metro": { lat: 10.005, lng: 76.3038, district: "Ernakulam" },
  "infopark kochi": { lat: 10.0094, lng: 76.3606, district: "Ernakulam" },
  "technopark tvm": { lat: 8.5581, lng: 76.8812, district: "Thiruvananthapuram" },
  "technopark trivandrum": { lat: 8.5581, lng: 76.8812, district: "Thiruvananthapuram" },
  "trivandrum central": { lat: 8.4875, lng: 76.9525, district: "Thiruvananthapuram" },
  "thampanoor": { lat: 8.4875, lng: 76.9525, district: "Thiruvananthapuram" },
};

export async function fetchCoordinatesForLocation(query, district = "") {
  if (!query || query.trim().length < 3) return null;
  const q = query.trim().toLowerCase();

  // 1. Exact or partial match in verified Kerala Landmark database
  for (const [key, coords] of Object.entries(KERALA_GEO_DATABASE)) {
    if (q.includes(key) || key.includes(q)) {
      return {
        lat: coords.lat,
        lng: coords.lng,
        district: coords.district,
        source: "verified_kerala_landmark",
      };
    }
  }

  // 2. Query OpenStreetMap Nominatim for accurate real-time geocoding
  try {
    const cleanQuery = query.replace(/[—–-]/g, " ").replace(/\s+/g, " ").trim();
    const fullQuery = `${cleanQuery}, ${district || "Kerala"}, India`;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(parseFloat(data[0].lat).toFixed(6)),
          lng: parseFloat(parseFloat(data[0].lon).toFixed(6)),
          displayName: data[0].display_name,
          source: "openstreetmap",
        };
      }
    }
  } catch (err) {
    console.warn("Geocoding lookup error:", err);
  }
  return null;
}

export async function importAssetsCsv(file) {
  const text = await file.text();
  const parsedRows = parseCsv(text);
  if (parsedRows.length < 2) {
    return { created: 0, updated: 0, total: 0, codes: [], errors: ["File is empty or contains only headers"] };
  }

  // Normalize headers: lowercase, trim, spaces/dashes to underscores
  const rawHeaders = parsedRows[0];
  const headers = rawHeaders.map((h) =>
    h.toLowerCase().trim().replace(/[\s-]+/g, "_").replace(/^"|"$/g, "")
  );

  const dataRows = parsedRows.slice(1);
  const created = [];
  const updated = [];
  const errors = [];

  for (let i = 0; i < dataRows.length; i++) {
    const values = dataRows[i];
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : "";
    });

    try {
      // Flexible field resolution
      let assetCode = (row.asset_code || row.code || "").trim();
      const assetType = (row.asset_type || row.type || "Digital Screen").trim();
      let locationCode = (row.location_code || row.loc_code || "").trim().toUpperCase();
      const locationName = (row.location_name || row.location || row.name || "").trim();

      // If location_code is missing, derive it from asset_code or location_name
      if (!locationCode) {
        if (assetCode.includes("-")) {
          const parts = assetCode.split("-");
          locationCode = parts[1]?.toUpperCase() || "LOC";
        } else if (locationName) {
          locationCode = locationName
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 5)
            .toUpperCase() || "LOC";
        } else {
          locationCode = "LOC";
        }
      }

      // If asset_code is missing, generate sequential code: TYPE-LOC-NNN
      if (!assetCode) {
        const prefix = `${assetType.toUpperCase().replace(/\s+/g, "").slice(0, 5)}-${locationCode}`;
        const { count } = await supabase
          .from("assets")
          .select("*", { count: "exact", head: true })
          .like("asset_code", `${prefix}-%`);
        assetCode = `${prefix}-${String((count ?? 0) + 1).padStart(3, "0")}`;
      }

      const rawStatus = (row.status || "available").trim().toLowerCase();
      const validStatuses = ["available", "reserved", "onboarding", "live", "closing", "closed"];
      const status = validStatuses.includes(rawStatus) ? rawStatus : "available";

      let lat = parseFloat(row.latitude || row.lat);
      let lng = parseFloat(row.longitude || row.lng || row.long);
      const radius = parseInt(row.geofence_radius_m || row.geofence || row.radius, 10);

      // Auto-resolve coordinates if missing in CSV
      if ((isNaN(lat) || isNaN(lng)) && locationName) {
        const autoGeo = await fetchCoordinatesForLocation(locationName, row.district || row.city);
        if (autoGeo) {
          lat = autoGeo.lat;
          lng = autoGeo.lng;
        }
      }

      // Parse brand details: supports single brand, brand_1 & brand_2, and comma-separated brand_names
      const brandList = [];
      if (row.brand_1) brandList.push(row.brand_1.trim());
      if (row.brand_2) brandList.push(row.brand_2.trim());
      if (row.brand_name) {
        row.brand_name.split(/[,|/]/).forEach((b) => {
          const trimmed = b.trim();
          if (trimmed && !brandList.includes(trimmed)) brandList.push(trimmed);
        });
      }
      if (row.brand) {
        row.brand.split(/[,|/]/).forEach((b) => {
          const trimmed = b.trim();
          if (trimmed && !brandList.includes(trimmed)) brandList.push(trimmed);
        });
      }
      if (row.brands || row.brand_names) {
        const multi = row.brands || row.brand_names;
        multi.split(/[,|/]/).forEach((b) => {
          const trimmed = b.trim();
          if (trimmed && !brandList.includes(trimmed)) brandList.push(trimmed);
        });
      }
      if (row.current_brand) {
        row.current_brand.split(/[,|/]/).forEach((b) => {
          const trimmed = b.trim();
          if (trimmed && !brandList.includes(trimmed)) brandList.push(trimmed);
        });
      }

      const currentBrandSummary = brandList.length ? brandList.join(", ") : (row.current_brand || "").trim();
      const startDate = (row.start_date || row.campaign_start_date || "").trim();
      const endDate = (row.end_date || row.campaign_end_date || "").trim();

      const payload = {
        asset_type: assetType,
        location_type: (row.location_type || "Mall").trim(),
        location_code: locationCode,
        location_name: locationName || `${locationCode} Display`,
        city: (row.city || row.district || "Ernakulam").trim(),
        district: (row.district || row.city || "Ernakulam").trim(),
        width_ft: parseFloat(row.width_ft || row.width) || 6,
        height_ft: parseFloat(row.height_ft || row.height) || 3,
        photo_url: (row.photo_url || row.photo || row.image || "").trim(),
        description: (row.description || row.desc || "").trim(),
        notes: (row.notes || "").trim(),
        current_brand: currentBrandSummary || null,
        start_date: startDate || null,
        end_date: endDate || null,
        status: brandList.length > 0 && status === "available" ? "live" : status,
        latitude: !isNaN(lat) ? lat : null,
        longitude: !isNaN(lng) ? lng : null,
        geofence_radius_m: !isNaN(radius) && radius > 0 ? radius : 500,
      };

      // Check if asset already exists
      const { data: existing } = await supabase
        .from("assets")
        .select("id")
        .eq("asset_code", assetCode)
        .maybeSingle();

      let targetAssetId = existing?.id;

      if (existing) {
        // Update existing record
        const { error: updateErr } = await supabase
          .from("assets")
          .update(payload)
          .eq("id", existing.id);
        if (updateErr) throw new Error(updateErr.message);
        updated.push(assetCode);
      } else {
        // Insert new record
        targetAssetId = randomId();
        const { error: insertErr } = await supabase
          .from("assets")
          .insert({
            id: targetAssetId,
            asset_code: assetCode,
            photo_ids: [],
            created_at: new Date().toISOString(),
            ...payload,
          });
        if (insertErr) throw new Error(insertErr.message);
        created.push(assetCode);
      }

      // Link brand details and auto-create campaigns if brand details were included
      if (brandList.length > 0 && targetAssetId) {
        const campStartDate = startDate || new Date().toISOString().split("T")[0];
        const campEndDate =
          endDate ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const durationDays = Math.max(
          1,
          Math.round(
            (new Date(campEndDate) - new Date(campStartDate)) / (1000 * 60 * 60 * 24)
          )
        );

        for (const bName of brandList) {
          // Check if brand exists in brands table
          let brandId = null;
          const { data: existingBrand } = await supabase
            .from("brands")
            .select("id")
            .ilike("name", bName)
            .maybeSingle();

          if (existingBrand) {
            brandId = existingBrand.id;
          } else {
            const newBId = randomId();
            const { data: createdBrand } = await supabase
              .from("brands")
              .insert({
                id: newBId,
                name: bName,
                created_at: new Date().toISOString(),
              })
              .select("id")
              .maybeSingle();
            brandId = createdBrand?.id || newBId;
          }

          // Check if active campaign already exists on this asset for this brand
          const { data: existingCamp } = await supabase
            .from("campaigns")
            .select("id")
            .eq("asset_id", targetAssetId)
            .ilike("brand", bName)
            .neq("stage", "closed")
            .maybeSingle();

          if (!existingCamp) {
            await supabase.from("campaigns").insert({
              id: randomId(),
              asset_id: targetAssetId,
              asset_code: assetCode,
              brand_id: brandId,
              brand: bName,
              stage: payload.status === "live" ? "live" : "onboarding",
              priority: "high",
              start_date: campStartDate,
              end_date: campEndDate,
              duration_days: durationDays,
              proposed_duration_days: durationDays,
              notes:
                brandList.length > 1
                  ? "Multi-Brand Ad Loop Slot (Imported from CSV)"
                  : "Exclusive Brand Slot (Imported from CSV)",
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message}`);
    }
  }

  return {
    created: created.length,
    updated: updated.length,
    total: created.length + updated.length,
    codes: [...created, ...updated],
    errors,
  };
}

export function errMessage(err, fallback = "Something went wrong") {
  const d = err?.body?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || x).join(", ");
  return err?.message || fallback;
}

export function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) {
    toast.info("No records to export");
    return false;
  }

  // Collect all unique keys from all rows to ensure no columns are omitted
  const headerSet = new Set();
  rows.forEach((r) => Object.keys(r).forEach((k) => headerSet.add(k)));
  const headers = Array.from(headerSet);

  const esc = (v) => {
    if (v === null || v === undefined) return '""';
    if (typeof v === "object") {
      return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
    }
    return `"${String(v).replace(/"/g, '""')}"`;
  };

  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\r\n");

  const cleanFilename = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;

  // \uFEFF Byte Order Mark ensures correct character encoding when opened in Excel
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = cleanFilename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);

  sound.success();
  toast.success(`Exported ${cleanFilename}`, {
    description: `${rows.length} record(s) downloaded successfully.`,
  });
  return true;
}

/** Downloads a ready-to-use CSV template for importing assets */
export function downloadAssetCsvTemplate() {
  sound.click();
  const sampleRows = [
    {
      asset_code: "DIGIT-LULUTVM-001",
      asset_type: "Digital Screen",
      location_code: "LULUTVM",
      location_name: "Lulu Mall TVM — Ground Atrium",
      location_type: "Mall",
      city: "Thiruvananthapuram",
      district: "Thiruvananthapuram",
      width_ft: 12,
      height_ft: 6,
      brand_names: "Nike, Adidas",
      start_date: "2026-10-01",
      end_date: "2026-10-31",
      latitude: 8.4975,
      longitude: 76.9038,
      geofence_radius_m: 500,
      status: "live",
      description: "P4 UHD Digital Totem Display with 2-brand rotation loop",
      notes: "Main atrium entrance facing central escalator",
    },
    {
      asset_code: "METRO-MG-001",
      asset_type: "Backlit Static",
      location_code: "MG",
      location_name: "MG Road Metro Station",
      location_type: "Metro",
      city: "Kochi",
      district: "Ernakulam",
      width_ft: 10,
      height_ft: 4,
      brand_name: "Tata Motors",
      start_date: "2026-10-01",
      end_date: "2026-11-30",
      latitude: 9.9723,
      longitude: 76.2845,
      geofence_radius_m: 300,
      status: "live",
      description: "Backlit flex display panel",
      notes: "Concourse ticketing hall entrance",
    },
    {
      asset_code: "MALL-CSMK-002",
      asset_type: "Mall Bench",
      location_code: "CSMK",
      location_name: "Center Square Mall Kochi — 2nd Floor",
      location_type: "Mall",
      city: "Kochi",
      district: "Ernakulam",
      width_ft: 6,
      height_ft: 3,
      brand_name: "",
      start_date: "",
      end_date: "",
      latitude: 9.9765,
      longitude: 76.2825,
      geofence_radius_m: 400,
      status: "available",
      description: "Branded seating bench unit",
      notes: "Food court corridor",
    },
  ];
  return downloadCsv("assets_import_template.csv", sampleRows);
}

export const STAGE_LABELS = {
  onboarding: "Onboarding",
  invoicing: "Invoice Pending",
  live: "Live",
  closing: "Closing",
  closed: "Closed",
};

export const ASSET_STATUS_LABELS = {
  available: "Available",
  reserved: "In Queue",
  onboarding: "Onboarding",
  live: "Live",
};

export const REASON_LABELS = {
  advance_payment: "Advance Payment",
  signed_agreement: "Signed Agreement",
  purchase_order: "Purchase Order",
  invoice: "Invoice Raised",
};

export function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtMoney(v) {
  if (v == null) return "—";
  return `₹${Number(v).toLocaleString("en-IN")}`;
}
