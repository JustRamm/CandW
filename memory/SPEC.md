# OOH-Sync — Outdoor Advertising Asset IMS

Workflow-driven inventory management for metro/mall bench advertising assets across
Sales, Operations, Finance and Admin roles. Mobile-first (installable PWA) with a
dense desktop experience from the same build.

## Stack
- Backend: FastAPI, all routes on `api_router` under `/api`; motor + MongoDB.
- Frontend: Vite + React 19 + Tailwind v4 + shadcn/ui (base-nova), plain JSX.
- Auth: email + password, httpOnly session cookie (`ims_session`), sessions in Mongo.
- Background worker: `scheduler_loop()` in `server.py` runs every 300s — queue expiry sweep + GTP reminders.

## Roles
`admin` (superuser — passes every role gate), `sales`, `ops`, `finance`, `finance_manager`.

## Data model (collections)
- `users` — id, email, name, role, password_hash (pbkdf2), active
- `sessions` — token, user_id, expires_at
- `assets` — id, asset_code (`TYPE-LOCATION-SEQ`), asset_type, location_type (Metro|Mall), location_code/name, city,
  width_ft/height_ft, photo_ids[] (multiple photo attachments, rendered as a slideshow), photo_url (legacy single image),
  description, status (`available|reserved|onboarding|live`), current_campaign_id.
  The list endpoint also returns next_gtp_date / gtp_overdue for live assets.
- `asset_types` — admin-managed: name, location_type, default_width_ft, default_height_ft. Add/edit/delete;
  a type in use cannot be deleted, and renaming one updates every asset that uses it.
- `brands` — id, name, contact_person, contact_email, contact_phone, industry, notes.
  Created explicitly on the Brands page, or lazily the first time Sales names a new brand in the queue.
  Brand detail shows full campaign + queue history across assets.
- `queue_entries` — asset_id, brand_id, brand, salesperson_id, proposed_duration_days,
  proposed_start_date, proposed_end_date (duration is derived from the window when both dates are given),
  state (`active|pending|confirmed|expired|cancelled`), position (0 = active), expires_on (IST date), confirmation{}
- `campaigns` — asset_id, brand_id, brand, duration_days, proposed_duration_days, priority (`high|medium|low`),
  stage (`onboarding|invoicing|live|closing|closed`), start_date, end_date,
  checklist[] (7 mandatory items), invoice{}, gtps[] (each with its own priority), cancellation{}
- `documents` — uploads stored base64 in Mongo, served at `GET /api/uploads/{id}` (images + PDF, 25 MB cap)
- `audit_logs` — immutable; entity_type, action, actor, before/after, comment, doc_ids, asset_id
- `notifications` — per-user in-app feed (email/Google Chat deferred to v2)
- `settings` (`id: "global"`) — gtp_interval_days (28), queue_active_business_days (5), gtp_reminder_days (5)
- `holidays` — admin-configurable IST holiday calendar

## Key flows
1. **Interest queue** — Sales adds a brand from an asset page. First entry takes the **active slot**
   (expires after 5 business days, IST, skipping weekends + configured holidays); everyone else joins an
   ordered, visible waitlist. On expiry the next pending entry auto-promotes and its clock starts.
   Urgency: `normal` (>2 days), `warning` (<=2), `urgent` (<=1).
2. **Finance confirmation** — only `finance_manager` (or admin) can confirm, and only the active slot.
   Requires a reason type, at least one supporting document, and a final duration (may override the
   sales-proposed value; the original is preserved). Confirming auto-cancels every other pending entry
   on that asset and notifies those salespersons. Creates the campaign + onboarding task.
3. **Ops onboarding** — 7 mandatory checklist items (creative, mall/metro approval, printing quotation,
   printing completed, printing proof, work permit, installation GTP). Each needs an attachment to complete.
   "Mark ad onboarded" is blocked until all mandatory items are done → stage becomes `invoicing`.
   Onboarding tasks carry a `high|medium|low` priority that Ops/Admin can change.
4. **Finance invoicing** — Finance records the GST invoice → campaign goes `live`, start_date = today,
   end_date = start + duration_days, and the GTP schedule is generated.
5. **GTP cycle** — schedule is **anchored to campaign start** at the configured interval (28 days) plus a
   final GTP at campaign end; a delayed approval never shifts later deadlines. Ops uploads geo-tagged
   photos → Finance approves, or rejects **with a mandatory reason** (returns to Ops).
   Ops is reminded 5 days before each deadline. Each GTP has its own `high|medium|low` priority.
5a. **Queue expiry warnings** — the scheduler notifies the owning salesperson once a day while their active
   slot has 2 or fewer business days left (deduped via `reminder_log`), in addition to the on-expiry notice.
6. **Premature cancellation** — Sales requests with reason + proposed cancel date (+ optional docs).
   Finance approves → stage `closing` and a final closure GTP is created for Ops. Approving that final
   GTP closes the campaign and releases the asset to `available` (any waiting interest is then promoted).
7. **Audit + document vault** — every action is appended to `audit_logs`; nothing is ever deleted.
   Campaign history stays visible on the asset page after the asset is available again.

## Routes
`/login`, `/dashboard`, `/assets`, `/assets/:assetId`, `/queue`, `/campaigns`, `/campaigns/:campaignId`,
`/brands`, `/brands/:brandId`, `/audit`, `/admin` (Users · Asset Types · Workflow · Holidays tabs).
Unauthenticated visits to any protected route redirect to `/login`; an authenticated visit to `/login`
bounces to `/dashboard`.

## Deviations from the original spec (v1 scope, agreed with the user)
- Notifications are **in-app only**. Resend email and the Google Chat Space webhook are deferred.
- Files are stored **in MongoDB** via the backend upload endpoint, not external object storage.
- Frontend is plain **JavaScript (JSX)**, not TypeScript (template constraint).
- No per-user realtime-vs-digest notification preference yet.
- No SLA auto-escalation on Finance actions (user accepted this default).
- CSV **exports** are present on Assets, Queue, Campaigns and Audit; Excel is not.

## Seed
`cd /app/backend && python seed.py` — wipes and reseeds. Creates 6 users, 8 assets, 6 queue entries,
2 campaigns (one awaiting Ops onboarding, one live with GTP #1 submitted awaiting Finance).
Credentials: see `memory/test_credentials.md`.
