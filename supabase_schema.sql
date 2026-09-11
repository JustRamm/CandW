-- ============================================================
-- Carbon & Whale · OOH-Sync — Complete Supabase Schema Bootstrap
-- Run this in your Supabase project: SQL Editor → New query → Run
-- ============================================================

-- ── 1. Extensions ────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ── 2. Disable Email Verification Requirement in SQL ───────────
-- Auto-confirms any new signup immediately so no confirmation email is required
create or replace function public.auto_confirm_new_user()
returns trigger language plpgsql security definer as $$
begin
  new.email_confirmed_at = coalesce(new.email_confirmed_at, now());
  new.confirmed_at = coalesce(new.confirmed_at, now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_confirm on auth.users;
create trigger on_auth_user_created_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_new_user();

-- Also confirm all existing users immediately
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmed_at = coalesce(confirmed_at, now())
where email_confirmed_at is null;

-- ── 3. profiles (mirrors auth.users) ─────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  email       text not null default '',
  role        text not null default 'sales'
                check (role in ('admin','sales','ops','finance','finance_manager')),
  active      boolean not null default true,
  created_at  timestamptz default now()
);
alter table public.profiles enable row level security;

create policy "profiles: authenticated read" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles: own update" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles: admin write" on public.profiles
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── 4. settings ───────────────────────────────────────────────
create table if not exists public.settings (
  id                          text primary key default 'global',
  gtp_interval_days           integer not null default 28,
  queue_active_business_days  integer not null default 5,
  gtp_reminder_days           integer not null default 5
);
alter table public.settings enable row level security;
create policy "settings: authenticated read" on public.settings
  for select using (auth.role() = 'authenticated');
create policy "settings: admin write" on public.settings
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
insert into public.settings (id) values ('global') on conflict (id) do nothing;

-- ── 5. holidays ───────────────────────────────────────────────
create table if not exists public.holidays (
  id    uuid primary key default uuid_generate_v4(),
  date  date not null unique,
  name  text not null
);
alter table public.holidays enable row level security;
create policy "holidays: authenticated read" on public.holidays
  for select using (auth.role() = 'authenticated');
create policy "holidays: admin write" on public.holidays
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── 6. asset_types ────────────────────────────────────────────
create table if not exists public.asset_types (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null unique,
  location_type     text not null default 'Metro' check (location_type in ('Metro','Mall')),
  default_width_ft  numeric(6,2) not null default 6,
  default_height_ft numeric(6,2) not null default 3
);
alter table public.asset_types enable row level security;
create policy "asset_types: authenticated read" on public.asset_types
  for select using (auth.role() = 'authenticated');
create policy "asset_types: admin/ops write" on public.asset_types
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','ops'))
  );

-- ── 7. assets ─────────────────────────────────────────────────
create table if not exists public.assets (
  id             uuid primary key default uuid_generate_v4(),
  asset_code     text not null unique,
  asset_type     text not null,
  location_type  text,
  location_code  text not null,
  location_name  text not null,
  city           text not null default 'Ernakulam',
  district       text not null default 'Ernakulam',
  width_ft       numeric(6,2) not null default 6,
  height_ft      numeric(6,2) not null default 3,
  photo_url      text default '',
  photo_ids      jsonb default '[]',
  description    text default '',
  notes          text default '',
  status         text not null default 'available'
                 check (status in ('available','reserved','onboarding','live','closing','closed')),
  created_at     timestamptz default now()
);
alter table public.assets enable row level security;
create policy "assets: authenticated read" on public.assets
  for select using (auth.role() = 'authenticated');
create policy "assets: ops/admin write" on public.assets
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','ops'))
  );

-- ── 8. brands ─────────────────────────────────────────────────
create table if not exists public.brands (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  contact_person  text default '',
  contact_email   text default '',
  contact_phone   text default '',
  industry        text default '',
  notes           text default '',
  created_at      timestamptz default now()
);
alter table public.brands enable row level security;
create policy "brands: authenticated read" on public.brands
  for select using (auth.role() = 'authenticated');
create policy "brands: sales/admin write" on public.brands
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','sales'))
  );

-- ── 9. queue_entries ──────────────────────────────────────────
create table if not exists public.queue_entries (
  id                     uuid primary key default uuid_generate_v4(),
  asset_id               uuid not null references public.assets(id) on delete cascade,
  asset_code             text not null,
  asset_location         text not null default '',
  brand                  text not null,
  brand_id               uuid references public.brands(id),
  salesperson_id         uuid not null references public.profiles(id),
  salesperson_name       text not null,
  proposed_duration_days integer not null,
  proposed_start_date    date,
  proposed_end_date      date,
  notes                  text default '',
  state                  text not null default 'pending'
                         check (state in ('active','pending','confirmed','cancelled','expired')),
  position               integer not null default 0,
  expires_on             date,
  confirmation           jsonb,
  cancel_reason          text,
  created_at             timestamptz default now(),
  closed_at              timestamptz
);
alter table public.queue_entries enable row level security;
create policy "queue_entries: authenticated read" on public.queue_entries
  for select using (auth.role() = 'authenticated');
create policy "queue_entries: sales insert" on public.queue_entries
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','sales'))
  );
create policy "queue_entries: all update" on public.queue_entries
  for update using (auth.role() = 'authenticated');

-- ── 10. campaigns ─────────────────────────────────────────────
create table if not exists public.campaigns (
  id                     uuid primary key default uuid_generate_v4(),
  asset_id               uuid not null references public.assets(id) on delete cascade,
  asset_code             text not null,
  brand                  text not null,
  brand_id               uuid references public.brands(id),
  salesperson_id         uuid references public.profiles(id),
  salesperson_name       text not null default '',
  duration_days          integer not null,
  proposed_duration_days integer not null,
  stage                  text not null default 'onboarding'
                         check (stage in ('onboarding','invoicing','live','closing','closed')),
  priority               text not null default 'high'
                         check (priority in ('high','medium','low')),
  start_date             date,
  end_date               date,
  checklist              jsonb default '[]',
  gtps                   jsonb default '[]',
  invoice                jsonb,
  cancellation           jsonb,
  created_at             timestamptz default now()
);
alter table public.campaigns enable row level security;
create policy "campaigns: authenticated read" on public.campaigns
  for select using (auth.role() = 'authenticated');
create policy "campaigns: authenticated write" on public.campaigns
  for all using (auth.role() = 'authenticated');

-- ── 11. documents ─────────────────────────────────────────────
create table if not exists public.documents (
  id            uuid primary key default uuid_generate_v4(),
  filename      text not null,
  content_type  text not null,
  size          bigint not null default 0,
  label         text default '',
  geo           text default '',
  storage_path  text not null,
  url           text not null,
  created_at    timestamptz default now()
);
alter table public.documents enable row level security;
create policy "documents: authenticated read" on public.documents
  for select using (auth.role() = 'authenticated');
create policy "documents: authenticated insert" on public.documents
  for insert with check (auth.role() = 'authenticated');

-- ── 12. notifications ─────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  body        text not null default '',
  kind        text not null default 'info'
              check (kind in ('info','success','warning','error')),
  link        text default '',
  read        boolean not null default false,
  created_at  timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "notifications: own read" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications: authenticated insert" on public.notifications
  for insert with check (auth.role() = 'authenticated');
create policy "notifications: own update" on public.notifications
  for update using (auth.uid() = user_id);

-- ── 13. audit_logs ────────────────────────────────────────────
create table if not exists public.audit_logs (
  id           uuid primary key default uuid_generate_v4(),
  entity_type  text not null,
  entity_id    uuid,
  asset_id     uuid,
  action       text not null,
  actor_id     uuid references public.profiles(id),
  actor_name   text,
  before_data  jsonb,
  after_data   jsonb,
  doc_ids      jsonb default '[]',
  comment      text,
  created_at   timestamptz default now()
);
alter table public.audit_logs enable row level security;
create policy "audit_logs: authenticated read" on public.audit_logs
  for select using (auth.role() = 'authenticated');
create policy "audit_logs: authenticated insert" on public.audit_logs
  for insert with check (auth.role() = 'authenticated');

-- ── 14. Trigger: auto-sync user metadata to profiles ─────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, email, role, active, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'sales'),
    true,
    now()
  )
  on conflict (id) do update
  set name = coalesce(excluded.name, profiles.name),
      email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 15. Storage bucket instructions ───────────────────────────
-- Ensure you have created a public bucket named 'documents' in Supabase:
-- Supabase Dashboard → Storage → Create bucket → Name: "documents" → Toggle "Public bucket" to ON.
