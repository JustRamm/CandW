import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ── Helper: throw on Supabase errors ──────────────────────────────────────
function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ── Auth / Profile ─────────────────────────────────────────────────────────

const ROLE_LABELS = {
  admin: "Admin",
  sales: "Sales",
  ops: "Operations",
  finance: "Finance",
  finance_manager: "Finance Manager",
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      // 1. Check hardcoded / local mock session first
      const stored = localStorage.getItem("cw_mock_user");
      if (stored) {
        try {
          const u = JSON.parse(stored);
          if (u) return u;
        } catch {
          localStorage.removeItem("cw_mock_user");
        }
      }

      // 2. Try Supabase Auth
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (!authError && authData?.user) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authData.user.id)
            .single();
          if (!profileError && profile) {
            return {
              ...profile,
              role_label: ROLE_LABELS[profile.role] ?? profile.role,
            };
          }
        }
      } catch {
        // Fallback
      }

      return null;
    },
    retry: false,
    staleTime: 60_000,
  });
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const mockUser = JSON.parse(localStorage.getItem("cw_mock_user") || "null");

      const [
        { data: assets },
        { data: queue },
        { data: campaigns },
        { data: settingsArr },
        { data: holidays },
        authResult,
      ] = await Promise.all([
        supabase.from("assets").select("*").then((r) => r, () => ({ data: [] })),
        supabase.from("queue_entries").select("*").in("state", ["active", "pending"]).then((r) => r, () => ({ data: [] })),
        supabase.from("campaigns").select("*").neq("stage", "closed").then((r) => r, () => ({ data: [] })),
        supabase.from("settings").select("*").then((r) => r, () => ({ data: [] })),
        supabase.from("holidays").select("date").then((r) => r, () => ({ data: [] })),
        supabase.auth.getUser().catch(() => ({ data: null })),
      ]);

      let profile = null;
      if (authResult?.data?.user?.id) {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authResult.data.user.id)
            .single();
          profile = data;
        } catch {
          // ignore
        }
      }

      const settings = settingsArr?.[0] ?? { gtp_reminder_days: 5 };
      const holidaySet = new Set((holidays ?? []).map((h) => h.date));
      const today = new Date().toISOString().split("T")[0];
      const role = profile?.role ?? mockUser?.role ?? "admin";

      // Decorate queue entries with urgency
      const decoratedQueue = (queue ?? []).map((e) => {
        const expires = e.expires_on;
        let daysRemaining = null;
        let urgency = "ok";
        if (expires && e.state === "active") {
          daysRemaining = Math.ceil((new Date(expires) - new Date(today)) / 86400000);
          urgency = daysRemaining <= 1 ? "urgent" : daysRemaining <= 2 ? "warning" : "ok";
        }
        return { ...e, days_remaining: daysRemaining, urgency };
      });

      // GTP state helpers
      const gtpState = (c) => {
        const gtps = c.gtps ?? [];
        const pendingGtp = gtps.find((g) => g.status === "pending" || g.status === "rejected");
        if (!pendingGtp) return { next_due: null, overdue: false };
        const days = Math.ceil((new Date(pendingGtp.due_date) - new Date(today)) / 86400000);
        return { next_due: pendingGtp.due_date, overdue: days < 0 };
      };

      const enrichedCampaigns = (campaigns ?? []).map((c) => {
        const s = gtpState(c);
        const checklist = c.checklist ?? [];
        return {
          ...c,
          ...s,
          checklist_done: checklist.filter((i) => i.status === "done").length,
          checklist_total: checklist.length,
          checklist_complete: checklist.every((i) => i.status === "done"),
        };
      });

      const gtpsDue = enrichedCampaigns.filter((c) => {
        if (!c.next_due) return false;
        const days = Math.ceil((new Date(c.next_due) - new Date(today)) / 86400000);
        return days <= settings.gtp_reminder_days;
      });

      const gtpPendingReview = enrichedCampaigns
        .filter((c) => (c.gtps ?? []).some((g) => g.status === "submitted"))
        .map((c) => ({
          ...c,
          pending_gtps: (c.gtps ?? []).filter((g) => g.status === "submitted"),
        }));

      const cancellations = enrichedCampaigns.filter(
        (c) => c.cancellation?.status === "requested",
      );

      const a = assets ?? [];
      const assetSummary = {
        available: a.filter((x) => x.status === "available").length,
        reserved: a.filter((x) => x.status === "reserved").length,
        onboarding: a.filter((x) => x.status === "onboarding").length,
        live: a.filter((x) => x.status === "live").length,
        total: a.length,
      };

      const kpis = [];
      if (role === "sales" || role === "admin") {
        const mine = decoratedQueue.filter((q) => q.salesperson_id === profile?.id);
        kpis.push(
          { label: "My active slots", value: mine.filter((q) => q.state === "active").length },
          { label: "My waitlisted", value: mine.filter((q) => q.state === "pending").length },
          { label: "Available assets", value: a.filter((x) => x.status === "available").length },
          { label: "Live campaigns", value: enrichedCampaigns.filter((c) => c.stage === "live").length },
        );
      }
      if (role === "ops" || role === "admin") {
        kpis.push(
          { label: "Onboarding tasks", value: enrichedCampaigns.filter((c) => c.stage === "onboarding").length },
          { label: "GTPs due soon", value: gtpsDue.length },
          { label: "Overdue GTPs", value: enrichedCampaigns.filter((c) => c.overdue).length },
          { label: "Closure tasks", value: enrichedCampaigns.filter((c) => c.stage === "closing").length },
        );
      }
      if (role === "finance" || role === "finance_manager" || role === "admin") {
        kpis.push(
          { label: "Confirmation queue", value: decoratedQueue.filter((q) => q.state === "active").length },
          { label: "Invoice requests", value: enrichedCampaigns.filter((c) => c.stage === "invoicing").length },
          { label: "GTP approvals", value: gtpPendingReview.length },
          { label: "Cancellations", value: cancellations.length },
        );
      }

      return {
        role,
        kpis,
        queue: decoratedQueue,
        campaigns: enrichedCampaigns,
        gtps_due: gtpsDue,
        gtp_pending_review: gtpPendingReview,
        cancellations,
        asset_summary: assetSummary,
      };
    },
    retry: false,
  });
}

// ── Assets ─────────────────────────────────────────────────────────────────

export const DEMO_ASSETS = [
  {
    id: "00000000-0000-0000-0001-000000000001",
    asset_code: "MALLB-CSMK-001",
    location_name: "Center Square Mall Kochi — Ground Atrium",
    asset_type: "Mall Bench",
    location_type: "Mall",
    location_code: "CSMK",
    city: "Kochi",
    district: "Ernakulam",
    width_ft: 8,
    height_ft: 3,
    status: "live",
    current_brand: "MALABAR GOLD",
    queue_count: 2,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000002",
    asset_code: "MALLB-LLTV-001",
    location_name: "Lulu Mall TVM — Grand Central Atrium",
    asset_type: "Mall Bench",
    location_type: "Mall",
    location_code: "LLTV",
    city: "Thiruvananthapuram",
    district: "Thiruvananthapuram",
    width_ft: 8,
    height_ft: 3,
    status: "live",
    current_brand: "KALYAN JEWELLERS",
    next_gtp_date: "2026-11-15",
    queue_count: 3,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1567449303183-ae0d6ed1498e?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000003",
    asset_code: "MALLB-HLKK-001",
    location_name: "Hilite Kozhikode — Central Atrium",
    asset_type: "Mall Bench",
    location_type: "Mall",
    location_code: "HLKK",
    city: "Kozhikode",
    district: "Kozhikode",
    width_ft: 8,
    height_ft: 3,
    status: "onboarding",
    current_brand: "SWIGGY INSTAMART",
    queue_count: 1,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1555421689-491a97ff2040?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000004",
    asset_code: "MALLB-SBCT-001",
    location_name: "Shobha City Thrissur — Main Walkway",
    asset_type: "Mall Bench",
    location_type: "Mall",
    location_code: "SBCT",
    city: "Thrissur",
    district: "Thrissur",
    width_ft: 8,
    height_ft: 3,
    status: "onboarding",
    current_brand: "BOAT LIFESTYLE",
    queue_count: 1,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000005",
    asset_code: "MALLB-LLKT-001",
    location_name: "Lulu Kottayam — Ground Concourse",
    asset_type: "Mall Bench",
    location_type: "Mall",
    location_code: "LLKT",
    city: "Kottayam",
    district: "Kottayam",
    width_ft: 8,
    height_ft: 3,
    status: "available",
    current_brand: null,
    queue_count: 0,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1581417478175-a9ef18f210c2?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000006",
    asset_code: "MALLB-MOTT-001",
    location_name: "MOT Trivandrum — Central Boulevard",
    asset_type: "Mall Bench",
    location_type: "Mall",
    location_code: "MOTT",
    city: "Thiruvananthapuram",
    district: "Thiruvananthapuram",
    width_ft: 8,
    height_ft: 3,
    status: "available",
    current_brand: null,
    queue_count: 0,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000007",
    asset_code: "MALLB-OBRN-001",
    location_name: "Oberon Mall Kochi — Second Floor",
    asset_type: "Mall Bench",
    location_type: "Mall",
    location_code: "OBRN",
    city: "Kochi",
    district: "Ernakulam",
    width_ft: 8,
    height_ft: 3,
    status: "live",
    current_brand: "CRED",
    queue_count: 1,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1567449303183-ae0d6ed1498e?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000008",
    asset_code: "MALLB-GKLM-001",
    location_name: "Gokulam Mall Kozhikode — Food Court",
    asset_type: "Mall Bench",
    location_type: "Mall",
    location_code: "GKLM",
    city: "Kozhikode",
    district: "Kozhikode",
    width_ft: 8,
    height_ft: 3,
    status: "available",
    current_brand: null,
    queue_count: 0,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1555421689-491a97ff2040?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000009",
    asset_code: "MALLB-MCMP-001",
    location_name: "Market City Malappuram — West Wing",
    asset_type: "Mall Bench",
    location_type: "Mall",
    location_code: "MCMP",
    city: "Malappuram",
    district: "Malappuram",
    width_ft: 8,
    height_ft: 3,
    status: "onboarding",
    current_brand: "AMUL",
    queue_count: 1,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000010",
    asset_code: "MALLB-SCKN-001",
    location_name: "Secura Centre Kannur — Main Concourse",
    asset_type: "Mall Bench",
    location_type: "Mall",
    location_code: "SCKN",
    city: "Kannur",
    district: "Kannur",
    width_ft: 8,
    height_ft: 3,
    status: "available",
    current_brand: null,
    queue_count: 0,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000011",
    asset_code: "MALLB-HLTC-001",
    location_name: "Hilite Thrissur — First Floor",
    asset_type: "Mall Bench",
    location_type: "Mall",
    location_code: "HLTC",
    city: "Thrissur",
    district: "Thrissur",
    width_ft: 8,
    height_ft: 3,
    status: "available",
    current_brand: null,
    queue_count: 0,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1508873696983-2df57046475a?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000012",
    asset_code: "MALLB-LLKK-001",
    location_name: "Lulu Kozhikode — Upper Ground Floor",
    asset_type: "Mall Bench",
    location_type: "Mall",
    location_code: "LLKK",
    city: "Kozhikode",
    district: "Kozhikode",
    width_ft: 8,
    height_ft: 3,
    status: "available",
    current_brand: null,
    queue_count: 0,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1581417478175-a9ef18f210c2?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000013",
    asset_code: "METRO-KMTR-001",
    location_name: "Kochi Metro — MG Road Platform 1",
    asset_type: "Metro Bench",
    location_type: "Metro",
    location_code: "MGRD",
    city: "Kochi",
    district: "Ernakulam",
    width_ft: 6,
    height_ft: 3,
    status: "available",
    current_brand: null,
    queue_count: 0,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&q=80",
  },
  {
    id: "00000000-0000-0000-0001-000000000014",
    asset_code: "METRO-KMTR-002",
    location_name: "Kochi Metro — Edappally Station",
    asset_type: "Metro Bench",
    location_type: "Metro",
    location_code: "EDPL",
    city: "Kochi",
    district: "Ernakulam",
    width_ft: 6,
    height_ft: 3,
    status: "live",
    current_brand: "FEDERAL BANK",
    queue_count: 1,
    photo_ids: [],
    photo_url: "https://images.unsplash.com/photo-1508873696983-2df57046475a?w=800&q=80",
  },
];

export function useAssets(params = {}) {
  return useQuery({
    queryKey: ["assets", params],
    queryFn: async () => {
      let assets = [];
      try {
        let q = supabase.from("assets").select("*").order("asset_code");
        if (params.status && params.status !== "all") q = q.eq("status", params.status);
        if (params.q) q = q.or(`asset_code.ilike.%${params.q}%,location_name.ilike.%${params.q}%`);
        const res = await q;
        if (!res.error && res.data && res.data.length > 0) {
          assets = res.data;
        }
      } catch {
        // Fall through to mock fallback
      }

      // If Supabase has no assets and mock user is active, use DEMO_ASSETS
      if (!assets.length && localStorage.getItem("cw_mock_user")) {
        assets = [...DEMO_ASSETS];
        if (params.status && params.status !== "all") {
          assets = assets.filter((a) => a.status === params.status);
        }
        if (params.q) {
          const lq = params.q.toLowerCase();
          assets = assets.filter(
            (a) =>
              a.asset_code.toLowerCase().includes(lq) ||
              a.location_name.toLowerCase().includes(lq) ||
              (a.city && a.city.toLowerCase().includes(lq)) ||
              (a.district && a.district.toLowerCase().includes(lq))
          );
        }
      }

      // Enrich with queue counts and live brand
      const ids = assets.map((a) => a.id);
      if (!ids.length) return [];
      let queueCounts = [];
      let liveCampaigns = [];
      let gtpCampaigns = [];

      try {
        const [qcRes, lcRes, gcRes] = await Promise.all([
          supabase.from("queue_entries").select("asset_id").in("state", ["active", "pending"]).in("asset_id", ids),
          supabase.from("campaigns").select("asset_id,brand").neq("stage", "closed").in("asset_id", ids),
          supabase.from("campaigns").select("asset_id,gtps,start_date,end_date").in("stage", ["live", "closing"]).in("asset_id", ids),
        ]);
        queueCounts = qcRes.data ?? [];
        liveCampaigns = lcRes.data ?? [];
        gtpCampaigns = gcRes.data ?? [];
      } catch {
        // Mock fallback retains its enriched fields
      }

      const today = new Date().toISOString().split("T")[0];
      const countMap = {};
      for (const e of queueCounts ?? []) countMap[e.asset_id] = (countMap[e.asset_id] ?? 0) + 1;
      const liveMap = {};
      for (const c of liveCampaigns ?? []) liveMap[c.asset_id] = c.brand;
      const gtpMap = {};
      for (const c of gtpCampaigns ?? []) {
        const pending = (c.gtps ?? []).find((g) => ["pending", "rejected"].includes(g.status));
        if (pending) {
          const days = Math.ceil((new Date(pending.due_date) - new Date(today)) / 86400000);
          gtpMap[c.asset_id] = { next_gtp_date: pending.due_date, gtp_overdue: days < 0 };
        }
      }

      return assets.map((a) => ({
        ...a,
        queue_count: countMap[a.id] ?? a.queue_count ?? 0,
        current_brand: liveMap[a.id] ?? a.current_brand ?? null,
        photo_ids: a.photo_ids ?? [],
        ...(gtpMap[a.id] ?? (a.next_gtp_date ? { next_gtp_date: a.next_gtp_date, gtp_overdue: false } : {})),
      }));
    },
    retry: false,
  });
}

export function useAsset(id) {
  return useQuery({
    queryKey: ["asset", id],
    queryFn: async () => {
      if (!id) return null;
      const asset = check(await supabase.from("assets").select("*").eq("id", id).single());
      const [{ data: campaigns }, { data: audit }, { data: queueEntries }] = await Promise.all([
        supabase.from("campaigns").select("*").eq("asset_id", id).order("created_at", { ascending: false }),
        supabase.from("audit_logs").select("*").eq("asset_id", id).order("created_at", { ascending: false }),
        supabase.from("queue_entries").select("*").eq("asset_id", id).order("created_at"),
      ]);
      return { ...asset, campaigns: campaigns ?? [], audit: audit ?? [], queue: queueEntries ?? [] };
    },
    enabled: Boolean(id),
    retry: false,
  });
}

// ── Queue ──────────────────────────────────────────────────────────────────

export function useQueueList() {
  return useQuery({
    queryKey: ["queue"],
    queryFn: async () => {
      const entries = check(
        await supabase
          .from("queue_entries")
          .select("*")
          .in("state", ["active", "pending"])
          .order("asset_code")
          .order("position"),
      );
      const today = new Date().toISOString().split("T")[0];
      return entries.map((e) => {
        let daysRemaining = null;
        let urgency = "ok";
        if (e.expires_on && e.state === "active") {
          daysRemaining = Math.ceil((new Date(e.expires_on) - new Date(today)) / 86400000);
          urgency = daysRemaining <= 1 ? "urgent" : daysRemaining <= 2 ? "warning" : "ok";
        }
        return { ...e, days_remaining: daysRemaining, urgency };
      });
    },
    retry: false,
  });
}

export function useAssetQueue(assetId) {
  return useQuery({
    queryKey: ["queue", "asset", assetId],
    queryFn: async () => {
      const entries = check(
        await supabase.from("queue_entries").select("*").eq("asset_id", assetId).order("created_at"),
      );
      const today = new Date().toISOString().split("T")[0];
      return entries.map((e) => {
        let daysRemaining = null;
        let urgency = "ok";
        if (e.expires_on && e.state === "active") {
          daysRemaining = Math.ceil((new Date(e.expires_on) - new Date(today)) / 86400000);
          urgency = daysRemaining <= 1 ? "urgent" : daysRemaining <= 2 ? "warning" : "ok";
        }
        return { ...e, days_remaining: daysRemaining, urgency };
      });
    },
    enabled: Boolean(assetId),
    retry: false,
  });
}

// ── Campaigns ──────────────────────────────────────────────────────────────

export function useCampaigns(stage) {
  return useQuery({
    queryKey: ["campaigns", stage ?? "all"],
    queryFn: async () => {
      let q = supabase.from("campaigns").select("*");
      if (stage && stage !== "all") q = q.eq("stage", stage);
      return check(await q);
    },
    retry: false,
  });
}

export function useCampaign(id) {
  return useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => {
      if (!id) return null;
      const campaign = check(await supabase.from("campaigns").select("*").eq("id", id).single());
      const { data: audit } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_id", id)
        .order("created_at", { ascending: false });
      const checklist = campaign.checklist ?? [];
      return {
        ...campaign,
        audit: audit ?? [],
        checklist_done: checklist.filter((i) => i.status === "done").length,
        checklist_total: checklist.length,
        checklist_complete: checklist.every((i) => i.status === "done"),
      };
    },
    enabled: Boolean(id),
    retry: false,
  });
}

// ── Notifications ──────────────────────────────────────────────────────────

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return { items: [], unread: 0 };
      const items = check(
        await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", authData.user.id)
          .order("created_at", { ascending: false })
          .limit(200),
      );
      return { items, unread: items.filter((i) => !i.read).length };
    },
    retry: false,
    refetchInterval: 60_000,
  });
}

// ── Audit Log ─────────────────────────────────────────────────────────────

export function useAuditLog(filters = {}) {
  return useQuery({
    queryKey: ["audit", filters],
    queryFn: async () => {
      let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      if (filters.entity_type && filters.entity_type !== "all") q = q.eq("entity_type", filters.entity_type);
      if (filters.asset_id) q = q.eq("asset_id", filters.asset_id);
      if (filters.actor_id && filters.actor_id !== "all") q = q.eq("actor_id", filters.actor_id);
      return check(await q);
    },
    retry: false,
  });
}

// ── Settings & Holidays ────────────────────────────────────────────────────

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").eq("id", "global").single();
      return data ?? { gtp_interval_days: 28, queue_active_business_days: 5, gtp_reminder_days: 5 };
    },
    retry: false,
  });
}

export function useHolidays() {
  return useQuery({
    queryKey: ["holidays"],
    queryFn: async () => check(await supabase.from("holidays").select("*").order("date")),
    retry: false,
  });
}

// ── Users & Roles ─────────────────────────────────────────────────────────

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () =>
      check(await supabase.from("profiles").select("*").order("name")),
    enabled,
    retry: false,
  });
}

export const ROLES_LIST = [
  { value: "admin", label: "Admin" },
  { value: "sales", label: "Sales" },
  { value: "ops", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "finance_manager", label: "Finance Manager" },
];

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => ROLES_LIST,
    retry: false,
  });
}

// ── Brands ────────────────────────────────────────────────────────────────

export function useBrands(q = "") {
  return useQuery({
    queryKey: ["brands", q],
    queryFn: async () => {
      let query = supabase.from("brands").select("*").order("name");
      if (q) query = query.ilike("name", `%${q}%`);
      const brands = check(await query);
      // Enrich with counts
      const ids = brands.map((b) => b.id);
      if (!ids.length) return brands;
      const [{ data: campaigns }, { data: queueEntries }] = await Promise.all([
        supabase.from("campaigns").select("brand_id,stage").in("brand_id", ids),
        supabase.from("queue_entries").select("brand_id,state").in("brand_id", ids).in("state", ["active", "pending"]),
      ]);
      return brands.map((b) => ({
        ...b,
        campaign_count: (campaigns ?? []).filter((c) => c.brand_id === b.id).length,
        live_campaigns: (campaigns ?? []).filter((c) => c.brand_id === b.id && c.stage === "live").length,
        open_queue_entries: (queueEntries ?? []).filter((e) => e.brand_id === b.id).length,
      }));
    },
    retry: false,
  });
}

export function useBrand(id) {
  return useQuery({
    queryKey: ["brand", id],
    queryFn: async () => {
      if (!id) return null;
      const brand = check(await supabase.from("brands").select("*").eq("id", id).single());
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("*")
        .eq("brand_id", id)
        .order("created_at", { ascending: false });
      return { ...brand, campaigns: campaigns ?? [] };
    },
    enabled: Boolean(id),
    retry: false,
  });
}

// ── Asset Types ───────────────────────────────────────────────────────────

export function useAssetTypes() {
  return useQuery({
    queryKey: ["asset-types"],
    queryFn: async () => {
      const types = check(await supabase.from("asset_types").select("*").order("name"));
      if (!types.length) return types;
      const { data: assets } = await supabase.from("assets").select("asset_type");
      return types.map((t) => ({
        ...t,
        asset_count: (assets ?? []).filter((a) => a.asset_type === t.name).length,
      }));
    },
    retry: false,
  });
}

