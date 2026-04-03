"""
XGBoost Model Runner - Non-Interactive Version
==============================================

Runs the NO-DEX scoring model without user prompts.
Uses calibration offset from config file.
"""
import pandas as pd
import numpy as np
from xgboost import XGBRegressor
from pathlib import Path
from datetime import datetime
from typing import Tuple, Optional

from config import (
    TRAINING_WEEKS_START,
    TRAINING_WEEKS_END,
)


def determine_status(score: float) -> str:
    """Determine status category based on score."""
    if score < 40:
        return 'POOR'
    elif score < 60:
        return 'FAIR'
    elif score < 80:
        return 'GREAT'
    elif score < 95:
        return 'FANTASTIC'
    else:
        return 'FANTASTIC_PLUS'


def clean_percentage_columns(df: pd.DataFrame, columns: list) -> pd.DataFrame:
    """Convert non-numeric values in percentage columns to 1.0 (100%)."""
    df = df.copy()
    for col in columns:
        if col in df.columns:
            numeric_col = pd.to_numeric(df[col], errors='coerce')
            non_numeric_mask = numeric_col.isna() & df[col].notna()
            non_numeric_count = non_numeric_mask.sum()

            if non_numeric_count > 0:
                print(f"    {col}: Converting {non_numeric_count} non-numeric values to 100%")

            df[col] = numeric_col.fillna(1.0)
    return df


def clean_dnr_dpmo(df: pd.DataFrame) -> pd.DataFrame:
    """Convert non-numeric DNR DPMO values to 0."""
    df = df.copy()
    if 'DNR DPMO' in df.columns:
        numeric_col = pd.to_numeric(df['DNR DPMO'], errors='coerce')
        non_numeric_mask = numeric_col.isna() & df['DNR DPMO'].notna()
        non_numeric_count = non_numeric_mask.sum()

        if non_numeric_count > 0:
            print(f"    DNR DPMO: Converting {non_numeric_count} non-numeric values to 0")

        df['DNR DPMO'] = numeric_col.fillna(0)
    return df


def run_xgboost_model(
    input_file: Path,
    output_dir: Path,
    calibration_offset: float = -2.0
) -> Tuple[Path, dict]:
    """
    Run the XGBoost scoring model on the input file.

    Args:
        input_file: Path to the master Excel file
        output_dir: Directory to save output files
        calibration_offset: Calibration adjustment for predictions (default: -2.0)

    Returns:
        Tuple of (output_file_path, summary_dict)
    """
    print(f"\n  Loading data from: {input_file.name}")

    # Load data
    df = pd.read_excel(input_file)
    print(f"    Total records: {len(df)}")

    # Verify required columns
    required_columns = ['Week', 'Site', 'Transporter ID', 'Total Score',
                        'Delivered', 'DCR', 'DNR DPMO', 'POD', 'CC', 'CE']

    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")

    # Feature columns (NO DEX)
    feature_columns = ['Delivered', 'DCR', 'DNR DPMO', 'POD', 'CC', 'CE']

    # Clean data
    print("    Cleaning data...")
    df = clean_percentage_columns(df, ['DCR', 'POD', 'CC'])
    df = clean_dnr_dpmo(df)

    # Fill remaining NaN in features with 0
    for col in feature_columns:
        if df[col].isna().any():
            nan_count = df[col].isna().sum()
            print(f"    {col}: Filling {nan_count} NaN values with 0")
            df[col] = df[col].fillna(0)

    # Split into training and prediction sets
    training_mask = (
        (df['Week'] >= TRAINING_WEEKS_START) &
        (df['Week'] <= TRAINING_WEEKS_END) &
        (df['Total Score'].notna()) &
        (df['Total Score'] > 0)
    )

    prediction_mask = df['Total Score'].isna() | (df['Total Score'] == 0)

    training_data = df[training_mask].copy()
    prediction_data = df[prediction_mask].copy()

    print(f"    Training records: {len(training_data)} (weeks {TRAINING_WEEKS_START}-{TRAINING_WEEKS_END})")
    print(f"    Prediction records: {len(prediction_data)}")

    if len(training_data) == 0:
        raise ValueError("No training data found")

    if len(prediction_data) == 0:
        print("    Warning: No records to predict (all have Total Score)")

    # Prepare training data
    X_train = training_data[feature_columns]
    y_train = training_data['Total Score']

    # Train model
    print("    Training XGBoost model...")
    model = XGBRegressor(
        random_state=42,
        eval_metric='mae',
        n_estimators=100
    )

    model.fit(X_train, y_train)

    # Calculate training performance
    y_train_pred = model.predict(X_train)
    train_mae = np.mean(np.abs(y_train - y_train_pred))
    print(f"    Training MAE: {train_mae:.2f} points")

    # Generate predictions for all data
    X_all = df[feature_columns]
    df['NO_DEX_Raw_Score'] = model.predict(X_all)

    # Apply calibration
    print(f"    Applying calibration offset: {calibration_offset:+.1f}")
    df['NO_DEX_Calibrated_Score'] = df['NO_DEX_Raw_Score'] + calibration_offset
    df['NO_DEX_Status'] = df['NO_DEX_Calibrated_Score'].apply(determine_status)

    # Prediction summary
    summary = {
        'training_records': len(training_data),
        'prediction_records': len(prediction_data),
        'calibration_offset': calibration_offset,
        'train_mae': train_mae,
    }

    if len(prediction_data) > 0:
        pred_indices = prediction_data.index
        pred_scores = df.loc[pred_indices, 'NO_DEX_Calibrated_Score']
        pred_statuses = df.loc[pred_indices, 'NO_DEX_Status']

        summary['mean_score'] = pred_scores.mean()
        summary['median_score'] = pred_scores.median()
        summary['min_score'] = pred_scores.min()
        summary['max_score'] = pred_scores.max()
        summary['status_counts'] = pred_statuses.value_counts().to_dict()

        pred_weeks = sorted(df.loc[pred_indices, 'Week'].unique())
        summary['prediction_weeks'] = pred_weeks

        print(f"    Prediction mean score: {summary['mean_score']:.2f}")
        print(f"    Status distribution: {summary['status_counts']}")

    # Save output - include calibration offset in filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    offset_str = f"Cal{calibration_offset:+.1f}".replace('.', '_').replace('+', 'p').replace('-', 'm')
    output_filename = output_dir / f"NO_DEX_Predictions_{offset_str}_{timestamp}.xlsx"

    print(f"    Saving output to: {output_filename.name}")

    with pd.ExcelWriter(output_filename, engine='openpyxl') as writer:

        # Sheet 1: Model Predictions (ALL data)
        model_predictions = df[[
            'Week', 'Site', 'Transporter ID', 'Status', 'Total Score',
            'Delivered', 'DCR', 'DNR DPMO', 'POD', 'CC', 'CE',
            'NO_DEX_Raw_Score', 'NO_DEX_Calibrated_Score', 'NO_DEX_Status'
        ]].copy()

        if 'DEX' in df.columns:
            model_predictions.insert(10, 'DEX', df['DEX'])

        model_predictions.to_excel(writer, sheet_name='Model Predictions', index=False)

        # Sheet 2: Predictions Only (just the new predictions)
        if len(prediction_data) > 0:
            pred_indices = prediction_data.index
            predictions_only = df.loc[pred_indices, [
                'Site', 'Transporter ID', 'Week',
                'NO_DEX_Calibrated_Score', 'NO_DEX_Status'
            ]].copy()

            predictions_only = predictions_only.rename(columns={
                'NO_DEX_Calibrated_Score': 'Predicted Score',
                'NO_DEX_Status': 'Predicted Status'
            })

            predictions_only = predictions_only.sort_values(
                ['Site', 'Predicted Score'],
                ascending=[True, False]
            )

            predictions_only.to_excel(writer, sheet_name='Predictions Only', index=False)

        # Sheet 3: Summary by Site
        if len(prediction_data) > 0:
            pred_indices = prediction_data.index
            summary_data = []

            for site in sorted(df.loc[pred_indices, 'Site'].unique()):
                site_data = df.loc[pred_indices][df.loc[pred_indices, 'Site'] == site]

                mean_score = site_data['NO_DEX_Calibrated_Score'].mean()
                median_score = site_data['NO_DEX_Calibrated_Score'].median()
                status_counts = site_data['NO_DEX_Status'].value_counts()

                summary_data.append({
                    'Site': site,
                    'Records': len(site_data),
                    'Mean Score': round(mean_score, 2),
                    'Median Score': round(median_score, 2),
                    'POOR': status_counts.get('POOR', 0),
                    'FAIR': status_counts.get('FAIR', 0),
                    'GREAT': status_counts.get('GREAT', 0),
                    'FANTASTIC': status_counts.get('FANTASTIC', 0),
                    'FANTASTIC_PLUS': status_counts.get('FANTASTIC_PLUS', 0),
                    'F+ %': round(status_counts.get('FANTASTIC_PLUS', 0) / len(site_data) * 100, 1)
                })

            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='Summary by Site', index=False)

        # Sheet 4: Calibration Info
        calibration_info = pd.DataFrame([
            {'Parameter': 'Calibration Offset', 'Value': f"{calibration_offset:+.1f} points"},
            {'Parameter': 'Training Period', 'Value': f'Weeks {TRAINING_WEEKS_START}-{TRAINING_WEEKS_END}'},
            {'Parameter': 'Training Records', 'Value': len(training_data)},
            {'Parameter': 'Model Type', 'Value': 'XGBoost Regressor (NO DEX)'},
            {'Parameter': 'Features Used', 'Value': ', '.join(feature_columns)},
            {'Parameter': 'Training MAE', 'Value': f'{train_mae:.2f} points'},
            {'Parameter': 'Prediction Records', 'Value': len(prediction_data)},
            {'Parameter': 'Output Created', 'Value': datetime.now().strftime("%Y-%m-%d %H:%M:%S")},
        ])

        calibration_info.to_excel(writer, sheet_name='Calibration Info', index=False)

    summary['output_file'] = output_filename

    return output_filename, summary


def extract_predictions_only_sheet(excel_file: Path) -> Optional[pd.DataFrame]:
    """
    Extract the 'Predictions Only' worksheet from the output file.
    Returns None if the sheet doesn't exist.
    """
    try:
        df = pd.read_excel(excel_file, sheet_name='Predictions Only')
        return df
    except Exception as e:
        print(f"    Warning: Could not extract 'Predictions Only' sheet: {e}")
        return None
