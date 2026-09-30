import { useMemo } from "react";
import { Building2, CalendarDays, Flame, Info, TrainFront } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { REVENUE_SHARE_MATRIX } from "@/lib/revenueShare";

export default function OccupancyHeatmap({ assets = [], campaigns = [] }) {
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

  // Group assets by venue
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

      const totalDisplays = matchingAssets.length;

      // Calculate occupancy per month
      const monthlyOccupancy = months.map((m) => {
        const monthStart = new Date(m.date.getFullYear(), m.date.getMonth(), 1).getTime();
        const monthEnd = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0).getTime();

        // Count campaigns active in this month for matching assets
        const activeInMonth = campaigns.filter((c) => {
          if (c.stage === "closed") return false;
          const matchingAsset = matchingAssets.find((a) => a.id === c.asset_id);
          if (!matchingAsset) return false;

          const cStart = new Date(c.start_date || c.created_at).getTime();
          const cEnd = new Date(c.end_date || (cStart + 30 * 86400000)).getTime();

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
        monthlyOccupancy,
      };
    });
  }, [assets, campaigns, months]);

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
            Proactive display inventory booking radar across all 16 Kerala venues.
          </p>
        </div>

        {/* Color Legend */}
        <div className="flex items-center gap-2 text-xs">
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
              <th className="py-2.5 px-3 min-w-[160px]">Venue Location</th>
              <th className="py-2.5 px-2 text-center w-16">Displays</th>
              {months.map((m) => (
                <th key={m.key} className="py-2.5 px-1.5 text-center font-mono text-[11px]">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {venues.map((v) => (
              <tr key={v.venueName} className="hover:bg-secondary/20 transition-colors">
                <td className="py-2 px-3">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    {v.venueType === "Metro" ? (
                      <TrainFront className="size-3.5 text-primary shrink-0" />
                    ) : (
                      <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{v.venueName}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground ml-5">{v.district}</span>
                </td>
                <td className="py-2 px-2 text-center font-mono text-muted-foreground">
                  {v.totalDisplays}
                </td>
                {v.monthlyOccupancy.map((mo) => (
                  <td key={mo.monthKey} className="py-2 px-1 text-center">
                    <div
                      className={cn(
                        "mx-auto w-full max-w-[52px] py-1 px-0.5 rounded-md font-mono text-[10px] font-semibold transition-all cursor-default",
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
