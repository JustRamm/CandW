-- ============================================================
-- Carbon & Whale · OOH-Sync — Comprehensive Database Seed Data
-- Run this in your Supabase SQL Editor to populate sample data
-- ============================================================

-- ── 1. Seed Asset Types ─────────────────────────────────────
insert into public.asset_types (id, name, location_type, default_width_ft, default_height_ft)
values
  ('00000000-0000-0000-0000-000000000001', 'Mall Bench', 'Mall', 8.0, 3.0),
  ('00000000-0000-0000-0000-000000000002', 'Metro Bench', 'Metro', 6.0, 3.0)
on conflict (name) do nothing;

-- ── 2. Seed Brands ──────────────────────────────────────────
insert into public.brands (id, name, contact_person, contact_email, contact_phone, industry, notes)
values
  ('00000000-0000-0000-0002-000000000001', 'Malabar Gold & Diamonds', 'Nikhil Varma', 'nikhil@malabargold.com', '+91 98470 12345', 'Jewellery & Retail', 'Annual regional partner'),
  ('00000000-0000-0000-0002-000000000002', 'Kalyan Jewellers', 'Pooja Menon', 'pooja.m@kalyanjewellers.net', '+91 94471 23456', 'Jewellery & Retail', 'Premium mall campaign'),
  ('00000000-0000-0000-0002-000000000003', 'Swiggy Instamart', 'Arjun Das', 'arjun.d@swiggy.in', '+91 97452 34567', 'Quick Commerce', 'High recall metro transit ads'),
  ('00000000-0000-0000-0002-000000000004', 'boAt Lifestyle', 'Rhea Kapoor', 'rhea@boat-lifestyle.com', '+91 99953 45678', 'Consumer Electronics', 'Gen-Z focused mall atrium displays'),
  ('00000000-0000-0000-0002-000000000005', 'CRED', 'Siddharth Iyer', 'siddharth@cred.club', '+91 98954 56789', 'Fintech', 'Exclusive metro network presence'),
  ('00000000-0000-0000-0002-000000000006', 'Federal Bank', 'Deepa Nair', 'deepa.nair@federalbank.co.in', '+91 94955 67890', 'Banking & BFSI', 'Festive season banking campaigns'),
  ('00000000-0000-0000-0002-000000000007', 'Amul', 'Vikram Patel', 'vikram.p@amul.coop', '+91 98466 78901', 'FMCG & Dairy', 'High footfall food court branding')
on conflict (id) do nothing;

-- ── 3. Seed Assets (Kerala Malls and Metro Network) ──────────
insert into public.assets (id, asset_code, asset_type, location_type, location_code, location_name, city, district, width_ft, height_ft, photo_url, description, status)
values
  (
    '00000000-0000-0000-0001-000000000001',
    'MALLB-CSMK-001',
    'Mall Bench',
    'Mall',
    'CSMK',
    'Center Square Mall Kochi — Ground Atrium',
    'Kochi',
    'Ernakulam',
    8.0,
    3.0,
    'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80',
    'High-visibility dual-sided recycled polymer bench in primary footfall corridor near escalators.',
    'live'
  ),
  (
    '00000000-0000-0000-0001-000000000002',
    'MALLB-LLTV-001',
    'Mall Bench',
    'Mall',
    'LLTV',
    'Lulu Mall TVM — Grand Central Atrium',
    'Thiruvananthapuram',
    'Thiruvananthapuram',
    8.0,
    3.0,
    'https://images.unsplash.com/photo-1567449303183-ae0d6ed1498e?w=800&q=80',
    'Prime atrium display opposite anchor department stores with 45,000+ daily average weekend impressions.',
    'live'
  ),
  (
    '00000000-0000-0000-0001-000000000003',
    'MALLB-HLKK-001',
    'Mall Bench',
    'Mall',
    'HLKK',
    'Hilite Kozhikode — Central Atrium',
    'Kozhikode',
    'Kozhikode',
    8.0,
    3.0,
    'https://images.unsplash.com/photo-1555421689-491a97ff2040?w=800&q=80',
    'Located in North Keralas largest shopping destination with prominent eye-level brand exposure.',
    'onboarding'
  ),
  (
    '00000000-0000-0000-0001-000000000004',
    'MALLB-SBCT-001',
    'Mall Bench',
    'Mall',
    'SBCT',
    'Shobha City Thrissur — Main Walkway',
    'Thrissur',
    'Thrissur',
    8.0,
    3.0,
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800&q=80',
    'Central walkway facing multiplex and entertainment zone.',
    'onboarding'
  ),
  (
    '00000000-0000-0000-0001-000000000005',
    'MALLB-LLKT-001',
    'Mall Bench',
    'Mall',
    'LLKT',
    'Lulu Kottayam — Ground Concourse',
    'Kottayam',
    'Kottayam',
    8.0,
    3.0,
    'https://images.unsplash.com/photo-1581417478175-a9ef18f210c2?w=800&q=80',
    'Freshly installed sustainable composite bench display in central retail spine.',
    'available'
  ),
  (
    '00000000-0000-0000-0001-000000000006',
    'MALLB-MOTT-001',
    'Mall Bench',
    'Mall',
    'MOTT',
    'MOT Trivandrum — Central Boulevard',
    'Thiruvananthapuram',
    'Thiruvananthapuram',
    8.0,
    3.0,
    'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80',
    'Mall of Travancore primary concourse near hypermarket entry.',
    'available'
  ),
  (
    '00000000-0000-0000-0001-000000000007',
    'MALLB-OBRN-001',
    'Mall Bench',
    'Mall',
    'OBRN',
    'Oberon Mall Kochi — Second Floor',
    'Kochi',
    'Ernakulam',
    8.0,
    3.0,
    'https://images.unsplash.com/photo-1567449303183-ae0d6ed1498e?w=800&q=80',
    'Second floor leisure zone outside gaming arena and food outlets.',
    'live'
  ),
  (
    '00000000-0000-0000-0001-000000000008',
    'MALLB-GKLM-001',
    'Mall Bench',
    'Mall',
    'GKLM',
    'Gokulam Mall Kozhikode — Food Court',
    'Kozhikode',
    'Kozhikode',
    8.0,
    3.0,
    'https://images.unsplash.com/photo-1555421689-491a97ff2040?w=800&q=80',
    'Direct frontage to food court seating area with high dwell time.',
    'available'
  ),
  (
    '00000000-0000-0000-0001-000000000009',
    'MALLB-MCMP-001',
    'Mall Bench',
    'Mall',
    'MCMP',
    'Market City Malappuram — West Wing',
    'Malappuram',
    'Malappuram',
    8.0,
    3.0,
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800&q=80',
    'West wing retail entrance near international apparel stores.',
    'onboarding'
  ),
  (
    '00000000-0000-0000-0001-000000000010',
    'MALLB-SCKN-001',
    'Mall Bench',
    'Mall',
    'SCKN',
    'Secura Centre Kannur — Main Concourse',
    'Kannur',
    'Kannur',
    8.0,
    3.0,
    'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&q=80',
    'Key retail thoroughfare in Kannur city center.',
    'available'
  ),
  (
    '00000000-0000-0000-0001-000000000011',
    'METRO-KMTR-001',
    'Metro Bench',
    'Metro',
    'MGRD',
    'Kochi Metro — MG Road Platform 1',
    'Kochi',
    'Ernakulam',
    6.0,
    3.0,
    'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&q=80',
    'Platform 1 Southbound commuter seating unit in high-density commercial district.',
    'available'
  ),
  (
    '00000000-0000-0000-0001-000000000012',
    'METRO-KMTR-002',
    'Metro Bench',
    'Metro',
    'EDPL',
    'Kochi Metro — Edappally Station',
    'Kochi',
    'Ernakulam',
    6.0,
    3.0,
    'https://images.unsplash.com/photo-1508873696983-2df57046475a?w=800&q=80',
    'Direct skywalk connection to Lulu Mall with continuous commuter traffic.',
    'live'
  )
on conflict (id) do nothing;

-- ── 4. Seed Kerala Holidays ──────────────────────────────────
insert into public.holidays (id, date, name)
values
  ('00000000-0000-0000-0004-000000000001', '2026-01-26', 'Republic Day'),
  ('00000000-0000-0000-0004-000000000002', '2026-04-14', 'Vishu / Dr. Ambedkar Jayanti'),
  ('00000000-0000-0000-0004-000000000003', '2026-05-01', 'May Day'),
  ('00000000-0000-0000-0004-000000000004', '2026-08-15', 'Independence Day'),
  ('00000000-0000-0000-0004-000000000005', '2026-08-27', 'Thiruvonam (Onam)'),
  ('00000000-0000-0000-0004-000000000006', '2026-10-02', 'Gandhi Jayanti'),
  ('00000000-0000-0000-0004-000000000007', '2026-11-01', 'Kerala Piravi (State Formation Day)'),
  ('00000000-0000-0000-0004-000000000008', '2026-12-25', 'Christmas')
on conflict (date) do nothing;

-- ── 5. Seed Settings ─────────────────────────────────────────
insert into public.settings (id, gtp_interval_days, queue_active_business_days, gtp_reminder_days)
values ('global', 28, 5, 5)
on conflict (id) do update
set gtp_interval_days = 28,
    queue_active_business_days = 5,
    gtp_reminder_days = 5;
