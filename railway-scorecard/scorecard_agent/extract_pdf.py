"""
PDF extraction module for DSP Weekly Scorecard PDFs
Extracts the transporter performance table from page 3+
"""
import re
from pathlib import Path
from typing import Optional, Tuple

import pandas as pd
import pdfplumber


def extract_site_code(filename: str) -> str:
    """
    Extract site code from PDF filename.
    Pattern: UK-GREY-DXXX-WeekN-... -> DXX (drop trailing digit)

    Example: UK-GREY-DBH3-Week4-DSP-Scorecard-3.0.pdf -> DBH
    """
    # Find pattern D[A-Z]{2}[0-9]
    match = re.search(r'D[A-Z]{2}[0-9]', filename, re.IGNORECASE)
    if match:
        site_4char = match.group().upper()
        return site_4char[:3]  # Drop trailing digit
    raise ValueError(f"Could not extract site code from filename: {filename}")


def extract_week_number(filename: str) -> int:
    """
    Extract week number from PDF filename.
    Pattern: ...-WeekN-... or ...-Week N-...

    Example: UK-GREY-DBH3-Week4-DSP-Scorecard-3.0.pdf -> 4
    """
    match = re.search(r'Week\s*(\d+)', filename, re.IGNORECASE)
    if match:
        return int(match.group(1))
    raise ValueError(f"Could not extract week number from filename: {filename}")


def extract_table_from_pdf(pdf_path: Path) -> pd.DataFrame:
    """
    Extract the DSP Weekly Summary table from a scorecard PDF.

    - Starts on page 3 (index 2)
    - Continues until "Drivers With Working Hour Exceptions" section
    - Returns a single DataFrame with all transporter rows
    """
    # Expected columns based on actual PDF structure
    # The PDF header has merged cells, so we define the correct column names
    EXPECTED_COLUMNS = [
        "Transporter ID", "Delivered", "DCR", "DSC DPMO", "LoR DPMO",
        "POD", "CC", "CE", "CDF DPMO", "PSB"
    ]

    all_rows = []

    with pdfplumber.open(pdf_path) as pdf:
        # Start from page 3 (index 2), continue through document
        for page_num in range(2, len(pdf.pages)):
            page = pdf.pages[page_num]
            text = page.extract_text() or ""

            # Check if we've hit the stop marker
            stop_processing = "Drivers With Working Hour Exceptions" in text

            # Extract tables with line-based strategy for cleaner results
            tables = page.extract_tables({
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
            })

            if tables:
                for table in tables:
                    for row in table:
                        if not row:
                            continue

                        # Skip header rows (contain "Transporter")
                        if row[0] and "Transporter" in str(row[0]):
                            continue

                        # Skip if this row contains the stop marker
                        row_text = " ".join(str(cell) for cell in row if cell)
                        if "Working Hour" in row_text:
                            stop_processing = True
                            break

                        # Data rows: transporter ID starts with 'A'
                        if row[0] and str(row[0]).startswith("A"):
                            # Clean the row data
                            cleaned_row = []
                            for cell in row[:len(EXPECTED_COLUMNS)]:
                                if cell is None:
                                    cleaned_row.append(None)
                                else:
                                    cleaned_row.append(str(cell).strip())
                            all_rows.append(cleaned_row)

            if stop_processing:
                break

    if not all_rows:
        raise ValueError(f"Could not extract table from PDF: {pdf_path}")

    # Build DataFrame with explicit column names
    df = pd.DataFrame(all_rows, columns=EXPECTED_COLUMNS)

    # Convert percentage strings to decimals for DCR, POD, CC
    for col in ["DCR", "POD", "CC"]:
        if col in df.columns:
            df[col] = df[col].apply(_convert_percentage)

    return df


def _convert_percentage(val):
    """Convert percentage string to decimal. Returns original value if not a percentage."""
    if val is None or val == "-" or val == "":
        return val
    try:
        val_str = str(val).strip()
        if val_str.endswith("%"):
            return float(val_str.rstrip("%")) / 100
        # Already a decimal
        return float(val_str)
    except (ValueError, TypeError):
        return val


def process_single_pdf(pdf_path: Path) -> Tuple[pd.DataFrame, str, int]:
    """
    Process a single PDF file:
    1. Extract site code from filename
    2. Extract week number from filename
    3. Extract table data
    4. Add Site column

    Returns: (DataFrame, site_code, week_number)
    """
    filename = pdf_path.name

    # Extract metadata from filename
    site_code = extract_site_code(filename)
    week_number = extract_week_number(filename)

    # Extract table
    df = extract_table_from_pdf(pdf_path)

    # Add site column
    df["Site"] = site_code

    print(f"  ✓ {filename}: {len(df)} transporters, Site={site_code}, Week={week_number}")

    return df, site_code, week_number
