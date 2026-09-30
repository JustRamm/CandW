import { useState, useMemo } from "react";
import { Download, FileSpreadsheet, Filter, Printer, Building2, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtMoney, fmtDate, downloadCsv } from "@/lib/helpers";
import { REVENUE_SHARE_MATRIX, matchVenueRule } from "@/lib/revenueShare";

export default function MallAnnexureReport({ campaigns = [], assets = [] }) {
  const [selectedMall, setSelectedMall] = useState("Secura Kannur");
  const [selectedMonth, setSelectedMonth] = useState("all");

  const venueRule = useMemo(() => {
    return matchVenueRule(selectedMall);
  }, [selectedMall]);

  // Extract all unique months from campaign data
  const availableMonths = useMemo(() => {
    const set = new Set();
    campaigns.forEach((c) => {
      const d = c.invoice?.invoice_date || c.start_date || c.created_at;
      if (d) {
        const key = d.slice(0, 7); // YYYY-MM
        set.add(key);
      }
    });
    return Array.from(set).sort().reverse();
  }, [campaigns]);

  // Filter campaigns matching the selected mall/venue and month
  const mallCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const inv = c.invoice;
      const asset = assets.find((a) => a.id === c.asset_id);
      const locName = (inv?.venue_name || asset?.location_name || c.asset_code || "").toLowerCase();
      const targetMall = selectedMall.toLowerCase();

      const matchesMall =
        locName.includes(targetMall) ||
        targetMall.includes(locName) ||
        (selectedMall === "Metro" && (locName.includes("metro") || locName.startsWith("km-")));

      if (!matchesMall) return false;

      if (selectedMonth !== "all") {
        const d = inv?.invoice_date || c.start_date || c.created_at || "";
        if (!d.startsWith(selectedMonth)) return false;
      }

      return true;
    });
  }, [campaigns, assets, selectedMall, selectedMonth]);

  // Aggregations
  const totalUntaxedTurnover = mallCampaigns.reduce((acc, c) => {
    const amt = Number(c.invoice?.untaxed_amount || c.invoice?.amount || 0);
    return acc + amt;
  }, 0);

  const totalGst = mallCampaigns.reduce((acc, c) => {
    const gst = Number(c.invoice?.gst_amount || (c.invoice?.amount ? c.invoice.amount * 0.18 : 0));
    return acc + gst;
  }, 0);

  const totalGrossInvoice = totalUntaxedTurnover + totalGst;

  const partyShareAmount = venueRule.share_type === "fixed_monthly"
    ? venueRule.fixed_monthly_fee || 0
    : Math.round((totalUntaxedTurnover * venueRule.party_share_pct) / 100);

  const netRetainedCW = Math.max(0, totalUntaxedTurnover - partyShareAmount);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = [
      "Sl No",
      "Invoice No",
      "Party",
      "Invoice Date",
      "Duration",
      "Total Revenue/Turnover (Untaxed)",
      "GST",
      "Total Invoice",
    ];

    const rows = mallCampaigns.map((c, idx) => {
      const untaxed = Number(c.invoice?.untaxed_amount || c.invoice?.amount || 0);
      const gst = Number(c.invoice?.gst_amount || (untaxed * 0.18));
      const total = untaxed + gst;
      return [
        idx + 1,
        c.invoice?.invoice_number || `CW-${c.asset_code}`,
        c.brand || "Client",
        c.invoice?.invoice_date || c.start_date || "—",
        `${c.duration_days || 30} Days`,
        untaxed,
        gst,
        total,
      ];
    });

    downloadCsv(`Annexure_${selectedMall.replace(/\s+/g, "_")}_Turnover.csv`, [headers, ...rows]);
  };

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Building2 className="size-3.5" /> Select Venue
            </span>
            <Select value={selectedMall} onValueChange={setSelectedMall}>
              <SelectTrigger className="h-8 text-xs min-w-[200px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVENUE_SHARE_MATRIX.map((m) => (
                  <SelectItem key={m.venue_name} value={m.venue_name} className="text-xs">
                    {m.venue_name} ({m.share_type === "fixed_monthly" ? `Fixed ₹${m.fixed_monthly_fee.toLocaleString()}` : `${m.party_share_pct}% share`})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3.5" /> Billing Month
            </span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8 text-xs min-w-[140px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Periods</SelectItem>
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-8 text-xs gap-1.5">
            <Download className="size-3.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={handlePrint} className="h-8 text-xs gap-1.5">
            <Printer className="size-3.5" /> Print Certificate
          </Button>
        </div>
      </div>

      {/* Official Certificate Paper Preview (Matching Annexure No. 1) */}
      <div className="rounded-xl border border-border bg-background p-6 md:p-8 shadow-sm space-y-6 font-sans">
        {/* Certificate Header */}
        <div className="border-b border-border/80 pb-4">
          <div className="inline-block px-3 py-1 rounded bg-secondary/80 text-foreground font-heading font-bold text-sm">
            {selectedMall.toUpperCase()}
          </div>
          <div className="mt-3">
            <h3 className="font-heading text-lg font-bold text-foreground tracking-tight">
              ANNEXURE FORMING PART OF CERTIFICATE
            </h3>
            <p className="text-xs font-semibold text-primary font-mono mt-0.5">
              Annexure No. 1 · Details of Turnover for the period
            </p>
          </div>
        </div>

        {/* Certificate Data Table */}
        <div className="overflow-x-auto rounded-lg border border-border/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-secondary/60 border-b border-border font-semibold text-foreground">
                <th className="py-2.5 px-3 w-12 text-center">Sl no</th>
                <th className="py-2.5 px-3">Invoice No</th>
                <th className="py-2.5 px-3">Party</th>
                <th className="py-2.5 px-3">Invoice Date</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3 text-right">Total revenue / Turnover</th>
                <th className="py-2.5 px-3 text-right">GST (18%)</th>
                <th className="py-2.5 px-3 text-right">Total invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {mallCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground italic">
                    No billed invoices found for {selectedMall} in this period.
                  </td>
                </tr>
              ) : (
                mallCampaigns.map((c, idx) => {
                  const untaxed = Number(c.invoice?.untaxed_amount || c.invoice?.amount || 0);
                  const gst = Number(c.invoice?.gst_amount || (untaxed * 0.18));
                  const total = untaxed + gst;
                  return (
                    <tr key={c.id || idx} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-primary">
                        {c.invoice?.invoice_number || `CW-${c.asset_code}`}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground">{c.brand}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {c.invoice?.invoice_date ? fmtDate(c.invoice.invoice_date) : fmtDate(c.start_date)}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{c.duration_days || 30} Days</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium">
                        ₹ {untaxed.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        ₹ {gst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        ₹ {total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
              {/* Table Total Row */}
              <tr className="bg-secondary/40 font-bold border-t-2 border-border text-foreground">
                <td colSpan={5} className="py-2.5 px-3 uppercase tracking-wider font-mono text-xs">
                  Total
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-xs">
                  ₹ {totalUntaxedTurnover.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-xs">
                  ₹ {totalGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-xs font-bold text-primary">
                  ₹ {totalGrossInvoice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Certificate Calculation Summary Cards */}
        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <div className="rounded-lg border border-border/80 bg-secondary/30 p-4 space-y-1">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Net Revenue Collected (Turnover)
            </span>
            <p className="font-heading text-xl font-bold text-foreground">
              ₹ {totalUntaxedTurnover.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Excludes 18% GST collected on behalf of government.
            </p>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-1">
            <span className="text-xs font-mono text-primary font-semibold uppercase tracking-wider">
              {selectedMall.toUpperCase()} PAYOUT
            </span>
            <p className="font-heading text-xl font-bold text-primary">
              ₹ {partyShareAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium">
              {venueRule.share_type === "fixed_monthly"
                ? `Fixed Monthly Fee Surcharge`
                : `Sharing ${venueRule.party_share_pct}% with ${selectedMall}`}
            </p>
          </div>
        </div>

        {/* C&W Net Retained & Sign-off footer */}
        <div className="border-t border-border pt-4 flex flex-wrap items-center justify-between text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Net Retained by Carbon &amp; Whale: </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              ₹ {netRetainedCW.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[11px] italic">
            Certified true copy extracted from Carbon &amp; Whale IMS Financial Ledger.
          </div>
        </div>
      </div>
    </div>
  );
}
