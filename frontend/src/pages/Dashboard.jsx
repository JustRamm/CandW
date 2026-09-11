import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, FileWarning, Radio } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import { StageBadge, UrgencyBadge } from "@/components/shared/StatusBadges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/skeletons";
import { useDashboard, useMe } from "@/lib/queries";
import { fmtDate } from "@/lib/helpers";
import { cn } from "@/lib/utils";

function KpiGrid({ kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="kpi-grid">
      {kpis.map((k) => (
        <Card
          key={k.label}
          className="border-border/80 bg-card shadow-xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 rounded-xl"
          data-testid={`kpi-${k.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <CardContent className="px-4 py-4">
            <p className="font-heading text-3xl font-bold tracking-tight text-foreground">{k.value}</p>
            <p className="mono-label mt-1 text-muted-foreground">{k.label}</p>
          </CardContent>
        </Card>
      ))}
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
  const { data: me, isLoading: isMeLoading } = useMe();
  const { data, isError, isLoading: isDashboardLoading } = useDashboard(me);
  const role = me?.role;
  const isLoading = isDashboardLoading || (!data && isMeLoading);

  const kpis = data?.kpis ?? [];
  const queue = data?.queue ?? [];
  const campaigns = data?.campaigns ?? [];
  const activeSlots = queue.filter((q) => q.state === "active");

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
      </div>
      )}
    </AppShell>
  );
}
