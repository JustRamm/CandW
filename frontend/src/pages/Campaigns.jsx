import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardList, Upload, WifiOff } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import Pagination from "@/components/shared/Pagination";
import { StageBadge } from "@/components/shared/StatusBadges";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { Button } from "@/components/ui/button";
import { CampaignsSkeleton } from "@/components/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCampaigns } from "@/lib/queries";
import { STAGE_LABELS, downloadCsv, fmtDate, fmtMoney } from "@/lib/helpers";
import { cacheCampaignsOffline, getCachedCampaignsOffline } from "@/lib/offlineStore";
import { cn } from "@/lib/utils";

const STAGES = [["all", "All stages"], ...Object.entries(STAGE_LABELS)];

export default function Campaigns() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStage = searchParams.get("stage") || "all";
  const [stage, setStage] = useState(urlStage);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const { data: rawCampaigns, isError, isLoading } = useCampaigns(stage);
  const [offlineData, setOfflineData] = useState([]);

  useEffect(() => {
    const current = searchParams.get("stage");
    if (current && current !== stage) {
      setStage(current);
    }
  }, [searchParams]);

  // Reset to page 1 on stage change
  useEffect(() => {
    setCurrentPage(1);
  }, [stage]);

  useEffect(() => {
    if (rawCampaigns?.length) {
      cacheCampaignsOffline(rawCampaigns);
    } else if (isError || !navigator.onLine) {
      getCachedCampaignsOffline().then((cached) => {
        if (stage === "all") {
          setOfflineData(cached);
        } else {
          setOfflineData(cached.filter((c) => c.stage === stage));
        }
      });
    }
  }, [rawCampaigns, isError, stage]);

  const campaigns = rawCampaigns ?? (offlineData.length > 0 ? offlineData : []);

  const paginatedCampaigns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return (campaigns ?? []).slice(start, start + pageSize);
  }, [campaigns, currentPage, pageSize]);


  return (
    <AppShell
      title="Campaigns"
      subtitle="Confirmed bookings through onboarding, invoicing, live delivery and closure"
      actions={
        <Button
          variant="outline"
          size="xs"
          onClick={() =>
            downloadCsv(
              "campaigns.csv",
              (campaigns ?? []).map((c) => ({
                asset_code: c.asset_code,
                brand: c.brand,
                stage: c.stage,
                salesperson: c.salesperson_name,
                duration_days: c.duration_days,
                proposed_days: c.proposed_duration_days,
                start_date: c.start_date ?? "",
                end_date: c.end_date ?? "",
                invoice_number: c.invoice?.invoice_number ?? "",
                invoice_total: c.invoice?.total_amount ?? "",
              })),
            )
          }
          data-testid="export-campaigns-button"
        >
          <Upload className="size-3.5" />
          Export
        </Button>
      }
    >
      <div className="space-y-4">
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-full sm:w-56" data-testid="campaign-stage-filter">
            <SelectValue>{(v) => STAGES.find(([k]) => k === v)?.[1] ?? "All stages"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STAGES.map(([k, label]) => (
              <SelectItem key={k} value={k} data-testid={`campaign-stage-option-${k}`}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isError && (
          <EmptyState title="Campaigns unavailable" hint="Try again shortly." testId="campaigns-error-state" />
        )}
        {isLoading && <CampaignsSkeleton count={4} />}
        {!isLoading && !isError && campaigns?.length === 0 && (
          <EmptyState
            title="No campaigns in this stage"
            hint="Finance Manager confirmations create campaigns from the interest queue."
            icon={ClipboardList}
            testId="campaigns-empty-state"
          />
        )}

        <div className="grid grid-cols-2 items-stretch gap-2.5 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3" data-testid="campaign-list">
          {paginatedCampaigns.map((c) => (
            <Link
              key={c.id}
              to={`/campaigns/${c.id}`}
              className="group block h-full select-none focus:outline-hidden"
              data-testid={`campaign-card-${c.asset_code}`}
            >
              <Card className="flex h-full flex-col justify-between overflow-hidden border-border/70 bg-card/80 transition-all duration-150 hover:border-primary/50 hover:bg-card hover:shadow-xs active:scale-[0.98]">
                <CardContent className="flex flex-1 flex-col justify-between gap-2 p-2.5 sm:gap-3 sm:p-4">
                  {/* Header: Brand & Asset Code + Badges */}
                  <div className="space-y-1 sm:space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-heading text-xs sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors leading-tight" title={c.brand}>
                          {c.brand}
                        </p>
                        <p className="mono-label mt-0.5 truncate text-[10px] text-muted-foreground sm:text-xs">
                          {c.asset_code}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        <PriorityBadge priority={c.priority} className="text-[9px] px-1.5 py-0 sm:text-[11px] sm:px-2 sm:py-0.5" />
                        <StageBadge stage={c.stage} className="text-[9px] px-1.5 py-0 sm:text-[11px] sm:px-2 sm:py-0.5" />
                      </div>
                    </div>

                    {/* Key Metrics */}
                    <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2 pt-1 text-[10px] sm:text-xs">
                      {[
                        ["Duration", `${c.duration_days} days`],
                        ["Salesperson", c.salesperson_name || "—"],
                        ["Window", c.start_date ? `${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}` : "Not started"],
                        ["Invoice", c.invoice ? fmtMoney(c.invoice.total_amount) : "Pending"],
                      ].map(([k, v]) => (
                        <div key={k} className="min-w-0">
                          <dt className="mono-label text-[9px] sm:text-[10px] text-muted-foreground truncate">{k}</dt>
                          <dd className="mt-0.5 truncate font-medium text-foreground">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  {/* Footer info: Checklist / GTP / Cancellation */}
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2 pt-1.5 border-t border-border/40 text-[9px] sm:text-xs text-muted-foreground">
                    {c.stage === "onboarding" && (
                      <span className="mono-label rounded-md bg-secondary/70 px-1.5 py-0.5 text-[9px] sm:text-[11px]" data-testid="campaign-checklist-progress">
                        Checklist {c.checklist_done}/{c.checklist_total}
                      </span>
                    )}
                    {c.next_due && (
                      <span className={cn("mono-label rounded-md px-1.5 py-0.5 text-[9px] sm:text-[11px]", c.overdue ? "bg-red-50 text-red-600 font-medium" : "bg-secondary/70")} data-testid="campaign-next-gtp">
                        {c.overdue ? "GTP overdue" : "Next GTP"} {fmtDate(c.next_due)}
                      </span>
                    )}
                    {c.cancellation?.status === "requested" && (
                      <span className="mono-label rounded-md bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[9px] sm:text-[11px] font-medium">
                        Cancellation pending
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {campaigns.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={campaigns.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[12, 24, 48]}
            itemLabel="campaigns"
          />
        )}
      </div>
    </AppShell>
  );
}
