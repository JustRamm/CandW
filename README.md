<div align="center">

<img src="./frontend/public/brand/logo.svg" alt="Carbon & Whale Logo" width="280" height="auto" />

# Carbon & Whale · OOH-Sync

### Out-Of-Home (OOH) Asset Inventory Management System (IMS)

*A specialized, role-governed platform designed for high-density transit metro networks and retail mall bench advertising assets.*

[![React 19](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC.svg)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase_%2F_PostgreSQL-3ECF8E.svg)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-slate.svg)](#)

---

</div>

## 📌 Overview

**Carbon & Whale · OOH-Sync** replaces fragmented spreadsheets, manual reservation slips, and disconnected chat threads with a single source of truth for transit and retail OOH media networks. 

It manages the complete advertising asset lifecycle: transparent interest slot queuing with business-day expiries, conflict-free booking confirmations, field operations geo-tagged proof-of-posting (GTP), and an immutable financial and operational audit trail.

---

## 🚀 Key Features

### 🏢 Asset Inventory Management
- **Asset Directory**: Granular inventory registry for metro concourses, platform benches, station pillars, and shopping mall interior assets.
- **Physical Specifications**: Tracks physical dimensions (W × H in feet), illumination status (backlit, frontlit, non-lit), rate cards, and location codes.
- **Visual Galleries**: Multi-photo asset showcases and slideshow previews for client proposals and field inspections.

### ⏱️ Transparent Interest Queue & Conflict Resolution
- **Interest Queues**: Per-asset visible interest queues for Sales agents with automated slot ranking.
- **Business-Day Expiry Engine**: Automatic expiry timers based on official operational working days (skipping weekends and statutory holidays).
- **Graceful Bump & Promotion**: Auto-promotes waitlisted brands upon slot forfeiture or expiration.

### 📋 End-to-End Campaign Lifecycle
- **Stage Progression**: Multi-step state machine: `Draft` ➔ `Onboarding` ➔ `Invoicing` ➔ `GTP Review` ➔ `Live` ➔ `Completed`.
- **Creative & Production Checklist**: Pre-flight checks for client creatives, print specs, mounting approvals, and electrical sign-offs.
- **Financial Controls**: Invoicing records, payment terms, and campaign booking value tracking.

### 📸 Geo-Tagged Proof (GTP) Verification
- **Field Ops Uploads**: On-site photographic proof capture with timestamp and geo-location metadata.
- **QA & Sign-off**: Operations review and approval before client presentation, ensuring strict delivery compliance.

### 🛡️ Role-Based Access Control (RBAC)
- **Sales**: Browse inventory, create interest slots, register brands, and initiate booking requests.
- **Operations (Ops)**: Manage mounting, creative checklists, photo inspection, and GTP verification.
- **Finance & Finance Manager**: Confirm booking holds, review invoices, authorize campaign execution, and approve exceptions.
- **System Administrator**: Full user administration, role assignment, asset category definitions, and holiday calendar scheduling.

### 📜 Tamper-Proof Audit Trail
- **Immutable Ledger**: Append-only log recording every status alteration, queue shift, proof submission, and administrative change.
- **CSV Export**: Instant one-click exports for accounting reconciliation and client compliance reporting.

### ✨ Shimmer Skeleton Loading Suite
- **Screen-Specific Skeletons**: Tailored skeleton loading animations for every screen (`Dashboard`, `Assets`, `AssetDetail`, `Queue`, `Campaigns`, `CampaignDetail`, `Brands`, `BrandDetail`, `Audit`, `Admin`).
- **Smooth Wave Shimmer**: High-fidelity animated gradients matching the real screen layout to eliminate cumulative layout shift (CLS).

---

## 🏗️ Tech Stack

- **Frontend**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **State & Queries**: [@tanstack/react-query v5](https://tanstack.com/query/latest)
- **Routing**: [React Router DOM v7](https://reactrouter.com/)
- **Icons & Typography**: [Lucide React](https://lucide.dev/), [Inter Variable](https://fontsource.org/fonts/inter), [JetBrains Mono Variable](https://fontsource.org/fonts/jetbrains-mono)
- **Notifications**: [Sonner](https://sonner.emilkowal.ski/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL with RLS, Stored Procedures, and Auth)

---

## 📁 Repository Structure

```
├── frontend/
│   ├── public/
│   │   ├── brand/                     # Centralized brand visual assets
│   │   │   ├── logo.svg               # Vector brand identity
│   │   │   ├── favicon.svg            # Browser tab icon
│   │   │   ├── app-icon.png           # Master application icon
│   │   │   ├── apple-touch-icon.png   # iOS home screen touch icon (180x180)
│   │   │   ├── icon-192.png           # PWA mobile icon (192x192)
│   │   │   └── icon-512.png           # PWA splash icon (512x512)
│   │   └── manifest.webmanifest       # PWA web app manifest
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/                # AppShell, Navigation, Topbar
│   │   │   ├── shared/                # Status badges, audit timeline, photo preview
│   │   │   ├── skeletons/             # Screen-specific skeleton loaders
│   │   │   │   ├── Skeleton.jsx       # Base animated shimmer primitive
│   │   │   │   ├── DashboardSkeleton.jsx
│   │   │   │   ├── AssetsSkeleton.jsx
│   │   │   │   ├── AssetDetailSkeleton.jsx
│   │   │   │   ├── QueueSkeleton.jsx
│   │   │   │   ├── CampaignsSkeleton.jsx
│   │   │   │   ├── CampaignDetailSkeleton.jsx
│   │   │   │   ├── BrandsSkeleton.jsx
│   │   │   │   ├── BrandDetailSkeleton.jsx
│   │   │   │   ├── AuditSkeleton.jsx
│   │   │   │   ├── AdminSkeleton.jsx
│   │   │   │   └── index.js           # Barrel export
│   │   │   └── ui/                    # shadcn/ui components (button, card, dialog, etc.)
│   │   ├── lib/                       # Supabase client, queries, session & utilities
│   │   ├── pages/                     # Application screens
│   │   │   ├── Login.jsx              # Role-aware authentication
│   │   │   ├── Dashboard.jsx          # Role metrics & operational actions
│   │   │   ├── Assets.jsx             # Inventory explorer & filters
│   │   │   ├── AssetDetail.jsx        # Specifications, schedule & history
│   │   │   ├── Queue.jsx              # Visible interest queue & countdowns
│   │   │   ├── Campaigns.jsx          # Pipeline management & booking stages
│   │   │   ├── CampaignDetail.jsx     # Campaign execution & GTP upload
│   │   │   ├── Brands.jsx             # Advertiser CRM & contact directory
│   │   │   ├── BrandDetail.jsx        # Brand portfolio & active campaigns
│   │   │   ├── Audit.jsx              # Immutable chronological activity ledger
│   │   │   └── Admin.jsx              # Users, asset types, holidays & workflow rules
│   │   ├── App.jsx                    # Route declarations
│   │   ├── index.css                  # Design tokens, fonts, and shimmer animations
│   │   └── main.jsx                   # React root & QueryClient provider
│   └── package.json
└── supabase_schema.sql                # Complete PostgreSQL tables, RLS policies & RPCs
```

---

## ⚡ Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Package Manager**: `npm` or `yarn`
- **Supabase**: Active Supabase project (or local Supabase instance)

### 2. Environment Setup
Create a `.env` file in `frontend/`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Database Initialization
Run the SQL migration script in your Supabase SQL editor:
- Execute `supabase_schema.sql` to establish the tables (`assets`, `brands`, `campaigns`, `interest_queue`, `gtp_records`, `audit_logs`, `holidays`, `profiles`), security policies, and stored procedures.

### 4. Running the Frontend
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start local development server (port 3000)
npm run dev
```

Visit **http://localhost:3000** in your browser.

---

## 👥 Demo Credentials

The platform provides preconfigured quick-login demo accounts across all system personas:

| Role | Email | Access Scope |
| :--- | :--- | :--- |
| **System Admin** | `admin@ims.test` | Full configuration, user invites, settings, holidays |
| **Sales Executive** | `sales@ims.test` | Inventory browsing, queue booking, brand records |
| **Field Operations** | `ops@ims.test` | Creative onboarding, mounting checklists, GTP proof |
| **Finance Specialist**| `finance@ims.test` | Invoice tracking, proof review, client billing |
| **Finance Manager** | `fm@ims.test` | Booking approval, slot confirmation, priority overrides |

*(Demo password across accounts: `Password123!`)*

---

## 📄 License & Brand Notice

© **Carbon & Whale**. All rights reserved.  
Proprietary software for transit and retail Out-Of-Home media inventory operations.
