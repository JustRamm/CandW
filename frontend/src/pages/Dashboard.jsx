import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  Coins,
  DollarSign,
  FileSpreadsheet,
  FileText,
  FileWarning,
  Flame,
  Layers,
  PieChart,
  Radio,
  Receipt,
  Sparkles,
  TrainFront,
  TrendingUp,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import { StageBadge, UrgencyBadge } from "@/components/shared/StatusBadges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardSkeleton } from "@/components/skeletons";
import OccupancyHeatmap from "@/components/financials/OccupancyHeatmap";
import { useDashboard, useAssets, useMe } from "@/lib/queries";
import { REVENUE_SHARE_MATRIX, matchVenueRule, calculateRevenueSplit } from "@/lib/revenueShare";
import { fmtDate, fmtMoney } from "@/lib/helpers";
import { cn } from "@/lib/utils";

function KpiGrid({ kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="kpi-grid">
      {kpis.map((k) => {
        const cardContent = (
          <Card
            className="border-border/80 bg-card shadow-xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/50 rounded-xl cursor-pointer group h-full"
            data-testid={`kpi-${k.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <CardContent className="px-4 py-4 flex flex-col justify-between h-full">
              <div>
                <p className="font-heading text-3xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                  {k.value}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="mono-label text-muted-foreground group-hover:text-foreground transition-colors">
                    {k.label}
                  </p>
                  <ArrowRight className="size-3.5 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        );

        if (k.href) {
          return (
            <Link key={k.label} to={k.href} className="block no-underline">
              {cardContent}
            </Link>
          );
        }

        return <div key={k.label}>{cardContent}</div>;
      })}
    </div>
  );
}

function Panel({ title, icon: Icon, children, testId }) {
  return (
    <Card className="border-border/80 bg-card shadow-xs rounded-xl" data-testid={testId}>
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="flex items-center gap-2 font-heading text-base font-semibold">
          {Icon && <Icon className="size-4 text-primary" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">{children}</CardContent>
    </Card>
  );
}

function CampaignRow({ campaign, note }) {
  return (
    <Link
      to={`/campaigns/${campaign.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2.5 transition-all duration-150 hover:border-primary/50 hover:bg-sky-50/50 hover:shadow-xs"
      data-testid="dashboard-campaign-row"
    >
      <div className="min-w-0">
        <p className="truncate font-heading text-sm font-semibold text-foreground hover:text-primary">{campaign.brand}</p>
        <p className="mono-label truncate text-muted-foreground">{campaign.asset_code}</p>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StageBadge stage={campaign.stage} />
        <ArrowRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("queues");
  const { data: me, isLoading: isMeLoading } = useMe();
  const { data, isError, isLoading: isDashboardLoading } = useDashboard(me);
  const { data: allAssets = [] } = useAssets();
  const role = me?.role;
  const isLoading = isDashboardLoading || (!data && isMeLoading);

  const kpis = data?.kpis ?? [];
  const queue = data?.queue ?? [];
  const campaigns = data?.campaigns ?? [];
  const activeSlots = queue.filter((q) => q.state === "active");

  // Financial aggregates & venue calculations
  const financialSummary = useMemo(() => {
    let totalBilled = 0;
    let totalCollected = 0;
    let totalPartyPayout = 0;
    let totalNetProfit = 0;

    const venueMap = {};
    REVENUE_SHARE_MATRIX.forEach((v) => {
      venueMap[v.venue_name] = {
        venueName: v.venue_name,
        venueType: v.venue_type,
        district: v.district,
        shareType: v.share_type,
        partySharePct: v.party_share_pct,
        cwSharePct: v.cw_share_pct,
        fixedMonthlyFee: v.fixed_monthly_fee || 0,
        displaysCount: 0,
        totalBilled: 0,
        totalCollected: 0,
        partyPayout: 0,
        netProfit: 0,
        activeCampaigns: 0,
      };
    });

    // Count displays per venue
    allAssets.forEach((a) => {
      const matched = matchVenueRule(a.location_name, a.location_type);
      if (matched && venueMap[matched.venue_name]) {
        venueMap[matched.venue_name].displaysCount += 1;
      }
    });

    // Aggregate campaign finances
    campaigns.forEach((c) => {
      const inv = c.invoice;
      if (!inv) return;
      const untaxed = Number(inv.untaxed_amount || inv.amount || 0);
      const gross = Number(inv.total_amount || (untaxed * 1.18) || 0);

      // Collect payments
      const adv = inv.milestones?.advance;
      const bal = inv.milestones?.balance;
      const advPaid = adv?.status === "received" ? Number(adv.amount || gross * 0.5) : 0;
      const balPaid = bal?.status === "received" ? Number(bal.amount || gross * 0.5) : 0;
      const paid = advPaid + balPaid;

      // Match venue
      const matched = matchVenueRule(inv.venue_name || c.asset_code);
      const split = calculateRevenueSplit({
        untaxedAmount: untaxed,
        venueName: matched.venue_name,
      });

      totalBilled += untaxed;
      totalCollected += paid;
      totalPartyPayout += split.party_share_amount;
      totalNetProfit += split.net_revenue;

      if (venueMap[matched.venue_name]) {
        venueMap[matched.venue_name].totalBilled += untaxed;
        venueMap[matched.venue_name].totalCollected += paid;
        venueMap[matched.venue_name].partyPayout += split.party_share_amount;
        venueMap[matched.venue_name].netProfit += split.net_revenue;
        venueMap[matched.venue_name].activeCampaigns += 1;
      }
    });

    const pendingReceivables = Math.max(0, totalBilled - totalCollected);

    return {
      totalBilled,
      totalCollected,
      pendingReceivables,
      totalPartyPayout,
      totalNetProfit,
      venues: Object.values(venueMap),
    };
  }, [campaigns, allAssets]);

  return (
    <AppShell
      title={`${me?.role_label ?? "Role"} dashboard`}
      subtitle={me ? `Signed in as ${me.name}` : "Loading workspace…"}
    >
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-5">
          {isError && (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-xs"
              data-testid="dashboard-offline-notice"
            >
              Live data is unavailable right now. Reconnect to load your work queues.
            </div>
          )}

          {/* Navigation View Switcher */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-2">
              <TabsList className="bg-secondary/40">
                <TabsTrigger value="queues" className="gap-1.5 text-xs">
                  <CalendarClock className="size-3.5" />
                  Work Queues &amp; Operations
                </TabsTrigger>
                <TabsTrigger value="financials" className="gap-1.5 text-xs">
                  <Banknote className="size-3.5 text-emerald-500" />
                  Financials &amp; Revenue Command Center
                </TabsTrigger>
                <TabsTrigger value="heatmap" className="gap-1.5 text-xs">
                  <Flame className="size-3.5 text-amber-500" />
                  12-Month Capacity Radar
                </TabsTrigger>
              </TabsList>

              <Badge variant="outline" className="mono-label text-[11px] text-muted-foreground">
                Carbon &amp; Whale v2.0
              </Badge>
            </div>

            {/* TAB 1: WORK QUEUES (DEFAULT) */}
            <TabsContent value="queues" className="space-y-5 m-0">
              {kpis.length > 0 && <KpiGrid kpis={kpis} />}

              <div className="grid gap-4 lg:grid-cols-2">
                {(role === "finance" || role === "finance_manager" || role === "admin") && (
                  <>
                    <Panel title="Confirmation queue" icon={CalendarClock} testId="panel-confirmation-queue">
                      {activeSlots.length === 0 ? (
                        <EmptyState title="No active interest slots" hint="Sales activity will surface here." />
                      ) : (
                        activeSlots.map((q) => (
                          <Link
                            key={q.id}
                            to="/queue"
                            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5 transition-colors duration-150 hover:border-primary/45"
                            data-testid="dashboard-queue-row"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-heading text-sm font-medium">{q.brand}</p>
                              <p className="mono-label truncate text-muted-foreground">
                                {q.asset_code} · {q.salesperson_name}
                              </p>
                            </div>
                            <UrgencyBadge urgency={q.urgency} daysRemaining={q.days_remaining} />
                          </Link>
                        ))
                      )}
                    </Panel>
                    <Panel title="Invoice requests" icon={FileWarning} testId="panel-invoice-requests">
                      {campaigns.filter((c) => c.stage === "invoicing").length === 0 ? (
                        <EmptyState title="No invoice requests" hint="Onboarded campaigns appear here." />
                      ) : (
                        campaigns
                          .filter((c) => c.stage === "invoicing")
                          .map((c) => <CampaignRow key={c.id} campaign={c} note="Awaiting GST invoice" />)
                      )}
                    </Panel>
                    <Panel title="GTP approvals" icon={CalendarClock} testId="panel-gtp-approvals">
                      {(data?.gtp_pending_review ?? []).length === 0 ? (
                        <EmptyState title="No GTPs awaiting review" />
                      ) : (
                        data.gtp_pending_review.map((c) => (
                          <CampaignRow
                            key={c.id}
                            campaign={c}
                            note={`${c.pending_gtps.length} submitted GTP(s) to review`}
                          />
                        ))
                      )}
                    </Panel>
                    <Panel title="Cancellation approvals" icon={AlertTriangle} testId="panel-cancellations">
                      {(data?.cancellations ?? []).length === 0 ? (
                        <EmptyState title="No cancellation requests" />
                      ) : (
                        data.cancellations.map((c) => (
                          <CampaignRow key={c.id} campaign={c} note={c.cancellation?.reason} />
                        ))
                      )}
                    </Panel>
                  </>
                )}

                {(role === "ops" || role === "admin") && (
                  <>
                    <Panel title="Onboarding tasks" icon={CalendarClock} testId="panel-onboarding-tasks">
                      {campaigns.filter((c) => c.stage === "onboarding").length === 0 ? (
                        <EmptyState title="No onboarding tasks" hint="Finance confirmations create tasks here." />
                      ) : (
                        campaigns
                          .filter((c) => c.stage === "onboarding")
                          .map((c) => (
                            <CampaignRow
                              key={c.id}
                              campaign={c}
                              note={`Checklist ${c.checklist_done}/${c.checklist_total} complete`}
                            />
                          ))
                      )}
                    </Panel>
                    <Panel title="GTPs due &amp; overdue" icon={AlertTriangle} testId="panel-gtps-due">
                      {(data?.gtps_due ?? []).length === 0 ? (
                        <EmptyState title="No GTPs due soon" />
                      ) : (
                        data.gtps_due.map((c) => (
                          <CampaignRow
                            key={c.id}
                            campaign={c}
                            note={`${c.overdue ? "Overdue since" : "Due"} ${fmtDate(c.next_due)}`}
                          />
                        ))
                      )}
                    </Panel>
                    <Panel title="Closure tasks" icon={FileWarning} testId="panel-closure-tasks">
                      {campaigns.filter((c) => c.stage === "closing").length === 0 ? (
                        <EmptyState title="No closure tasks" />
                      ) : (
                        campaigns
                          .filter((c) => c.stage === "closing")
                          .map((c) => <CampaignRow key={c.id} campaign={c} note="Final GTP required" />)
                      )}
                    </Panel>
                  </>
                )}

                {(role === "sales" || role === "admin") && (
                  <>
                    <Panel title="My interest queue" icon={CalendarClock} testId="panel-my-queue">
                      {queue.filter((q) => q.salesperson_id === me?.id).length === 0 ? (
                        <EmptyState
                          title="You have no queue entries"
                          hint="Open Assets and add a brand to an available asset."
                        />
                      ) : (
                        queue
                          .filter((q) => q.salesperson_id === me?.id)
                          .map((q) => (
                            <div
                              key={q.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5"
                              data-testid="dashboard-my-queue-row"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-heading text-sm font-medium">{q.brand}</p>
                                <p className="mono-label truncate text-muted-foreground">
                                  {q.asset_code} ·{" "}
                                  {q.state === "active" ? "ACTIVE SLOT" : `WAITLIST #${q.position}`}
                                </p>
                              </div>
                              <UrgencyBadge urgency={q.urgency} daysRemaining={q.days_remaining} />
                            </div>
                          ))
                      )}
                    </Panel>
                    <Panel title="Live inventory" icon={Radio} testId="panel-live-inventory">
                      {campaigns.filter((c) => c.stage === "live").length === 0 ? (
                        <EmptyState title="Nothing live yet" />
                      ) : (
                        campaigns
                          .filter((c) => c.stage === "live")
                          .map((c) => (
                            <CampaignRow key={c.id} campaign={c} note={`Ends ${fmtDate(c.end_date)}`} />
                          ))
                      )}
                    </Panel>
                  </>
                )}
              </div>

              <Card className="border-border/70 bg-card/70" data-testid="asset-summary-card">
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-base font-semibold">Inventory at a glance</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  {Object.entries(data?.asset_summary ?? {}).map(([k, v]) => (
                    <Badge
                      key={k}
                      variant="outline"
                      className="mono-label border-border/70 bg-secondary/40"
                      data-testid={`asset-summary-${k}`}
                    >
                      {k}: {v}
                    </Badge>
                  ))}
                  <Link to="/assets" className={cn(buttonVariants({ variant: "outline", size: "xs" }), "ml-auto")}>
                    Browse assets
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: FINANCIAL CONTROL & COMMAND CENTER */}
            <TabsContent value="financials" className="space-y-5 m-0">
              {/* 4 Core Financial KPI Cards */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card className="border-border/80 bg-card shadow-xs rounded-xl p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase font-mono tracking-wider flex items-center justify-between">
                    <span>Total Contract Billed</span>
                    <Receipt className="size-4 text-primary" />
                  </p>
                  <p className="font-heading text-2xl font-bold text-foreground mt-2">
                    {fmtMoney(financialSummary.totalBilled)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Gross billed turnover across active campaigns
                  </p>
                </Card>

                <Card className="border-border/80 bg-card shadow-xs rounded-xl p-4">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase font-mono tracking-wider flex items-center justify-between">
                    <span>Cash Collected</span>
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </p>
                  <p className="font-heading text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                    {fmtMoney(financialSummary.totalCollected)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Cleared bank balance from advances &amp; settlements
                  </p>
                </Card>

                <Card className="border-border/80 bg-card shadow-xs rounded-xl p-4">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase font-mono tracking-wider flex items-center justify-between">
                    <span>Pending Receivables</span>
                    <Coins className="size-4 text-amber-600 dark:text-amber-400" />
                  </p>
                  <p className="font-heading text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                    {fmtMoney(financialSummary.pendingReceivables)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Uncollected balance due on scheduled milestones
                  </p>
                </Card>

                <Card className="border-primary/40 bg-primary/5 shadow-xs rounded-xl p-4">
                  <p className="text-xs font-medium text-primary uppercase font-mono tracking-wider flex items-center justify-between">
                    <span>Net C&amp;W Profit</span>
                    <Sparkles className="size-4 text-primary" />
                  </p>
                  <p className="font-heading text-2xl font-bold text-primary mt-2">
                    {fmtMoney(financialSummary.totalNetProfit)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Retained after mall &amp; metro revenue sharing
                  </p>
                </Card>
              </div>

              {/* Mall-by-Mall Revenue & Payout Matrix */}
              <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div>
                    <CardTitle className="font-heading text-base font-semibold flex items-center gap-2">
                      <Building2 className="size-4 text-primary" />
                      Venue-by-Venue Revenue Sharing &amp; Net Profit Matrix
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Breakdown of contract values, mall/metro share payouts, and net earnings across Kerala.
                    </p>
                  </div>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-secondary/50 border-b border-border text-foreground font-semibold">
                        <th className="py-2.5 px-3">Venue / Mall Name</th>
                        <th className="py-2.5 px-2 text-center">Displays</th>
                        <th className="py-2.5 px-3 text-right">Billed Turnover</th>
                        <th className="py-2.5 px-2 text-center">Share Rule</th>
                        <th className="py-2.5 px-3 text-right">Party Payout</th>
                        <th className="py-2.5 px-3 text-right font-bold text-primary">Net C&amp;W Profit</th>
                        <th className="py-2.5 px-3 text-right">Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {financialSummary.venues.map((v) => (
                        <tr key={v.venueName} className="hover:bg-secondary/20 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                              {v.venueType === "Metro" ? (
                                <TrainFront className="size-3.5 text-primary shrink-0" />
                              ) : (
                                <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span>{v.venueName}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground ml-5">{v.district}</span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-muted-foreground">
                            {v.displaysCount}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium">
                            {fmtMoney(v.totalBilled)}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <Badge variant="outline" className="text-[10px] py-0">
                              {v.shareType === "fixed_monthly"
                                ? `Fixed ₹${v.fixedMonthlyFee.toLocaleString()}`
                                : `${v.partySharePct}% / ${v.cwSharePct}%`}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            {fmtMoney(v.partyPayout)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-primary">
                            {fmtMoney(v.netProfit)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                            {fmtMoney(v.totalCollected)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>

            {/* TAB 3: 12-MONTH OCCUPANCY HEATMAP */}
            <TabsContent value="heatmap" className="space-y-5 m-0">
              <OccupancyHeatmap assets={allAssets} campaigns={campaigns} queue={queue} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AppShell>
  );
}
