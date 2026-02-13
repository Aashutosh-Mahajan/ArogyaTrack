#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FINAL TRUE MODEL EVALUATION
Evaluates:

1) final_ensemble_model (Prophet + XGBoost Forecast)
2) isolation_forest_prod (XGBoost outbreak detector)
3) dbscan_prod (DBSCAN Clustering)
4) xgboost_outbreak_v3 (Alternative outbreak detector)

Fully stable. Matches training feature engineering.
"""

import os
import json
import warnings
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
# PATHS
# ==========================================================

BASE_DIR = r"D:\python\ml_models"
DATA_DIR = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
MODELS_DIR = os.path.join(BASE_DIR, "saved_models")

FORECAST_DIR = os.path.join(MODELS_DIR, "final_ensemble_model")
OUTBREAK_DIR = os.path.join(MODELS_DIR, "isolation_forest_prod")
DBSCAN_DIR = os.path.join(MODELS_DIR, "dbscan_prod")
XGBOOST_V3_DIR = os.path.join(MODELS_DIR, "xgboost_outbreak_v3")

FORECAST_DAYS = 90
USE_WEEKLY = True   # must match training script

# Feature engineering config (must match training)
LAG_PERIODS = [7, 14, 21]
ROLLING_WINDOWS = [7, 14, 28]

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

    daily = surv.groupby("date", as_index=False)["case_count"].sum()
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
            "y": "sum",
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

    df["rolling_mean_4"] = df["y_original"].rolling(4, min_periods=1).mean()
    df["rolling_std_4"] = df["y_original"].rolling(4, min_periods=1).std().fillna(0)
    df["rolling_mean_8"] = df["y_original"].rolling(8, min_periods=1).mean()
    df["rolling_std_8"] = df["y_original"].rolling(8, min_periods=1).std().fillna(0)
    df["rolling_max_4"] = df["y_original"].rolling(4, min_periods=1).max()
    df["rolling_min_4"] = df["y_original"].rolling(4, min_periods=1).min()

    df["diff_1"] = df["y_original"].diff().fillna(0)
    df["diff_2"] = df["y_original"].diff(2).fillna(0)
    df["pct_change_1"] = df["y_original"].pct_change().fillna(0).replace([np.inf, -np.inf], 0)

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
# 2️⃣ OUTBREAK DETECTOR (XGBoost from isolation_forest_prod)
# ==========================================================

def evaluate_outbreak():
    """
    Evaluate XGBoost outbreak detector with proper feature engineering
    """
    print("\n[2] XGBoost Outbreak Detector (isolation_forest_prod)")

    # Check if model exists
    if not os.path.exists(os.path.join(OUTBREAK_DIR, "xgboost_model.pkl")):
        print("  ⚠️  Model not found, skipping...")
        return 0.0

    # Load model artifacts
    model = joblib.load(os.path.join(OUTBREAK_DIR, "xgboost_model.pkl"))
    scaler = joblib.load(os.path.join(OUTBREAK_DIR, "scaler.pkl"))

    with open(os.path.join(OUTBREAK_DIR, "features.json")) as f:
        FEATURES = json.load(f)

    print(f"  ✓ Loaded model with {len(FEATURES)} features")

    # Load data
    surv = pd.read_csv(
        os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
        parse_dates=["date"]
    )

    if "outbreak_occurred" not in surv.columns:
        print("  ⚠️  No outbreak labels found, skipping...")
        return 0.0

    # Load environmental data if needed
    env = pd.read_csv(
        os.path.join(DATA_DIR, "environmental_data.csv"),
        parse_dates=["date"]
    )

    # Load regions for population
    regions = pd.read_csv(
        os.path.join(DATA_DIR, "regions.csv"),
        usecols=["region_id", "population"]
    )

    # Merge datasets
    df = surv.merge(env, on=["region_id", "date"], how="left", suffixes=('', '_env'))
    df = df.merge(regions, on="region_id", how="left")

    # Handle duplicate columns
    for col in df.columns:
        if col.endswith('_env'):
            base_col = col.rsplit('_', 1)[0]
            if base_col in df.columns:
                df[base_col] = df[base_col].fillna(df[col])
                df = df.drop(columns=[col])

    df = df.sort_values(["region_id", "date"]).reset_index(drop=True)

    # Feature engineering (MUST MATCH TRAINING)
    print("  Engineering features...")
    group = df.groupby("region_id")

    # Lag features
    for lag in LAG_PERIODS:
        df[f"cases_lag_{lag}"] = group["case_count"].shift(lag).fillna(0)
        if "severity_avg" in df.columns:
            df[f"severity_lag_{lag}"] = group["severity_avg"].shift(lag).fillna(0)

    # Rolling mean
    for w in ROLLING_WINDOWS:
        df[f"cases_rm_{w}"] = group["case_count"].transform(
            lambda x: x.rolling(window=w, min_periods=1).mean()
        ).fillna(0)

    # Rolling std
    for w in ROLLING_WINDOWS:
        df[f"cases_rstd_{w}"] = group["case_count"].transform(
            lambda x: x.rolling(window=w, min_periods=1).std()
        ).fillna(0)

    # Rolling max
    for w in ROLLING_WINDOWS:
        df[f"cases_rmax_{w}"] = group["case_count"].transform(
            lambda x: x.rolling(window=w, min_periods=1).max()
        ).fillna(0)

    # Growth rates
    for p in LAG_PERIODS:
        df[f"growth_{p}"] = group["case_count"].pct_change(periods=p).fillna(0)
        df[f"growth_{p}"] = df[f"growth_{p}"].replace([np.inf, -np.inf], 0)

    # Acceleration
    df["acceleration_7"] = group["case_count"].diff().diff().fillna(0)

    # Deviation from baseline
    df["deviation_7"] = (df["case_count"] - df["cases_rm_7"]) / (df["cases_rstd_7"] + 1)
    df["deviation_14"] = (df["case_count"] - df["cases_rm_14"]) / (df["cases_rstd_14"] + 1)
    df["deviation_28"] = (df["case_count"] - df["cases_rm_28"]) / (df["cases_rstd_28"] + 1)

    # Spike indicators
    df["is_spike_2std"] = (df["deviation_7"] > 2).astype(int)
    df["is_spike_3std"] = (df["deviation_7"] > 3).astype(int)

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

    # Extract features (only those that exist in both FEATURES list and dataframe)
    available_features = [f for f in FEATURES if f in test_df.columns]
    missing_features = [f for f in FEATURES if f not in test_df.columns]

    if missing_features:
        print(f"  ⚠️  Missing {len(missing_features)} features: {missing_features[:5]}")
        # Fill missing features with zeros
        for f in missing_features:
            test_df[f] = 0
        available_features = FEATURES

    X = test_df[available_features].fillna(0)
    y_true = test_df["outbreak_occurred"].values

    # Scale features
    X_scaled = scaler.transform(X)

    # Predict
    probs = model.predict_proba(X_scaled)[:, 1]
    preds = (probs >= 0.5).astype(int)

    # Calculate metrics
    precision = precision_score(y_true, preds, zero_division=0)
    recall = recall_score(y_true, preds, zero_division=0)
    f1 = f1_score(y_true, preds, zero_division=0)
    
    if len(np.unique(y_true)) > 1:
        roc = roc_auc_score(y_true, probs)
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
        print("  Model not found, skipping...")
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

    # Feature engineering (match training script)
    print("  Engineering features...")
    df = df.sort_values(["region_id", "date"])

    # Rolling averages
    for w in [7, 14, 21, 28]:
        df[f"cases_{w}d"] = df.groupby("region_id")["case_count"] \
            .transform(lambda x: x.rolling(w, 1).mean())

    # Rolling std
    for w in [7, 14, 28]:
        df[f"cases_std_{w}d"] = df.groupby("region_id")["case_count"] \
            .transform(lambda x: x.rolling(w, 1).std()).fillna(0)

    # Rolling max
    for w in [7, 14, 28]:
        df[f"cases_max_{w}d"] = df.groupby("region_id")["case_count"] \
            .transform(lambda x: x.rolling(w, 1).max())

    # Growth rates
    for p in [7, 14, 21]:
        df[f"growth_{p}d"] = (
            (df["cases_7d"] - df.groupby("region_id")["cases_7d"].shift(p))
            / (df.groupby("region_id")["cases_7d"].shift(p) + 1)
        )
        df[f"growth_{p}d"] = df[f"growth_{p}d"].replace([np.inf, -np.inf], 0)

    # Acceleration
    df["acceleration"] = df.groupby("region_id")["growth_7d"].diff().fillna(0)

    # Z-score
    df["rolling_mean_30"] = df.groupby("region_id")["case_count"] \
        .transform(lambda x: x.rolling(30, 1).mean())
    df["rolling_std_30"] = df.groupby("region_id")["case_count"] \
        .transform(lambda x: x.rolling(30, 1).std())
    df["zscore"] = (df["case_count"] - df["rolling_mean_30"]) / (df["rolling_std_30"] + 1)

    # Deviation
    df["deviation_7"] = (df["case_count"] - df["cases_7d"]) / (df["cases_std_7d"] + 1)
    df["deviation_14"] = (df["case_count"] - df["cases_14d"]) / (df["cases_std_14d"] + 1)

    # Spikes
    df["is_spike_2std"] = (df["deviation_7"] > 2).astype(int)
    df["is_spike_3std"] = (df["deviation_7"] > 3).astype(int)

    # Severity
    if "severity_avg" in df.columns:
        df["severity_7d"] = df.groupby("region_id")["severity_avg"] \
            .transform(lambda x: x.rolling(7, 1).mean())
        for lag in [7, 14, 21]:
            df[f"severity_lag_{lag}"] = df.groupby("region_id")["severity_avg"].shift(lag)

    # Lag features
    for lag in [7, 14, 21]:
        df[f"cases_lag_{lag}"] = df.groupby("region_id")["case_count"].shift(lag)

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
    df["cases_per_100k"] = df["cases_7d"] / (df["population"] / 100000 + 1)

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
        print("  ⚠️  Model not found, skipping...")
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
        print("  ⚠️  Only one cluster found, cannot compute silhouette score")
        score = 0

    return score


# ==========================================================
# MAIN
# ==========================================================

if __name__ == "__main__":

    results = {}
    
    # Evaluate Forecast Model
    try:
        forecast_r2 = evaluate_forecast()
        results["forecast_r2"] = forecast_r2
    except Exception as e:
        print(f"\n❌ Error evaluating forecast model: {e}")
        results["forecast_r2"] = None

    # Evaluate Outbreak Detector
    try:
        outbreak_f1 = evaluate_outbreak()
        results["outbreak_f1"] = outbreak_f1
    except Exception as e:
        print(f"\n❌ Error evaluating outbreak detector: {e}")
        results["outbreak_f1"] = None

    # Evaluate XGBoost V3
    try:
        xgboost_v3_f1 = evaluate_xgboost_v3()
        results["xgboost_v3_f1"] = xgboost_v3_f1
    except Exception as e:
        print(f"\n❌ Error evaluating xgboost_v3: {e}")
        results["xgboost_v3_f1"] = None

    # Evaluate DBSCAN
    try:
        dbscan_score = evaluate_dbscan()
        results["dbscan_silhouette"] = dbscan_score
    except Exception as e:
        print(f"\n❌ Error evaluating DBSCAN: {e}")
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
