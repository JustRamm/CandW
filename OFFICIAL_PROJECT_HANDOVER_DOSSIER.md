# PROJECT HANDOVER DOSSIER & FINAL ACCEPTANCE DELIVERABLE
**Project Name**: Carbon & Whale · OOH Media Inventory Management System (OOH-Sync IMS)  
**Client Organization**: Carbon & Whale Media Network  
**Delivery Phase**: Final Production Release & Handover  
**Document Classification**: Confidential / Client Handover Deliverable  

---

## TABLE OF CONTENTS
1. [Executive Summary & Project Acceptance Certificate](#1-executive-summary--project-acceptance-certificate)
2. [Master Deliverables & Scope Verification Matrix](#2-master-deliverables--scope-verification-matrix)
3. [System Architecture & Technology Blueprint](#3-system-architecture--technology-blueprint)
4. [Environment Variables, Credentials & Integration Registry](#4-environment-variables-credentials--integration-registry)
5. [Standard Operating Procedures (SOP) & Admin/User Manual](#5-standard-operating-procedures-sop--adminuser-manual)
6. [Security, Access Control & Database Backup Runbook](#6-security-access-control--database-backup-runbook)
7. [Deployment, DevOps & Hosting Architecture](#7-deployment-devops--hosting-architecture)
8. [Warranty, Maintenance & Support SLA](#8-warranty-maintenance--support-sla)

---

## 1. EXECUTIVE SUMMARY & PROJECT ACCEPTANCE CERTIFICATE

### 1.1 Executive Summary
The Carbon & Whale OOH-Sync IMS platform has completed all design, development, quality assurance, integration, and security verification stages. The system provides real-time Out-of-Home (OOH) media inventory management, SLA-governed conflict-free interest queueing, anti-fraud Geo-Tagged Proof-of-Performance (GTP) mobile capture, unauthenticated live client portal sharing, and automated email telemetry across Kerala's mall and metro advertising networks.

### 1.2 Formal Sign-Off & Handover Certificate

| Parameter | Developer Entity | Client Entity |
| :--- | :--- | :--- |
| **Organization** | Development Team | Carbon & Whale Media Network |
| **Representative** | Lead Software Architect | Managing Director / Product Owner |
| **Project Status** | Delivered & Live in Production | Accepted & Operational |
| **Release Version** | v1.0.0 (Production Stable) | Release Signed Off |
| **Date** | 12 September 2026 | 12 September 2026 |

---

## 2. MASTER DELIVERABLES & SCOPE VERIFICATION MATRIX

| Module | Feature Set Delivered | Verification Status |
| :--- | :--- | :--- |
| **Authentication & RBAC** | Email/Password login, Quick Sign-in mode, 5-tier role hierarchy (Admin, Sales, Ops, Finance, Client), session isolation | Verified & Passed |
| **Asset Inventory** | Static & Digital Screens (rotating ad loop), 14 Kerala districts, benchmark mall catalogue, interactive Leaflet map, geofence radius | Verified & Passed |
| **Queue Engine** | Active slot lock, ordered waitlist (`#1, #2...`), automated 5-day business SLA expiry worker, auto-forfeiture & auto-promotion | Verified & Passed |
| **Campaign Pipeline** | Multi-stage workflow (Onboarding, Invoicing, Live, Closing, Closed), task checklists, cancellation review workflows | Verified & Passed |
| **Proof-of-Performance (GTP)** | GPS camera capture, anti-fraud geofence radius verification, client-side image compression, inspection schedules | Verified & Passed |
| **Client Portal** | Direct unauthenticated tokenized live view (`/view/:campaignId`), interactive map, verified photos, live countdown timer | Verified & Passed |
| **Email Service** | Automated milestone emails via Resend REST API, responsive branded HTML templates, dynamic Vercel base URL resolver | Verified & Passed |
| **Offline PWA** | Progressive Web App installable on iOS/Android/Desktop, IndexedDB storage, offline camera capture with automatic sync | Verified & Passed |
| **Finance & Invoicing** | 18% GST tax invoice recording (`INV-YYYY-XXXX`), supporting PO/receipt attachment, payment tracking | Verified & Passed |
| **Audit Ledger** | Immutable audit trail across all entities, forensic actor and timestamp tracking, structured before/after diffs | Verified & Passed |

---

## 3. SYSTEM ARCHITECTURE & TECHNOLOGY BLUEPRINT

```
[ Client Browser / PWA ]  <==== WebSocket Realtime ====> [ Supabase Realtime Engine ]
         |
         +-----> [ Vercel Production Edge CDN ] (Static SPA, React, Vite, Tailwind CSS)
         |
         +-----> [ Supabase PostgreSQL & Auth ] (RLS Policies, Tables, Storage Buckets)
         |
         +-----> [ Resend REST API ] (Automated Transactional Emails)
         |
         +-----> [ OpenStreetMap / CartoDB ] (Geocoding & Leaflet Map Tiles)
```

### 3.1 Core Technology Stack
- **Frontend Framework**: React 18+ with Vite compiler
- **UI Architecture**: Tailwind CSS, Shadcn UI primitives, Lucide React icons, Framer Motion
- **Map & Geospatial**: Leaflet.js, OpenStreetMap Nominatim API, GPS Geolocation API
- **Offline Storage**: IndexedDB (`OOH_SYNC_OFFLINE_DB`) + Service Worker Cache Storage
- **Backend & Database**: Supabase PostgreSQL + Supabase GoTrue Auth + Supabase Storage
- **Transactional Email**: Resend REST API v1
- **Hosting & CDN**: Vercel Global Edge Network

---

## 4. ENVIRONMENT VARIABLES, CREDENTIALS & INTEGRATION REGISTRY

### 4.1 Production Environment Variables (`.env` / Vercel Environment Configuration)

```env
# Supabase Cloud Project Configuration
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Resend Transactional Email API Key
VITE_RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Live Production Application Base URL
VITE_APP_BASE_URL=https://cand-w.vercel.app
```

### 4.2 Integration Accounts & Ownership Handover

| Service | Purpose | Dashboard URL | Handover Action |
| :--- | :--- | :--- | :--- |
| **GitHub Repository** | Source code & version control | `https://github.com/JustRamm/CandW` | Transfer Admin ownership to client |
| **Supabase Cloud** | Database, Storage buckets, Auth | `https://supabase.com/dashboard` | Invite client organization as Owner |
| **Vercel** | Hosting & Continuous Deployment | `https://vercel.com/` | Transfer Project to client Team |
| **Resend** | Transactional email delivery | `https://resend.com/` | Add client domain DNS records (DKIM/SPF) |

---

## 5. STANDARD OPERATING PROCEDURES (SOP) & ADMIN/USER MANUAL

### 5.1 How to Add & Manage Displays (Asset Inventory)
1. Log in as an **Admin** or **Operations** user and navigate to **Assets** (`/assets`).
2. Click **+ New asset**.
3. Fill in mandatory fields:
   - **Asset Code**: Generated automatically based on Type and Location (e.g. `BENCH-LULUK-001`).
   - **Asset Type**: Static Display, Digital Screen Loop, Mall Benchmark, Metro Pillar.
   - **District & Mall**: Select from the official Kerala directory.
   - **Coordinates**: Enter latitude and longitude or paste a Google Maps link (auto-extracted).
   - **Geofence Radius**: Default 500 meters.
4. Click **Save asset**. A live notification will be broadcast to all online users.

### 5.2 How the Interest Queue & 5-Day SLA Work
1. When an advertiser expresses interest in a display, a Sales Executive clicks **Reserve slot** on the asset.
2. If the asset is free, the reservation occupies the **Active Slot** with a **5-business-day hold SLA** (excluding weekends and regional holidays).
3. If the asset already has an active hold, subsequent reservations enter the **Waitlist** (`#1, #2, #3...`).
4. **Confirmation**: Finance/Admin clicks **Confirm**, selects the confirmation basis (Advance Payment, PO, Contract), uploads supporting documents, and confirms. This moves the asset to **Onboarding** and auto-cancels competing waitlist entries.
5. **Auto-Forfeiture**: If 5 business days elapse without confirmation, the background engine automatically forfeits the active slot, writes an audit record, promotes waitlist entry `#1` to Active with a new 5-day timer, and broadcasts an alert to all sales agents.

### 5.3 How to Capture Field Installation Proof (GTP)
1. An Operations field inspector opens the app on a mobile device at the site.
2. Navigate to **Campaigns** -> Select the active campaign -> **GTP Proofs** tab.
3. Tap **Upload Proof** -> Select **Camera**.
4. The system validates:
   - Device GPS position against the asset's registered location (within geofence radius).
   - Timestamp and orientation.
5. The photo is automatically optimized, uploaded, and timestamped.
6. The client's live portal (`/view/:campaignId`) updates immediately in real-time.

### 5.4 How to Share Live Proof with Clients
1. Open the campaign in **Campaign Detail** (`/campaigns/:id`).
2. Click **Copy Client Link** to copy the unauthenticated live URL (`https://cand-w.vercel.app/view/:id`).
3. Click **Send Email** to dispatch a branded notification email directly to the brand's marketing contact via Resend.
4. When stages transition to **Live** or **Closing**, the system also triggers an automated email notification to the brand.

---

## 6. SECURITY, ACCESS CONTROL & DATABASE BACKUP RUNBOOK

### 6.1 Database Security & Row-Level Security (RLS)
- Supabase PostgreSQL tables (`assets`, `brands`, `campaigns`, `queue_entries`, `audit_logs`, `settings`) have Row-Level Security enabled.
- Storage buckets (`proofs`, `documents`, `photos`) restrict direct write operations to authenticated sessions while allowing public reads on verified proof assets.

### 6.2 Backup & Disaster Recovery Procedure
- **Automated Daily Backups**: Managed by Supabase Cloud at 00:00 UTC with 7-day point-in-time recovery (PITR).
- **Manual Snapshot Export**:
  1. Open Supabase Dashboard -> Database -> Backups.
  2. Click **Download backup snapshot** (`.sql` dump).
  3. Store in offline encrypted cold storage.

---

## 7. DEPLOYMENT, DEVOPS & HOSTING ARCHITECTURE

### 7.1 Continuous Deployment Workflow
The project is configured with GitHub-to-Vercel automated CI/CD:
- Every push to the `main` branch automatically triggers a production build (`vite build`) and deploys to the Vercel Edge CDN within ~60 seconds.

### 7.2 Manual Build & Validation Command
To test and bundle locally:
```bash
cd frontend
npm install
npm run build
```

---

## 8. WARRANTY, MAINTENANCE & SUPPORT SLA

### 8.1 30-Day Post-Handover Warranty Period
- **Warranty Scope**: Full remediation of any reproducible software defects, regressions, or integration anomalies discovered within 30 days of formal handover.
- **Exclusions**: New feature additions, scope modifications, third-party API outages (Resend, OpenStreetMap, Vercel), or unauthorized database schema alterations.

### 8.2 Maintenance & Support Contacts

| Support Tier | Contact Channel | Response SLA |
| :--- | :--- | :--- |
| **Critical System Outage (Sev-1)** | Dedicated Emergency Hotline | < 2 Hours |
| **Operational Query / Bug (Sev-2)** | Support Email Desk | < 8 Business Hours |
| **Feature Enhancements (Sev-3)** | Product Management Desk | Planned Sprint Cycle |

---

### SIGN-OFF AND ACCEPTANCE CONFIRMATION

**Delivered By**: Lead Developer / Engineering Agency  
**Received & Accepted By**: Carbon & Whale Media Network Management  
**Date of Handover**: 12 September 2026  
