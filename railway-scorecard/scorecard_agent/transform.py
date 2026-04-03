"""
Transform module for mapping extracted PDF data to master format
"""
import pandas as pd
import numpy as np
from typing import List

from config import (
    COLUMN_RENAME,
    COLUMNS_TO_DROP,
    COLUMNS_TO_ADD_NAN,
    MASTER_COLUMN_ORDER,
    CURRENT_YEAR,
)


def convert_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert columns that should be numeric.
    Handles percentage strings and dashes.
    """
    df = df.copy()

    numeric_columns = ["Delivered", "DCR", "DNR DPMO", "POD", "CC", "CE"]

    for col in numeric_columns:
        if col not in df.columns:
            continue

        # Convert to string first for consistent handling
        df[col] = df[col].astype(str)

        # Replace dashes and empty values with NaN
        df[col] = df[col].replace(["-", "", "None", "nan"], np.nan)

        # Remove percentage signs if present (shouldn't be after PDF extraction, but safety)
        df[col] = df[col].str.replace("%", "", regex=False)

        # Convert to numeric
        df[col] = pd.to_numeric(df[col], errors="coerce")

    return df


def transform_to_master_format(df: pd.DataFrame, week_number: int) -> pd.DataFrame:
    """
    Transform extracted PDF data to master format:
    1. Rename columns (DSC DPMO -> DNR DPMO)
    2. Drop unnecessary columns
    3. Add NaN columns (Status, Total Score, DEX, Focus Area)
    4. Add Week column
    5. Enforce column order
    """
    df = df.copy()

    # Step 1: Drop columns we don't need
    for col in COLUMNS_TO_DROP:
        if col in df.columns:
            df = df.drop(columns=[col])

    # Also drop any unnamed columns
    unnamed_cols = [c for c in df.columns if c.startswith("Unnamed")]
    if unnamed_cols:
        df = df.drop(columns=unnamed_cols)

    # Step 2: Rename columns
    rename_map = {k: v for k, v in COLUMN_RENAME.items() if k in df.columns and k != v}
    if rename_map:
        df = df.rename(columns=rename_map)

    # Step 3: Add Week column (WWYYYY format, no leading zero)
    week_value = int(f"{week_number}{CURRENT_YEAR}")
    df["Week"] = week_value

    # Step 4: Add NaN columns
    for col in COLUMNS_TO_ADD_NAN:
        df[col] = np.nan

    # Step 5: Convert numeric columns
    df = convert_numeric_columns(df)

    # Step 6: Enforce column order
    # Only include columns that exist
    final_columns = [c for c in MASTER_COLUMN_ORDER if c in df.columns]
    df = df[final_columns]

    return df


def combine_site_dataframes(dfs: List[pd.DataFrame]) -> pd.DataFrame:
    """
    Combine multiple site DataFrames into one.
    All should already be in master format.
    """
    if not dfs:
        raise ValueError("No DataFrames to combine")

    combined = pd.concat(dfs, ignore_index=True)
    return combined


def validate_master_format(df: pd.DataFrame) -> bool:
    """
    Validate that DataFrame matches expected master format.
    Returns True if valid, raises ValueError if not.
    """
    missing_cols = [c for c in MASTER_COLUMN_ORDER if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")

    # Check Week column has valid values
    if df["Week"].isna().all():
        raise ValueError("Week column is all NaN")

    # Check Site column has valid values
    if df["Site"].isna().all():
        raise ValueError("Site column is all NaN")

    # Check we have transporter IDs
    if df["Transporter ID"].isna().all():
        raise ValueError("Transporter ID column is all NaN")

    return True
