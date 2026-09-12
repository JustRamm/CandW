import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardList, Download, WifiOff } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import { StageBadge } from "@/components/shared/StatusBadges";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { Button } from "@/components/ui/button";
import { CampaignsSkeleton } from "@/components/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCampaigns } from "@/lib/queries";
import { STAGE_LABELS, downloadCsv, fmtDate, fmtMoney } from "@/lib/helpers";
import { cacheCampaignsOffline, getCachedCampaignsOffline } from "@/lib/offlineStore";

const STAGES = [["all", "All stages"], ...Object.entries(STAGE_LABELS)];

export default function Campaigns() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStage = searchParams.get("stage") || "all";
  const [stage, setStage] = useState(urlStage);
  const { data: rawCampaigns, isError, isLoading } = useCampaigns(stage);
  const [offlineData, setOfflineData] = useState([]);

  useEffect(() => {
    const current = searchParams.get("stage");
    if (current && current !== stage) {
      setStage(current);
    }
  }, [searchParams]);

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
          <Download className="size-3.5" />
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

        <div className="grid gap-3 lg:grid-cols-2" data-testid="campaign-list">
          {(campaigns ?? []).map((c) => (
            <Link key={c.id} to={`/campaigns/${c.id}`} data-testid={`campaign-card-${c.asset_code}`}>
              <Card className="h-full border-border/70 bg-card/80 transition-colors duration-200 hover:border-primary/45">
                <CardContent className="space-y-2.5 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-heading text-base font-semibold">{c.brand}</p>
                      <p className="mono-label text-muted-foreground">{c.asset_code}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PriorityBadge priority={c.priority} />
                      <StageBadge stage={c.stage} />
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    {[
                      ["Duration", `${c.duration_days} days`],
                      ["Salesperson", c.salesperson_name || "—"],
                      ["Window", c.start_date ? `${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}` : "Not started"],
                      ["Invoice", c.invoice ? fmtMoney(c.invoice.total_amount) : "Pending"],
                    ].map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="mono-label text-muted-foreground">{k}</dt>
                        <dd className="mt-0.5 truncate">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {c.stage === "onboarding" && (
                      <span data-testid="campaign-checklist-progress">
                        Checklist {c.checklist_done}/{c.checklist_total}
                      </span>
                    )}
                    {c.next_due && (
                      <span className={c.overdue ? "text-red-400" : ""} data-testid="campaign-next-gtp">
                        {c.overdue ? "GTP overdue" : "Next GTP"} {fmtDate(c.next_due)}
                      </span>
                    )}
                    {c.cancellation?.status === "requested" && (
                      <span className="text-amber-400">Cancellation pending</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
