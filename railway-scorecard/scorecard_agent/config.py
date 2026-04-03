"""
Configuration for Courier Scorecard Processing Agent — Railway deployment

All file operations use the Graph API (Linux/Docker container).
Local paths are temporary workspace within the container.
"""
import os
from pathlib import Path

# ============================================================================
# PLATFORM DETECTION
# ============================================================================

# Railway is always Linux Docker — always use Graph API for SharePoint
USE_GRAPH_API = True

# ============================================================================
# PATH CONFIGURATION (container-local, temporary workspace)
# ============================================================================

_DATA_DIR = Path("/app/data")
BASE_PATH = _DATA_DIR / "archived"
INBOX_PATH = _DATA_DIR / "agent_input"
MASTER_FILE = _DATA_DIR / "Master Combined Input_.xlsx"

# ============================================================================
# GRAPH API SETTINGS (SharePoint file paths)
# ============================================================================

GRAPH_SITE_NAME = "DirectorsStorage"
GRAPH_LIBRARY_NAME = "Documents"
GRAPH_INBOX_PATH = "Directors Google Sheets/Miten Stuff/Scorecards/2026/Agent Input"
GRAPH_MASTER_PATH = "Directors Google Sheets/Miten Stuff/Scorecards/2026/Master Combined Input_.xlsx"
GRAPH_ARCHIVE_PATH = "Directors Google Sheets/Miten Stuff/Scorecards/2026/Archived"

# ============================================================================
# XGBOOST MODEL SETTINGS
# ============================================================================

XGBOOST_SCRIPT_DIR = Path(__file__).parent
XGBOOST_SCRIPT_NAME = "run_model.py"

CALIBRATION_OFFSETS = [-2.2, -2.0, -1.8]

TRAINING_WEEKS_START = 22
TRAINING_WEEKS_END = 41

# ============================================================================
# EMAIL CONFIGURATION
# ============================================================================

EMAIL_ENABLED = True
EMAIL_RECIPIENT = "rep_agent@greythorn.services"
EMAIL_SENDER = "reports@greythornservices.uk"
EMAIL_SUBJECT_PREFIX = "DSP Scorecard Predictions"

RESEND_API_KEY = os.environ.get("RESEND_API_KEY_SCORECARD")
if not RESEND_API_KEY and EMAIL_ENABLED:
    import logging as _logging
    _logging.getLogger(__name__).warning(
        "RESEND_API_KEY_SCORECARD not set — email sending will fail. "
        "Set it in the Railway dashboard."
    )

# ============================================================================
# PDF EXTRACTION SETTINGS
# ============================================================================

TABLE_START_MARKER = "DSP WEEKLY SUMMARY"
TABLE_STOP_MARKER = "Drivers With Working Hour Exceptions"
TABLE_START_PAGE = 3

# ============================================================================
# COLUMN MAPPING CONFIGURATION
# ============================================================================

COLUMN_RENAME = {
    "Transporter ID": "Transporter ID",
    "Delivered": "Delivered",
    "DCR": "DCR",
    "DSC DPMO": "DNR DPMO",
    "POD": "POD",
    "CC": "CC",
    "CE": "CE",
}

COLUMNS_TO_DROP = ["LoR DPMO", "CDF DPMO", "PSB"]

COLUMNS_TO_ADD_NAN = ["Status", "Total Score", "DEX", "Focus Area"]

MASTER_COLUMN_ORDER = [
    "Week",
    "Transporter ID",
    "Status",
    "Total Score",
    "Delivered",
    "DCR",
    "DNR DPMO",
    "POD",
    "CC",
    "CE",
    "DEX",
    "Focus Area",
    "Site",
]

CURRENT_YEAR = 2026
