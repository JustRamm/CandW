// Supabase data layer — replaces the old /api fetch wrapper.
// SupabaseError keeps the same { status, body } shape as the old ApiError so
// every existing errMessage() call works unchanged.
import { supabase } from "@/lib/supabase";

export class ApiError extends Error {
  status;
  body;
  constructor(status, body) {
    super(`request failed with ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function toApiError(error) {
  if (!error) return null;
  return new ApiError(400, { detail: error.message ?? String(error) });
}

/** Re-export supabase so pages can import it from here if they want. */
export { supabase };

// ── Generic table helpers ──────────────────────────────────────────────────

/** Select rows from a table. Returns the data array. */
export async function sbSelect(table, query = (q) => q) {
  const { data, error } = await query(supabase.from(table).select("*"));
  if (error) throw toApiError(error);
  return data;
}

/** Insert one row and return it. */
export async function sbInsert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw toApiError(error);
  return data;
}

/** Update rows matching the filter. Returns the first updated row. */
export async function sbUpdate(table, filter, changes) {
  let q = supabase.from(table).update(changes).select();
  for (const [col, val] of Object.entries(filter)) q = q.eq(col, val);
  const { data, error } = await q;
  if (error) throw toApiError(error);
  return data?.[0];
}

/** Delete rows matching the filter. */
export async function sbDelete(table, filter) {
  let q = supabase.from(table).delete();
  for (const [col, val] of Object.entries(filter)) q = q.eq(col, val);
  const { error } = await q;
  if (error) throw toApiError(error);
  return { ok: true };
}

/** Call a Supabase RPC / Postgres function. */
export async function sbRpc(fn, params = {}) {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw toApiError(error);
  return data;
}

