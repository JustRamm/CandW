/**
 * Carbon & Whale — Inbuilt Venue Revenue Sharing Engine
 * Maps Kerala Malls & Kochi Metro revenue split rules against billed turnover.
 */

export const REVENUE_SHARE_MATRIX = [
  { venue_name: "Hilite Calicut", venue_type: "Mall", district: "Kozhikode", share_type: "percentage", cw_share_pct: 50, party_share_pct: 50, notes: "50/50 Split on Untaxed Turnover" },
  { venue_name: "Hilite Malappuram", venue_type: "Mall", district: "Malappuram", share_type: "percentage", cw_share_pct: 50, party_share_pct: 50, notes: "50/50 Split on Untaxed Turnover" },
  { venue_name: "Hilite Thrissur", venue_type: "Mall", district: "Thrissur", share_type: "percentage", cw_share_pct: 50, party_share_pct: 50, notes: "50/50 Split on Untaxed Turnover" },
  { venue_name: "Hilite Mall Chemmad", venue_type: "Mall", district: "Malappuram", share_type: "percentage", cw_share_pct: 50, party_share_pct: 50, notes: "50/50 Split on Untaxed Turnover" },
  { venue_name: "Lulu Calicut", venue_type: "Mall", district: "Kozhikode", share_type: "percentage", cw_share_pct: 50, party_share_pct: 50, notes: "50/50 Split on Untaxed Turnover" },
  { venue_name: "Lulu Kottayam", venue_type: "Mall", district: "Kottayam", share_type: "percentage", cw_share_pct: 50, party_share_pct: 50, notes: "50/50 Split on Untaxed Turnover" },
  { venue_name: "Secura Kannur", venue_type: "Mall", district: "Kannur", share_type: "percentage", cw_share_pct: 50, party_share_pct: 50, notes: "50/50 Split on Untaxed Turnover" },
  { venue_name: "Y Mall Thrissur", venue_type: "Mall", district: "Thrissur", share_type: "percentage", cw_share_pct: 50, party_share_pct: 50, notes: "50/50 Split on Untaxed Turnover" },
  { venue_name: "Oberon Kochi", venue_type: "Mall", district: "Ernakulam", share_type: "percentage", cw_share_pct: 60, party_share_pct: 40, notes: "60% C&W / 40% Mall Split" },
  { venue_name: "Sobha City Thrissur", venue_type: "Mall", district: "Thrissur", share_type: "percentage", cw_share_pct: 60, party_share_pct: 40, notes: "60% C&W / 40% Mall Split" },
  { venue_name: "Gokulam Calicut", venue_type: "Mall", district: "Kozhikode", share_type: "percentage", cw_share_pct: 60, party_share_pct: 40, notes: "60% C&W / 40% Mall Split" },
  { venue_name: "Falcon Mall Thrissur", venue_type: "Mall", district: "Thrissur", share_type: "percentage", cw_share_pct: 60, party_share_pct: 40, notes: "60% C&W / 40% Mall Split" },
  { venue_name: "Centre Square Kochi", venue_type: "Mall", district: "Ernakulam", share_type: "percentage", cw_share_pct: 70, party_share_pct: 30, notes: "70% C&W / 30% Mall Split" },
  { venue_name: "Mall of Travancore", venue_type: "Mall", district: "Thiruvananthapuram", share_type: "percentage", cw_share_pct: 70, party_share_pct: 30, notes: "70% C&W / 30% Mall Split" },
  { venue_name: "Lulu TVM", venue_type: "Mall", district: "Thiruvananthapuram", share_type: "fixed_monthly", cw_share_pct: 0, party_share_pct: 0, fixed_monthly_fee: 100000, notes: "Fixed monthly fee of ₹1,00,000" },
  { venue_name: "Lulu Kochi", venue_type: "Mall", district: "Ernakulam", share_type: "fixed_monthly", cw_share_pct: 0, party_share_pct: 0, fixed_monthly_fee: 150000, notes: "Fixed monthly fee of ₹1,50,000" },
  { venue_name: "Metro", venue_type: "Metro", district: "Ernakulam", share_type: "percentage", cw_share_pct: 30, party_share_pct: 70, notes: "30% C&W / 70% KMRL Split" },
];

/**
 * Fuzzy matches venue name against known Kerala venues matrix.
 */
export function matchVenueRule(venueName = "", locationType = "") {
  const v = (venueName || "").toLowerCase().trim();
  const isMetro = (locationType || "").toLowerCase() === "metro" || v.includes("metro");

  if (isMetro) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Metro");
  }

  // Exact or contains match
  const matched = REVENUE_SHARE_MATRIX.find((m) => {
    const target = m.venue_name.toLowerCase();
    return v.includes(target) || target.includes(v);
  });

  if (matched) return matched;

  // Keyword fallbacks
  if (v.includes("secura") || v.includes("kannur")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Secura Kannur");
  }
  if (v.includes("centre square") || v.includes("csq")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Centre Square Kochi");
  }
  if (v.includes("travancore") || v.includes("mot")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Mall of Travancore");
  }
  if (v.includes("oberon")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Oberon Kochi");
  }
  if (v.includes("sobha")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Sobha City Thrissur");
  }
  if (v.includes("gokulam")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Gokulam Calicut");
  }
  if (v.includes("falcon")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Falcon Mall Thrissur");
  }
  if (v.includes("chemmad")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Hilite Mall Chemmad");
  }
  if (v.includes("hilite") && v.includes("malappuram")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Hilite Malappuram");
  }
  if (v.includes("hilite") && v.includes("thrissur")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Hilite Thrissur");
  }
  if (v.includes("hilite")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Hilite Calicut");
  }
  if (v.includes("lulu") && (v.includes("tvm") || v.includes("trivandrum"))) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Lulu TVM");
  }
  if (v.includes("lulu") && v.includes("kottayam")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Lulu Kottayam");
  }
  if (v.includes("lulu") && v.includes("calicut")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Lulu Calicut");
  }
  if (v.includes("lulu")) {
    return REVENUE_SHARE_MATRIX.find((m) => m.venue_name === "Lulu Kochi");
  }

  // Default fallback 50/50
  return {
    venue_name: venueName || "Other Mall",
    venue_type: "Mall",
    district: "Ernakulam",
    share_type: "percentage",
    cw_share_pct: 50,
    party_share_pct: 50,
    notes: "Default 50/50 Revenue Share",
  };
}

/**
 * Calculates Revenue Sharing split for an invoice or campaign turnover.
 */
export function calculateRevenueSplit({
  untaxedAmount = 0,
  venueName = "",
  locationType = "",
  customPartyPct = null,
}) {
  const amount = Number(untaxedAmount) || 0;
  const rule = matchVenueRule(venueName, locationType);

  if (rule.share_type === "fixed_monthly") {
    const fixedFee = rule.fixed_monthly_fee || 0;
    const netRevenue = Math.max(0, amount - fixedFee);
    return {
      venue_name: rule.venue_name,
      share_type: "fixed_monthly",
      party_share_pct: 0,
      cw_share_pct: 100,
      party_share_amount: fixedFee,
      net_revenue: netRevenue,
      fixed_monthly_fee: fixedFee,
      formula_note: `Fixed venue fee of ₹${fixedFee.toLocaleString("en-IN")}`,
    };
  }

  const partyPct = customPartyPct !== null && !isNaN(Number(customPartyPct))
    ? Number(customPartyPct)
    : rule.party_share_pct;

  const cwPct = 100 - partyPct;
  const partyShareAmount = Math.round((amount * partyPct) / 100);
  const netRevenue = Math.round((amount * cwPct) / 100);

  return {
    venue_name: rule.venue_name,
    share_type: "percentage",
    party_share_pct: partyPct,
    cw_share_pct: cwPct,
    party_share_amount: partyShareAmount,
    net_revenue: netRevenue,
    fixed_monthly_fee: 0,
    formula_note: `Sharing ${partyPct}% with ${rule.venue_name}`,
  };
}

/**
 * Calculates flexible payment milestone schedule.
 * Milestone 1: Advance (Booking stage)
 * Milestone 2: Balance (Flexible: on onboarding / net 5 / net 15 / custom PO)
 */
export function computeMilestoneSchedule({
  totalAmount = 0,
  advancePercent = 50,
  balanceTermType = "net_5_days",
  customBalanceDueDate = "",
  campaignStartDate = "",
  onboardedDate = "",
}) {
  const total = Number(totalAmount) || 0;
  const advPct = Math.min(100, Math.max(0, Number(advancePercent) || 50));
  const balPct = 100 - advPct;

  const advanceAmount = Math.round((total * advPct) / 100);
  const balanceAmount = total - advanceAmount;

  const baseDate = onboardedDate || campaignStartDate || new Date().toISOString().split("T")[0];
  const baseMs = new Date(baseDate).getTime();

  let balanceDueDate = "";
  if (balanceTermType === "on_onboarding") {
    balanceDueDate = baseDate;
  } else if (balanceTermType === "net_5_days") {
    balanceDueDate = new Date(baseMs + 5 * 86400000).toISOString().split("T")[0];
  } else if (balanceTermType === "net_15_days") {
    balanceDueDate = new Date(baseMs + 15 * 86400000).toISOString().split("T")[0];
  } else if (balanceTermType === "net_30_days") {
    balanceDueDate = new Date(baseMs + 30 * 86400000).toISOString().split("T")[0];
  } else if (balanceTermType === "custom_po") {
    balanceDueDate = customBalanceDueDate || new Date(baseMs + 15 * 86400000).toISOString().split("T")[0];
  } else {
    balanceDueDate = new Date(baseMs + 5 * 86400000).toISOString().split("T")[0];
  }

  return {
    advance: {
      percent: advPct,
      amount: advanceAmount,
      status: "pending", // 'pending' | 'received'
      received_at: null,
      payment_ref: "",
    },
    balance: {
      percent: balPct,
      amount: balanceAmount,
      term_type: balanceTermType,
      due_date: balanceDueDate,
      status: "pending", // 'pending' | 'received'
      received_at: null,
      payment_ref: "",
    },
  };
}
