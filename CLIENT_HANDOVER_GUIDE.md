# Carbon & Whale · OOH-Sync IMS
## Comprehensive Client Product & Feature Handover Guide

---

### Executive Overview
**Carbon & Whale OOH-Sync** is an enterprise-grade Out-of-Home (OOH) media inventory management system, conflict-free queueing platform, and automated Proof-of-Performance (PoP) verification network. Tailored specifically for high-impact transit media, Metro benchmarks, and mall display networks across Kerala and South India.

---

### 1. Multi-Role User Access & Granular Permissions (RBAC)
The platform enforces role-based access control across five operational tiers:
- **Admin**: Full master control over user provisioning, role assignments, global settings, asset pricing, SLA timers, and immutable audit logs.
- **Sales Executive**: Asset inventory availability lookup, creating reservations, adding client brands, and managing proposed campaign durations.
- **Operations (Ops)**: Field verification, checklist tracking (creative brief, site inspection, flex printing, mount installation), and capturing Geo-Tagged Proofs (GTP).
- **Finance**: Reviewing booking confirmations, raising compliant GST tax invoices (18%), and monitoring revenue across active displays.
- **Client (Advertiser / Brand)**: Read-only access to their dedicated live campaign portal without requiring account registration or credentials.

---

### 2. Interactive Asset Inventory & Geospatial Mapping
- **Digital & Static Inventory**: Manages high-resolution digital screen ad loop rotations (multiple brands per screen) and exclusive static display inventory.
- **Kerala Mall & Metro Directory**: Pre-configured locations covering all 14 official Kerala districts and benchmark malls (Lulu Mall Kochi, Forum Kochi, Nexus Mall, Centre Square Mall, Mall of Travancore, Hilite Mall, etc.).
- **Interactive Leaflet Map**:
  - Live GPS clustering with real-time status badges (*Available*, *In Queue*, *Onboarding*, *Live*).
  - Geofence radius configuration (default 500m) to enforce tamper-proof on-site photo capture.
  - Quick direction lookup via integrated Google Maps coordinates.
- **Smart Data Import/Export**: One-click upward export to standardized CSV formats and robust drag-and-drop CSV batch importing with automated error validation.

---

### 3. SLA-Enforced Conflict-Free Interest Queue Engine
- **Fair-Hold Queue Allocation**: Prevents double-booking by locking assets into an **Active Slot** for the first sales reservation while maintaining an ordered waitlist (`#1, #2, #3...`).
- **Automated 5-Day SLA Expiry Worker**:
  - Automatically calculates business days elapsed (excluding weekends and official regional holidays).
  - If a reservation is not confirmed within the 5-business-day SLA, the system automatically forfeits the slot, logs an audit entry, and promotes the next waitlisted brand with a fresh timer.
  - Automatically restores asset status to `Available` when no waitlist entries remain.
- **Two-Party Confirmation Basis**: Requiring POs, advance receipts, or signed contracts to lock in campaigns.

---

### 4. End-to-End Campaign Lifecycle Workflow
Tracks every booking through a structured pipeline:
1. **Onboarding**: Checklist validation for creative brief signoff, site suitability inspection, printing/dispatch, and mounting.
2. **Invoicing**: Finance verification with automated GST invoice generation (`INV-YYYY-XXXX`).
3. **Live Flight**: Display activation with scheduled recurring inspection milestones.
4. **Closing / Handover**: Premature cancellation review workflows or scheduled campaign conclusion.

---

### 5. Geo-Tagged Installation Proof (GTP) & Field Verification
- **Anti-Fraud Camera Verification**: Captures device GPS coordinates, timestamp, and device orientation at the moment of photo capture.
- **Geofence Validation**: Verifies that ops personnel are physically within the benchmark location before accepting proof uploads.
- **Lightweight Image Optimization**: Client-side lossless compression before upload for ultra-fast performance on mobile 4G networks.
- **Sequential Inspection Schedules**: Automates periodic display inspections (Day 1, Day 15, Day 30) to ensure continuous illumination and structural flex integrity.

---

### 6. Client Proof-of-Performance (PoP) Portal
- **Direct Unauthenticated Client Access**: Secure, tokenized URL (`/view/:campaignId`) allowing brand marketing managers to view live campaigns without logging in.
- **Live PoP Dashboard**:
  - Verified installation photos with timestamp, site coordinates, and inspection approval badges.
  - Real-time flight progress bar and campaign countdown.
  - Interactive site map with embedded street coordinates.
  - 1-click clipboard link copying and shareable links for client executive teams.

---

### 7. Automated Email Communication Engine (Resend)
- **Instant Status Update Notifications**: Automatically emails brand marketing contacts (`contact_email`) when campaign milestones transition:
  - When ad onboarding completes.
  - When the ad officially goes **Live** on the physical screens.
  - When closing inspections are performed.
- **Branded Email Deliverability**: Features the official Carbon & Whale navy/blue theme, campaign metadata, and direct CTA buttons to the client's live PoP portal.
- **On-Demand Custom Dispatch**: Ops and sales teams can send branded manual notification emails directly from the campaign dashboard.

---

### 8. Offline-First Progressive Web Application (PWA)
- **Installable on Mobile & Desktop**: Fully compliant PWA installable on iOS, Android, macOS, and Windows with custom splash screens and app icons.
- **Offline Data Access**: IndexedDB storage keeps active campaigns, asset directories, and queue data accessible in basements or areas with zero mobile reception.
- **Background Sync Queue**: Photos captured while offline are safely queued and automatically synchronized with Supabase cloud storage the moment connectivity is restored.

---

### 9. Real-Time Telemetry & Notification Center
- **Multi-Device Realtime Sync**: Powered by Supabase Realtime WebSocket broadcast.
- **Multi-Channel Alerts**:
  - Top header notification bell with categorized filter tabs (*All*, *Assets & Brands*, *Queue Expiry*, *GTP Alerts*, *Campaigns*).
  - Floating toast popups for urgent operational milestones.
  - Crystal glass acoustic chime (`sound.notification()`) for instant audio cues.

---

### 10. Immutable Audit Trail & Regulatory Compliance
- **Audit Logging**: Every create, update, delete, stage promotion, SLA forfeiture, document upload, and automated email is logged in the `audit_logs` ledger.
- **Forensic Attribution**: Captures timestamp, actor name, actor role, before/after JSON diffs, and reason comments.
- **Export Ready**: Filterable by entity type and actor with CSV export for executive reporting.

---

### Technical Architecture
- **Frontend Core**: React (Vite), Tailwind CSS, Lucide Icons, Framer Motion, Leaflet.
- **State Management & Caching**: TanStack React Query + IndexedDB (Offline Store).
- **Backend & Database**: Supabase PostgreSQL, Row-Level Security, Storage Buckets, Realtime Broadcast.
- **Email Delivery**: Resend REST API integration.
- **Hosting & Deployment**: Vercel production edge network.
