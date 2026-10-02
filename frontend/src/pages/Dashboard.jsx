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

function ExecutivePulseGrid({ kpis, enrichedCampaigns, allAssets, queue, data }) {
  const liveCount = enrichedCampaigns.filter((c) => c.stage === "live").length;
  const availableCount = allAssets.filter((a) => a.status === "available").length;
  const overdueCount = enrichedCampaigns.filter((c) => c.overdue).length;
  const dueSoonCount = (data?.gtps_due ?? []).length;
  const closureCount = enrichedCampaigns.filter((c) => c.stage === "closing").length;
  const invoiceCount = enrichedCampaigns.filter((c) => c.stage === "invoicing").length;
  const totalActionCount = overdueCount + dueSoonCount + closureCount + invoiceCount;
  const activeSlotsCount = queue.filter((q) => q.state === "active").length;
  const waitlistCount = queue.filter((q) => q.state === "pending").length;

  const pulseCards = [
    {
      label: "Live Campaigns",
      value: liveCount,
      subtext: `${liveCount} active OOH flights`,
      icon: Radio,
      color: "emerald",
      badge: "LIVE",
      href: "/campaigns?stage=live",
      testId: "kpi-live-campaigns",
    },
    {
      label: "Available Displays",
      value: availableCount,
      subtext: `Out of ${allAssets.length} total inventory`,
      icon: Layers,
      color: "sky",
      badge: "READY",
      href: "/assets?status=available",
      testId: "kpi-available-assets",
    },
    {
      label: "Action Needed",
      value: totalActionCount,
      subtext: overdueCount > 0 ? `${overdueCount} overdue GTPs require attention` : `${dueSoonCount} due soon · ${closureCount} closing`,
      icon: totalActionCount > 0 ? AlertTriangle : CheckCircle2,
      color: overdueCount > 0 ? "rose" : totalActionCount > 0 ? "amber" : "emerald",
      badge: overdueCount > 0 ? "URGENT" : totalActionCount > 0 ? "PENDING" : "ON TRACK",
      href: "/campaigns",
      testId: "kpi-action-needed",
    },
    {
      label: "Queue Allocations",
      value: activeSlotsCount,
      subtext: `${waitlistCount} brand(s) in waitlist`,
      icon: CalendarClock,
      color: "indigo",
      badge: activeSlotsCount > 0 ? "ACTIVE" : "OPEN",
      href: "/queue",
      testId: "kpi-active-slots",
    },
  ];

  return (
    <div className="space-y-3" data-testid="kpi-grid">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {pulseCards.map((c) => {
          const Icon = c.icon;
          const isRose = c.color === "rose";
          const isAmber = c.color === "amber";
          const isEmerald = c.color === "emerald";
          const isIndigo = c.color === "indigo";

          return (
            <Link
              key={c.label}
              to={c.href}
              className="block no-underline group"
              data-testid={c.testId}
            >
              <Card
                className={cn(
                  "border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-3.5 h-full flex flex-col justify-between relative overflow-hidden",
                  isRose && "border-rose-200/80 bg-rose-50/30 dark:bg-rose-950/10 hover:border-rose-400",
                  isAmber && "border-amber-200/80 bg-amber-50/30 dark:bg-amber-950/10 hover:border-amber-400",
                  isEmerald && "border-emerald-200/80 bg-emerald-50/30 dark:bg-emerald-950/10 hover:border-emerald-400",
                  isIndigo && "border-indigo-200/80 bg-indigo-50/30 dark:bg-indigo-950/10 hover:border-indigo-400",
                  !isRose && !isAmber && !isEmerald && !isIndigo && "border-border/80 bg-card hover:border-primary/50"
                )}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className={cn(
                        "size-6 rounded-md flex items-center justify-center shrink-0",
                        isRose && "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400",
                        isAmber && "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
                        isEmerald && "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
                        isIndigo && "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
                        !isRose && !isAmber && !isEmerald && !isIndigo && "bg-primary/10 text-primary"
                      )}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground truncate uppercase font-mono tracking-wider">
                      {c.label}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] px-1.5 py-0 font-mono font-medium shrink-0",
                      isRose && "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/50",
                      isAmber && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/50",
                      isEmerald && "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50",
                      isIndigo && "border-indigo-300 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50"
                    )}
                  >
                    {c.badge}
                  </Badge>
                </div>

                <div className="mt-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                      {c.value}
                    </span>
                    <ArrowRight className="size-3.5 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 text-primary" />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {c.subtext}
                  </p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children, testId, badge, badgeColor }) {
  return (
    <Card className="border-border/80 bg-card shadow-xs rounded-xl overflow-hidden" data-testid={testId}>
      <CardHeader className="py-2.5 px-3.5 border-b border-border/50 bg-secondary/20 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 font-heading text-xs sm:text-sm font-semibold text-foreground">
          {Icon && <Icon className="size-3.5 text-primary" />}
          <span>{title}</span>
        </CardTitle>
        {badge !== undefined && (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] py-0 px-1.5 font-mono",
              badgeColor === "rose" && "border-rose-300 text-rose-600 bg-rose-50/50",
              badgeColor === "amber" && "border-amber-300 text-amber-600 bg-amber-50/50",
              badgeColor === "emerald" && "border-emerald-300 text-emerald-600 bg-emerald-50/50",
              !badgeColor && "border-border text-muted-foreground"
            )}
          >
            {badge}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-2 p-3">{children}</CardContent>
    </Card>
  );
}

function CampaignRow({ campaign, note }) {
  return (
    <Link
      to={`/campaigns/${campaign.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 transition-all duration-150 hover:border-primary/50 hover:bg-sky-50/40 hover:shadow-xs"
      data-testid="dashboard-campaign-row"
    >
      <div className="min-w-0">
        <p className="truncate font-heading text-xs sm:text-sm font-semibold text-foreground hover:text-primary">
          {campaign.brand}
        </p>
        <p className="mono-label truncate text-[11px] text-muted-foreground">{campaign.asset_code}</p>
        {note && <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StageBadge stage={campaign.stage} />
        <ArrowRight className="size-3.5 text-muted-foreground" />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("queues");
  const [queueFilter, setQueueFilter] = useState("all");
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

  // Counts for workflow domain badges
  const opsTasksCount = (data?.gtps_due?.length || 0) + campaigns.filter((c) => c.stage === "onboarding" || c.stage === "closing").length;
  const financeTasksCount = activeSlots.length + campaigns.filter((c) => c.stage === "invoicing").length + (data?.gtp_pending_review?.length || 0) + (data?.cancellations?.length || 0);
  const salesTasksCount = queue.length;
  const totalTasksCount = opsTasksCount + financeTasksCount + salesTasksCount;

  return (
    <AppShell
      title={`${me?.role_label ?? "Role"} dashboard`}
      subtitle={me ? `Signed in as ${me.name}` : "Loading workspace…"}
    >
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-4">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 pb-2.5">
              <div className="overflow-x-auto scrollbar-none">
                <TabsList className="bg-secondary/60 p-1 rounded-xl h-auto flex flex-nowrap shrink-0">
                  <TabsTrigger value="queues" className="gap-1.5 text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-xs">
                    <CalendarClock className="size-3.5 text-primary" />
                    <span>Operations &amp; Queues</span>
                  </TabsTrigger>
                  <TabsTrigger value="financials" className="gap-1.5 text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-xs">
                    <Banknote className="size-3.5 text-emerald-500" />
                    <span>Financial Command</span>
                  </TabsTrigger>
                  <TabsTrigger value="heatmap" className="gap-1.5 text-xs py-1.5 px-3 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-xs">
                    <Flame className="size-3.5 text-amber-500" />
                    <span>12-Month Radar</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* TAB 1: WORK QUEUES (DEFAULT) */}
            <TabsContent value="queues" className="space-y-4 m-0">
              {/* Executive Pulse 4-card grid */}
              <ExecutivePulseGrid
                kpis={kpis}
                enrichedCampaigns={campaigns}
                allAssets={allAssets}
                queue={queue}
                data={data}
              />

              {/* Multi-role Filter Bar for Admin */}
              {role === "admin" && (
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 pt-1">
                  {[
                    { id: "all", label: "All Tasks", count: totalTasksCount },
                    { id: "ops", label: "Operations", count: opsTasksCount },
                    { id: "finance", label: "Finance", count: financeTasksCount },
                    { id: "sales", label: "Sales & Slots", count: salesTasksCount },
                  ].map((tab) => (
                    <Button
                      key={tab.id}
                      type="button"
                      variant={queueFilter === tab.id ? "default" : "outline"}
                      size="xs"
                      onClick={() => setQueueFilter(tab.id)}
                      className={cn(
                        "rounded-lg text-xs h-7 gap-1.5 shrink-0 transition-all",
                        queueFilter === tab.id
                          ? "bg-primary text-primary-foreground font-medium shadow-xs"
                          : "text-muted-foreground hover:text-foreground bg-card"
                      )}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                          queueFilter === tab.id
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {tab.count}
                      </span>
                    </Button>
                  ))}
                </div>
              )}

              <div className="grid gap-3.5 lg:grid-cols-2">
                {/* FINANCE PANELS */}
                {(role === "finance" || role === "finance_manager" || role === "admin") &&
                  (queueFilter === "all" || queueFilter === "finance") && (
                    <>
                      <Panel
                        title="Confirmation queue"
                        icon={CalendarClock}
                        testId="panel-confirmation-queue"
                        badge={activeSlots.length}
                        badgeColor={activeSlots.length > 0 ? "amber" : undefined}
                      >
                        {activeSlots.length === 0 ? (
                          <EmptyState title="No active interest slots" hint="Sales activity will surface here." />
                        ) : (
                          activeSlots.map((q) => (
                            <Link
                              key={q.id}
                              to="/queue"
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 transition-colors duration-150 hover:border-primary/45 hover:bg-sky-50/40"
                              data-testid="dashboard-queue-row"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-heading text-xs sm:text-sm font-medium">{q.brand}</p>
                                <p className="mono-label truncate text-[11px] text-muted-foreground">
                                  {q.asset_code} · {q.salesperson_name}
                                </p>
                              </div>
                              <UrgencyBadge urgency={q.urgency} daysRemaining={q.days_remaining} />
                            </Link>
                          ))
                        )}
                      </Panel>

                      <Panel
                        title="Invoice requests"
                        icon={FileWarning}
                        testId="panel-invoice-requests"
                        badge={campaigns.filter((c) => c.stage === "invoicing").length}
                        badgeColor={campaigns.filter((c) => c.stage === "invoicing").length > 0 ? "amber" : undefined}
                      >
                        {campaigns.filter((c) => c.stage === "invoicing").length === 0 ? (
                          <EmptyState title="No invoice requests" hint="Onboarded campaigns appear here." />
                        ) : (
                          campaigns
                            .filter((c) => c.stage === "invoicing")
                            .map((c) => <CampaignRow key={c.id} campaign={c} note="Awaiting GST invoice" />)
                        )}
                      </Panel>

                      <Panel
                        title="GTP approvals"
                        icon={CalendarClock}
                        testId="panel-gtp-approvals"
                        badge={(data?.gtp_pending_review ?? []).length}
                        badgeColor={(data?.gtp_pending_review ?? []).length > 0 ? "amber" : undefined}
                      >
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

                      <Panel
                        title="Cancellation approvals"
                        icon={AlertTriangle}
                        testId="panel-cancellations"
                        badge={(data?.cancellations ?? []).length}
                        badgeColor={(data?.cancellations ?? []).length > 0 ? "rose" : undefined}
                      >
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

                {/* OPERATIONS PANELS */}
                {(role === "ops" || role === "admin") &&
                  (queueFilter === "all" || queueFilter === "ops") && (
                    <>
                      <Panel
                        title="GTPs due &amp; overdue"
                        icon={AlertTriangle}
                        testId="panel-gtps-due"
                        badge={(data?.gtps_due ?? []).length}
                        badgeColor={(data?.gtps_due ?? []).some((c) => c.overdue) ? "rose" : (data?.gtps_due ?? []).length > 0 ? "amber" : undefined}
                      >
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

                      <Panel
                        title="Onboarding tasks"
                        icon={CalendarClock}
                        testId="panel-onboarding-tasks"
                        badge={campaigns.filter((c) => c.stage === "onboarding").length}
                      >
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

                      <Panel
                        title="Closure tasks"
                        icon={FileWarning}
                        testId="panel-closure-tasks"
                        badge={campaigns.filter((c) => c.stage === "closing").length}
                        badgeColor={campaigns.filter((c) => c.stage === "closing").length > 0 ? "amber" : undefined}
                      >
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

                {/* SALES PANELS */}
                {(role === "sales" || role === "admin") &&
                  (queueFilter === "all" || queueFilter === "sales") && (
                    <>
                      <Panel
                        title="My interest queue"
                        icon={CalendarClock}
                        testId="panel-my-queue"
                        badge={queue.filter((q) => q.salesperson_id === me?.id).length}
                      >
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
                                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2"
                                data-testid="dashboard-my-queue-row"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-heading text-xs sm:text-sm font-medium">{q.brand}</p>
                                  <p className="mono-label truncate text-[11px] text-muted-foreground">
                                    {q.asset_code} ·{" "}
                                    {q.state === "active" ? "ACTIVE SLOT" : `WAITLIST #${q.position}`}
                                  </p>
                                </div>
                                <UrgencyBadge urgency={q.urgency} daysRemaining={q.days_remaining} />
                              </div>
                            ))
                        )}
                      </Panel>

                      <Panel
                        title="Live inventory"
                        icon={Radio}
                        testId="panel-live-inventory"
                        badge={campaigns.filter((c) => c.stage === "live").length}
                        badgeColor="emerald"
                      >
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

              {/* Clean Inventory Snapshot */}
              <Card className="border-border/70 bg-card shadow-xs rounded-xl" data-testid="asset-summary-card">
                <CardHeader className="py-2.5 px-3.5 border-b border-border/50 flex flex-row items-center justify-between">
                  <CardTitle className="font-heading text-xs sm:text-sm font-semibold flex items-center gap-2">
                    <Layers className="size-3.5 text-primary" />
                    <span>Inventory at a Glance</span>
                  </CardTitle>
                  <Link to="/assets" className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "h-6 text-xs gap-1 text-primary hover:text-primary")}>
                    <span>Browse assets</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </CardHeader>
                <CardContent className="p-3 flex flex-wrap items-center gap-2">
                  {Object.entries(data?.asset_summary ?? {}).map(([k, v]) => (
                    <Badge
                      key={k}
                      variant="outline"
                      className="mono-label text-xs border-border/70 bg-secondary/40 py-1 px-2.5"
                      data-testid={`asset-summary-${k}`}
                    >
                      <span className="capitalize">{k}</span>: <strong className="ml-1 text-foreground">{v}</strong>
                    </Badge>
                  ))}
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
