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

from fastapi import FastAPI, HTTPException, Header
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

def _run_pipeline():
    """Full pipeline: download → process → cleanup. Runs in background thread."""
    global _running, _last_run

    _last_run["status"] = "running"
    _last_run["started_at"] = datetime.now().isoformat()
    _last_run["completed_at"] = None
    _last_run["result"] = None
    _last_run["error"] = None

    pdfs = None

    try:
        # Step 1: Download source files from SharePoint
        pdfs = download_source_files()

        if not pdfs:
            log.info("No PDFs found on SharePoint. Nothing to process.")
            _last_run["status"] = "no_files"
            _last_run["completed_at"] = datetime.now().isoformat()
            _last_run["result"] = {"status": "no_files", "files_processed": 0}
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

    except Exception as e:
        log.error("Pipeline failed: %s", e, exc_info=True)
        _last_run["status"] = "error"
        _last_run["error"] = str(e)

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
def run(x_scorecard_secret: str | None = Header(None)):
    _check_auth(x_scorecard_secret)

    global _running
    with _lock:
        if _running:
            raise HTTPException(status_code=409, detail="Pipeline already running")
        _running = True

    thread = threading.Thread(target=_run_pipeline, daemon=True)
    thread.start()

    return {"status": "started", "started_at": datetime.now().isoformat()}
