# OneSource Farm

Internal memo management system for **OneSource Farm**.

## Features

- Official company memo template with branding
- Role-based access (Admin, Staff, Department Head, Finance, HR, CEO, EXCO)
- Automatic memo numbering: `RPS/EMEMO/YEAR/SEQUENCE`
- Configurable approval workflows by memo type
- Parallel EXCO approval (CEO, CBDO, CTO, CFO — all must approve)
- Auto-signatures on approval
- Attachments (locked after submission)
- PDF and Word export
- Audit trail, version history, SLA tracking
- Email and in-app notifications
- Approval delegation
- Memo sharing (view-only)
- Admin: users, departments, branding, workflows, trash

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Files | Local storage (dev), cloud-ready adapter |
| PDF | PDFKit |
| Word | docx |

## Quick Start

### 1. Clone and install

```bash
cd onesource-farm
npm install
cp .env.example .env.local
```

### 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Add your URL and keys to `.env.local`
3. Run migrations in the SQL editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/seed.sql`

### 3. Team accounts (OneSource Farm staff)

Run the password-setup migration in **Supabase → SQL Editor**:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_set_password BOOLEAN NOT NULL DEFAULT FALSE;
```

Then seed the team (18 accounts from `@onesourcefresh.com`):

```bash
npm run seed:team
```

- **First login:** work email + temporary password `Welcome@OneSource2026` (then set a new password with confirmation).
- **Testing (all accounts):** `npm run reset:logins` or **Admin → Users → Reset all logins (testing)** — shared password `Test@OneSource2026`, skips set-password screen.
- **Admin + 1st IT checker (Emma):** `emmanuel.ngwero@onesourcefresh.com` — admin role in DB; IT 1st-check queue via sidebar. `npm run assign:admin` / `npm run assign:it-checkers`.
- Everyone else starts as **Staff** (can create memos); admin assigns **department** and **role** per person in **Admin → Users**.

### 4. Seed demo users (optional, old dev accounts)

```bash
npm run seed:users
```

### 4. Create upload directories

```bash
mkdir -p uploads/attachments uploads/signatures uploads/logos
```

### 5. Email notifications (approval alerts)

Add SMTP settings to `.env.local` so approvers receive email when a memo is submitted or routed to them:

```env
SMTP_HOST=mail.one-sourcebrand.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@one-sourcebrand.com
SMTP_PASS=your-email-account-password
SMTP_FROM="OneSource Farm <noreply@one-sourcebrand.com>"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Use the password for the `noreply@one-sourcebrand.com` mailbox (outgoing server: `mail.one-sourcebrand.com`, port **465** SSL). Set `SMTP_REPLY_TO=your system administrator`. In-app notifications always appear in the bell panel; email is sent in parallel when SMTP is configured.

After a user’s **first successful sign-in** (once they have set their own password), they receive a one-time welcome email. Apply `supabase/migrations/003_welcome_email_sent.sql` in the Supabase SQL editor so the system does not resend it on every login.

**Outlook inbox (not Junk / Other):** Ask IT to enable **SPF**, **DKIM**, and **DMARC** for `one-sourcebrand.com` on the same host that sends mail (`mail.one-sourcebrand.com`). The app sends as transactional mail (not bulk), embeds images inline, and uses a clear subject line. Users can also right-click the first message → **Move to Inbox** → **Always move messages from this sender** so future OneSource Farm mail stays in the inbox.

### 6. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo Accounts

| Email | Role | Password |
|-------|------|----------|
| admin@onesourcefresh.com | Admin | Admin@123 |
| staff@onesourcefresh.com | Staff | Staff@123 |
| depthead@onesourcefresh.com | Department Head | Head@123 |
| finance@onesourcefresh.com | Finance Reviewer | Finance@123 |
| hr@onesourcefresh.com | HR Reviewer | HR@123 |
| ceo@onesourcefresh.com | CEO | CEO@123 |
| cbdo@onesourcefresh.com | EXCO (CBDO) | EXCO@123 |
| cto@onesourcefresh.com | EXCO (CTO) | EXCO@123 |
| cfo@onesourcefresh.com | EXCO (CFO) | EXCO@123 |

## Default Workflows

| Memo Type | Route |
|-----------|-------|
| Payment Request | Staff → Dept Head → Finance → CEO |
| Procurement Request | Staff → Dept Head → Finance → CEO |
| HR Request | Dorothy (HR staff) → Christine (review) → CEO |
| Marketing Request | Margaret (MKT head) → Norman (business) → Christine → CEO |
| Finance Request | Christine (FIN staff) → Amara (review) → CEO |
| Leave Request | Staff → Dept Head → CEO |
| IT Request | Staff → Emma (1st IT) → Jim (2nd IT) → Christine (Finance) → CEO |
| General Internal | Staff → Dept Head → Finance → CEO or EXCO |

## Who can create / approve

**Create:** Any staff or department head (with signature); pick **target department** on the form.

**Finance review:** Amara (CFO) on **Finance Request** only; **Christine** on the finance step for HR, marketing, IT, payment, procurement, and general memos from other departments. Dept heads by target department:

| Code | Head(s) |
|------|---------|
| HR | dorothy.kubakurungi@onesourcefresh.com |
| IT | emmanuel.ngwero + jim.ntare |
| OPS | emmanuel.ngwero@onesourcefresh.com |
| MKT | margaret.nassiwa@onesourcefresh.com (marketing head) |
| BD | norman.nowamani@onesourcefresh.com (business — marketing_request step) |
| FIN | amara.oto@onesourcefresh.com |

| Memo type | Route |
|-----------|-------|
| HR Request | Christine → CEO |
| Finance Request | Amara (CFO) → CEO |
| Marketing Request | Norman (business) → Christine → CEO |
| IT Request | Emma → Jim → Christine → CEO |
| Payment / Procurement / General | Dept head → Christine → CEO |
| Leave | Dept head (e.g. Dorothy for HR, Margaret for MKT) → CEO |

`npm run assign:org` — sync workflows to Supabase

## Workflow smoke tests

Runs end-to-end create → submit → approve for every department route (creates memos tagged `[TEST]` in the subject):

```bash
npm run test:workflows              # all 8 scenarios
npm run test:workflows:hr           # single route (hr, finance, marketing, it, …)
```

If dept heads or HR reviewer are missing, the script temporarily promotes team members for the run (e.g. Jason → IT head). Re-run `assign:*` scripts afterward if you need production roles restored.

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Authenticated pages
│   │   ├── dashboard/        # Role-based dashboards
│   │   ├── memos/            # Create, list, view memos
│   │   └── admin/            # Admin settings
│   └── api/                  # REST API routes
├── components/
│   ├── layout/               # Sidebar, dashboard layout
│   ├── memo/                 # Template, timeline, list
│   └── ui/                   # Shared UI components
├── lib/
│   ├── auth/                 # RBAC
│   ├── workflow/             # Routing engine
│   ├── export/               # PDF & Word
│   ├── memo/                 # Memo business logic
│   ├── storage/              # File storage (local + cloud adapter)
│   ├── audit/                # Audit logging
│   └── notifications/        # Email & in-app alerts
├── types/                    # TypeScript definitions
└── context/                  # Auth context
supabase/
├── migrations/               # Database schema
└── seed.sql                  # Reference data
```

## Environment Variables

See `.env.example` for all required variables.

## SLA Defaults

| Role | Hours |
|------|-------|
| Department Head | 24 |
| Finance / HR | 48 |
| CEO / EXCO | 72 |

## License

Proprietary — Rhino Payment Services Limited

### Field maps, forecasts, and scheduled reports

Apply Supabase migrations through `028_farm_digest_delivery.sql` in order before deploying. Migration 027 adds block polygons/centroids, attachment GPS, activity forecast fields, and digest subscriptions; 028 adds a single schedule per user/farm and an atomic delivery lease. Migration 028 stops if duplicate schedules exist so they can be reconciled without silently deleting subscriptions.

Blocks support a Leaflet boundary editor on create/edit and a read-only boundary map with photos on detail. Click boundary vertices, use **Finish polygon**, then save the block. Coordinates use GeoJSON longitude/latitude order; the server calculates the polygon centroid. **Use my GPS** centers the map and captures a point when no boundary exists. Camera capture and **Tag GPS** require browser camera/location permissions on HTTPS (or localhost).

**Fill from forecast** on an activity uses the block centroid and activity date via `/api/farm/weather`. The saved snapshot represents 09:00 in the location's timezone. Source: [Open-Meteo forecast API](https://open-meteo.com/en/docs). Changing the block/date clears the previous forecast. Structured weather and spray score/label are persisted after the activity RPC; a failed weather update is reported to the caller. The score is a weather heuristic, and missing data is marked unavailable.

Reports stores daily/weekly digest schedules on the server. Hours and weekdays are UTC (06:00 UTC is 09:00 in Kampala). Delivery rechecks the subscriber's current report permissions and active account, includes CSV sections in the email body, and records `last_sent_at` only after SMTP succeeds. Concurrent jobs use a 15-minute database lease; failed deliveries release it for retry. SMTP delivery and database acknowledgement cannot be atomic: a crash after SMTP accepts a message can cause a duplicate on retry.

Set these environment variables in the Vercel project before enabling delivery:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` for your mail server; optionally `SMTP_REPLY_TO`.
- `CRON_SECRET` to a strong random value. Both cron endpoints require `Authorization: Bearer CRON_SECRET`.
- `NEXT_PUBLIC_APP_URL` to the deployed portal URL, plus the existing Supabase service credentials and storage settings.

`.github/workflows/farm-scheduled-jobs.yml` runs both authenticated endpoints hourly at minute 17 UTC and supports manual dispatch. Set the repository Actions secret `CRON_SECRET` to the same value as Vercel. The workflow requires no repository token permissions or third-party actions. GitHub may delay scheduled jobs; this is an hourly best-effort schedule. Vercel cron definitions are omitted because the production project uses the Hobby plan. For a manual run, send an authenticated GET to `/api/cron/farm-reports`; the response reports checked/sent/failed/skipped counts. Disabling the `reports.digest_enabled` system setting pauses delivery globally.

Run `npm run test:farm-field-ops` for geometry, forecast, report access, schedule, and cron authentication regression checks.
