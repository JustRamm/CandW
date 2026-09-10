// Multipart upload helper — api.js only speaks JSON, uploads need FormData.
import { ApiError } from "@/lib/api";

export async function uploadFile(file, { label = "", geo = "" } = {}) {
  const form = new FormData();
  form.append("file", file);
  form.append("label", label);
  form.append("geo", geo);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  return await res.json();
}

export async function uploadMany(files, opts) {
  const out = [];
  for (const f of Array.from(files)) out.push(await uploadFile(f, opts));
  return out;
}

export async function importAssetsCsv(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/assets/import-csv", { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  return await res.json();
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
