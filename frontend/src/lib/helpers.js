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

      const lat = parseFloat(row.latitude || row.lat);
      const lng = parseFloat(row.longitude || row.lng || row.long);
      const radius = parseInt(row.geofence_radius_m || row.geofence || row.radius, 10);

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
        status,
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
        const { error: insertErr } = await supabase
          .from("assets")
          .insert({
            id: randomId(),
            asset_code: assetCode,
            photo_ids: [],
            created_at: new Date().toISOString(),
            ...payload,
          });
        if (insertErr) throw new Error(insertErr.message);
        created.push(assetCode);
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
      asset_code: "DIGIT-LULU-001",
      asset_type: "Digital Screen",
      location_code: "LULU",
      location_name: "Lulu Mall - Main Atrium",
      location_type: "Mall",
      city: "Kochi",
      district: "Ernakulam",
      width_ft: 12,
      height_ft: 6,
      latitude: 10.0275,
      longitude: 76.3081,
      geofence_radius_m: 500,
      status: "available",
      description: "P4 UHD Digital Totem Display",
      notes: "Main atrium entrance facing escalators",
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
      latitude: 9.9723,
      longitude: 76.2845,
      geofence_radius_m: 300,
      status: "available",
      description: "Backlit flex display panel",
      notes: "Concourse ticketing hall",
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
