import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Cog, Pencil, Shapes, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useAssetTypes, useHolidays, useMe, useRoles, useSettings, useUsers } from "@/lib/queries";
import { errMessage, fmtDate } from "@/lib/helpers";

function UsersPanel() {
  const { data: users, isError } = useUsers();
  const { data: roles } = useRoles();
  const [form, setForm] = useState({ email: "", name: "", role: "sales", password: "" });

  const create = useMutation({
    mutationFn: (body) => apiPost("/admin/users", body),
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(`${u.name} invited as ${u.role_label}`);
      setForm({ email: "", name: "", role: "sales", password: "" });
    },
    onError: (err) => toast.error(errMessage(err, "Could not create the user")),
  });

  const toggle = useMutation({
    mutationFn: (id) => apiPost(`/admin/users/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
    },
    onError: (err) => toast.error(errMessage(err, "Could not update the user")),
  });

  const roleLabel = (v) => roles?.find((r) => r.value === v)?.label ?? v;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <Users className="size-4 text-primary" />
            Users
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isError && <EmptyState title="Users unavailable" testId="users-error-state" />}
          {users?.length === 0 && <EmptyState title="No users yet" testId="users-empty-state" />}
          <ul className="space-y-2" data-testid="user-list">
            {(users ?? []).map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5"
                data-testid={`user-row-${u.email}`}
              >
                <div className="min-w-0">
                  <p className="truncate font-heading text-sm font-medium">{u.name}</p>
                  <p className="mono-label truncate text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="mono-label border-primary/40 text-primary">
                    {u.role_label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      u.active
                        ? "mono-label border-emerald-800 text-emerald-300"
                        : "mono-label border-border/70 text-muted-foreground"
                    }
                  >
                    {u.active ? "active" : "disabled"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => toggle.mutate(u.id)}
                    data-testid={`toggle-user-${u.email}`}
                  >
                    {u.active ? "Disable" : "Enable"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <UserPlus className="size-4 text-primary" />
            Invite a user
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate(form);
            }}
            data-testid="invite-user-form"
          >
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Full name</Label>
              <Input
                id="u-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                data-testid="invite-name-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email</Label>
              <Input
                id="u-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                data-testid="invite-email-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="invite-role-select">
                  <SelectValue>{(v) => roleLabel(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(roles ?? []).map((r) => (
                    <SelectItem key={r.value} value={r.value} data-testid={`invite-role-option-${r.value}`}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-password">Temporary password</Label>
              <Input
                id="u-password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                data-testid="invite-password-input"
              />
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending} data-testid="submit-invite-button">
              {create.isPending ? "Inviting…" : "Create account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsPanel() {
  const { data: settings } = useSettings();
  const [form, setForm] = useState(null);
  const active = form ?? settings ?? { gtp_interval_days: 28, queue_active_business_days: 5, gtp_reminder_days: 5 };

  const save = useMutation({
    mutationFn: (body) => apiPut("/admin/settings", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Workflow settings saved");
    },
    onError: (err) => toast.error(errMessage(err, "Could not save settings")),
  });

  const set = (k) => (e) => setForm({ ...active, [k]: e.target.value });

  return (
    <Card className="max-w-md border-border/70 bg-card/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-heading text-base">
          <Cog className="size-4 text-primary" />
          Workflow configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({
              gtp_interval_days: Number(active.gtp_interval_days),
              queue_active_business_days: Number(active.queue_active_business_days),
              gtp_reminder_days: Number(active.gtp_reminder_days),
            });
          }}
          data-testid="settings-form"
        >
          <div className="space-y-1.5">
            <Label htmlFor="gtp-interval">GTP interval (days)</Label>
            <Input
              id="gtp-interval"
              type="number"
              min={1}
              value={active.gtp_interval_days}
              onChange={set("gtp_interval_days")}
              data-testid="gtp-interval-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="queue-days">Active slot hold (business days)</Label>
            <Input
              id="queue-days"
              type="number"
              min={1}
              value={active.queue_active_business_days}
              onChange={set("queue_active_business_days")}
              data-testid="queue-days-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reminder-days">GTP reminder lead time (days)</Label>
            <Input
              id="reminder-days"
              type="number"
              min={0}
              value={active.gtp_reminder_days}
              onChange={set("gtp_reminder_days")}
              data-testid="reminder-days-input"
            />
          </div>
          <Button type="submit" disabled={save.isPending} data-testid="save-settings-button">
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function HolidaysPanel() {
  const { data: holidays } = useHolidays();
  const [form, setForm] = useState({ date: "", name: "" });

  const add = useMutation({
    mutationFn: (body) => apiPost("/admin/holidays", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Holiday added — business-day math updated");
      setForm({ date: "", name: "" });
    },
    onError: (err) => toast.error(errMessage(err, "Could not add the holiday")),
  });

  const remove = useMutation({
    mutationFn: (id) => apiDelete(`/admin/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Holiday removed");
    },
    onError: (err) => toast.error(errMessage(err, "Could not remove the holiday")),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <CalendarDays className="size-4 text-primary" />
            Holiday calendar (IST)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {holidays?.length === 0 ? (
            <EmptyState
              title="No holidays configured"
              hint="Weekends are always skipped. Add public holidays so the 5-business-day queue clock is accurate."
              testId="holidays-empty-state"
            />
          ) : (
            <ul className="space-y-2" data-testid="holiday-list">
              {(holidays ?? []).map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2"
                  data-testid={`holiday-row-${h.date}`}
                >
                  <div>
                    <p className="text-sm">{h.name}</p>
                    <p className="mono-label text-muted-foreground">{fmtDate(h.date)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${h.name}`}
                    onClick={() => remove.mutate(h.id)}
                    className="text-muted-foreground hover:text-destructive"
                    data-testid={`remove-holiday-${h.date}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Add a holiday</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate(form);
            }}
            data-testid="add-holiday-form"
          >
            <div className="space-y-1.5">
              <Label htmlFor="h-date">Date</Label>
              <Input
                id="h-date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                data-testid="holiday-date-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-name">Name</Label>
              <Input
                id="h-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                data-testid="holiday-name-input"
              />
            </div>
            <Button type="submit" className="w-full" disabled={add.isPending} data-testid="submit-holiday-button">
              {add.isPending ? "Adding…" : "Add holiday"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AssetTypesPanel() {
  const { data: types } = useAssetTypes();
  const [form, setForm] = useState({
    name: "",
    location_type: "Metro",
    default_width_ft: 6,
    default_height_ft: 3,
  });
  const [editing, setEditing] = useState(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["asset-types"] });
    queryClient.invalidateQueries({ queryKey: ["assets"] });
  };

  const create = useMutation({
    mutationFn: (body) => apiPost("/asset-types", body),
    onSuccess: (t) => {
      invalidate();
      toast.success(`Asset type "${t.name}" added`);
      setForm({ name: "", location_type: "Metro", default_width_ft: 6, default_height_ft: 3 });
    },
    onError: (err) => toast.error(errMessage(err, "Could not add the asset type")),
  });

  const update = useMutation({
    mutationFn: ({ id, body }) => apiPut(`/asset-types/${id}`, body),
    onSuccess: () => {
      invalidate();
      toast.success("Asset type updated");
      setEditing(null);
    },
    onError: (err) => toast.error(errMessage(err, "Could not update the asset type")),
  });

  const remove = useMutation({
    mutationFn: (id) => apiDelete(`/asset-types/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success("Asset type deleted");
    },
    onError: (err) => toast.error(errMessage(err, "Could not delete the asset type")),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <Shapes className="size-4 text-primary" />
            Asset types
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {types?.length === 0 ? (
            <EmptyState title="No asset types" hint="Add the display types your inventory uses." testId="asset-types-empty-state" />
          ) : (
            <ul className="space-y-2" data-testid="asset-type-list">
              {(types ?? []).map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5"
                  data-testid={`asset-type-row-${t.name.replace(/\s+/g, "-")}`}
                >
                  {editing?.id === t.id ? (
                    <form
                      className="space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        update.mutate({
                          id: t.id,
                          body: {
                            name: editing.name,
                            location_type: editing.location_type,
                            default_width_ft: Number(editing.default_width_ft),
                            default_height_ft: Number(editing.default_height_ft),
                          },
                        });
                      }}
                      data-testid="edit-asset-type-form"
                    >
                      <Input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        required
                        data-testid="edit-asset-type-name-input"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Select
                          value={editing.location_type}
                          onValueChange={(v) => setEditing({ ...editing, location_type: v })}
                        >
                          <SelectTrigger size="sm" data-testid="edit-asset-type-location-select">
                            <SelectValue>{(v) => v}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {["Metro", "Mall"].map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.5"
                          value={editing.default_width_ft}
                          onChange={(e) => setEditing({ ...editing, default_width_ft: e.target.value })}
                          data-testid="edit-asset-type-width-input"
                        />
                        <Input
                          type="number"
                          step="0.5"
                          value={editing.default_height_ft}
                          onChange={(e) => setEditing({ ...editing, default_height_ft: e.target.value })}
                          data-testid="edit-asset-type-height-input"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="xs" disabled={update.isPending} data-testid="save-asset-type-button">
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => setEditing(null)}
                          data-testid="cancel-asset-type-button"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-heading text-sm font-medium">{t.name}</p>
                        <p className="mono-label text-muted-foreground">
                          {t.location_type} · {t.default_width_ft}×{t.default_height_ft} ft · {t.asset_count} asset
                          {t.asset_count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setEditing({ ...t })}
                          data-testid={`edit-asset-type-${t.name.replace(/\s+/g, "-")}`}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete ${t.name}`}
                          onClick={() => remove.mutate(t.id)}
                          className="text-muted-foreground hover:text-destructive"
                          data-testid={`delete-asset-type-${t.name.replace(/\s+/g, "-")}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">
            A type in use cannot be deleted — reassign those assets first. Renaming a type updates every
            asset that uses it.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Add an asset type</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({
                ...form,
                default_width_ft: Number(form.default_width_ft),
                default_height_ft: Number(form.default_height_ft),
              });
            }}
            data-testid="add-asset-type-form"
          >
            <div className="space-y-1.5">
              <Label htmlFor="at-name">Type name</Label>
              <Input
                id="at-name"
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Metro Pillar"
                data-testid="asset-type-name-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Location type</Label>
              <Select value={form.location_type} onValueChange={(v) => setForm((f) => ({ ...f, location_type: v }))}>
                <SelectTrigger data-testid="asset-type-location-select">
                  <SelectValue>{(v) => v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {["Metro", "Mall"].map((l) => (
                    <SelectItem key={l} value={l} data-testid={`asset-type-location-option-${l.toLowerCase()}`}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="at-w">Default width (ft)</Label>
                <Input
                  id="at-w"
                  type="number"
                  step="0.5"
                  value={form.default_width_ft}
                  onChange={(e) => setForm((f) => ({ ...f, default_width_ft: e.target.value }))}
                  data-testid="asset-type-width-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="at-h">Default height (ft)</Label>
                <Input
                  id="at-h"
                  type="number"
                  step="0.5"
                  value={form.default_height_ft}
                  onChange={(e) => setForm((f) => ({ ...f, default_height_ft: e.target.value }))}
                  data-testid="asset-type-height-input"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending} data-testid="submit-asset-type-button">
              {create.isPending ? "Adding…" : "Add asset type"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Admin() {
  const { data: me } = useMe();

  if (me && me.role !== "admin") {
    return (
      <AppShell title="Admin" subtitle="Restricted area">
        <EmptyState
          title="Admin access required"
          hint="Ask your administrator for access to user management and workflow configuration."
          testId="admin-forbidden-state"
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Administration" subtitle="Users, workflow configuration and the holiday calendar">
      <Tabs defaultValue="users">
        <TabsList variant="line" data-testid="admin-tabs">
          <TabsTrigger value="users" data-testid="tab-users">
            Users
          </TabsTrigger>
          <TabsTrigger value="asset-types" data-testid="tab-asset-types">
            Asset Types
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            Workflow
          </TabsTrigger>
          <TabsTrigger value="holidays" data-testid="tab-holidays">
            Holidays
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="pt-4">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="asset-types" className="pt-4">
          <AssetTypesPanel />
        </TabsContent>
        <TabsContent value="settings" className="pt-4">
          <SettingsPanel />
        </TabsContent>
        <TabsContent value="holidays" className="pt-4">
          <HolidaysPanel />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
