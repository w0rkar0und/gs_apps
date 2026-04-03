"""
Email Module for Courier Scorecard Agent
=========================================

Sends reports via Resend API.
Extracts only the 'Predictions Only' worksheet for attachment.
Computes email summary stats directly from that sheet so counts
always match the attached data.
"""
import base64
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

try:
    import resend
except ImportError:
    resend = None

try:
    import pandas as pd
except ImportError:
    pd = None

from config import (
    EMAIL_ENABLED,
    EMAIL_RECIPIENT,
    EMAIL_SENDER,
    EMAIL_SUBJECT_PREFIX,
    RESEND_API_KEY,
)


def compute_summary_from_predictions_sheet(predictions_file: Path) -> Dict[str, Any]:
    """
    Read the 'Predictions Only' worksheet and compute summary stats.
    This ensures email counts match exactly what's in the attachment.

    Expected columns: Site, Transporter ID, Week, Predicted Score, Predicted Status
    """
    df = pd.read_excel(predictions_file, sheet_name="Predictions Only")

    summary = {
        "prediction_records": len(df),
        "mean_score": 0.0,
        "median_score": 0.0,
        "min_score": 0.0,
        "max_score": 0.0,
        "status_counts": {},
        "sites": [],
    }

    if len(df) == 0:
        return summary

    # Score stats -- handle both possible column names
    score_col = None
    for candidate in ["Predicted Score", "NO_DEX_Calibrated_Score"]:
        if candidate in df.columns:
            score_col = candidate
            break

    if score_col:
        scores = pd.to_numeric(df[score_col], errors="coerce").dropna()
        if len(scores) > 0:
            summary["mean_score"] = scores.mean()
            summary["median_score"] = scores.median()
            summary["min_score"] = scores.min()
            summary["max_score"] = scores.max()

    # Status distribution -- handle both possible column names
    status_col = None
    for candidate in ["Predicted Status", "NO_DEX_Status"]:
        if candidate in df.columns:
            status_col = candidate
            break

    if status_col:
        summary["status_counts"] = df[status_col].value_counts().to_dict()

    # Sites
    if "Site" in df.columns:
        summary["sites"] = sorted(df["Site"].dropna().unique().tolist())

    return summary


def create_predictions_email_body(
    sheet_summaries: List[Dict[str, Any]],
    calibration_offsets: List[float],
    week_number: int,
) -> str:
    """Create HTML email body with prediction summaries derived from the attached sheets."""

    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            h2 {{ color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }}
            h3 {{ color: #34495e; margin-top: 25px; }}
            table {{ border-collapse: collapse; width: 100%; margin: 15px 0; }}
            th, td {{ border: 1px solid #ddd; padding: 10px; text-align: left; }}
            th {{ background-color: #3498db; color: white; }}
            tr:nth-child(even) {{ background-color: #f9f9f9; }}
            .metric {{ font-weight: bold; color: #2c3e50; }}
            .value {{ color: #27ae60; }}
            .offset-section {{ margin: 25px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #3498db; }}
            .offset-header {{ color: #2c3e50; font-size: 1.1em; margin-bottom: 10px; }}
            .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #7f8c8d; font-size: 12px; }}
            .explanation {{ background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <h2>DSP Scorecard Predictions - Week {week_number}</h2>

        <p>The automated scoring model has completed processing for <strong>Week {week_number}</strong>.</p>
    """

    # Add explanation if multiple offsets
    if len(calibration_offsets) > 1:
        html += f"""
        <div class="explanation">
            <strong>Multiple Calibration Levels</strong><br>
            This report includes <strong>{len(calibration_offsets)}</strong> prediction files with different calibration offsets.
            <ul>
                <li><strong>More negative</strong> offset (e.g., -2.2) = More conservative predictions (lower scores)</li>
                <li><strong>Less negative</strong> offset (e.g., -1.8) = More optimistic predictions (higher scores)</li>
            </ul>
            Review each attachment and select the calibration that best matches your operational needs.
        </div>
        """

    # Add summary for each calibration offset
    for summary, offset in zip(sheet_summaries, calibration_offsets):
        status_counts = summary.get("status_counts", {})
        total = summary.get("prediction_records", 1)

        html += f"""
        <div class="offset-section">
            <div class="offset-header">
                <strong>Calibration Offset: {offset:+.1f}</strong>
                &nbsp;|&nbsp; Attachment: Week{week_number}_Predictions_Cal{offset:+.1f}.xlsx
            </div>

            <table>
                <tr><th>Metric</th><th>Value</th></tr>
                <tr><td class="metric">Prediction Records</td><td class="value">{summary.get('prediction_records', 'N/A')}</td></tr>
                <tr><td class="metric">Mean Score</td><td class="value">{summary.get('mean_score', 0):.2f}</td></tr>
                <tr><td class="metric">Median Score</td><td class="value">{summary.get('median_score', 0):.2f}</td></tr>
                <tr><td class="metric">Score Range</td><td class="value">{summary.get('min_score', 0):.2f} - {summary.get('max_score', 0):.2f}</td></tr>
            </table>

            <table>
                <tr><th>Status</th><th>Count</th><th>%</th></tr>
        """

        for status in ["FANTASTIC_PLUS", "FANTASTIC", "GREAT", "FAIR", "POOR"]:
            count = status_counts.get(status, 0)
            pct = (count / total * 100) if total > 0 else 0
            html += f"<tr><td>{status}</td><td>{count}</td><td>{pct:.1f}%</td></tr>\n"

        html += """
            </table>
        </div>
        """

    html += f"""
        <div class="footer">
            <p>This is an automated report generated by the Courier Scorecard Processing Agent.</p>
            <p>Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>
        </div>
    </body>
    </html>
    """

    return html


def extract_predictions_only_sheet(
    full_output_file: Path,
    week_number: int,
    calibration_offset: float,
) -> Path:
    """
    Extract 'Predictions Only' worksheet to a separate file for email attachment.

    Returns path to the extracted file with calibration offset in filename.
    """
    df = pd.read_excel(full_output_file, sheet_name="Predictions Only")

    # Create a clean filename including the calibration offset
    output_path = (
        full_output_file.parent
        / f"Week{week_number}_Predictions_Cal{calibration_offset:+.1f}.xlsx"
    )
    df.to_excel(output_path, index=False, sheet_name="Predictions Only")

    return output_path


def send_predictions_email(
    predictions_files: List[Path],
    summaries: List[Dict[str, Any]],
    calibration_offsets: List[float],
    week_number: int,
    recipient: str = EMAIL_RECIPIENT,
    sender: str = EMAIL_SENDER,
) -> bool:
    """
    Send the predictions report via Resend API with multiple calibration outputs.

    Summary stats in the email body are computed directly from each
    'Predictions Only' worksheet, so they always match the attachment.

    Args:
        predictions_files: Paths to the full Excel predictions files
        summaries: Model summaries (kept for backward compat, not used for email stats)
        calibration_offsets: Calibration offsets used
        week_number: Week number for the subject line
        recipient: Email recipient address
        sender: Sender email address

    Returns:
        True if email sent successfully, False otherwise
    """
    if not EMAIL_ENABLED:
        print("    Email is disabled in config. Skipping.")
        return False

    if resend is None:
        print("    resend library not installed. Run: pip install resend")
        return False

    if not sender or not RESEND_API_KEY:
        print("    Email credentials not configured. Skipping email.")
        print("    Update EMAIL_SENDER and RESEND_API_KEY in config.py")
        return False

    attachment_files = []  # Track extracted files for cleanup

    try:
        # Set API key
        resend.api_key = RESEND_API_KEY

        # Extract Predictions Only sheets and compute stats from them
        attachments = []
        sheet_summaries = []

        for pred_file, offset in zip(predictions_files, calibration_offsets):
            if not pred_file.exists():
                print(f"    Predictions file not found: {pred_file.name}")
                continue

            try:
                # Extract the sheet to a standalone file
                attachment_file = extract_predictions_only_sheet(
                    pred_file, week_number, offset
                )
                attachment_files.append(attachment_file)

                # Compute summary stats from the extracted sheet
                sheet_summary = compute_summary_from_predictions_sheet(pred_file)
                sheet_summary["calibration_offset"] = offset
                sheet_summaries.append(sheet_summary)

                # Read file bytes for attachment
                with open(attachment_file, "rb") as f:
                    file_content = f.read()

                attachments.append(
                    {
                        "filename": attachment_file.name,
                        "content": list(file_content),
                    }
                )
                print(
                    f"    Prepared: {attachment_file.name} "
                    f"({sheet_summary['prediction_records']} records)"
                )
            except Exception as e:
                print(f"    Could not extract sheet from {pred_file.name}: {e}")

        if not attachments:
            print("    No attachments prepared. Skipping email.")
            return False

        # Build email body using stats from the extracted sheets
        html_body = create_predictions_email_body(
            sheet_summaries, calibration_offsets, week_number
        )

        # Subject line
        if len(calibration_offsets) > 1:
            subject = (
                f"{EMAIL_SUBJECT_PREFIX} - Week {week_number} "
                f"({len(calibration_offsets)} Calibrations)"
            )
        else:
            subject = f"{EMAIL_SUBJECT_PREFIX} - Week {week_number}"

        email_params = {
            "from": sender,
            "to": [recipient],
            "subject": subject,
            "html": html_body,
            "attachments": attachments,
        }

        # Send via Resend API
        print(f"    Sending via Resend API ({len(attachments)} attachment(s))...")

        response = resend.Emails.send(email_params)

        if response and response.get("id"):
            print(f"    Email sent to {recipient}")
            return True
        else:
            print(f"    Resend returned unexpected response: {response}")
            return False

    except Exception as e:
        print(f"    Email error: {e}")
        return False

    finally:
        # Clean up extracted attachment files
        for attachment_file in attachment_files:
            if attachment_file and attachment_file.exists():
                try:
                    attachment_file.unlink()
                except:
                    pass
