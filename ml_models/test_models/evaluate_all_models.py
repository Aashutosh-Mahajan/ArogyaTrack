#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FINAL TRUE MODEL EVALUATION
Evaluates:

1) final_ensemble_model (Prophet + XGBoost Forecast)
2) isolation_forest_prod (IsolationForest Anomaly Detector v4.0)
3) dbscan_prod (DBSCAN Clustering)
4) xgboost_outbreak_v3 (Alternative outbreak detector)

Fully stable. Matches training feature engineering.

Usage:
  python evaluate_all_models.py               # Uses real data
  python evaluate_all_models.py --use-dummy   # Uses dummy data
  python evaluate_all_models.py --generate-dummy  # Generates and uses dummy data
"""

import os
import json
import sys
import warnings
import argparse
import subprocess
import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from prophet import Prophet

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    f1_score,
    roc_auc_score,
    silhouette_score,
    precision_score,
    recall_score,
    classification_report
)

warnings.filterwarnings("ignore")

# ==========================================================
# PATHS AND CONFIGURATION
# ==========================================================

BASE_DIR = r"D:\python\ml_models"
DATA_DIR = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
MODELS_DIR = os.path.join(BASE_DIR, "saved_models")
DUMMY_DATA_DIR = os.path.join(BASE_DIR, "test_dummy_data")

FORECAST_DIR = os.path.join(MODELS_DIR, "final_ensemble_model")
OUTBREAK_DIR = os.path.join(MODELS_DIR, "isolation_forest_prod")
DBSCAN_DIR = os.path.join(MODELS_DIR, "dbscan_prod")
XGBOOST_V3_DIR = os.path.join(MODELS_DIR, "xgboost_outbreak_v3")

FORECAST_DAYS = 90
USE_WEEKLY = True   # must match training script

# Feature engineering config (must match training)
LAG_PERIODS = [7, 14, 21]
ROLLING_WINDOWS = [7, 14, 28]

# Global flag to track which data source is being used
USING_DUMMY_DATA = False

print("=" * 80)
print("COMPREHENSIVE MODEL EVALUATION")
print("=" * 80)


# ==========================================================
# SETUP DUMMY DATA
# ==========================================================

def setup_dummy_data(generate=False):
    """
    Setup dummy data directory. Can generate new data or use existing.
    
    Parameters:
    -----------
    generate : bool
        If True, generates new dummy datasets
    
    Returns:
    --------
    str : Path to data directory to use
    """
    global USING_DUMMY_DATA
    
    # Try to generate if requested
    if generate:
        print("\n[SETUP] Generating dummy datasets...")
        try:
            generator_script = os.path.join(BASE_DIR, "generate_dummy_datasets.py")
            if os.path.exists(generator_script):
                subprocess.run(
                    [sys.executable, generator_script,
                     "--output-dir", DUMMY_DATA_DIR,
                     "--regions", "5",
                     "--days", "365"],
                    check=True,
                    cwd=BASE_DIR
                )
                print("[OK] Dummy data generated successfully")
                USING_DUMMY_DATA = True
                return DUMMY_DATA_DIR
            else:
                print("[WARN] Generator script not found, cannot generate dummy data")
                return None
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Failed to generate dummy data: {e}")
            return None
    
    # Check if dummy data exists
    if os.path.exists(DUMMY_DATA_DIR):
        required_files = [
            "disease_surveillance_historical.csv",
            "environmental_data.csv",
            "regions.csv"
        ]
        
        if all(os.path.exists(os.path.join(DUMMY_DATA_DIR, f)) 
               for f in required_files):
            print(f"\n[SETUP] Using dummy data from: {DUMMY_DATA_DIR}")
            USING_DUMMY_DATA = True
            return DUMMY_DATA_DIR
    
    return None


print("=" * 80)
print("COMPREHENSIVE MODEL EVALUATION")
print("=" * 80)


# ==========================================================
# 1️⃣ FORECAST MODEL EVALUATION
# ==========================================================

def evaluate_forecast():

    print("\n[1] Forecast Model (Prophet + XGBoost)")

    # Load config saved during training
    config_path = os.path.join(FORECAST_DIR, "config.json")
    if os.path.exists(config_path):
        with open(config_path) as f:
            config = json.load(f)
        log_transform = config.get("log_transform", False)
        smooth_window = config.get("smooth_window", 5)
        outlier_percentile = config.get("outlier_percentile", 99)
        feature_cols = config.get("feature_cols", [])
        blend_weight = config.get("blend_weight_prophet", 0.5)
    else:
        log_transform = False
        smooth_window = 5
        outlier_percentile = 99
        feature_cols = []
        blend_weight = 0.5

    prophet_model = joblib.load(os.path.join(FORECAST_DIR, "prophet_model.pkl"))
    xgb_model = xgb.Booster()
    xgb_model.load_model(os.path.join(FORECAST_DIR, "xgb_model.bst"))

    # ---- Load data ----
    surv = pd.read_csv(
        os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
        usecols=["date", "case_count"],
        parse_dates=["date"]
    )

    env = pd.read_csv(
        os.path.join(DATA_DIR, "environmental_data.csv"),
        usecols=["date", "temperature_celsius", "rainfall_mm", "aqi"],
        parse_dates=["date"]
    )

    # Use MEAN (not sum) - matches training v4.0; scale-independent
    daily = surv.groupby("date", as_index=False)["case_count"].mean()
    env_daily = env.groupby("date", as_index=False).mean(numeric_only=True)

    df = daily.merge(env_daily, on="date", how="left")
    df = df.rename(columns={"date": "ds", "case_count": "y"})
    df = df.sort_values("ds")

    df = df.set_index("ds").asfreq("D").reset_index()

    for col in ["temperature_celsius", "rainfall_mm", "aqi"]:
        df[col] = df[col].interpolate().ffill().bfill()

    df["y"] = df["y"].fillna(0)

    # ---- Weekly aggregation (must match training) ----
    if USE_WEEKLY:
        df = df.set_index("ds").resample("W").agg({
            "y": "mean",
            "temperature_celsius": "mean",
            "rainfall_mm": "mean",
            "aqi": "mean"
        }).reset_index()

    # ---- Cleaning (must match training) ----
    cap = df["y"].quantile(outlier_percentile / 100)
    df["y"] = df["y"].clip(upper=cap)
    df["y"] = df["y"].rolling(smooth_window, min_periods=1).mean()
    df["y_original"] = df["y"].copy()

    if log_transform:
        df["y"] = np.log1p(df["y"])

    # ---- Feature engineering (must match training) ----
    df["month"] = df["ds"].dt.month
    df["weekofyear"] = df["ds"].dt.isocalendar().week.astype(int)
    df["quarter"] = df["ds"].dt.quarter

    for lag in [1, 2, 3, 4, 8]:
        df[f"lag_{lag}"] = df["y_original"].shift(lag)

    df["rm_4"]    = df["y_original"].rolling(4, min_periods=1).mean()
    df["rstd_4"]  = df["y_original"].rolling(4, min_periods=1).std().fillna(0)
    df["rm_8"]    = df["y_original"].rolling(8, min_periods=1).mean()
    df["rstd_8"]  = df["y_original"].rolling(8, min_periods=1).std().fillna(0)
    df["rmax_4"]  = df["y_original"].rolling(4, min_periods=1).max()
    df["rmin_4"]  = df["y_original"].rolling(4, min_periods=1).min()

    df["diff_1"] = df["y_original"].diff().fillna(0)
    df["diff_2"] = df["y_original"].diff(2).fillna(0)
    df["pct_1"]  = df["y_original"].pct_change().fillna(0).replace([np.inf, -np.inf], 0)

    df["temp_rain"] = df["temperature_celsius"] * df["rainfall_mm"]
    df["temp_aqi"] = df["temperature_celsius"] * df["aqi"]

    df = df.fillna(0)

    # ---- Split ----
    test_start = df["ds"].max() - pd.Timedelta(days=FORECAST_DAYS)

    train_df = df[df["ds"] <= test_start].copy()
    test_df = df[df["ds"] > test_start].copy()

    # ---- Prophet Forecast ----
    future = prophet_model.make_future_dataframe(
        periods=len(test_df),
        freq="W" if USE_WEEKLY else "D"
    )

    # Add regressors safely
    future = future.merge(
        df[["ds", "temperature_celsius", "rainfall_mm", "aqi"]],
        on="ds",
        how="left"
    )

    future["month"] = future["ds"].dt.month
    future = future.interpolate().ffill().bfill()

    forecast = prophet_model.predict(future)

    if log_transform:
        forecast["yhat"] = np.expm1(forecast["yhat"])

    # SAFE MERGE
    forecast_small = forecast[["ds", "yhat"]]
    merged = test_df.merge(forecast_small, on="ds", how="left")
    merged["yhat"] = merged["yhat"].interpolate().ffill().bfill()
    prophet_pred = np.maximum(merged["yhat"].values, 0)

    # ---- XGBoost Forecast ----
    if feature_cols:
        xgb_features = [f for f in feature_cols if f in test_df.columns]
        X_test = test_df[xgb_features].values
        dtest = xgb.DMatrix(X_test)
        xgb_pred = np.maximum(xgb_model.predict(dtest), 0)
    else:
        xgb_pred = prophet_pred  # fallback

    # ---- Blend ----
    y_pred = blend_weight * prophet_pred + (1 - blend_weight) * xgb_pred
    y_true = merged["y_original"].values

    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)

    print(f"  Blend weight: Prophet={blend_weight:.2f}, XGBoost={1-blend_weight:.2f}")
    print(f"  MAE: {mae:.2f}")
    print(f"  RMSE: {rmse:.2f}")
    print(f"  R2: {r2:.4f}")

    return r2



# ==========================================================
# 2️⃣ ISOLATION FOREST ANOMALY DETECTOR (isolation_forest_prod)
# ==========================================================

def evaluate_outbreak():
    """
    Evaluate Isolation Forest anomaly detector (v4.0)
    Uses decision_function() for anomaly scoring.
    """
    print("\n[2] Isolation Forest Anomaly Detector (isolation_forest_prod)")

    # Check if model exists
    if not os.path.exists(os.path.join(OUTBREAK_DIR, "isolation_forest.pkl")):
        print("  [WARN] isolation_forest.pkl not found, skipping...")
        return 0.0

    # Load model artifacts
    iforest = joblib.load(os.path.join(OUTBREAK_DIR, "isolation_forest.pkl"))
    scaler  = joblib.load(os.path.join(OUTBREAK_DIR, "scaler.pkl"))

    with open(os.path.join(OUTBREAK_DIR, "features.json")) as f:
        FEATURES = json.load(f)   # plain list

    # Load threshold from metrics
    metrics_path = os.path.join(OUTBREAK_DIR, "metrics.json")
    threshold = 0.0
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            m = json.load(f)
            threshold = m.get("threshold", 0.0)

    print(f"  [OK] Loaded IsolationForest with {len(FEATURES)} features, threshold={threshold:.4f}")

    # Load data
    surv = pd.read_csv(
        os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
        parse_dates=["date"]
    )

    if "outbreak_occurred" not in surv.columns:
        print("  [WARN] No outbreak labels found, skipping...")
        return 0.0

    # Load environmental data
    env = pd.read_csv(
        os.path.join(DATA_DIR, "environmental_data.csv"),
        parse_dates=["date"]
    )

    # Load regions
    regions = pd.read_csv(os.path.join(DATA_DIR, "regions.csv"))

    # Merge datasets
    df = surv.merge(env, on=["region_id", "date"], how="left", suffixes=('', '_env'))
    df = df.merge(regions, on="region_id", how="left", suffixes=('', '_reg'))

    # Handle duplicate columns
    for col in list(df.columns):
        if col.endswith('_env') or col.endswith('_reg'):
            base_col = col.rsplit('_', 1)[0]
            if base_col in df.columns:
                df[base_col] = df[base_col].fillna(df[col])
                df = df.drop(columns=[col])

    df = df.sort_values(["region_id", "date"]).reset_index(drop=True)

    # Feature engineering (MUST MATCH train_isolation_forest_prod.py v4.0)
    print("  Engineering features...")
    group = df.groupby("region_id")

    # Rolling stats
    for w in ROLLING_WINDOWS:
        df[f"cases_rm_{w}"]   = group["case_count"].transform(
            lambda x: x.rolling(w, 1).mean()).fillna(0)
        df[f"cases_rstd_{w}"] = group["case_count"].transform(
            lambda x: x.rolling(w, 1).std()).fillna(0)
        df[f"cases_rmax_{w}"] = group["case_count"].transform(
            lambda x: x.rolling(w, 1).max()).fillna(0)

    # Growth rates (pct_change, clipped)
    for p in LAG_PERIODS:
        df[f"growth_{p}"] = group["case_count"].pct_change(periods=p).fillna(0)
        df[f"growth_{p}"] = df[f"growth_{p}"].replace([np.inf, -np.inf], 0).clip(-5, 5)

    # Acceleration
    df["accel_7"] = group["case_count"].diff().diff().fillna(0)

    # Deviation z-scores (divide by rstd + 1)
    df["dev_7"]  = (df["case_count"] - df["cases_rm_7"])  / (df["cases_rstd_7"]  + 1)
    df["dev_14"] = (df["case_count"] - df["cases_rm_14"]) / (df["cases_rstd_14"] + 1)
    df["dev_28"] = (df["case_count"] - df["cases_rm_28"]) / (df["cases_rstd_28"] + 1)

    # Spike indicators (based on dev_7)
    df["spike_2std"] = (df["dev_7"] > 2).astype(int)
    df["spike_3std"] = (df["dev_7"] > 3).astype(int)

    # Lag features
    for lag in LAG_PERIODS:
        df[f"cases_lag_{lag}"] = group["case_count"].shift(lag).fillna(0)

    # Environmental risk
    env_risk_components = []
    if "temperature_celsius" in df.columns:
        env_risk_components.append((df["temperature_celsius"] > 30).astype(int))
    if "rainfall_mm" in df.columns:
        env_risk_components.append((df["rainfall_mm"] > 50).astype(int))
    if "aqi" in df.columns:
        env_risk_components.append((df["aqi"] > 150).astype(int))
    df["env_risk"] = sum(env_risk_components) if env_risk_components else 0

    # Replace inf/nan
    df = df.replace([np.inf, -np.inf], 0).fillna(0)

    # Temporal split (80/20)
    split_date = df["date"].quantile(0.8)
    test_df = df[df["date"] >= split_date].copy()

    # Extract features
    for f in FEATURES:
        if f not in test_df.columns:
            test_df[f] = 0

    X = test_df[FEATURES].astype(float).fillna(0)
    y_true = test_df["outbreak_occurred"].values

    # Scale features
    X_scaled = scaler.transform(X)

    # Anomaly scoring via decision_function
    raw_scores = iforest.decision_function(X_scaled)
    preds = (raw_scores <= threshold).astype(int)   # below threshold = anomaly

    # Calculate metrics
    precision = precision_score(y_true, preds, zero_division=0)
    recall = recall_score(y_true, preds, zero_division=0)
    f1 = f1_score(y_true, preds, zero_division=0)

    if len(np.unique(y_true)) > 1:
        roc = roc_auc_score(y_true, -raw_scores)   # negate: higher = more anomalous
    else:
        roc = 0.0

    print(f"  Precision: {precision:.4f}")
    print(f"  Recall: {recall:.4f}")
    print(f"  F1: {f1:.4f}")
    print(f"  ROC-AUC: {roc:.4f}")

    return f1


# ==========================================================
# 3️⃣ XGBOOST OUTBREAK V3 (Alternative Outbreak Detector)
# ==========================================================

def evaluate_xgboost_v3():
    """
    Evaluate the xgboost_outbreak_v3 model (XGBClassifier)
    """
    print("\n[3] XGBoost Outbreak V3")

    # Check if model exists
    if not os.path.exists(os.path.join(XGBOOST_V3_DIR, "xgboost_model.pkl")):
        print("  [WARN] Model not found, skipping...")
        return 0.0

    # Load model artifacts
    model = joblib.load(os.path.join(XGBOOST_V3_DIR, "xgboost_model.pkl"))
    scaler = joblib.load(os.path.join(XGBOOST_V3_DIR, "scaler.pkl"))

    # Load features list
    features_path = os.path.join(XGBOOST_V3_DIR, "features.json")
    if os.path.exists(features_path):
        with open(features_path) as f:
            FEATURES = json.load(f)
    else:
        print("  Features file not found, skipping...")
        return 0.0

    # Load optimal threshold
    metrics_path = os.path.join(XGBOOST_V3_DIR, "metrics.json")
    opt_threshold = 0.5
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            m = json.load(f)
            opt_threshold = m.get("optimal_threshold", 0.5)

    print(f"  Loaded model with {len(FEATURES)} features, threshold={opt_threshold:.4f}")

    # Load surveillance data (already has outbreak_occurred)
    df = pd.read_csv(
        os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
        parse_dates=["date"]
    )

    # Load regions
    regions = pd.read_csv(
        os.path.join(DATA_DIR, "regions.csv"),
        usecols=["region_id", "population"]
    )

    # Load environmental data
    env = pd.read_csv(
        os.path.join(DATA_DIR, "environmental_data.csv"),
        parse_dates=["date"]
    )

    # Feature engineering (match training script exactly)
    print("  Engineering features...")
    df = df.sort_values(["region_id", "date"]).reset_index(drop=True)
    grp = df.groupby("region_id")

    # Rolling statistics (match train_xgboost_prod.py)
    for w in [7, 14, 28]:
        df[f"cases_rm_{w}"]   = grp["case_count"].transform(lambda x: x.rolling(w, 1).mean())
        df[f"cases_rstd_{w}"] = grp["case_count"].transform(lambda x: x.rolling(w, 1).std()).fillna(0)
        df[f"cases_rmax_{w}"] = grp["case_count"].transform(lambda x: x.rolling(w, 1).max())

    # Growth rates
    for p in [7, 14]:
        df[f"growth_{p}"] = grp["case_count"].pct_change(periods=p).fillna(0)
        df[f"growth_{p}"] = df[f"growth_{p}"].replace([np.inf, -np.inf], 0).clip(-5, 5)

    # Acceleration
    df["acceleration_7"] = grp["case_count"].diff().diff().fillna(0)

    # Deviation from baseline
    df["deviation_7"]  = (df["case_count"] - df["cases_rm_7"])  / (df["cases_rstd_7"]  + 1)
    df["deviation_14"] = (df["case_count"] - df["cases_rm_14"]) / (df["cases_rstd_14"] + 1)

    # Spikes
    df["is_spike_2std"] = (df["deviation_7"] > 2).astype(int)
    df["is_spike_3std"] = (df["deviation_7"] > 3).astype(int)

    # Severity features
    if "severity_avg" in df.columns:
        df["severity_rm_7"] = grp["severity_avg"].transform(lambda x: x.rolling(7, 1).mean())

    # Lag features
    for lag in [7, 14, 21]:
        df[f"cases_lag_{lag}"] = grp["case_count"].shift(lag).fillna(0)

    df = df.fillna(0)

    # Merge regions + env
    df = df.merge(regions, on="region_id", how="left")

    env_cols = ["date", "region_id"]
    for col in ["temperature_celsius", "humidity_percent", "rainfall_mm", "aqi", "water_quality_index"]:
        if col in env.columns:
            env_cols.append(col)
    df = df.merge(env[env_cols], on=["region_id", "date"], how="left")

    df = df.fillna(0)

    # Per-capita
    df["cases_per_100k"] = df["cases_rm_7"] / (df["population"] / 100000 + 1)

    # Environmental risk
    env_risk_components = []
    if "temperature_celsius" in df.columns:
        env_risk_components.append((df["temperature_celsius"] > 30).astype(int))
    if "rainfall_mm" in df.columns:
        env_risk_components.append((df["rainfall_mm"] > 50).astype(int))
    if "aqi" in df.columns:
        env_risk_components.append((df["aqi"] > 150).astype(int))
    df["env_risk"] = sum(env_risk_components) if env_risk_components else 0

    # Temporal split
    df = df.sort_values("date")
    split_date = df["date"].quantile(0.8)
    test_df = df[df["date"] > split_date].copy()

    # Ensure all features exist
    for f in FEATURES:
        if f not in test_df.columns:
            test_df[f] = 0

    X_test = test_df[FEATURES].astype(float).fillna(0)
    y_test = test_df["outbreak_occurred"].astype(int)

    # Scale and predict
    X_test_scaled = scaler.transform(X_test)
    probs = model.predict_proba(X_test_scaled)[:, 1]
    preds = (probs >= opt_threshold).astype(int)

    # Metrics
    precision = precision_score(y_test, preds, zero_division=0)
    recall = recall_score(y_test, preds, zero_division=0)
    f1 = f1_score(y_test, preds, zero_division=0)

    if len(np.unique(y_test)) > 1:
        roc = roc_auc_score(y_test, probs)
    else:
        roc = 0.0

    print(f"  Precision: {precision:.4f}")
    print(f"  Recall: {recall:.4f}")
    print(f"  F1: {f1:.4f}")
    print(f"  ROC-AUC: {roc:.4f}")

    return f1


# ==========================================================
# 4️⃣ DBSCAN CLUSTERING
# ==========================================================

def evaluate_dbscan():

    print("\n[4] DBSCAN Clustering")

    # Check if model exists
    if not os.path.exists(os.path.join(DBSCAN_DIR, "dbscan_model.pkl")):
        print("  [WARN] Model not found, skipping...")
        return 0.0

    dbscan = joblib.load(os.path.join(DBSCAN_DIR, "dbscan_model.pkl"))

    regions = pd.read_csv(
        os.path.join(DATA_DIR, "regions.csv"),
        usecols=["latitude", "longitude"]
    )

    coords = np.radians(regions[["latitude", "longitude"]].values)
    labels = dbscan.labels_

    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = list(labels).count(-1)

    print(f"  Clusters found: {n_clusters}")
    print(f"  Noise points: {n_noise} ({n_noise / len(labels) * 100:.1f}%)")

    if len(set(labels)) > 1:
        score = silhouette_score(coords, labels, metric="haversine")
        print(f"  Silhouette Score: {score:.4f}")
    else:
        print("  [WARN] Only one cluster found, cannot compute silhouette score")
        score = 0

    return score


# ==========================================================
# MAIN
# ==========================================================

if __name__ == "__main__":

    # Parse command-line arguments
    parser = argparse.ArgumentParser(description="Evaluate ML models")
    parser.add_argument(
        "--use-dummy",
        action="store_true",
        help="Use existing dummy datasets for evaluation"
    )
    parser.add_argument(
        "--generate-dummy",
        action="store_true",
        help="Generate and use new dummy datasets for evaluation"
    )
    
    args = parser.parse_args()
    
    # Setup data source
    if args.generate_dummy:
        data_dir = setup_dummy_data(generate=True)
        if data_dir:
            DATA_DIR = data_dir
        else:
            print("[WARN] Failed to generate dummy data, falling back to real data")
    elif args.use_dummy:
        data_dir = setup_dummy_data(generate=False)
        if data_dir:
            DATA_DIR = data_dir
        else:
            print("[WARN] Dummy data not found, using real data")
    
    # Print data source info
    data_source = "dummy" if USING_DUMMY_DATA else "real"
    print(f"\n[DATA SOURCE] Using {data_source} data: {DATA_DIR}\n")
    
    results = {}
    
    # Evaluate Forecast Model
    try:
        forecast_r2 = evaluate_forecast()
        results["forecast_r2"] = forecast_r2
    except Exception as e:
        print(f"\n[ERROR] Error evaluating forecast model: {e}")
        results["forecast_r2"] = None

    # Evaluate Outbreak Detector
    try:
        outbreak_f1 = evaluate_outbreak()
        results["outbreak_f1"] = outbreak_f1
    except Exception as e:
        print(f"\n[ERROR] Error evaluating outbreak detector: {e}")
        results["outbreak_f1"] = None

    # Evaluate XGBoost V3
    try:
        xgboost_v3_f1 = evaluate_xgboost_v3()
        results["xgboost_v3_f1"] = xgboost_v3_f1
    except Exception as e:
        print(f"\n[ERROR] Error evaluating xgboost_v3: {e}")
        results["xgboost_v3_f1"] = None

    # Evaluate DBSCAN
    try:
        dbscan_score = evaluate_dbscan()
        results["dbscan_silhouette"] = dbscan_score
    except Exception as e:
        print(f"\n[ERROR] Error evaluating DBSCAN: {e}")
        results["dbscan_silhouette"] = None

    # Print Final Summary
    print("\n" + "=" * 80)
    print("FINAL EVALUATION SUMMARY")
    print("=" * 80)
    
    print("\nModel Performance:")
    print(f"  1. Forecast Model (R²):              {results.get('forecast_r2', 'N/A')}")
    print(f"  2. Outbreak Detector (F1):           {results.get('outbreak_f1', 'N/A')}")
    print(f"  3. XGBoost V3 Outbreak (F1):         {results.get('xgboost_v3_f1', 'N/A')}")
    print(f"  4. DBSCAN Clustering (Silhouette):   {results.get('dbscan_silhouette', 'N/A')}")
    
    # Save results
    test_results_dir = os.path.join(BASE_DIR, "test_results")
    os.makedirs(test_results_dir, exist_ok=True)
    
    output_path = os.path.join(test_results_dir, "evaluation_report.json")
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    
    # Also save to root for backwards compatibility
    with open(os.path.join(BASE_DIR, "evaluation_report.json"), "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\nEvaluation complete! Results saved to: {output_path}")
    print("=" * 80)
