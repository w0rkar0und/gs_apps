# CLAUDE.md — Scorecard Service (Railway)

## Session Handoff — 3 April 2026

### What This Is

A Railway-deployed Python service that runs the courier scorecard processing pipeline (previously only on a DigitalOcean droplet). It downloads Amazon DSP scorecard PDFs from SharePoint, extracts performance data, scores transporters with XGBoost, emails predictions via Resend, and archives results back to SharePoint.

This is a **parallel deployment** — the DigitalOcean droplet is unchanged and still running. Both can coexist because they read from the same SharePoint inbox, but only one should be active in production at a time.

### Source

Ported from the `w0rkar0und/courier-scorecard-agent` repo (local: `C:\Users\miten\Documents\GitHub\courier-scorecard-agent\`). The core pipeline modules (`extract_pdf.py`, `transform.py`, `run_model.py`, `email_report.py`, `onedrive_client.py`) are unchanged copies. `config.py` and `main.py` were adapted to remove Mac/Windows branches and use Docker paths (`/app/data/`).

### What Was Built

```
railway-scorecard/
├── Dockerfile              # Python 3.12-slim, uvicorn on port 3000
├── requirements.txt        # Pinned versions
├── .gitignore
├── server.py               # FastAPI wrapper — /health, /status, /run
├── scorecard_agent/
│   ├── config.py           # Docker paths, USE_GRAPH_API=True always
│   ├── main.py             # 7-step pipeline, Graph API archiving only
│   ├── extract_pdf.py      # PDF → pandas (pdfplumber)
│   ├── transform.py        # Raw → master format
│   ├── run_model.py        # XGBoost scoring, 3 calibration offsets
│   └── email_report.py     # Resend email with Excel attachments
└── onedrive_client/
    └── onedrive_client.py  # Microsoft Graph API client for SharePoint
```

Plus two changes in the main gs_apps codebase:

- **`app/api/cron/scorecard-run/route.ts`** — Vercel cron route that POSTs to Railway `/run`
- **`vercel.json`** — Two new cron entries: Thu 2PM UTC (3PM UK), Fri 11AM UTC (12PM UK)

### How It Works

```
Vercel cron (Thu/Fri) → POST /api/cron/scorecard-run
  → POST {SCORECARD_SERVICE_URL}/run (with X-Scorecard-Secret header)
    → Railway scorecard service:
      1. Downloads PDFs + master from SharePoint (Graph API)
      2. Extracts tables from PDFs (pdfplumber)
      3. Transforms to master format (pandas)
      4. Creates runtime copy of master, appends new data
      5. Runs XGBoost with 3 calibration offsets (-2.2, -2.0, -1.8)
      6. Emails predictions via Resend
      7. Archives to SharePoint, cleans up inbox
    → Returns result via GET /status
```

The Thursday/Friday retry works naturally — if Thursday processes and deletes the PDFs from SharePoint, Friday finds nothing and returns `no_files`.

### What Still Needs Doing

#### 1. Deploy & Test (BEFORE anything else)

**Railway dashboard — create new service:**
- Source: `gs_apps` repo, root directory: `railway-scorecard/`
- Port: 3000 (auto-detected from Dockerfile)
- Environment variables:

| Variable | Value | Notes |
|---|---|---|
| `AZURE_TENANT_ID` | (same as droplet) | Greythorn Services tenant |
| `AZURE_CLIENT_ID` | (same as droplet) | "FV Agents OneDrive Access" app |
| `AZURE_CLIENT_SECRET` | (same as droplet) | Expires Feb 2028 |
| `RESEND_API_KEY_SCORECARD` | (same as droplet) | Resend key for reports@ |
| `SCORECARD_SECRET` | (generate a new shared secret) | Shared with Vercel |

**Vercel dashboard — add env vars:**

| Variable | Value |
|---|---|
| `SCORECARD_SERVICE_URL` | `https://<railway-scorecard-service>.up.railway.app` |
| `SCORECARD_SECRET` | (same value as Railway) |

**Testing steps (in order):**

1. **Health check** — `GET /health` on the Railway URL. Confirms container starts and uvicorn serves.
2. **Full pipeline** — `POST /run` (with `X-Scorecard-Secret` header). Then poll `GET /status` to see the result. If no PDFs are in the SharePoint inbox, expect `{"status": "no_files"}` — this still validates Graph API auth and SharePoint connectivity.
3. **Vercel cron route** — `curl -H "Authorization: Bearer <CRON_SECRET>" https://www.gsapps.co/api/cron/scorecard-run` — confirms Vercel can reach Railway and pass auth through.

The main risk is Graph API credentials and SharePoint paths working from the Railway container. The pipeline code itself is proven from the droplet.

#### 2. Supabase `scorecard_runs` Table (Optional)

Add a table to persist run history (currently only in-memory via `/status`). Would allow the frontend to show run history. Not blocking — can be added later.

#### 3. Frontend `/scorecards` Page (Optional)

A page in gs_apps to trigger runs and view history. Requires step 2 first. Not blocking.

### Key Design Decisions

- **FastAPI** (not Flask) — lighter, async-friendly, auto-generates OpenAPI docs
- **Background thread** for pipeline execution — `POST /run` returns immediately, pipeline runs in a daemon thread. Status tracked in-memory via `GET /status`
- **No `run_scheduled.py`** — Thursday/Friday logic handled naturally by the SharePoint inbox state (processed = deleted = nothing for Friday to find)
- **No `run_scorecard.py`** — its download/cleanup/scheduling logic is inlined in `server.py`
- **Auth** via `X-Scorecard-Secret` header — same pattern as SQL proxy's `X-Report-Secret`
- **Container filesystem** for temp files during processing — runtime copies, extracted data, model outputs are all cleaned up after each run. This is within the container, not external systems, so it doesn't violate the no-temp-files rule
- **`CURRENT_YEAR = 2026`** in `config.py` — needs updating in January 2027

### Environment Variables Reference

| Variable | Where | Purpose |
|---|---|---|
| `AZURE_TENANT_ID` | Railway | Azure AD tenant for Graph API |
| `AZURE_CLIENT_ID` | Railway | Azure AD app client ID |
| `AZURE_CLIENT_SECRET` | Railway | Azure AD app client secret |
| `RESEND_API_KEY_SCORECARD` | Railway | Resend API key for email |
| `SCORECARD_SECRET` | Railway + Vercel | Shared auth secret |
| `SCORECARD_SERVICE_URL` | Vercel | Railway service public URL |
| `CRON_SECRET` | Vercel | Existing Vercel cron auth |
