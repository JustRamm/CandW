import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Building2, FileDown, Loader2, Mail, Phone, Plus, Search, Upload, User } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { BrandsSkeleton } from "@/components/skeletons";
import { Card, CardContent } from "@/components/ui/card";
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
import { useBrands, useMe } from "@/lib/queries";
import { downloadCsv, errMessage, fmtDate, importBrandsCsv } from "@/lib/helpers";
import { broadcastNotification } from "@/lib/realtime";
import sound from "@/lib/sound";

const BLANK = {
  name: "",
  contact_person: "",
  contact_email: "",
  contact_phone: "",
  industry: "",
  notes: "",
};

function BrandDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);

  const create = useMutation({
    mutationFn: async (body) => {
      const trimmedName = body.name.trim();
      const trimmedEmail = body.contact_email?.trim();
      if (!trimmedEmail) {
        throw { body: { detail: "Brand contact email is required." } };
      }
      const { data: existing } = await supabase.from("brands").select("*").ilike("name", trimmedName).maybeSingle();
      if (existing) {
        throw { body: { detail: `Brand "${existing.name}" already exists.` } };
      }
      const { data, error } = await supabase
        .from("brands")
        .insert({
          id: crypto.randomUUID(),
          ...body,
          name: trimmedName,
          contact_email: trimmedEmail,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") {
          throw { body: { detail: `Brand "${trimmedName}" already exists.` } };
        }
        throw { body: { detail: error.message } };
      }
      return data;
    },
    onSuccess: (b) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      broadcastNotification({
        key: `new_brand_${b.id}`,
        title: "New Brand Added",
        message: `${b.name} was added to the client directory.`,
        link: `/brands/${b.id}`,
        category: "brand",
        type: "success",
      });
      setForm(BLANK);
      setOpen(false);
    },
    onError: (err) => {
      sound.warning();
      toast.error(errMessage(err, "Could not create the brand"));
    },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" data-testid="add-brand-button" />}>
        <Plus className="size-4" />
        New brand
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Add a brand / customer</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(form);
          }}
          data-testid="brand-form"
        >
          <div className="space-y-1.5">
            <Label htmlFor="b-name" className="flex items-center gap-1 font-medium">
              <span>Brand name</span>
              <span className="text-destructive">*</span>
            </Label>
            <Input id="b-name" required value={form.name} onChange={set("name")} data-testid="brand-name-input" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-email" className="flex items-center gap-1 font-medium">
              <span>Brand contact email</span>
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="b-email"
              type="email"
              required
              placeholder="e.g. marketing@brand.com"
              value={form.contact_email}
              onChange={set("contact_email")}
              data-testid="brand-email-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-industry">Industry</Label>
            <Input
              id="b-industry"
              value={form.industry}
              onChange={set("industry")}
              placeholder="Retail, FMCG, Fintech…"
              data-testid="brand-industry-input"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-contact">Contact person</Label>
              <Input
                id="b-contact"
                value={form.contact_person}
                onChange={set("contact_person")}
                data-testid="brand-contact-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-phone">Phone</Label>
              <Input
                id="b-phone"
                value={form.contact_phone}
                onChange={set("contact_phone")}
                data-testid="brand-phone-input"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-notes">Notes</Label>
            <Textarea id="b-notes" rows={2} value={form.notes} onChange={set("notes")} data-testid="brand-notes-input" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending} data-testid="submit-brand-button">
              {create.isPending ? "Saving…" : "Add brand"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Brands() {
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const { data: brands, isError, isLoading } = useBrands(q);
  const canCreate = me?.role === "sales" || me?.role === "admin";
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const handleCsvImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const res = await importBrandsCsv(file);
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (res.created > 0) {
        broadcastNotification({
          title: "Brands Imported",
          message: `${res.created} new brand(s) imported to client directory.`,
          link: "/brands",
          category: "brand",
          type: "success",
        });
      }
      sound.success();
      toast.success(`Import complete: ${res.created} created, ${res.updated} updated`, {
        description: res.errors.length
          ? `${res.errors.length} row error(s):\n${res.errors.slice(0, 3).join("\n")}`
          : undefined,
      });
    } catch (err) {
      sound.warning();
      toast.error(err.message || "Failed to import brands CSV");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <AppShell
      title="Brands"
      subtitle="Customer records with contacts and the assets they have run on"
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvImport}
            className="hidden"
            data-testid="brand-csv-file-input"
          />
          {canCreate && (
            <Button
              variant="outline"
              size="xs"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
              data-testid="import-brands-button"
            >
              {importing ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
              {importing ? "Importing…" : "Import CSV"}
            </Button>
          )}
          <Button
            variant="outline"
            size="xs"
            onClick={() =>
              downloadCsv(
                "brands.csv",
                (brands ?? []).map((b) => ({
                  name: b.name,
                  contact_email: b.contact_email ?? "",
                  contact_person: b.contact_person ?? "",
                  contact_phone: b.contact_phone ?? "",
                  industry: b.industry ?? "",
                  notes: b.notes ?? "",
                  created_at: b.created_at ? fmtDate(b.created_at) : "",
                })),
              )
            }
            data-testid="export-brands-button"
          >
            <Upload className="size-3.5" />
            Export
          </Button>
          {canCreate && <BrandDialog />}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="relative sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search brands"
            className="pl-9"
            data-testid="brand-search-input"
          />
        </div>

        {isError && <EmptyState title="Brands unavailable" hint="Try again shortly." testId="brands-error-state" />}
        {isLoading && <BrandsSkeleton count={6} />}
        {!isLoading && !isError && brands?.length === 0 && (
          <EmptyState
            title="No brands yet"
            hint="Brands are created here, or automatically the first time Sales adds one to an interest queue."
            icon={Building2}
            testId="brands-empty-state"
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="brand-grid">
          {(brands ?? []).map((b) => (
            <Link key={b.id} to={`/brands/${b.id}`} data-testid={`brand-card-${b.name.replace(/\s+/g, "-")}`}>
              <Card className="h-full border-border/70 bg-card/80 transition-colors duration-200 hover:border-primary/45">
                <CardContent className="space-y-2.5 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-heading text-base font-semibold">{b.name}</p>
                      {b.industry && <p className="mono-label text-muted-foreground">{b.industry}</p>}
                    </div>
                    <Building2 className="size-4 shrink-0 text-primary" />
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {b.contact_person && (
                      <p className="flex items-center gap-1.5 truncate">
                        <User className="size-3.5 shrink-0" />
                        {b.contact_person}
                      </p>
                    )}
                    {b.contact_email && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail className="size-3.5 shrink-0" />
                        {b.contact_email}
                      </p>
                    )}
                    {b.contact_phone && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Phone className="size-3.5 shrink-0" />
                        {b.contact_phone}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="mono-label border-border/70 text-muted-foreground">
                      {b.campaign_count} campaign{b.campaign_count === 1 ? "" : "s"}
                    </Badge>
                    {b.live_campaigns > 0 && (
                      <Badge variant="outline" className="mono-label rounded-full border-emerald-200 bg-emerald-50 text-[#006d37] shadow-xs">
                        {b.live_campaigns} live
                      </Badge>
                    )}
                    {b.open_queue_entries > 0 && (
                      <Badge variant="outline" className="mono-label rounded-full border-sky-200 bg-sky-50 text-[#004c69] shadow-xs">
                        {b.open_queue_entries} in queue
                      </Badge>
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
