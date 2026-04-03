"""
Scorecard Service — HTTP wrapper for the courier scorecard pipeline.

Endpoints:
    GET  /health  — health check
    GET  /status  — last run result
    POST /run     — trigger the full pipeline (runs in background thread)
"""
import os
import sys
import logging
import threading
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.responses import JSONResponse

# Add module paths so scorecard_agent and onedrive_client are importable
sys.path.insert(0, "/app/scorecard_agent")
sys.path.insert(0, "/app/onedrive_client")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("scorecard_server")

app = FastAPI(title="Scorecard Service")

# ── State ────────────────────────────────────────────────────────────────────

_lock = threading.Lock()
_running = False

_last_run = {
    "status": "idle",
    "started_at": None,
    "completed_at": None,
    "result": None,
    "error": None,
}


# ── Auth ─────────────────────────────────────────────────────────────────────

SCORECARD_SECRET = os.environ.get("SCORECARD_SECRET")


def _check_auth(secret: str | None):
    """Validate the X-Scorecard-Secret header if SCORECARD_SECRET is set."""
    if SCORECARD_SECRET and secret != SCORECARD_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorised")


# ── Supabase persistence ────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


def _supabase_insert(row: dict) -> str | None:
    """Insert a row into scorecard_runs. Returns the row id or None on failure."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        log.warning("Supabase not configured — skipping persistence")
        return None
    try:
        resp = httpx.post(
            f"{SUPABASE_URL}/rest/v1/scorecard_runs",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json=row,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()[0]["id"]
    except Exception as e:
        log.error("Supabase insert failed: %s", e)
        return None


def _supabase_update(row_id: str, updates: dict):
    """Update a scorecard_runs row by id."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or not row_id:
        return
    try:
        resp = httpx.patch(
            f"{SUPABASE_URL}/rest/v1/scorecard_runs?id=eq.{row_id}",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
            },
            json=updates,
            timeout=10,
        )
        resp.raise_for_status()
    except Exception as e:
        log.error("Supabase update failed: %s", e)


def _supabase_save_results(run_id: str, predictions_data: list):
    """Save prediction results to scorecard_results table."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or not run_id:
        return
    for entry in predictions_data:
        try:
            resp = httpx.post(
                f"{SUPABASE_URL}/rest/v1/scorecard_results",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "run_id": run_id,
                    "calibration_offset": entry["calibration_offset"],
                    "week": entry["week"],
                    "prediction_count": entry["prediction_count"],
                    "mean_score": entry.get("mean_score"),
                    "median_score": entry.get("median_score"),
                    "min_score": entry.get("min_score"),
                    "max_score": entry.get("max_score"),
                    "status_counts": entry.get("status_counts"),
                    "predictions": entry["predictions"],
                    "site_summary": entry.get("site_summary"),
                },
                timeout=30,
            )
            resp.raise_for_status()
            log.info("Saved results for offset %+.1f (%d predictions)",
                     entry["calibration_offset"], entry["prediction_count"])
        except Exception as e:
            log.error("Supabase results save failed for offset %+.1f: %s",
                      entry["calibration_offset"], e)


# ── SharePoint download + cleanup ───────────────────────────────────────────

DATA_DIR = Path("/app/data")
INBOX_DIR = DATA_DIR / "agent_input"
MASTER_PATH = DATA_DIR / "Master Combined Input_.xlsx"


def download_source_files() -> list[Path]:
    """Download scorecard PDFs and master file from SharePoint via Graph API."""
    from onedrive_client import OneDriveClient, OneDriveClientError
    from config import GRAPH_SITE_NAME, GRAPH_LIBRARY_NAME, GRAPH_INBOX_PATH, GRAPH_MASTER_PATH

    client = OneDriveClient()

    INBOX_DIR.mkdir(parents=True, exist_ok=True)

    # Download PDFs
    log.info("Downloading PDFs from SharePoint Agent Input folder...")
    pdfs = client.download_folder(
        site_name=GRAPH_SITE_NAME,
        library_name=GRAPH_LIBRARY_NAME,
        folder_path=GRAPH_INBOX_PATH,
        local_dir=INBOX_DIR,
        extension_filter=".pdf",
    )
    log.info("Downloaded %d PDF files", len(pdfs))

    # Download master file
    log.info("Downloading master file from SharePoint...")
    client.download_file(
        site_name=GRAPH_SITE_NAME,
        library_name=GRAPH_LIBRARY_NAME,
        file_path=GRAPH_MASTER_PATH,
        local_path=MASTER_PATH,
    )
    log.info("Master file downloaded: %.1f KB", MASTER_PATH.stat().st_size / 1024)

    return pdfs


def cleanup_sharepoint_inbox(pdf_names: list[str]):
    """Delete processed PDFs from SharePoint Agent Input folder."""
    from onedrive_client import OneDriveClient, OneDriveClientError
    from config import GRAPH_SITE_NAME, GRAPH_LIBRARY_NAME, GRAPH_INBOX_PATH

    client = OneDriveClient()
    deleted = 0

    for name in pdf_names:
        src = f"{GRAPH_INBOX_PATH}/{name}"
        try:
            client.delete_file(GRAPH_SITE_NAME, GRAPH_LIBRARY_NAME, src)
            log.info("Deleted from SharePoint inbox: %s", name)
            deleted += 1
        except Exception as e:
            log.error("Failed to delete '%s' from inbox: %s", name, e)

    log.info("Cleaned up %d/%d files from SharePoint inbox", deleted, len(pdf_names))


# ── Pipeline runner ──────────────────────────────────────────────────────────

def _run_pipeline(triggered_by: str = "scheduled"):
    """Full pipeline: download → process → cleanup. Runs in background thread."""
    global _running, _last_run

    started_at = datetime.now().isoformat()
    _last_run["status"] = "running"
    _last_run["started_at"] = started_at
    _last_run["completed_at"] = None
    _last_run["result"] = None
    _last_run["error"] = None

    # Persist start to Supabase
    row_id = _supabase_insert({
        "status": "running",
        "triggered_by": triggered_by,
        "started_at": started_at,
    })

    pdfs = None

    try:
        # Step 1: Download source files from SharePoint
        pdfs = download_source_files()

        if not pdfs:
            log.info("No PDFs found on SharePoint. Nothing to process.")
            _last_run["status"] = "no_files"
            _last_run["completed_at"] = datetime.now().isoformat()
            _last_run["result"] = {"status": "no_files", "files_processed": 0}
            _supabase_update(row_id, {
                "status": "no_files",
                "completed_at": _last_run["completed_at"],
                "files_processed": 0,
            })
            return

        # Step 2: Run the processing pipeline
        from main import process_inbox
        result = process_inbox()

        # Step 3: Clean up SharePoint inbox on success
        if result and result.get("status") == "success" and pdfs:
            pdf_names = [p.name for p in pdfs]
            cleanup_sharepoint_inbox(pdf_names)

        _last_run["status"] = result.get("status", "completed") if result else "completed"
        _last_run["result"] = _serialise_result(result)

        _supabase_update(row_id, {
            "status": _last_run["status"],
            "completed_at": datetime.now().isoformat(),
            "files_processed": result.get("files_processed") if result else None,
            "records_added": result.get("records_added") if result else None,
            "week": result.get("week") if result else None,
            "email_sent": result.get("email_sent") if result else None,
            "result": _serialise_result(result),
        })

        # Save prediction results
        predictions_data = result.get("predictions_data", []) if result else []
        if predictions_data and row_id:
            _supabase_save_results(row_id, predictions_data)

    except Exception as e:
        log.error("Pipeline failed: %s", e, exc_info=True)
        _last_run["status"] = "error"
        _last_run["error"] = str(e)
        _supabase_update(row_id, {
            "status": "error",
            "completed_at": datetime.now().isoformat(),
            "error": str(e),
        })

    finally:
        _last_run["completed_at"] = datetime.now().isoformat()
        with _lock:
            _running = False


def _serialise_result(result: dict | None) -> dict | None:
    """Ensure result dict is JSON-serialisable (convert Path objects etc.)."""
    if result is None:
        return None
    clean = {}
    for k, v in result.items():
        if isinstance(v, Path):
            clean[k] = str(v)
        elif isinstance(v, list) and v and isinstance(v[0], Path):
            clean[k] = [str(p) for p in v]
        else:
            clean[k] = v
    return clean


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "scorecard"}


@app.get("/status")
def status(x_scorecard_secret: str | None = Header(None)):
    _check_auth(x_scorecard_secret)
    return _last_run


@app.post("/run")
def run(
    x_scorecard_secret: str | None = Header(None),
    triggered_by: str = Query(default="scheduled"),
):
    _check_auth(x_scorecard_secret)

    if triggered_by not in ("scheduled", "manual", "cron"):
        triggered_by = "scheduled"

    global _running
    with _lock:
        if _running:
            raise HTTPException(status_code=409, detail="Pipeline already running")
        _running = True

    thread = threading.Thread(target=_run_pipeline, args=(triggered_by,), daemon=True)
    thread.start()

    return {"status": "started", "started_at": datetime.now().isoformat()}
