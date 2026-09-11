import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Building2, Copy, ExternalLink, Mail, Pencil, Phone, User } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import AuditTrail from "@/components/shared/AuditTrail";
import { AssetStatusBadge, StageBadge } from "@/components/shared/StatusBadges";
import { Button, buttonVariants } from "@/components/ui/button";
import { BrandDetailSkeleton } from "@/components/skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useBrand, useMe } from "@/lib/queries";
import { errMessage, fmtDate } from "@/lib/helpers";
import { cn } from "@/lib/utils";

function EditBrandDialog({ brand }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: brand.name,
    contact_person: brand.contact_person ?? "",
    contact_email: brand.contact_email ?? "",
    contact_phone: brand.contact_phone ?? "",
    industry: brand.industry ?? "",
    notes: brand.notes ?? "",
  });

  const save = useMutation({
    mutationFn: async (body) => {
      const { data, error } = await supabase.from("brands").update(body).eq("id", brand.id).select().single();
      if (error) throw { body: { detail: error.message } };
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand", brand.id] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Brand updated");
      setOpen(false);
    },
    onError: (err) => toast.error(errMessage(err, "Could not update the brand")),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="xs" data-testid="edit-brand-button" />}>
        <Pencil className="size-3.5" />
        Edit
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Edit {brand.name}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
          data-testid="edit-brand-form"
        >
          <div className="space-y-1.5">
            <Label htmlFor="eb-name">Brand name</Label>
            <Input id="eb-name" required value={form.name} onChange={set("name")} data-testid="edit-brand-name-input" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eb-industry">Industry</Label>
            <Input id="eb-industry" value={form.industry} onChange={set("industry")} data-testid="edit-brand-industry-input" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eb-contact">Contact person</Label>
            <Input id="eb-contact" value={form.contact_person} onChange={set("contact_person")} data-testid="edit-brand-contact-input" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eb-email">Email</Label>
              <Input id="eb-email" type="email" value={form.contact_email} onChange={set("contact_email")} data-testid="edit-brand-email-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eb-phone">Phone</Label>
              <Input id="eb-phone" value={form.contact_phone} onChange={set("contact_phone")} data-testid="edit-brand-phone-input" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eb-notes">Notes</Label>
            <Textarea id="eb-notes" rows={2} value={form.notes} onChange={set("notes")} data-testid="edit-brand-notes-input" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending} data-testid="save-brand-button">
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BrandDetail() {
  const { brandId } = useParams();
  const { data: me } = useMe();
  const { data: brand, isError, isLoading } = useBrand(brandId);
  const canEdit = me?.role === "sales" || me?.role === "admin";

  const assetById = Object.fromEntries((brand?.assets ?? []).map((a) => [a.id, a]));

  return (
    <AppShell
      title={brand?.name ?? "Brand"}
      subtitle={brand?.industry || "Customer record and asset history"}
      actions={
        <div className="flex items-center gap-1.5">
          <Link to="/brands" className={cn(buttonVariants({ variant: "outline", size: "xs" }))} data-testid="back-to-brands">
            <ArrowLeft className="size-3.5" />
            Brands
          </Link>
          {brand && (
            <Button
              variant="outline"
              size="xs"
              className="gap-1.5 text-primary border-primary/40 hover:bg-primary/10 cursor-pointer"
              onClick={() => {
                const slug = encodeURIComponent(brand.name.toLowerCase().replace(/\s+/g, "-"));
                const url = `${window.location.origin}/portal/${slug}`;
                navigator.clipboard.writeText(url);
                toast.success("Client Proof-of-Performance link copied to clipboard!");
              }}
              data-testid="copy-client-portal-button"
            >
              <Copy className="size-3.5" />
              Copy Client Link
            </Button>
          )}
          {brand && (
            <Link
              to={`/portal/${encodeURIComponent(brand.name.toLowerCase().replace(/\s+/g, "-"))}`}
              className={cn(buttonVariants({ variant: "outline", size: "xs" }), "gap-1.5 cursor-pointer")}
              data-testid="view-client-portal-button"
            >
              <ExternalLink className="size-3.5" />
              View Portal
            </Link>
          )}
          {brand && canEdit && <EditBrandDialog brand={brand} />}
        </div>
      }
    >
      {isError && <EmptyState title="Brand unavailable" hint="This brand could not be loaded." testId="brand-detail-error" />}
      {isLoading && <BrandDetailSkeleton />}

      {brand && (
        <div className="space-y-5">
          <Card className="border-border/70 bg-card/80">
            <CardContent className="px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-primary/40 bg-primary/10 p-2.5">
                  <Building2 className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-2xl font-bold tracking-tight" data-testid="brand-detail-name">
                    {brand.name}
                  </h2>
                  <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="mono-label text-muted-foreground">Contact</dt>
                      <dd className="mt-0.5 flex items-center gap-1.5" data-testid="brand-contact-person">
                        <User className="size-3.5 text-muted-foreground" />
                        {brand.contact_person || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="mono-label text-muted-foreground">Email</dt>
                      <dd className="mt-0.5 flex items-center gap-1.5 truncate" data-testid="brand-contact-email">
                        <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                        {brand.contact_email || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="mono-label text-muted-foreground">Phone</dt>
                      <dd className="mt-0.5 flex items-center gap-1.5" data-testid="brand-contact-phone">
                        <Phone className="size-3.5 text-muted-foreground" />
                        {brand.contact_phone || "—"}
                      </dd>
                    </div>
                  </dl>
                  {brand.notes && <p className="mt-3 text-xs text-muted-foreground">{brand.notes}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70" data-testid="brand-campaign-history">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-base">Campaign history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(brand.campaigns ?? []).length === 0 ? (
                <EmptyState
                  title="No campaigns yet"
                  hint="Once Finance confirms an interest entry for this brand, the campaign appears here permanently."
                  testId="brand-campaigns-empty"
                />
              ) : (
                (brand.campaigns ?? []).map((c) => (
                  <Link
                    key={c.id}
                    to={`/campaigns/${c.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 transition-colors duration-150 hover:border-primary/45"
                    data-testid="brand-campaign-row"
                  >
                    <div className="min-w-0">
                      <p className="font-heading text-sm font-medium">{c.asset_code}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {assetById[c.asset_id]?.location_name ?? "—"} · {c.duration_days} days
                        {c.start_date ? ` · ${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {assetById[c.asset_id] && <AssetStatusBadge status={assetById[c.asset_id].status} />}
                      <StageBadge stage={c.stage} />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70" data-testid="brand-queue-history">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-base">Interest queue history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {(brand.queue_entries ?? []).length === 0 ? (
                <EmptyState title="No queue entries" testId="brand-queue-empty" />
              ) : (
                (brand.queue_entries ?? []).map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-xs"
                    data-testid="brand-queue-row"
                  >
                    <span className="truncate">
                      {e.asset_code} · {e.salesperson_name} · proposed {e.proposed_duration_days}d
                      {e.proposed_start_date ? ` · from ${fmtDate(e.proposed_start_date)}` : ""}
                    </span>
                    <Badge variant="outline" className="mono-label border-border/70 text-muted-foreground">
                      {e.state}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div>
            <p className="mono-label mb-2 text-muted-foreground">Brand record changes</p>
            <AuditTrail entries={brand.audit ?? []} emptyHint="No edits recorded for this brand yet." />
          </div>
        </div>
      )}
    </AppShell>
  );
}
