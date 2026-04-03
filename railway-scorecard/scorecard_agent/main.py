"""
Courier Scorecard Processing Agent - Main Orchestrator

Workflow:
1. Scan inbox folder for PDF files
2. Extract table data from each PDF
3. Transform to master format
4. Create runtime copy of master, append new data
5. Run XGBoost scoring model (against runtime copy)
6. Email predictions report
7. Archive files to SharePoint (Graph API)

The master file is READ ONLY and is NEVER modified.
A disposable runtime copy is used for all processing.
"""
import logging
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

import pandas as pd

from config import (
    INBOX_PATH, MASTER_FILE, BASE_PATH, MASTER_COLUMN_ORDER,
    CALIBRATION_OFFSETS, EMAIL_ENABLED, USE_GRAPH_API,
    GRAPH_SITE_NAME, GRAPH_LIBRARY_NAME, GRAPH_ARCHIVE_PATH,
)
from extract_pdf import process_single_pdf
from transform import transform_to_master_format, combine_site_dataframes, validate_master_format
from run_model import run_xgboost_model
from email_report import send_predictions_email


# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================

LOG_FILE = Path(__file__).parent / "agent_log.txt"


def setup_logging():
    """Configure logging to both console and agent log file."""
    logger = logging.getLogger("scorecard_agent")
    logger.setLevel(logging.DEBUG)

    # Clear any existing handlers
    logger.handlers.clear()

    # File handler
    file_handler = logging.FileHandler(LOG_FILE, mode='a', encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_format = logging.Formatter('%(asctime)s | %(levelname)s | %(message)s')
    file_handler.setFormatter(file_format)
    logger.addHandler(file_handler)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_format = logging.Formatter('%(message)s')
    console_handler.setFormatter(console_format)
    logger.addHandler(console_handler)

    return logger


log = setup_logging()


# =============================================================================
# GRAPH API CLIENT (lazy-loaded)
# =============================================================================

_graph_client = None


def get_graph_client():
    """Lazy-load the OneDrive/Graph API client."""
    global _graph_client
    if _graph_client is None:
        from onedrive_client import OneDriveClient
        _graph_client = OneDriveClient()
    return _graph_client


# =============================================================================
# FILE MANAGEMENT FUNCTIONS
# =============================================================================

def find_pdf_files(inbox_path: Path) -> List[Path]:
    """Find all PDF files in the inbox folder."""
    if not inbox_path.exists():
        raise FileNotFoundError(f"Inbox folder not found: {inbox_path}")

    # Deduplicate: on some systems, *.pdf and *.PDF match the same files
    pdfs = list(dict.fromkeys(
        list(inbox_path.glob("*.pdf")) + list(inbox_path.glob("*.PDF"))
    ))
    return sorted(pdfs)


def create_week_archive_folder(week_number: int) -> Path:
    """Create local archive folder for the week: WKXX format."""
    folder_name = f"WK{week_number:02d}"
    folder_path = BASE_PATH / folder_name
    folder_path.mkdir(parents=True, exist_ok=True)
    return folder_path


def create_runtime_copy(master_path: Path) -> Path:
    """
    Create a disposable runtime copy of the master file for processing.
    The original master is NEVER modified.
    Returns path to the runtime copy.
    """
    runtime_path = master_path.parent / f"{master_path.stem}_runtime{master_path.suffix}"
    shutil.copy2(master_path, runtime_path)
    return runtime_path


def cleanup_runtime_copy(runtime_path: Path) -> None:
    """
    Remove the runtime copy after processing.
    Safe to call even if file doesn't exist.
    """
    if runtime_path and runtime_path.exists():
        runtime_path.unlink()
        log.info(f"Cleaned up runtime file: {runtime_path.name}")


def upload_to_sharepoint(local_path: Path, week_number: int) -> bool:
    """Upload a single file to SharePoint archive folder via Graph API."""
    client = get_graph_client()
    remote_path = f"{GRAPH_ARCHIVE_PATH}/WK{week_number:02d}/{local_path.name}"

    try:
        client.upload_file(
            site_name=GRAPH_SITE_NAME,
            library_name=GRAPH_LIBRARY_NAME,
            remote_path=remote_path,
            local_path=local_path,
        )
        log.info(f"  Uploaded to SharePoint: {local_path.name}")
        return True
    except Exception as e:
        log.error(f"  SharePoint upload FAILED for {local_path.name}: {e}")
        return False


def archive_to_sharepoint(
    pdf_files: List[Path],
    extracted_xlsx: Path,
    model_output_files: List[Path],
    week_number: int,
) -> Dict[str, Any]:
    """
    Upload all archive files to SharePoint and clean up local copies.

    Returns:
        dict with upload results: {"uploaded": int, "failed": int, "files": [...]}
    """
    results = {"uploaded": 0, "failed": 0, "files": []}

    all_files = list(pdf_files) + [extracted_xlsx] + list(model_output_files)

    for f in all_files:
        if f and f.exists():
            if upload_to_sharepoint(f, week_number):
                results["uploaded"] += 1
                results["files"].append(f.name)
                # Delete local copy after successful upload
                f.unlink()
                log.info(f"  Deleted local: {f.name}")
            else:
                results["failed"] += 1
                log.warning(f"  KEPT local (upload failed): {f.name}")

    return results


# =============================================================================
# MAIN PROCESSING PIPELINE
# =============================================================================

def process_inbox(
    inbox_path: Path = INBOX_PATH,
    master_path: Path = MASTER_FILE,
    dry_run: bool = False,
    skip_email: bool = False,
    skip_model: bool = False,
) -> Dict[str, Any]:
    """
    Main processing function.

    Args:
        inbox_path: Path to folder containing input PDFs
        master_path: Path to master Excel file (READ ONLY - never modified)
        dry_run: If True, process fully (inc. email) but don't archive
        skip_email: If True, skip sending email
        skip_model: If True, skip running XGBoost model

    Returns:
        dict with processing summary
    """
    log.info("=" * 70)
    log.info("COURIER SCORECARD PROCESSING AGENT")
    log.info(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log.info(f"Platform: Graph API -> SharePoint (Railway)")
    if dry_run:
        log.info("MODE: DRY RUN (files not archived)")
    log.info("=" * 70)

    result = {
        "status": "unknown",
        "files_processed": 0,
        "records_added": 0,
        "week": None,
        "archive_folder": None,
        "model_output": None,
        "email_sent": False,
    }

    runtime_path = None  # Track for cleanup in finally block
    model_output_files = []  # Track all model outputs for cleanup/archiving

    try:
        # =====================================================================
        # STEP 1: Find PDF files
        # =====================================================================
        log.info("[1/7] Scanning inbox for PDF files...")
        pdf_files = find_pdf_files(inbox_path)

        if not pdf_files:
            log.info("No PDF files found in inbox. Nothing to process.")
            result["status"] = "no_files"
            return result

        log.info(f"Found {len(pdf_files)} PDF file(s)")

        # =====================================================================
        # STEP 2: Extract data from each PDF
        # =====================================================================
        log.info("[2/7] Extracting data from PDFs...")
        extracted_dfs = []
        week_numbers = set()

        for pdf_path in pdf_files:
            try:
                df, site_code, week_num = process_single_pdf(pdf_path)
                extracted_dfs.append((df, week_num))
                week_numbers.add(week_num)
                log.info(f"  {pdf_path.name}: {len(df)} transporters, Site={site_code}, Week={week_num}")
            except Exception as e:
                log.error(f"  ERROR processing {pdf_path.name}: {e}")
                raise

        # Validate all PDFs are from the same week
        if len(week_numbers) > 1:
            raise ValueError(f"PDFs contain multiple weeks: {week_numbers}. Process one week at a time.")

        week_number = week_numbers.pop()
        log.info(f"All files are from Week {week_number}")
        result["week"] = week_number

        # =====================================================================
        # STEP 3: Transform and combine
        # =====================================================================
        log.info("[3/7] Transforming to master format...")
        transformed_dfs = []
        for df, week_num in extracted_dfs:
            transformed = transform_to_master_format(df, week_num)
            transformed_dfs.append(transformed)

        combined = combine_site_dataframes(transformed_dfs)
        validate_master_format(combined)
        log.info(f"Combined: {len(combined)} transporter records")

        # =====================================================================
        # STEP 4: Create runtime copy and append new data
        # =====================================================================
        log.info("[4/7] Preparing runtime file...")

        if not master_path.exists():
            raise FileNotFoundError(f"Master file not found: {master_path}")

        runtime_path = create_runtime_copy(master_path)
        log.info(f"Created runtime copy: {runtime_path.name}")

        runtime_df = pd.read_excel(runtime_path)
        log.info(f"Loaded runtime copy: {len(runtime_df)} existing records")

        # Append new records to runtime copy only
        updated_runtime = pd.concat([runtime_df, combined], ignore_index=True)
        new_records = len(combined)
        result["records_added"] = new_records
        log.info(f"Added {new_records} new records to runtime copy")

        updated_runtime.to_excel(runtime_path, index=False)
        log.info(f"Saved runtime file: {len(updated_runtime)} total records")
        log.info(f"Master file UNCHANGED: {master_path.name}")

        # =====================================================================
        # STEP 5: Run XGBoost scoring model (against runtime copy)
        # =====================================================================
        model_summaries = []

        # Get calibration offsets (default to [-2.0] if not configured)
        offsets = CALIBRATION_OFFSETS if CALIBRATION_OFFSETS else [-2.0]

        # Limit to 5 offsets max
        if len(offsets) > 5:
            log.warning(f"Too many calibration offsets ({len(offsets)}). Using first 5 only.")
            offsets = offsets[:5]

        if not skip_model:
            log.info(f"[5/7] Running XGBoost scoring model ({len(offsets)} calibration offset(s))...")
            try:
                for offset in offsets:
                    log.info(f"  Running with calibration offset: {offset:+.1f}")
                    output_file, summary = run_xgboost_model(
                        input_file=runtime_path,
                        output_dir=BASE_PATH,
                        calibration_offset=offset
                    )
                    model_output_files.append(output_file)
                    model_summaries.append(summary)
                    log.info(f"    Generated: {output_file.name}")

                result["model_output"] = [str(f) for f in model_output_files]
                log.info(f"Generated {len(model_output_files)} prediction file(s)")
            except ImportError as e:
                log.warning(f"Skipping model: {e}")
                log.warning("Install xgboost with: pip install xgboost")
            except Exception as e:
                log.error(f"Model error: {e}")
                raise
        else:
            log.info("[5/7] Skipping XGBoost model (--skip-model flag)")

        # =====================================================================
        # STEP 6: Send email report with all prediction files
        # =====================================================================
        if not skip_email and EMAIL_ENABLED and model_output_files:
            log.info("[6/7] Sending email report...")
            try:
                email_sent = send_predictions_email(
                    predictions_files=model_output_files,
                    summaries=model_summaries,
                    calibration_offsets=offsets,
                    week_number=week_number
                )
                result["email_sent"] = email_sent
                if email_sent:
                    log.info("Email sent successfully")
                else:
                    log.warning("Email send returned False")
            except Exception as e:
                log.error(f"Email error: {e}")
                # Don't raise - email failure shouldn't stop processing
        elif skip_email:
            log.info("[6/7] Skipping email (--skip-email flag)")
        elif not EMAIL_ENABLED:
            log.info("[6/7] Skipping email (disabled in config)")
        else:
            log.info("[6/7] Skipping email (no model output)")

        # =====================================================================
        # STEP 7: Archive files to SharePoint
        # =====================================================================
        log.info("[7/7] Archiving to SharePoint...")

        if dry_run:
            log.info("[DRY RUN] Skipping archive step")

            # Clean up model output files in dry run
            for output_file in model_output_files:
                if output_file and output_file.exists():
                    output_file.unlink()
            if model_output_files:
                log.info(f"[DRY RUN] Removed {len(model_output_files)} temporary model output(s)")

        else:
            # Upload to SharePoint via Graph API, then delete local files
            log.info("Uploading archive to SharePoint via Graph API...")

            # Save extracted data to a temporary file for upload
            archive_folder = create_week_archive_folder(week_number)
            week_output = archive_folder / f"WK{week_number:02d}_extracted.xlsx"
            combined.to_excel(week_output, index=False)
            log.info(f"  Saved temp: {week_output.name}")

            # Upload everything to SharePoint
            upload_results = archive_to_sharepoint(
                pdf_files=pdf_files,
                extracted_xlsx=week_output,
                model_output_files=model_output_files,
                week_number=week_number,
            )

            log.info(
                f"SharePoint upload: {upload_results['uploaded']} uploaded, "
                f"{upload_results['failed']} failed"
            )

            if upload_results["failed"] > 0:
                log.warning(
                    f"{upload_results['failed']} file(s) failed to upload — "
                    f"local copies retained in {archive_folder}"
                )
            else:
                # All uploads succeeded — clean up the local archive folder
                try:
                    shutil.rmtree(archive_folder)
                    log.info(f"Cleaned up local archive folder: {archive_folder.name}")
                except Exception as e:
                    log.warning(f"Could not remove local archive folder: {e}")

            result["archive_folder"] = f"SharePoint: {GRAPH_ARCHIVE_PATH}/WK{week_number:02d}/"
            result["model_output"] = upload_results["files"]

        # =====================================================================
        # SUMMARY
        # =====================================================================
        result["status"] = "success"
        result["files_processed"] = len(pdf_files)

        log.info("")
        log.info("=" * 70)
        log.info("PROCESSING COMPLETE")
        log.info("=" * 70)
        log.info(f"  Week:            {week_number}")
        log.info(f"  Files processed: {len(pdf_files)}")
        log.info(f"  Records added:   {new_records} (runtime only)")
        log.info(f"  Model outputs:   {len(model_output_files)} file(s)")
        log.info(f"  Email sent:      {'Yes' if result['email_sent'] else 'No'}")
        log.info(f"  Master file:     UNCHANGED")
        if dry_run:
            log.info(f"  Mode:            DRY RUN (no permanent changes)")
        else:
            log.info(f"  Archive:         SharePoint (Graph API)")
        log.info(f"  Archive folder:  WK{week_number:02d}/")

        return result

    finally:
        # ALWAYS clean up the runtime copy, even on failure
        cleanup_runtime_copy(runtime_path)
