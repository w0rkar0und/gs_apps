# CLAUDE.md — GS Apps Platform
## Claude Code Project Briefing

This file is the authoritative briefing document for the GS Apps platform — a multi-application
hub for Greythorn Services. Read it fully before taking any action. All architectural decisions
documented here are final unless explicitly overridden by the user in the current session.

---

## Platform Overview

GS Apps (gsapps.co) is a multi-application platform for Greythorn Services operations.
Users log in once and see an app launcher showing only the applications they are authorised to access.
Platform admins (`profiles.is_admin = true`) can access all apps and manage user permissions.

### Current Apps

| App | Slug | Status | Description |
|---|---|---|---|
| Referrals | `referrals` | Live | Contractor referral registration and verification |
| Reports | `reports` | Live | Self-service Greythorn SQL Server reports with visualisations |
| Scorecards | `scorecards` | Live | Courier scorecard predictions — run pipeline, view results |
| Fleet | `fleet` | Live | Vehicle status dashboard — fleet overview, assignments, composition, compliance |

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js (App Router) | Hosted on Vercel |
| Database + Auth | Supabase (Postgres) | Row Level Security enforced |
| Repository | GitHub (`gs_apps`) | https://github.com/w0rkar0und/gs_apps |
| Sync/Check Scripts | Python 3.9+ | Run locally or via self-hosted GitHub Actions runner |
| Greythorn DB | Azure SQL Server | Accessed via Railway proxy (static IP) |
| SQL Proxy | Railway (Pro plan) | Node.js/Express — static outbound IP for SQL Server whitelist |
| Scorecard Service | Railway (Pro plan) | Python/FastAPI — courier scorecard processing pipeline |
| Cron | Vercel cron | Daily sync reminder, missed sync check, referral digest, scorecard runs |
| Email notifications | Resend | Verified sender domain: greythornservices.uk |
| Charts | Recharts | Used in Reports app for data visualisation |
| Excel generation | ExcelJS | House-style .xlsx reports |

---

## Repository Structure

```
gs_apps/
├── .github/
│   └── workflows/
│       └── contractor-sync.yml          # Self-hosted runner — 11AM daily
├── app/                                 # Next.js App Router
│   ├── layout.tsx                       # Root layout — "GS Apps" title
│   ├── page.tsx                         # Redirects to /apps or /login
│   ├── login/
│   │   └── page.tsx                     # Username/password login
│   ├── (authenticated)/                 # Route group — shared navbar layout
│   │   ├── layout.tsx                   # AuthNavbar wrapper
│   │   ├── apps/
│   │   │   ├── page.tsx                 # App launcher — shows authorised apps
│   │   │   └── admin/
│   │   │       └── page.tsx             # Platform user management (admin only)
│   │   ├── referrals/                   # ── Referrals app ──
│   │   │   ├── page.tsx                 # My Referrals (recruiter view)
│   │   │   ├── submit/
│   │   │   │   └── page.tsx             # New referral form
│   │   │   └── admin/
│   │   │       ├── page.tsx             # Admin dashboard
│   │   │       ├── checks/
│   │   │       │   ├── page.tsx         # Run Checks
│   │   │       │   └── ChecksPanel.tsx
│   │   ├── reports/                     # ── Reports app ──
│   │   │   └── page.tsx                 # Report runner (server component, checks permissions)
│   │   ├── scorecards/                  # ── Scorecards app ──
│   │   │   └── page.tsx                 # Dashboard — trigger runs, view history + results
│   │   ├── fleet/                       # ── Fleet app ──
│   │   │   └── page.tsx                 # Vehicle status dashboard (admin/fleet access)
│   │   └── api/
│   │       ├── platform/admin/
│   │       │   ├── create-user/route.ts # Platform user creation (service role)
│   │       │   └── update-user/route.ts # Platform user edit/deactivate/delete
│   │       ├── referrals/admin/
│   │       │   ├── run-checks/route.ts      # Run Check from UI (admin, max 4)
│   │       │   ├── run-sync/route.ts        # Contractor sync from UI (admin)
│   │       │   └── update-referral/route.ts
│   │       ├── reports/
│   │       │   ├── deposit/route.ts             # Proxy → Railway deposit report
│   │       │   ├── working-days/route.ts        # Proxy → Railway working days report
│   │       │   ├── working-days-by-client/route.ts  # Proxy → Railway fleet-wide report
│   │       │   ├── settlement/route.ts          # Proxy → Railway settlement report
│   │       │   ├── branch-performance/route.ts  # Proxy → Railway multi-week trend report
│   │       │   ├── download/route.ts            # ExcelJS generation → .xlsx download
│   │       │   └── email/route.ts               # ExcelJS generation → Resend email
│   │       ├── scorecards/
│   │       │   ├── run/route.ts                 # Trigger pipeline (admin, POST)
│   │       │   ├── status/route.ts              # Live pipeline status (admin, GET)
│   │       │   ├── history/route.ts             # Run history from Supabase (admin, GET)
│   │       │   └── results/route.ts             # Prediction results for a run (admin, GET)
│   │       └── fleet/
│   │           ├── data/route.ts                # Proxy → Railway vehicle-status (snapshot/history/contractor-history)
│   │           ├── download/route.ts            # ExcelJS generation → .xlsx download
│   │           └── email/route.ts               # ExcelJS generation → Resend email
│   └── api/
│       └── cron/                        # Vercel cron endpoints (platform-level)
│           ├── sync-reminder/route.ts
│           ├── check-sync/route.ts
│           ├── referral-digest/route.ts
│           └── scorecard-run/route.ts       # Trigger scorecard pipeline (Thu/Fri cron)
├── components/
│   ├── AuthNavbar.tsx                   # Platform — server component, fetches profile
│   ├── Navbar.tsx                       # Platform — multi-app aware, hamburger menu on mobile
│   ├── platform/                        # ── Platform components ──
│   │   └── PlatformUserManagement.tsx   # Admin user management (create/edit/deactivate/delete)
│   ├── referrals/                       # ── Referrals app components ──
│   │   ├── AdminTable.tsx
│   │   ├── CheckDetailView.tsx
│   │   ├── HrCodeInput.tsx
│   │   ├── ReferralForm.tsx
│   │   ├── ReferralTable.tsx             # Desktop table + mobile card layout
│   │   ├── SearchInput.tsx
│   │   ├── SortableHeader.tsx
│   │   ├── SuccessToast.tsx              # Auto-dismissing success banner
│   │   └── SyncStatusBanner.tsx
│   ├── reports/                         # ── Reports app components ──
│   │   ├── ReportRunner.tsx             # Report selector, download/email actions
│   │   ├── DepositReport.tsx            # Deposit report — 4-section table view
│   │   ├── WorkingDaysReport.tsx        # Per-contractor working day count
│   │   ├── WorkingDaysByClientReport.tsx # Fleet-wide: filters, chart, grouped table
│   │   ├── SettlementReport.tsx         # DA Relations settlement — 5 collapsible sections
│   │   └── BranchPerformanceReport.tsx  # Multi-week trend: line chart, pivoted table
│   ├── scorecards/                      # ── Scorecards app components ──
│   │   └── ScorecardDashboard.tsx       # Run trigger, history table, expandable results
│   └── fleet/                           # ── Fleet app components ──
│       └── VehicleStatusDashboard.tsx   # 4-panel dashboard: overview, assignment, composition, compliance
├── docs/
│   ├── GREYTHORN_REPORTS_CONTEXT.md     # Full report specs (deposit + working days)
│   ├── WORKING_DAY_COUNT_BY_CLIENT.md   # Fleet-wide report spec + SQL
│   ├── REFERRALS_USER_GUIDE.md          # Referrals app user guide (plain English)
│   └── Referrals_User_Guide.pdf         # PDF version of the user guide
├── lib/
│   ├── apps.ts                          # App registry — add new apps here
│   ├── app-nav.ts                       # Per-app navigation links
│   ├── excel-styles.ts                  # ExcelJS house style definitions
│   ├── excel-deposit.ts                 # Deposit report Excel generator
│   ├── excel-working-days.ts            # Working day count Excel generator
│   ├── excel-working-days-by-client.ts  # Fleet-wide report Excel generator
│   ├── excel-settlement.ts             # Settlement report Excel generator
│   ├── excel-branch-performance.ts    # Branch performance Excel generator
│   ├── excel-vehicle-status.ts        # Vehicle status Excel generator
│   ├── supabase.ts                      # Supabase client (browser)
│   ├── supabase-server.ts               # Supabase client (server/RSC)
│   └── types.ts                         # Shared TypeScript types
├── railway-proxy/                       # ── Railway SQL proxy service ──
│   ├── index.js                         # Express server — report query endpoints
│   ├── package.json
│   └── .gitignore
├── railway-scorecard/                   # ── Railway scorecard service ──
│   ├── Dockerfile                       # Python 3.12-slim, uvicorn on port 3000
│   ├── requirements.txt                 # Pinned versions
│   ├── server.py                        # FastAPI — /health, /status, /run + Supabase persistence
│   ├── scorecard_agent/
│   │   ├── config.py                    # Docker paths, Graph API settings, XGBoost config
│   │   ├── main.py                      # 7-step pipeline, captures predictions data
│   │   ├── extract_pdf.py               # PDF → pandas (pdfplumber)
│   │   ├── transform.py                 # Raw → master format
│   │   ├── run_model.py                 # XGBoost scoring, 3 calibration offsets
│   │   └── email_report.py              # Resend email with Excel attachments
│   ├── onedrive_client/
│   │   └── onedrive_client.py           # Microsoft Graph API client for SharePoint
│   └── .gitignore
├── scripts/
│   ├── contractor_sync.py               # Greythorn → Supabase contractor sync
│   ├── referral_check.py                # Working day verification
│   └── generate_referrals_guide_pdf.py  # Regenerate Referrals_User_Guide.pdf
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql       # Core tables, RLS, triggers
│       ├── 002_user_apps.sql            # Multi-app user access table
│       ├── 003_profile_fields.sql       # Add full_name, email, is_active to profiles
│       ├── 004_user_apps_permissions.sql # Add permissions JSONB to user_apps
│       ├── 005_sync_log_rls.sql         # Enable RLS on sync_log
│       ├── 006_scorecard_runs.sql       # Scorecard run history table
│       └── 007_scorecard_results.sql    # Scorecard prediction results table
├── seed_data/                           # Historical data imports
├── vercel.json                          # Vercel cron schedule
├── next.config.ts                       # Redirects for old URLs
├── .env.example
├── .env.local
├── .gitignore
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

---

## Multi-App Architecture

### How to add a new app

1. **Register the app** — add an entry to `lib/apps.ts`:
   ```typescript
   {
     slug: 'new-app',
     name: 'New App',
     description: 'What it does',
     icon: 'generic',    // add a new icon key to the launcher if needed
     basePath: '/new-app',
   }
   ```

2. **Add nav links** — add an entry to `lib/app-nav.ts`:
   ```typescript
   'new-app': [
     { href: '/new-app', label: 'Home', adminOnly: false },
     { href: '/new-app/settings', label: 'Settings', adminOnly: true },
   ]
   ```

3. **Update middleware matcher** — add the base path to `middleware.ts`:
   ```typescript
   export const config = {
     matcher: ['/apps/:path*', '/referrals/:path*', '/reports/:path*', '/scorecards/:path*', '/fleet/:path*', '/new-app/:path*'],
   }
   ```

4. **Create routes** — build pages under `app/(authenticated)/new-app/`

5. **Create components** — add to `components/new-app/`

6. **Grant access** — insert rows into `user_apps` for authorised users

### App access control

- **`user_apps` table** maps users to apps via `(user_id, app_slug)` pairs
- **`permissions` JSONB column** on `user_apps` provides sub-level access control (e.g. per-report-type)
- **Platform admins** (`profiles.is_admin = true`) bypass `user_apps` and can access all apps
- **Middleware** checks `user_apps` on every request to an app route; unauthorised users redirect to `/apps`
- **App launcher** (`/apps`) only shows apps the user has access to
- **New users** created via the admin page get app access granted automatically (defaults to `referrals`)

### Navbar behaviour

- Logo links to `/apps` (the launcher)
- Shows the current app name next to the logo
- Nav links are contextual — driven by `lib/app-nav.ts` based on the current URL path
- On the `/apps` launcher page, admins see "Users & Access" link
- All forms have `autoComplete="off"` to prevent browser value retention

---

## Database Schema

### Platform tables

#### Table: `profiles`
Extends Supabase `auth.users`. Created automatically on user signup via trigger.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_id TEXT NOT NULL,          -- HR code (X######) or j.smith for external
  full_name TEXT,                    -- User's full name
  email TEXT,                        -- User's real email address
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,   -- Platform-wide admin flag
  is_active BOOLEAN NOT NULL DEFAULT TRUE,   -- Deactivated users cannot log in
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`is_admin` is a **platform-level superadmin flag** — admins can access all apps and all admin features.

**Note:** `is_active` may be `null` for users created before migration 003. Frontend code uses `=== false` checks to treat `null` as active.

#### Table: `user_apps`
Maps users to the apps they can access. Admins bypass this check.

```sql
CREATE TABLE user_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_slug TEXT NOT NULL,
  permissions JSONB,                 -- Sub-level permissions (e.g. {"deposit": true, "working-days": true})
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, app_slug)
);
```

**Permissions JSONB** — used by apps that need sub-level access control. For the Reports app:
```json
{"deposit": true, "working-days": true, "working-days-by-client": true, "branch-performance": true}
```
The `APP_PERMISSIONS` config in `PlatformUserManagement.tsx` defines which apps have sub-permissions and what the keys are.

### Referrals app tables

#### Table: `contractors`
Synced daily from Greythorn. Source of truth for HR code validation.

```sql
CREATE TABLE contractors (
  hr_code TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_worked_date DATE,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Table: `referrals`
One row per registered referral. All fields lock on insert. Only admins may update.

```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES auth.users(id),
  recruited_hr_code TEXT NOT NULL UNIQUE REFERENCES contractors(hr_code),
  recruited_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  start_date_locked BOOLEAN NOT NULL DEFAULT TRUE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status referral_status NOT NULL DEFAULT 'pending',
  working_days_approved FLOAT,
  working_days_projected FLOAT,
  working_days_total FLOAT,
  last_checked_at TIMESTAMPTZ,
  last_check_snapshot JSONB,
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  query_version TEXT
);
```

#### Table: `referral_checks`
Full audit trail of every working-day verification.

```sql
CREATE TABLE referral_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  query_version TEXT NOT NULL,
  start_date_filter DATE NOT NULL,
  working_days_approved FLOAT NOT NULL,
  working_days_projected FLOAT NOT NULL,
  working_days_total FLOAT NOT NULL,
  threshold_met BOOLEAN NOT NULL,
  start_date_discrepancy_flag BOOLEAN NOT NULL DEFAULT FALSE,
  check_detail JSONB NOT NULL
);
```

#### Table: `sync_log`
One row per contractor sync attempt. Used by missed-sync cron.

```sql
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  records_synced INT,
  error_message TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'scheduled' CHECK (triggered_by IN ('scheduled', 'manual'))
);
```

### Scorecards app tables

#### Table: `scorecard_runs`
One row per pipeline execution. Persists run history for the dashboard.

```sql
CREATE TABLE scorecard_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'no_files', 'error')),
  triggered_by TEXT NOT NULL DEFAULT 'scheduled' CHECK (triggered_by IN ('scheduled', 'manual', 'cron')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  files_processed INT,
  records_added INT,
  week INT,
  email_sent BOOLEAN,
  result JSONB,
  error TEXT
);
```

#### Table: `scorecard_results`
One row per run per calibration offset. Stores predictions and site summaries.

```sql
CREATE TABLE scorecard_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES scorecard_runs(id) ON DELETE CASCADE,
  calibration_offset FLOAT NOT NULL,
  week INT NOT NULL,
  prediction_count INT NOT NULL,
  mean_score FLOAT,
  median_score FLOAT,
  min_score FLOAT,
  max_score FLOAT,
  status_counts JSONB,
  predictions JSONB NOT NULL,
  site_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `check_detail` JSONB structure (reference)
```json
{
  "start_date_filter": "2026-01-06",
  "query_version": "v1.0",
  "first_rota_date": "2026-01-07",
  "start_date_discrepancy_days": 1,
  "rows": [
    {
      "source": "Approved",
      "year": 2026,
      "week": 3,
      "week_start": "13/01/2026",
      "week_end": "17/01/2026",
      "contract_type": "DPD Full Day",
      "shift_count": 5,
      "working_days": 5.0
    }
  ]
}
```

---

## Row Level Security Policies

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_results ENABLE ROW LEVEL SECURITY;

-- profiles: users read/update their own row only
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- user_apps: users can read their own app assignments
CREATE POLICY "user_apps_select_own" ON user_apps FOR SELECT USING (auth.uid() = user_id);

-- contractors: all authenticated users can read
CREATE POLICY "contractors_select_authenticated" ON contractors FOR SELECT
  USING (auth.role() = 'authenticated');

-- referrals: users see only their own; INSERT only; no UPDATE for non-admins
CREATE POLICY "referrals_select_own" ON referrals FOR SELECT
  USING (auth.uid() = recruiter_id);
CREATE POLICY "referrals_insert_own" ON referrals FOR INSERT
  WITH CHECK (auth.uid() = recruiter_id);

-- referral_checks: users can read checks for their own referrals
CREATE POLICY "referral_checks_select_own" ON referral_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM referrals r
      WHERE r.id = referral_checks.referral_id
        AND r.recruiter_id = auth.uid()
    )
  );

-- Admin bypass: service role key bypasses RLS entirely.
```

### Profile auto-creation trigger
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_id, full_name, email, is_internal, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_id', NEW.email),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'email',
    COALESCE((NEW.raw_user_meta_data->>'is_internal')::boolean, true),
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## Route Structure

```
/                              → Redirects to /apps or /login
/login                         → Username/password login
/(authenticated)/
  apps/                        → App launcher (shows authorised apps)
  apps/admin/                  → Platform user management (admin only)
  referrals/                   → My Referrals (recruiter view)
  referrals/submit/            → New referral form
  referrals/admin/             → Admin dashboard (all referrals)
  referrals/admin/checks/      → Run Checks
  reports/                     → Report runner (all report types)
  scorecards/                  → Scorecard dashboard — run pipeline, view history + results (admin only)
  fleet/                       → Vehicle status dashboard — 4 panels + assignment lookup (admin/fleet access)
  api/platform/admin/create-user     → Platform user creation (service role)
  api/platform/admin/update-user     → Platform user edit/deactivate/delete (service role)
  api/referrals/admin/run-checks      → Run Check from UI (admin, max 4 HR codes)
  api/referrals/admin/run-sync        → Contractor sync from UI (admin only)
  api/referrals/admin/update-referral → Admin referral updates (service role)
  api/reports/deposit                → Deposit report proxy
  api/reports/working-days           → Working day count proxy
  api/reports/working-days-by-client → Fleet-wide report proxy
  api/reports/settlement             → Settlement report proxy
  api/reports/branch-performance     → Branch performance trend proxy
  api/reports/download               → Excel download for any report type
  api/reports/email                  → Email report to user's own email
  api/scorecards/run                 → Trigger scorecard pipeline (admin, POST)
  api/scorecards/status              → Live pipeline status (admin, GET)
  api/scorecards/history             → Run history from Supabase (admin, GET)
  api/scorecards/results             → Prediction results for a run (admin, GET)
  api/fleet/data                     → Vehicle status data proxy (snapshot/history/contractor-history)
  api/fleet/download                 → Vehicle status Excel download
  api/fleet/email                    → Vehicle status Excel email
/api/cron/sync-reminder        → Daily sync reminder email
/api/cron/check-sync           → Missed sync detection + alert
/api/cron/referral-digest      → Daily new referrals digest
/api/cron/scorecard-run        → Trigger scorecard pipeline (Thu/Fri cron)
```

### URL redirects (for old bookmarks)
Configured in `next.config.ts`:
- `/submit` → `/referrals/submit`
- `/admin` → `/referrals/admin`
- `/admin/*` → `/referrals/admin/*`

---

## Environment Variables

### Vercel (Next.js)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
NOTIFY_FROM_EMAIL=
NOTIFY_TO_EMAILS=
CRON_SECRET=
RAILWAY_PROXY_URL=https://gsapps-production.up.railway.app
RAILWAY_PROXY_SECRET=<shared secret>
SCORECARD_SERVICE_URL=https://gsapps-production-6b04.up.railway.app
SCORECARD_SECRET=<shared secret>
```

### Railway (SQL proxy)
```
MSSQL_HOST=
MSSQL_PORT=1433
MSSQL_USER=
MSSQL_PASSWORD=
MSSQL_DATABASE=
PROXY_SECRET=<same shared secret>
PORT=3000
```

### Railway (Scorecard service)
```
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
RESEND_API_KEY_SCORECARD=
SCORECARD_SECRET=<same shared secret as Vercel>
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### Python scripts — `scripts/.env` (never commit)
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GT_DB_SERVER=
GT_DB_NAME=
GT_DB_USER=
GT_DB_PASSWORD=
GT_DB_PORT=1433
```

---

## Railway SQL Proxy

### Overview
A Node.js/Express service deployed on Railway with static outbound IPs, used to proxy SQL Server queries from Vercel (which has no static IP).

- **Public URL:** `https://gsapps-production.up.railway.app`
- **Health check:** `GET /health` → `{ status: 'ok', database: 'connected' }`
- **Auth:** `X-Report-Secret` header validated on all `/report/*` endpoints
- **Root directory:** `railway-proxy/` within the `gs_apps` repo
- **Static outbound IP:** whitelisted on Greythorn Azure SQL Server firewall

### Endpoints

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/health` | — | DB connectivity check (no auth) |
| POST | `/report/deposit` | `{ hrCode }` | Deposit report — 4 section queries |
| POST | `/report/working-days` | `{ hrCode }` | Per-contractor working day count |
| POST | `/report/working-days-by-client` | `{}` | Fleet-wide weighted days by client/branch/contract type |
| POST | `/report/settlement` | `{ hrCode }` | DA Relations settlement — deposit, vehicles, charges, remittances |
| POST | `/report/referral-check` | `{ hrCodes, startDates }` | Working day check for 1-4 referrals — approved debriefs, rota projections, first rota date |
| POST | `/report/branch-performance` | `{ weekCount? }` | Multi-week weighted days trend by client/branch/contract type (default 4 weeks, max 12) |
| POST | `/report/contractor-sync` | `{}` | All contractors — HrCode, name, active status, last worked date |
| POST | `/report/vehicle-status` | `{ mode }` | Vehicle status — snapshot (fleet overview), history (vehicle assignments), contractor-history (contractor assignments) |

### Request flow
```
Browser → Vercel API route (JWT auth + permission check)
       → Railway proxy (X-Report-Secret header)
       → SQL Server (Greythorn)
       → JSON back through the chain
```

---

## Railway Scorecard Service

### Overview
A Python/FastAPI service deployed on Railway that runs the courier scorecard processing pipeline. Downloads Amazon DSP scorecard PDFs from SharePoint (via Microsoft Graph API), extracts performance data, scores transporters with XGBoost, emails predictions via Resend, and archives results back to SharePoint.

- **Public URL:** `https://gsapps-production-6b04.up.railway.app`
- **Health check:** `GET /health` → `{ status: 'ok', service: 'scorecard' }`
- **Auth:** `X-Scorecard-Secret` header validated on `/run` and `/status` endpoints
- **Root directory:** `railway-scorecard/` within the `gs_apps` repo
- **Source:** Ported from `w0rkar0und/courier-scorecard-agent` repo (DigitalOcean droplet). Droplet cron jobs disabled — Railway is the active deployment.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Container health check |
| POST | `/run` | X-Scorecard-Secret | Trigger pipeline (runs in background thread) |
| GET | `/status` | X-Scorecard-Secret | Last run result (in-memory) |

`POST /run` accepts `?triggered_by=` query param (`scheduled`, `manual`, or `cron`).

### Pipeline Flow
```
Vercel cron (Thu/Fri) or manual trigger → POST /api/cron/scorecard-run or /api/scorecards/run
  → POST {SCORECARD_SERVICE_URL}/run (with X-Scorecard-Secret header)
    → Railway scorecard service:
      1. Downloads PDFs + master from SharePoint (Graph API)
      2. Extracts tables from PDFs (pdfplumber)
      3. Transforms to master format (pandas)
      4. Creates runtime copy of master, appends new data
      5. Runs XGBoost with 3 calibration offsets (-2.2, -2.0, -1.8)
      6. Captures predictions data for Supabase persistence
      7. Emails predictions via Resend
      8. Archives to SharePoint, cleans up inbox
      9. Writes run history + prediction results to Supabase
    → Returns result via GET /status
```

### Supabase Persistence
- **`scorecard_runs`** — one row per pipeline execution (status, files processed, week, email sent, error)
- **`scorecard_results`** — one row per run per calibration offset (predictions array, status counts, site summary)
- Written via direct Supabase REST API calls (httpx) from the Railway service
- Graceful degradation — if Supabase env vars are missing, pipeline still runs but doesn't persist

### XGBoost Model
- **Features:** Delivered, DCR, DNR DPMO, POD, CC, CE (no DEX)
- **Training:** Weeks 22–41 with known Total Score values
- **Calibration offsets:** -2.2, -2.0, -1.8 (3 prediction files per run)
- **Status thresholds:** POOR (<40), FAIR (40–60), GREAT (60–80), FANTASTIC (80–95), FANTASTIC_PLUS (95+)

### SharePoint Paths
- **Site:** DirectorsStorage / Documents
- **Inbox:** `Directors Google Sheets/Miten Stuff/Scorecards/2026/Agent Input`
- **Master:** `Directors Google Sheets/Miten Stuff/Scorecards/2026/Master Combined Input_.xlsx`
- **Archive:** `Directors Google Sheets/Miten Stuff/Scorecards/2026/Archived/WKXX/`

### Key Design Decisions
- **FastAPI** (not Flask) — lighter, async-friendly
- **Background thread** for pipeline execution — `POST /run` returns immediately
- **Thursday/Friday retry** works naturally — if Thursday processes and deletes PDFs, Friday finds nothing and returns `no_files`
- **Container filesystem** for temp files during processing — cleaned up after each run
- **`CURRENT_YEAR = 2026`** in `config.py` — needs updating in January 2027
- **Azure AD credentials** — "FV Agents OneDrive Access" app, client secret expires Feb 2028

---

## Scorecards App — Frontend

### Dashboard (`/scorecards`)
Admin-only page with:
- **Status banner** — shows last run status with coloured indicator (green/amber/red/blue)
- **"Run Scorecard" button** — triggers pipeline via `POST /api/scorecards/run`, auto-polls every 3s while running
- **Run history table** — last 20 runs with status, triggered by, started time, duration, week, files, email sent
- **Expandable results** — click a successful run row to lazy-load prediction results from Supabase (cached after first load)

### Results Detail View
- **Calibration offset tabs** — switch between -2.2, -2.0, -1.8 results
- **Summary view** — score stat cards (mean/median/min/max), status distribution (F+/Fantastic/Great/Fair/Poor with counts and percentages), site summary table
- **Predictions view** — full scrollable table of all transporter predictions (site, transporter ID, score, status badge)

### Access Control
- Admin-only at every level: middleware, server component `is_admin` check, all API routes check `is_admin`
- No `user_apps` row needed — admins bypass the access check

---

## Fleet App — Detailed Documentation

### Overview
Vehicle status dashboard for the Greythorn fleet. Queries the Greythorn DB via Railway proxy, renders client-side with Recharts visualisations. No Supabase tables — all data comes live from Greythorn.

### Data Model

Central table: **Vehicle** with JOINs to:
- Branch (via BranchId) — display uses `BranchAlias` with `BranchName` fallback
- VehicleOwnershipType — ownership classification
- VehicleModel, VehicleType, VehicleCategory, VehicleColor — fleet composition
- VehicleSupplier, VehicleInsuranceProvider, VehicleTrackerProvider, VehicleBreakdownProvider — operational details
- ContractorVehicle (OUTER APPLY) → Contractor → User → UserProfile → UserBranchRole → Branch — current assignment

**Ownership grouping:** Only `DA Supplied Vehicle` is DA Supplied. All others (Greythorn Vehicle, DPD Supplied Vehicle, Greythorn - RTB) are Greythorn. Determined by `VehicleOwnershipType.VehicleOwnershipTypeName`, not `IsOwnedByContractor`.

**Active status:** `Vehicle.IsActive` determines if a vehicle is in the fleet. `Vehicle.IsSorn` is regulatory only (SORN but active = owned, off-road).

**Assignment:** A vehicle is currently attached when `ContractorVehicle` has `FromDate <= today AND (ToDate IS NULL OR ToDate >= today)`. One vehicle can have multiple historical assignments but never two concurrent.

### Railway Proxy Endpoint

`POST /report/vehicle-status` with three modes:

| Mode | Body | Returns |
|---|---|---|
| `snapshot` | `{}` | One row per vehicle with current assignment (if any), all lookup fields |
| `history` | `{ vehicleId }` | All ContractorVehicle rows for a vehicle with contractor details |
| `contractor-history` | `{ hrCode }` | All ContractorVehicle rows for a contractor with vehicle details |

### Vercel API Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/fleet/data` | Proxy → Railway vehicle-status (all 3 modes) |
| POST | `/api/fleet/download` | ExcelJS → .xlsx download |
| POST | `/api/fleet/email` | ExcelJS → Resend email to user's own email |

### Dashboard (`/fleet`)

**Filter bar** (shared across all panels):
- Branch, Ownership (Greythorn/DA Supplied), Status (defaults to Active), Assignment (Attached/Unattached), Type, Model — dropdowns
- VRM, HR Code — text inputs with partial match
- Download Excel / Email to Me buttons

**Panel 1: Fleet Overview**
- Stat cards: Total, Active (with inactive count), SORN, Attached (with unattached count)
- Horizontal bar chart: vehicles by branch, stacked by ownership (Greythorn blue / DA green). DA supplied vehicles excluded if no current contractor
- Donut chart: Greythorn vs DA split with counts and percentages in legend

**Panel 2: Assignment Status**
- Assignment Lookup: search by VRM or HR Code — shows full current + historical assignments regardless of active status
- Stat cards: Attached, Unattached, Greythorn Unattached, Total Assignments (all-time)
- Sortable table: Registration, Branch, Ownership, Model, Type, Status (Attached/Unattached), Contractor (HR Code + Name), Contractor Branch, Attached Since
- Click any row to expand inline assignment history (lazy-loaded via `history` mode)

**Panel 3: Fleet Composition**
- Horizontal bar chart: top 15 models
- Grid cards: vehicles by type with counts

**Panel 4: Compliance**
- Filter buttons: All issues, Overdue only, Due within 30/60/90 days
- Table: Registration, Branch, Model, MOT Due (date + status badge), Road Tax Due (date + status badge), Insurance Renewal (date + status badge)
- Badges: red (Overdue), amber (Due soon — within 30 days), green (Valid)
- Sorted by urgency (overdue first)

### Access Control
- Middleware checks `user_apps` for `fleet` slug (admins bypass)
- Server component checks `is_admin` OR `user_apps` access
- API routes check same — admin or fleet-app access via `user_apps`
- Currently admin-only. Fleet team users to be added to `user_apps` with `app_slug = 'fleet'`

### Excel Export
- House-style .xlsx with 14 columns: Registration, Branch, Ownership, Model, Type, Category, Active, Contractor HR Code, Contractor Name, Contractor Branch, Attached Since, MOT Due, Road Tax Due, Insurance Renewal
- Filter summary included in title row
- Same download/email pattern as Reports app

### Key Design Decisions
1. **Single query, client-side filtering** — snapshot returns all vehicles (~hundreds), filtering/grouping happens in the browser for instant interaction
2. **Assignment history on demand** — loaded per-vehicle or per-contractor to avoid pulling thousands of rows upfront
3. **Ownership by name, not flag** — `IsOwnedByContractor` is unreliable; ownership determined by `VehicleOwnershipTypeName = 'DA Supplied Vehicle'`
4. **BranchAlias for display** — all branch display uses `ISNULL(BranchAlias, BranchName)` for shorter, familiar labels
5. **LEFT JOINs on User/UserProfile** — some contractors lack User/UserProfile rows; INNER JOINs would silently drop them from results
6. **No Supabase persistence** — all data is live from Greythorn; no run history or caching layer
7. **Default to active** — Status filter defaults to "Active" on page load
8. **DA excluded from branch chart if unattached** — DA supplied vehicles with no current contractor are not counted in the branch chart since they're not effectively in the fleet

---

## Reports App — Detailed Documentation

### Architecture

Reports follow a consistent pattern:
1. **Railway proxy** runs the SQL query and returns JSON
2. **Vercel API route** authenticates the user, checks permissions, proxies to Railway
3. **ReportRunner** client component handles form, download, and email actions
4. **Report component** renders the in-browser preview (tables + charts)
5. **Excel generator** produces house-style .xlsx for download/email

### Report Types

| Slug | Name | HR Code Required | Description |
|---|---|---|---|
| `deposit` | Deposit Report | Yes | 4-section deposit summary per contractor |
| `working-days` | Contractor - Working Day Count | Yes | Per-contractor weekly working day count |
| `working-days-by-client` | Working Days by Client | No | Fleet-wide weighted days with visualisations |
| `settlement` | DA Relations Settlement Data | Yes | 5-section settlement summary with collapsible sections |
| `branch-performance` | Branch/Client Performance | No | Multi-week weighted days trend with line chart and pivoted table |

### Access Control

Report access is controlled at two levels:
1. **App level** — user must have `reports` in `user_apps`
2. **Report level** — `permissions` JSONB on the `user_apps` row specifies which report types are allowed

Admins bypass both levels.

### Deposit Report (5 collapsible sections)
- Per-contractor deposit summary with 5 collapsible sections (chevron toggle, open by default) — same pattern as Settlement report
- **Section 1: Last Deposit Record** — latest `ContractorVehicleDeposit` with audit trail (created/updated/cancelled by)
- **Section 2: Deposit Instalment Payments** — transactions on the last deposit, with totals summary. Collapsed header shows weeks paid + remaining
- **Section 3: Vehicle Usage History** — all vehicles, non-Greythorn in italic grey. Collapsed header shows vehicle count + Greythorn count
- **Section 4: Vehicle Charges** — Greythorn vehicles only, with payment status and totals. Collapsed header shows partial paid count, unpaid count, total outstanding
- **Section 5: Deposit Return Audit** — ContractorAdditionalPay where reason = 7. Collapsed header shows return count + total amount
- **Split query pattern**: Part 1A isolates deposit ID lookup (no JOINs) to avoid SQL Server bit+JOIN silent failure, Part 1B fetches full details by PK
- Response shape: `{ contractor, deposit, transactions, vehicles, charges, depositReturns }`

### Contractor - Working Day Count
- Per-contractor, per-week summary from approved debriefs + current-week rota projections
- Two separate queries (never UNION ALL with FLOAT)
- WeightedDays computed in SQL and returned alongside ShiftCount — presentation layer uses SQL value directly

### Working Days by Client
- Fleet-wide: no HR code input, scans all approved debriefs
- Targets the **last completed** Greythorn epoch week (not current)
- Weight tiers in SQL: OSM/Support = 0.0, Sameday_6* = 0.5, Hourly contracts = 0.5 or 1.0 based on hours (< 4.5h = 0.5, >= 4.5h = 1.0), else = 1.0
- Includes `BranchAlias` for display and filtering
- **Visualisations:** filter bar (Client, Branch, Contract Type) + Recharts bar chart that drills down + grouped data table

### DA Relations Settlement Data
- Per-contractor settlement summary with 5 collapsible sections (chevron toggle, open by default)
- **Section 1: Last Deposit Record** — latest `ContractorVehicleDeposit` with audit trail (created/updated/cancelled by)
- **Section 2: Deposit Instalment Payments** — transactions on the last deposit, with totals summary. Collapsed header shows weeks paid + remaining
- **Section 3: Vehicles Assigned** — all vehicles since the deposit creation date. Uses `VehicleOwnershipType.IsOwnedByContractor` to determine DA vs non-DA supplied. Non-DA supplied (contractor-owned, `IsOwnedByContractor !== '1'`) shown in italic grey. Collapsed header shows Greythorn vehicle count
- **Section 4: Vehicle Charges** — Greythorn vehicles only, with payment status and totals. Collapsed header shows partial paid count, unpaid count, total outstanding
- **Section 5: Recent Remittance Notices** — last 2 remittance notices
- **Contractor header** shows account status (active/deactivated) from `ContractorAccountStatusHistory`
- **Split query pattern**: Part 1A isolates deposit ID lookup (no JOINs) to avoid SQL Server bit+JOIN silent failure, Part 1B fetches full details by PK
- **Vehicle ownership**: `VehicleOwnershipType` table joined via `Vehicle.VehicleOwnershipTypeId`. `IsOwnedByContractor = 1` = DA supplied (contractor's own vehicle). `IsOwnedByContractor != 1` = Greythorn/company vehicle (italic grey)
- Response shape: `{ contractor, accountStatus, deposit, transactions, vehicles, charges, remittances }`

### Excel House Style

| Element | Style |
|---|---|
| Title row | Dark navy (`#1F3864`), white bold text |
| Column headers | Dark navy (`#1F3864`), white bold text |
| Section banners | Mid-blue (`#2E75B6`), white bold text |
| Alternating data rows | White / light blue (`#DEEAF1`) |
| Nil-record notices | Amber (`#FFD966`), italic |
| Summary/total rows | Green (`#E2EFDA`), bold |
| Non-Greythorn vehicle rows | Italic grey (`#808080`) |
| Projected rota rows | Amber (`#FFD966`) |
| Zero-weight rows (OSM, Support) | Italic grey (`#808080`) |
| Gridlines | Hidden |

### Email Delivery
- "Email to Me" sends the .xlsx to the user's `email` from their `profiles` row
- If no email is set: "No email present on user setup. Please contact system admin."
- Sent via Resend from `NOTIFY_FROM_EMAIL`

### CRITICAL: Greythorn Query Rules
- **Always `CAST(... AS DATE)`** when joining to `Calendar`
- **Always `CAST(numeric AS FLOAT)`** for any numeric column
- **Never `UNION ALL` with FLOAT columns** — run as separate queries
- **Always quote `[User]`** — SQL Server reserved word
- **Debrief has no `IsDeleted`** — use `IsApproved = 1` as sole quality gate
- **Column is `RegistrationNumber`** — not `Registration`
- **Column is `VehicleSupplierName`** — not `Name`
- **`VehicleSupplierId = 2`** = Greythorn
- **`ContractorAdditionalPayReasonId = 7`** = Deposit Return
- **Hourly contract types** — `ContractType.Hourly = 1` flags hourly contracts. Hours = `ROUND(DATEDIFF(MINUTE, d.StartTime, d.EndTime) / 60.0, 0)`. If < 4.5h = 0.5 weighted day, >= 4.5h = 1.0 weighted day. NULL start/end times default to 1.0
- **BranchId from Debrief** — join `Branch` via `d.BranchId`, not `ContractType.BranchId`
- **`VehicleOwnershipTypeId`** lives on `Vehicle` table, not `ContractorVehicle`
- **DA Supplied vehicles** — `VehicleOwnershipType.IsOwnedByContractor = 1` means DA/contractor supplied their own vehicle; `!= 1` means Greythorn/company vehicle
- **`ContractorVehicleDeposit` split query** — isolate ID lookup (Part 1A) from detail fetch (Part 1B) to avoid SQL Server bit+JOIN silent failure

---

## Referrals App — Detailed Documentation

### Error Codes

| Code | Trigger | User-Facing Message |
|---|---|---|
| `REF-001` | Duplicate HR code | "This HR code has already been registered by another user. If you believe this is an error, please contact SLT quoting reference REF-001." |
| `REF-002` | Rehire within 6 months | "This contractor's last recorded working day falls within six months of the submitted start date. This referral cannot be accepted. If you believe this is an error, please contact SLT quoting reference REF-002." Only triggers when `last_worked_date` is **before** the start date (i.e. `diffDays >= 0`). If `last_worked_date` is on or after the start date the contractor is currently working — not a rehire. |
| `REF-003` | Start date >7 days in past | "Referrals cannot be backdated beyond 7 days. If you believe this is an error, please contact SLT quoting reference REF-003." |

### HR Code Validation Flow

On the `HrCodeInput` component (debounced 400ms):
1. Query `contractors` table by HR code
2. If not found → inline error
3. If `is_active = false` → inline error
4. If active → auto-populate name, run REF-001 (duplicate) and REF-002 (rehire 180-day) checks. REF-002 only fires when `last_worked_date` is before the start date (`diffDays >= 0 && diffDays < 180`); negative diff means the contractor is currently working, not a rehire
5. On submit → Supabase insert → catch `23505` → REF-001

### Python Script: `contractor_sync.py`

Queries Greythorn → upserts to Supabase `contractors` table → writes to `sync_log`.

### Python Script: `referral_check.py`

For a given HR code (or list), checks working days against Greythorn since the referral
start date, compares against 30-day threshold, writes results to Supabase.

Query version: `v1.0`. Weighted day rules: OSM/Support = 0.0, Sameday_6* = 0.5, Hourly contracts = 0.5 or 1.0 based on debrief hours (< 4.5h = half day), all others = 1.0. Computed in SQL, not presentation layer.

---

## Platform Admin Features

### User Management (`/apps/admin`)

- **Create users** — display ID, full name, email, password, type (internal/external), admin flag, app access with per-report-type permissions
- **Edit users** — inline edit of display ID, full name, email, type
- **Toggle admin** — make/remove platform admin (cannot modify own status)
- **Deactivate/Reactivate** — sets `is_active` on profile and bans/unbans in Supabase Auth
- **Reset password** — admin can set a new password for any user
- **Delete users** — with confirmation prompt, cascades via FK
- **Edit app access** — per-user app assignments with sub-permissions (e.g. report types)
- **Search** — across display ID, full name, and email

---

## Vercel Cron Jobs

| Schedule | Path | Purpose |
|---|---|---|
| 10:30 daily | `/api/cron/sync-reminder` | Email reminder to run contractor sync |
| 13:00 daily | `/api/cron/check-sync` | Alert if sync hasn't run today |
| 23:05 daily | `/api/cron/referral-digest` | Daily digest of new referral submissions |
| 14:00 Thu (UTC) | `/api/cron/scorecard-run` | Trigger scorecard pipeline (3PM UK) |
| 11:00 Fri (UTC) | `/api/cron/scorecard-run` | Scorecard retry/backup (12PM UK) |

---

## Production URLs & Services

- **App:** https://www.gsapps.co
- **Supabase:** https://fjhkowrxuczkrafczcru.supabase.co
- **GitHub:** https://github.com/w0rkar0und/gs_apps
- **Railway proxy:** https://gsapps-production.up.railway.app
- **Railway scorecard:** https://gsapps-production-6b04.up.railway.app
- **Resend sender domain:** greythornservices.uk
- **Admin email:** miten@greythorn.services

---

## Current State (as of 4 April 2026)

### Multi-App Platform — Live, Pushed to GitHub

- App launcher at `/apps` with card-based UI
- `user_apps` table for per-app access control with `permissions` JSONB
- Middleware enforces per-app authorisation
- Navbar is multi-app aware with contextual navigation — Greythorn logo PNG at 28x28px
- Navbar has hamburger menu on mobile (below `sm` breakpoint) with dropdown for nav links, user info, and sign out
- Platform admin at `/apps/admin` for user management (including admin password reset)
- Components namespaced under `components/referrals/`, `components/reports/`, `components/scorecards/`, `components/platform/`
- All referral routes under `/referrals/` prefix
- Old URLs redirected via `next.config.ts`
- Repo renamed to `gs_apps` on GitHub, Vercel, and Supabase
- Local directory renamed to `gs_apps`
- Login page uses Greythorn strapline logo with subtle gradient background, tries both `@greythorn.internal` and `@greythorn.external` domains sequentially (no regex-based domain detection)
- Browser favicon set to Greythorn "G" logo (`/greythorn-logo.png`) via metadata in `app/layout.tsx`
- **Greythorn brand identity applied** — Nunito Sans font (Avenir web fallback per brand guidelines), Greythorn blue (`#3B6E8F`, Pantone 5405 C) as primary accent, brand dark (`#58595B`) and mid (`#A7A9AC`) for text, cool grey page background (`#F7F8F9`). Brand tokens defined as CSS variables in `globals.css` via Tailwind v4 `@theme inline` block (`gt-blue`, `gt-blue-dark`, `gt-dark`, `gt-mid`, `gt-bg`). Platform-wide — all apps inherit the font and background; component-level colour swaps applied to Fleet first, other apps to follow
- Brand guidelines reference: `docs/Greythorn Brand Guidelines_V2.pdf` — primary font Avenir (Nunito Sans web fallback), Pantone 5405 C blue, Pantone Black 80%/40% greys

### Referrals App — Fully Built

All 11 original build phases complete. Referrals app is live at `/referrals/*`.
- Redundant referrals user management screen (`/referrals/admin/users`) removed — all user management via platform admin at `/apps/admin`
- My Referrals page: mobile-friendly card layout (below `sm`), desktop table unchanged
- Submit form: responsive padding (`p-5 sm:p-8`)
- Success toast: auto-dismisses after 4s with fade animation, cleans URL query param
- Empty state: icon + "Register your first referral" CTA link
- **Run Check from UI** — admin can select 1-4 referrals on `/referrals/admin/checks` and run working day checks directly from the browser (no Python script needed). Flow: ChecksPanel → Vercel API route (`/api/referrals/admin/run-checks`) → Railway proxy (`/report/referral-check`) → Greythorn SQL → results written to Supabase + summary email via Resend. Same logic as `referral_check.py` (half-day rules, threshold check, discrepancy detection, `referral_checks` audit trail). Max 4 HR codes per run, admin-only. Existing copy-paste commands retained as fallback for `--all` or terminal use.
- **Self-service Contractor Sync** — "Run Sync" button on the admin dashboard (`SyncStatusBanner`) triggers contractor sync from the browser. Flow: SyncStatusBanner → Vercel API route (`/api/referrals/admin/run-sync`) → Railway proxy (`/report/contractor-sync`) → Greythorn SQL → batch upsert to Supabase `contractors` table → `sync_log` entry with `triggered_by: 'manual'`. Ports the same SQL query from `contractor_sync.py`. Daily GitHub Actions run (`contractor-sync.yml`) unchanged as the automated scheduled sync.

### Referrals User Guide — Created

- Non-admin user guide at `docs/REFERRALS_USER_GUIDE.md` and `docs/Referrals_User_Guide.pdf`
- Written in plain English for users whose first language is not English
- Covers: submission steps, 7-day rule (REF-003), one-per-contractor rule (REF-001), 6-month returning contractor rule (REF-002), email to SLT@greythorn.services required for validation, 30-day working day threshold, half-day contract types (Nursery L1/2/3 & Sameday_6), status meanings, My Referrals page
- PDF generated via `scripts/generate_referrals_guide_pdf.py` (uses reportlab) — re-run to regenerate after edits

### Reports App — Fully Built

All 8 build phases complete plus additional reports. Reports app is live at `/reports`:
- Phase 1: Railway proxy service (deployed, health check passing)
- Phase 2: Deposit report endpoint
- Phase 3: Working day count endpoint (renamed to "Contractor - Working Day Count")
- Phase 4: Auth gate + report-level permissions
- Phase 5: Reports page with HR code input + report selector
- Phase 6: In-browser formatted report preview
- Phase 7: ExcelJS generation with house style + download
- Phase 8: Resend email delivery with .xlsx attachment
- Additional: Working Days by Client report with visualisations (filters + Recharts + grouped table)
- Additional: DA Relations Settlement Data report — 5 collapsible sections with collapsed header summaries, account status, vehicles since deposit, vehicle charges, remittances
- Deposit report updated: now uses split query pattern (like Settlement), shows only most recent deposit with instalment payments as separate section, 5 collapsible sections with collapsed header summaries
- Additional: Branch/Client Performance report — multi-week trend (default 4 weeks, max 12) extending Working Days by Client. Line chart with drill-down (client → branch → contract type), pivoted table with week columns, filters, Excel download + email

### Scorecards App — Live

Courier scorecard prediction pipeline ported from DigitalOcean droplet to Railway, with frontend dashboard at `/scorecards`:
- Railway service (`railway-scorecard/`): Python/FastAPI, processes Amazon DSP scorecard PDFs via XGBoost
- Pipeline: SharePoint download → PDF extraction → XGBoost scoring (3 calibration offsets) → email → SharePoint archive
- Supabase persistence: `scorecard_runs` (run history) + `scorecard_results` (predictions per calibration offset)
- Frontend dashboard: admin-only, trigger runs, view history, expandable prediction results with summary stats and full transporter table
- Vercel cron: Thursday 3PM UK + Friday 12PM UK (backup). Manual runs via dashboard also supported
- DigitalOcean droplet cron jobs disabled — Railway is the active deployment
- Auth: `X-Scorecard-Secret` header between Vercel and Railway (same pattern as SQL proxy)
- `CURRENT_YEAR = 2026` in `config.py` — update in January 2027
- Azure AD client secret for Graph API expires Feb 2028

### Fleet App — Live

Vehicle status dashboard at `/fleet` with live Greythorn DB queries:
- Railway proxy endpoint `POST /report/vehicle-status` with 3 modes: snapshot (fleet overview), history (per-vehicle), contractor-history (per-contractor)
- Frontend: 4-panel dashboard (Overview, Assignment, Composition, Compliance) with shared filter bar
- **Filter bar redesigned** — two-zone layout: filter strip (CSS grid of 6 dropdowns in responsive `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`, plus text inputs row) and separate action bar below (vehicle count left, Download/Email buttons right)
- Assignment Lookup: search by VRM or HR Code for full current + historical assignments regardless of active status
- Recharts visualisations: stacked bar chart by branch (Greythorn blue + brand dark grey), donut for ownership split, model bar chart (single brand colour)
- Compliance panel: MOT, Road Tax, Insurance renewal dates with red/amber/green urgency badges
- **Mobile responsive tables** — Assignment and Compliance tables use `sm:hidden` card layout / `hidden sm:block` table pattern (same as Referrals app). Assignment cards show key-value pairs with expandable history mini-cards. Compliance cards show date + badge rows per compliance type
- **Assignment table alignment fixed** — replaced CSS grid hack (`grid-cols-[20px_1fr...]` inside `<td colSpan>`) with proper `<tr>/<td>` rows using `Fragment` for expand/collapse
- **Greythorn brand identity** — stat cards with `border-l-4 border-l-gt-blue` accent, filter bar with `border-t-2 border-t-gt-blue` accent, panel tabs and compliance filter buttons use `bg-gt-blue` active state, chart colours use brand palette, all text uses `gt-dark`/`gt-mid` tokens, card shadows removed (background contrast replaces them)
- Excel download and email via ExcelJS + Resend (same pattern as Reports app)
- Access: admin or `user_apps` with `app_slug = 'fleet'`. Currently admin-only; fleet team users to be added
- Ownership: determined by `VehicleOwnershipTypeName` — only "DA Supplied Vehicle" is DA, all others are Greythorn
- Branch display: uses `BranchAlias` with `BranchName` fallback throughout
- No Supabase tables — all data live from Greythorn
- Components: `components/fleet/VehicleStatusDashboard.tsx`, `lib/excel-vehicle-status.ts`

### Build Configuration

- `next.config.ts` includes `serverExternalPackages: ['exceljs']` (Turbopack mangles external module names)
- `package.json` build script uses `next build --webpack` (Turbopack ignores `serverExternalPackages`)
- Resend client instantiated inside handler functions (not at module scope) to avoid build-time env var errors
- TypeScript pinned at 5.9.3 in package-lock.json

### Migrations

All migrations applied to Supabase:
- `001_initial_schema.sql` — core tables, RLS, triggers
- `002_user_apps.sql` — multi-app user access table
- `003_profile_fields.sql` — add full_name, email, is_active to profiles
- `004_user_apps_permissions.sql` — add permissions JSONB to user_apps
- `005_sync_log_rls.sql` — enable RLS on sync_log
- `006_scorecard_runs.sql` — scorecard run history table
- `007_scorecard_results.sql` — scorecard prediction results table

### Users

- **Admin:** m.patel (external, is_admin: true) — platform superadmin
- **12 recruiter accounts** — internal, granted `referrals` app access
- **165 referrals** seeded from 2025 data
- **3,441 contractors** synced from Greythorn (last sync: 18 March 2026)

### Key Technical Decisions

1. **Active/inactive status** uses `ContractorAccountStatusHistory.Active` (not `CurrentRecruitmentStatusId`)
2. **Status change date** from `ContractorAccountStatusHistory.CreatedAt`
3. **ODBC Driver auto-detection** — Python scripts detect ODBC Driver 18 or 17 automatically via `get_odbc_driver()`
4. **Profile trigger** requires `SET search_path = public`
5. **REF-001 duplicate check** runs during HR code validation, before REF-002
6. **Greythorn DB is Azure SQL** — accessed via Railway proxy for static IP
7. **`is_admin` on profiles** is platform-wide superadmin — admins bypass all app access checks
8. **`user_apps` table** gates per-user app access; middleware checks on every request
9. **`permissions` JSONB** on `user_apps` for sub-level access (e.g. per-report-type)
10. **Railway proxy** provides static outbound IP for SQL Server whitelist
11. **`is_active` null safety** — frontend uses `=== false` to treat null (pre-migration) as active
12. **Email delivery** goes to user's own email from profiles; errors if no email set
13. **`autoComplete="off"`** on all forms to prevent browser value retention
14. **Login domain detection** — tries both internal and external domains sequentially; no restriction on username format for internal users
15. **No temporary files** — all processing stays in memory across the entire chain (Vercel, Railway, Supabase); Excel buffers, JSON payloads all in-memory
16. **`ContractorVehicleDeposit` split query** — Part 1A isolates ID, Part 1B fetches details, to avoid SQL Server bit+JOIN silent failure
17. **Vehicle ownership** — `VehicleOwnershipType` joined via `Vehicle.VehicleOwnershipTypeId`; `IsOwnedByContractor = 1` = DA supplied (contractor's own); `!= 1` = Greythorn/company vehicle
18. **Run Check from UI** — Railway proxy runs SQL queries (including weighted day calculation for hourly contracts), Vercel route handles threshold check, discrepancy detection, Supabase writes, and Resend email. Max 4 HR codes per run to keep response times under 10s. `selectAllVisible` caps at 4. Python script `referral_check.py` still used for `--all` bulk runs
19. **Weighted days in SQL** — all weighted day calculations (half-day rules, hourly contracts, zero-weight types) are computed in the Railway proxy SQL, not in the presentation layer. The TypeScript `calcWorkingDays` function in `lib/working-days.ts` is no longer used
20. **Scorecard service** — separate Railway service (`railway-scorecard/`) from the SQL proxy (`railway-proxy/`). Uses FastAPI + background thread; pipeline runs asynchronously after `POST /run` returns
21. **Scorecard Supabase persistence** — uses direct REST API calls via `httpx` (not `supabase-py`) to keep the Docker image lighter. Graceful degradation if env vars missing
22. **Scorecard predictions capture** — predictions data is extracted from Excel sheets in-memory before the archive step deletes the files. Stored as JSONB in `scorecard_results`
23. **Scorecard container temp files** — runtime copies, extracted data, model outputs are within the container filesystem (not external systems), so this doesn't violate the no-temp-files rule
24. **Scorecard Thursday/Friday pattern** — if Thursday processes and deletes PDFs from SharePoint inbox, Friday naturally finds nothing and returns `no_files`. No explicit skip logic needed
25. **Fleet ownership by name** — `VehicleOwnershipType.IsOwnedByContractor` flag is unreliable; ownership determined by `VehicleOwnershipTypeName = 'DA Supplied Vehicle'` explicitly. "Greythorn Vehicle", "DPD Supplied Vehicle", "Greythorn - RTB" are all Greythorn
26. **Fleet BranchAlias** — all fleet branch display uses `ISNULL(BranchAlias, BranchName)` for shorter labels, consistent with Reports app
27. **Fleet LEFT JOINs** — User/UserProfile joins in fleet queries must be LEFT JOIN, not INNER — some contractors lack these rows and INNER JOINs silently drop them from results
28. **Fleet client-side filtering** — snapshot returns entire fleet (~hundreds of vehicles), all filtering/grouping happens in-browser for instant interaction. Assignment history loaded on demand per vehicle/contractor
29. **Fleet Greythorn DB columns** — some columns in the DBeaver ERD export do not exist in the actual database (e.g. `DartFrontAccount`, `SpareKey`, `Logbook`, `CongestionAccount`, `Route`). Always verify column existence before adding to queries
30. **Greythorn brand tokens** — defined as CSS variables in `globals.css` `:root` and exposed via Tailwind v4 `@theme inline` block. Token names: `gt-blue` (`#3B6E8F`), `gt-blue-dark` (`#2D5670`), `gt-dark` (`#58595B`), `gt-mid` (`#A7A9AC`), `gt-bg` (`#F7F8F9`). Use `text-gt-dark` / `text-gt-mid` / `bg-gt-blue` etc. in Tailwind classes
31. **Nunito Sans font** — loaded via `next/font/google` in `app/layout.tsx` with weights 300, 400, 600, 700. CSS variable `--font-nunito-sans`. Replaces Geist as the platform-wide sans-serif font
32. **Mobile table pattern** — `sm:hidden` card list + `hidden sm:block` table, matching Referrals app pattern. Used in Fleet Assignment and Compliance panels. Lookup result tables left as-is (small enough for horizontal scroll)
33. **Assignment table proper rows** — uses `Fragment` from React to wrap data `<tr>` + expanded history `<tr>` as siblings inside `<tbody>`. Never use CSS grid inside `<td colSpan>` for table row simulation — it causes column misalignment

---

## Outstanding Work

### Fleet Dashboard — Loading/Transition States

**Status:** Not started. Design review feedback item, not yet specced.

**What:** The Fleet dashboard has no loading skeletons or panel transitions. Loading states are plain text ("Loading fleet data...", "Loading..."). Panel switches are instant conditional renders with no transition.

**Scope:**
- Skeleton loaders for the initial fleet data load (stat cards, chart containers, table area)
- Subtle fade or slide transition when switching between panels (Overview → Assignment → Composition → Compliance)
- Skeleton or spinner for assignment history expansion (per-vehicle lazy load)

**Why:** High-impact polish for a data-heavy dashboard. Prevents jarring pop-in of large tables and charts.

**Design specs and plans location:** `docs/superpowers/specs/` and `docs/superpowers/plans/`

### Platform-Wide Brand Rollout

**Status:** Fleet done. Other apps pending.

**What:** Fleet dashboard has full Greythorn brand identity (colours, typography, surface treatments). Referrals, Reports, and Scorecards still use default Tailwind colour classes (`text-slate-*`, `bg-blue-*`, `bg-emerald-*`). Font and page background are already platform-wide — only component-level colour swaps remain for each app.

---

## Working Style Notes

- British English throughout all user-facing text
- All dates displayed DD/MM/YYYY (UK locale)
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser-side code
- **No temporary files** — never write temp files to any system in the chain; all processing must stay in memory
- If a Greythorn query produces unexpected results, check the CRITICAL rules section first
- When adding a new app, follow the "How to add a new app" checklist above
- When adding a new report type, update: Railway proxy endpoint, Vercel API route, ReportRunner labels, reports page ALL_REPORT_TYPES, Excel generator, download/email routes, APP_PERMISSIONS in PlatformUserManagement

---

*End of CLAUDE.md*
