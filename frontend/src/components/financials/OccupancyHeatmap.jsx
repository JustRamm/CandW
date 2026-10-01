import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  Clock,
  ExternalLink,
  Flame,
  Layers,
  MapPin,
  Sparkles,
  TrainFront,
  User,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssetStatusBadge, StageBadge } from "@/components/shared/StatusBadges";
import { REVENUE_SHARE_MATRIX } from "@/lib/revenueShare";
import { fmtDate } from "@/lib/helpers";
import sound from "@/lib/sound";

export default function OccupancyHeatmap({ assets = [], campaigns = [], queue = [] }) {
  const [expandedVenue, setExpandedVenue] = useState(null);

  // Generate 12 upcoming months starting from current month
  const months = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const yearMonth = d.toISOString().slice(0, 7); // YYYY-MM
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      result.push({ key: yearMonth, label, date: d });
    }
    return result;
  }, []);

  // Group assets, campaigns, and queue entries by venue
  const venues = useMemo(() => {
    return REVENUE_SHARE_MATRIX.map((venue) => {
      const venueLower = venue.venue_name.toLowerCase();
      const isMetro = venue.venue_name === "Metro";

      // Match assets for this venue
      const matchingAssets = assets.filter((a) => {
        const aLoc = (a.location_name || a.location_type || a.asset_code || "").toLowerCase();
        if (isMetro) return a.location_type === "Metro" || aLoc.includes("metro") || a.asset_code.startsWith("km-");
        return aLoc.includes(venueLower) || venueLower.includes(aLoc);
      });

      const matchingAssetIds = new Set(matchingAssets.map((a) => a.id));

      // Match active and upcoming campaigns for this venue
      const venueCampaigns = campaigns.filter(
        (c) => matchingAssetIds.has(c.asset_id) && c.stage !== "closed"
      );

      // Match interest queue entries
      const venueQueue = queue.filter(
        (q) => matchingAssetIds.has(q.asset_id) && ["active", "pending"].includes(q.state)
      );

      const totalDisplays = matchingAssets.length;

      // Calculate occupancy per month
      const monthlyOccupancy = months.map((m) => {
        const monthStart = new Date(m.date.getFullYear(), m.date.getMonth(), 1).getTime();
        const monthEnd = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0).getTime();

        // Count campaigns active in this month for matching assets
        const activeInMonth = venueCampaigns.filter((c) => {
          const cStart = new Date(c.start_date || c.created_at).getTime();
          const cEnd = new Date(c.end_date || cStart + 30 * 86400000).getTime();
          return cStart <= monthEnd && cEnd >= monthStart;
        });

        const bookedCount = activeInMonth.length;
        const rate = totalDisplays > 0 ? Math.min(100, Math.round((bookedCount / totalDisplays) * 100)) : 0;

        let tier = "low"; // < 40%
        if (rate >= 80) tier = "high"; // 80 - 100%
        else if (rate >= 40) tier = "mid"; // 40 - 79%

        return {
          monthKey: m.key,
          rate,
          tier,
          bookedCount,
          totalDisplays,
        };
      });

      return {
        venueName: venue.venue_name,
        venueType: venue.venue_type,
        district: venue.district,
        totalDisplays,
        matchingAssets,
        venueCampaigns,
        venueQueue,
        monthlyOccupancy,
      };
    });
  }, [assets, campaigns, queue, months]);

  const toggleVenue = (venueName) => {
    sound.click();
    setExpandedVenue((prev) => (prev === venueName ? null : venueName));
  };

  return (
    <div className="space-y-4">
      {/* Legend & Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border/80 shadow-xs">
        <div>
          <h4 className="font-heading text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Flame className="size-4 text-amber-500" />
            12-Month Capacity Radar &amp; Occupancy Heatmap
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Click any venue row to view live display benches, active brand flights, and waitlist queues.
          </p>
        </div>

        {/* Color Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium text-[11px] border border-emerald-500/30">
            <span className="size-2 rounded-full bg-emerald-500" /> 80%–100% Occupied
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium text-[11px] border border-amber-500/30">
            <span className="size-2 rounded-full bg-amber-500" /> 40%–79% Moderate
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 font-medium text-[11px] border border-rose-500/30">
            <span className="size-2 rounded-full bg-rose-500" /> &lt;40% Vacant Danger
          </span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-secondary/60 border-b border-border text-foreground font-semibold">
              <th className="py-2.5 px-3 min-w-[180px]">Venue Location</th>
              <th className="py-2.5 px-2 text-center w-16">Displays</th>
              {months.map((m) => (
                <th key={m.key} className="py-2.5 px-1.5 text-center font-mono text-[11px]">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {venues.map((v) => {
              const isExpanded = expandedVenue === v.venueName;

              return (
                <FragmentGroup key={v.venueName}>
                  <tr
                    onClick={() => toggleVenue(v.venueName)}
                    className={cn(
                      "cursor-pointer transition-colors duration-150 select-none group",
                      isExpanded
                        ? "bg-primary/5 hover:bg-primary/10 border-b border-primary/20"
                        : "hover:bg-secondary/40"
                    )}
                    data-testid={`heatmap-venue-${v.venueName.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-primary",
                            isExpanded && "rotate-180 text-primary"
                          )}
                        />
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary/80 text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          {v.venueType === "Metro" ? (
                            <TrainFront className="size-3.5" />
                          ) : (
                            <Building2 className="size-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {v.venueName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{v.district}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-medium text-foreground">
                      <Badge variant="outline" className="mono-label text-[10px] px-1.5 py-0 border-border/70">
                        {v.totalDisplays}
                      </Badge>
                    </td>
                    {v.monthlyOccupancy.map((mo) => (
                      <td key={mo.monthKey} className="py-2 px-1 text-center">
                        <div
                          className={cn(
                            "mx-auto w-full max-w-[52px] py-1 px-0.5 rounded-md font-mono text-[10px] font-semibold transition-all",
                            mo.tier === "high" && "bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40",
                            mo.tier === "mid" && "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40",
                            mo.tier === "low" && "bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/40"
                          )}
                          title={`${v.venueName} · ${mo.monthKey}: ${mo.rate}% (${mo.bookedCount}/${mo.totalDisplays} displays)`}
                        >
                          {mo.rate}%
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Expandable In-Card Drawer Row */}
                  {isExpanded && (
                    <tr className="bg-secondary/10 border-b border-border/80">
                      <td colSpan={months.length + 2} className="p-3 sm:p-4">
                        <AnimatePresence>
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-3.5 overflow-hidden"
                          >
                            {/* Venue Drawer Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
                              <div className="flex items-center gap-2.5">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                  {v.venueType === "Metro" ? <TrainFront className="size-4" /> : <Building2 className="size-4" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-heading text-sm font-bold text-foreground">
                                      {v.venueName}
                                    </h5>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {v.district}
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {v.totalDisplays} total display units · {v.venueCampaigns.length} active campaigns · {v.venueQueue.length} waitlisted
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Link
                                  to={
                                    v.venueType === "Metro"
                                      ? `/assets?venueType=metro`
                                      : `/assets?mall=${encodeURIComponent(v.venueName)}`
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                                >
                                  <span>View in Inventory</span>
                                  <ExternalLink className="size-3" />
                                </Link>
                              </div>
                            </div>

                            {/* Two-Column Grid: Displays/Ads + Waitlist */}
                            <div className="grid gap-3 lg:grid-cols-2">
                              {/* Column 1: Live Display Units & Active Campaigns */}
                              <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-2.5 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                  <h6 className="font-heading text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Layers className="size-3.5 text-primary" />
                                    <span>Displays &amp; Active Advertisements ({v.matchingAssets.length})</span>
                                  </h6>
                                </div>

                                {v.matchingAssets.length === 0 ? (
                                  <p className="py-4 text-center text-xs text-muted-foreground">
                                    No display assets registered for this venue in the inventory yet.
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {v.matchingAssets.map((asset) => {
                                      const activeAd = v.venueCampaigns.find((c) => c.asset_id === asset.id);

                                      return (
                                        <div
                                          key={asset.id}
                                          className="rounded-lg border border-border/60 bg-secondary/20 p-2.5 transition-colors hover:border-primary/40 space-y-2"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <Link
                                              to={`/assets/${asset.id}`}
                                              className="font-heading font-semibold text-xs text-primary hover:underline flex items-center gap-1"
                                            >
                                              <span>{asset.asset_code}</span>
                                              <ArrowUpRight className="size-3 opacity-70" />
                                            </Link>
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[10px] text-muted-foreground font-mono">
                                                {asset.width_ft}×{asset.height_ft} ft
                                              </span>
                                              <AssetStatusBadge status={asset.status} className="text-[9px] px-1.5 py-0" />
                                            </div>
                                          </div>

                                          {/* Active Campaign Detail */}
                                          {activeAd ? (
                                            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs flex flex-wrap items-center justify-between gap-2">
                                              <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
                                                  <Building2 className="size-3 shrink-0" />
                                                  <Link
                                                    to={`/campaigns/${activeAd.id}`}
                                                    className="hover:underline truncate"
                                                  >
                                                    {activeAd.brand}
                                                  </Link>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                                  <Calendar className="size-3 shrink-0" />
                                                  <span>
                                                    {activeAd.start_date ? fmtDate(activeAd.start_date) : "Start"} → {activeAd.end_date ? fmtDate(activeAd.end_date) : "End"} ({activeAd.duration_days}d)
                                                  </span>
                                                </p>
                                              </div>
                                              <div className="flex items-center gap-1.5 shrink-0">
                                                <StageBadge stage={activeAd.stage} />
                                                <Link
                                                  to={`/campaigns/${activeAd.id}`}
                                                  className="inline-flex items-center justify-center size-6 rounded-md bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-700 dark:text-emerald-300 transition-colors"
                                                  title="View Campaign Flight"
                                                >
                                                  <ExternalLink className="size-3" />
                                                </Link>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/30 rounded-md px-2 py-1">
                                              <span className="flex items-center gap-1">
                                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                                Available for booking
                                              </span>
                                              <Link
                                                to={`/assets/${asset.id}`}
                                                className="text-primary hover:underline font-medium text-[10px]"
                                              >
                                                Book Display →
                                              </Link>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Column 2: Interest Queue & Waitlist */}
                              <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-2.5 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                  <h6 className="font-heading text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Clock className="size-3.5 text-primary" />
                                    <span>Interest Queue &amp; Waitlist ({v.venueQueue.length})</span>
                                  </h6>
                                </div>

                                {v.venueQueue.length === 0 ? (
                                  <div className="py-8 text-center space-y-1">
                                    <p className="text-xs text-muted-foreground font-medium">No waitlist entries</p>
                                    <p className="text-[11px] text-muted-foreground/70">
                                      All display slots for this venue are open for new bookings.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {v.venueQueue.map((entry) => (
                                      <div
                                        key={entry.id}
                                        className="rounded-lg border border-border/60 bg-secondary/20 p-2.5 text-xs space-y-1.5"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                            <Building2 className="size-3.5 text-primary shrink-0" />
                                            <span>{entry.brand}</span>
                                          </div>
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "mono-label text-[10px] px-1.5 py-0",
                                              entry.state === "active"
                                                ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-bold"
                                                : "border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10"
                                            )}
                                          >
                                            {entry.state === "active" ? "Holding Active Slot" : `Waitlist #${entry.position}`}
                                          </Badge>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground pt-0.5">
                                          <span className="flex items-center gap-1">
                                            <User className="size-3 shrink-0" />
                                            <span>Rep: {entry.salesperson_name || "Sales"}</span>
                                          </span>
                                          <span>
                                            Proposed: {entry.proposed_duration_days}d
                                            {entry.proposed_start_date ? ` from ${fmtDate(entry.proposed_start_date)}` : ""}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </td>
                    </tr>
                  )}
                </FragmentGroup>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentGroup({ children }) {
  return <>{children}</>;
}

