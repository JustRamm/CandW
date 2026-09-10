// File upload helpers — use Supabase Storage instead of the old /api/uploads endpoint.
import { supabase } from "@/lib/supabase";
import { ApiError } from "@/lib/api";

function randomId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export async function uploadFile(file, { label = "", geo = "" } = {}) {
  const ext = file.name.split(".").pop();
  const path = `documents/${randomId()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw new ApiError(400, { detail: uploadError.message });

  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      id: randomId(),
      filename: file.name,
      content_type: file.type,
      size: file.size,
      label,
      geo,
      storage_path: path,
      url: urlData.publicUrl,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) throw new ApiError(400, { detail: insertError.message });
  return { id: doc.id, filename: doc.filename, content_type: doc.content_type, size: doc.size, url: doc.url };
}

export async function uploadMany(files, opts) {
  const out = [];
  for (const f of Array.from(files)) out.push(await uploadFile(f, opts));
  return out;
}

export async function importAssetsCsv(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { created: 0, codes: [], errors: ["File is empty"] };

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1);
  const created = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const values = rows[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row = Object.fromEntries(headers.map((h, idx) => [h, values[idx] ?? ""]));
    try {
      const assetType = (row.asset_type || "").trim();
      const locationCode = (row.location_code || "").trim().toUpperCase();
      if (!assetType || !locationCode) throw new Error("asset_type and location_code are required");

      // Generate a sequential asset code: TYPE-LOC-NNN
      const prefix = `${assetType.toUpperCase().replace(/\s+/g, "").slice(0, 5)}-${locationCode}`;
      const { count } = await supabase.from("assets").select("*", { count: "exact", head: true }).like("asset_code", `${prefix}-%`);
      const code = `${prefix}-${String((count ?? 0) + 1).padStart(3, "0")}`;

      const { error } = await supabase.from("assets").insert({
        id: randomId(),
        asset_code: code,
        asset_type: assetType,
        location_type: (row.location_type || "Metro").trim(),
        location_code: locationCode,
        location_name: (row.location_name || "").trim(),
        city: (row.city || "Delhi").trim(),
        width_ft: parseFloat(row.width_ft) || 6,
        height_ft: parseFloat(row.height_ft) || 3,
        photo_url: (row.photo_url || "").trim(),
        photo_ids: [],
        description: "",
        notes: "",
        status: "available",
        created_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      created.push(code);
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message}`);
    }
  }
  return { created: created.length, codes: created, errors };
}

export function errMessage(err, fallback = "Something went wrong") {
  const d = err?.body?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || x).join(", ");
  return err?.message || fallback;
}

export function downloadCsv(filename, rows) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
