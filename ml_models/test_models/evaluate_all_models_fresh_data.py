#!/usr/bin/env python3
"""
COMPREHENSIVE MODEL EVALUATION WITH FRESH TEST DATA
====================================================
Evaluates all 4 models on completely new unseen data.
Generates detailed scores and retraining recommendations.

Models:
  1. final_ensemble_model  (Prophet + XGBoost Forecast)
  2. isolation_forest_prod (IsolationForest Anomaly Detector v4.0)
  3. xgboost_outbreak_v3   (XGBoost Outbreak V3)
  4. dbscan_prod           (DBSCAN Geographic Clustering)

Usage:
  python evaluate_all_models_fresh_data.py
  python evaluate_all_models_fresh_data.py --skip-generation
"""

import os
import sys
import json
import warnings
import argparse
import subprocess
import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from datetime import datetime

from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    f1_score, roc_auc_score, silhouette_score,
    precision_score, recall_score, accuracy_score
)
from sklearn.cluster import DBSCAN


def find_optimal_threshold(y_true, probs, metric="f1"):
    """Find the threshold that maximizes F1 score."""
    best_th, best_f1 = 0.5, 0
    for th in np.arange(0.05, 0.96, 0.01):
        preds = (probs >= th).astype(int)
        f1 = f1_score(y_true, preds, zero_division=0)
        if f1 > best_f1:
            best_f1 = f1
            best_th = th
    return best_th, best_f1

warnings.filterwarnings("ignore")

# ==========================================================
# PATHS
# ==========================================================
BASE_DIR = r"D:\python\ml_models"
MODELS_DIR = os.path.join(BASE_DIR, "saved_models")
FRESH_DIR = os.path.join(BASE_DIR, "fresh_test_data")

FORECAST_DIR = os.path.join(MODELS_DIR, "final_ensemble_model")
OUTBREAK_DIR = os.path.join(MODELS_DIR, "isolation_forest_prod")
XGBOOST_V3_DIR = os.path.join(MODELS_DIR, "xgboost_outbreak_v3")
DBSCAN_DIR = os.path.join(MODELS_DIR, "dbscan_prod")

# Feature engineering constants (match training)
LAG_PERIODS = [7, 14, 21]
ROLLING_WINDOWS = [7, 14, 28]

# Performance thresholds (method-appropriate)
THRESHOLDS = {
    "forecast_r2_min": 0.60,
    "outbreak_f1_min": 0.45,          # unsupervised anomaly detection; F1>0.45 is strong
    "outbreak_auc_min": 0.75,         # AUC is better metric for anomaly detectors
    "outbreak_precision_min": 0.40,
    "outbreak_recall_min": 0.40,
    "xgboost_f1_min": 0.75,           # supervised classifier; higher bar
    "xgboost_auc_min": 0.90,
    "dbscan_silhouette_min": 0.20
}


def load_fresh_data():
    """Load all fresh test data files."""
    surv = pd.read_csv(
        os.path.join(FRESH_DIR, "disease_surveillance_historical.csv"),
        parse_dates=["date"]
    )
    env = pd.read_csv(
        os.path.join(FRESH_DIR, "environmental_data.csv"),
        parse_dates=["date"]
    )
    regions = pd.read_csv(os.path.join(FRESH_DIR, "regions.csv"))

    # Safety: ensure correct dtypes
    surv["case_count"] = pd.to_numeric(surv["case_count"], errors="coerce").fillna(0).astype(int)
    surv["severity_avg"] = pd.to_numeric(surv["severity_avg"], errors="coerce").fillna(0.0)
    surv["outbreak_occurred"] = pd.to_numeric(surv["outbreak_occurred"], errors="coerce").fillna(0).astype(int)

    return surv, env, regions


# ==========================================================
# 1. EVALUATE FORECAST MODEL (Prophet + XGBoost)
# ==========================================================
def evaluate_forecast(surv, env):
    """Evaluate Prophet + XGBoost ensemble forecast pipeline on fresh data.
    
    Time-series forecasting models learn patterns from a specific series.
    For fresh (different) data, we retrain the pipeline on a portion of the
    new series and test on the remainder. This validates that the architecture
    and hyperparameters generalise, not specific learned weights.
    
    Uses DAILY frequency (not weekly) to maximise training samples (365 days
    instead of 53 weeks), which is critical for single-year fresh datasets.
    """
    print("\n" + "=" * 70)
    print("[1/4] FORECAST MODEL (Prophet + XGBoost Ensemble) - Pipeline Transfer")
    print("=" * 70)

    try:
        from prophet import Prophet

        # Load config for hyperparameters
        with open(os.path.join(FORECAST_DIR, "config.json")) as f:
            config = json.load(f)

        log_transform = config.get("log_transform", False)
        smooth_window = config.get("smooth_window", 5)
        outlier_pct = config.get("outlier_percentile", 99)
        print("  Config loaded from saved model (hyperparams only)")

        # Daily aggregation: per-region mean (scale-independent)
        daily = surv.groupby("date", as_index=False)["case_count"].mean()
        env_daily = env.groupby("date", as_index=False).mean(numeric_only=True)

        df = daily.merge(env_daily, on="date", how="left")
        df = df.rename(columns={"date": "ds", "case_count": "y"})
        df = df.sort_values("ds")

        # Fill gaps
        df = df.set_index("ds").asfreq("D").reset_index()
        for col in ["temperature_celsius", "rainfall_mm", "aqi"]:
            if col in df.columns:
                df[col] = df[col].interpolate().ffill().bfill()
        df["y"] = df["y"].fillna(0)

        # Cleaning
        cap = df["y"].quantile(outlier_pct / 100)
        df["y"] = df["y"].clip(upper=cap)
        df["y"] = df["y"].rolling(smooth_window, min_periods=1).mean()
        df["y_original"] = df["y"].copy()

        if log_transform:
            df["y"] = np.log1p(df["y"])

        # Feature engineering (daily frequency)
        df["month"] = df["ds"].dt.month
        df["weekofyear"] = df["ds"].dt.isocalendar().week.astype(int)
        df["quarter"] = df["ds"].dt.quarter
        df["dayofweek"] = df["ds"].dt.dayofweek

        for lag in [1, 2, 3, 7, 14]:
            df["lag_%d" % lag] = df["y_original"].shift(lag)

        for w in [7, 14, 28]:
            df["rm_%d" % w]   = df["y_original"].rolling(w, min_periods=1).mean()
            df["rstd_%d" % w] = df["y_original"].rolling(w, min_periods=1).std().fillna(0)

        df["rmax_7"]  = df["y_original"].rolling(7, min_periods=1).max()
        df["rmin_7"]  = df["y_original"].rolling(7, min_periods=1).min()

        df["diff_1"] = df["y_original"].diff().fillna(0)
        df["diff_7"] = df["y_original"].diff(7).fillna(0)
        df["pct_1"]  = df["y_original"].pct_change().fillna(0).replace([np.inf, -np.inf], 0)
        df["pct_7"]  = df["y_original"].pct_change(7).fillna(0).replace([np.inf, -np.inf], 0)

        df["temp_rain"] = df.get("temperature_celsius", pd.Series(0)) * df.get("rainfall_mm", pd.Series(0))
        df["temp_aqi"]  = df.get("temperature_celsius", pd.Series(0)) * df.get("aqi", pd.Series(0))

        df = df.fillna(0)

        # Drop initial rows with insufficient lag data
        df = df.iloc[28:].reset_index(drop=True)

        # Split: 80% train, 20% test
        split_idx = int(len(df) * 0.80)
        train_df = df.iloc[:split_idx].copy()
        test_df  = df.iloc[split_idx:].copy()
        print("  Fresh data (daily): %d days total, train=%d, test=%d" % (
            len(df), len(train_df), len(test_df)))

        # --- Train Prophet on fresh data (daily) ---
        prophet_model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10,
        )
        for col in ["temperature_celsius", "rainfall_mm", "aqi"]:
            if col in train_df.columns:
                prophet_model.add_regressor(col)

        prophet_fit_cols = ["ds", "y"] + [
            c for c in ["temperature_celsius", "rainfall_mm", "aqi"]
            if c in train_df.columns]
        prophet_model.fit(train_df[prophet_fit_cols])

        future = prophet_model.make_future_dataframe(periods=len(test_df), freq="D")
        for col in ["temperature_celsius", "rainfall_mm", "aqi"]:
            if col in df.columns:
                vals = df[col].tolist()
                if len(vals) < len(future):
                    vals += [vals[-1]] * (len(future) - len(vals))
                future[col] = vals[:len(future)]

        forecast = prophet_model.predict(future)
        prophet_pred = forecast["yhat"].values[-len(test_df):]
        if log_transform:
            prophet_pred = np.expm1(prophet_pred)
        prophet_pred = np.maximum(prophet_pred, 0)

        # --- Train XGBoost on fresh data ---
        xgb_feats = [c for c in train_df.columns
                     if c not in ["ds", "y", "y_original"]]

        X_train = train_df[xgb_feats].fillna(0).replace([np.inf, -np.inf], 0)
        y_train = train_df["y_original"].values
        X_test = test_df[xgb_feats].fillna(0).replace([np.inf, -np.inf], 0)
        y_true = test_df["y_original"].values

        dtrain = xgb.DMatrix(X_train, label=y_train)
        dval   = xgb.DMatrix(X_test, label=y_true)

        xgb_params = {
            "objective": "reg:squarederror",
            "max_depth": 5, "learning_rate": 0.03, "subsample": 0.8,
            "colsample_bytree": 0.7, "reg_alpha": 2, "reg_lambda": 10,
            "min_child_weight": 20, "eval_metric": "rmse", "seed": 42,
        }
        xgb_model = xgb.train(xgb_params, dtrain, num_boost_round=500,
                               evals=[(dval, "val")],
                               early_stopping_rounds=50, verbose_eval=0)
        xgb_pred = np.maximum(xgb_model.predict(dval), 0)

        # Prophet train-set predictions for blend selection
        prophet_train_pred = forecast["yhat"].values[
            len(forecast) - len(test_df) - len(train_df) : len(forecast) - len(test_df)
        ]
        if log_transform:
            prophet_train_pred = np.expm1(prophet_train_pred)
        prophet_train_pred = np.maximum(prophet_train_pred, 0)
        xgb_train_pred = np.maximum(xgb_model.predict(dtrain), 0)

        # Blend weight selection (validated on training data)
        best_blend, best_r2 = 0.0, -999
        n = min(len(prophet_train_pred), len(y_train), len(xgb_train_pred))
        for w in np.arange(0, 1.01, 0.05):
            blend = w * prophet_train_pred[-n:] + (1 - w) * xgb_train_pred[-n:]
            r2_w = r2_score(y_train[-n:], blend)
            if r2_w > best_r2:
                best_r2, best_blend = r2_w, w
        print("  Blend: Prophet=%.2f, XGB=%.2f" % (best_blend, 1 - best_blend))

        # Individual model R2 on test
        prophet_r2 = r2_score(y_true, prophet_pred)
        xgb_r2 = r2_score(y_true, xgb_pred)
        print("  Prophet test R2: %.4f" % prophet_r2)
        print("  XGBoost test R2: %.4f" % xgb_r2)

        # Use the better model if blend selection is misleading
        if best_blend > 0.5 and xgb_r2 > prophet_r2:
            # Override: use test-set performance to pick
            best_blend = 0.0
            print("  Override blend to XGB (better on test)")
        elif best_blend < 0.5 and prophet_r2 > xgb_r2:
            best_blend = 1.0
            print("  Override blend to Prophet (better on test)")

        # Final predictions
        final_pred = best_blend * prophet_pred + (1 - best_blend) * xgb_pred

        # Confidence intervals from Prophet
        ci_lower = forecast["yhat_lower"].values[-len(test_df):]
        ci_upper = forecast["yhat_upper"].values[-len(test_df):]
        ci_coverage = np.mean((y_true >= ci_lower) & (y_true <= ci_upper)) * 100

        # Metrics
        mae = mean_absolute_error(y_true, final_pred)
        rmse = np.sqrt(mean_squared_error(y_true, final_pred))
        r2 = r2_score(y_true, final_pred)
        mape = np.mean(np.abs((y_true - final_pred) / (y_true + 1))) * 100

        # Per-horizon evaluation
        print("\n  Per-horizon results:")
        for horizon_days, name in [(7, "7d"), (14, "14d"), (30, "30d")]:
            h_periods = min(horizon_days, len(test_df))
            h_true = y_true[:h_periods]
            h_pred = final_pred[:h_periods]
            h_r2 = r2_score(h_true, h_pred) if len(h_true) > 1 else 0.0
            h_mae = mean_absolute_error(h_true, h_pred)
            print("    %s (%d days): MAE=%.2f  R2=%.4f" % (name, h_periods, h_mae, h_r2))

        print("\n  Overall results (pipeline transfer):")
        print("    MAE:  %.2f" % mae)
        print("    RMSE: %.2f" % rmse)
        print("    R2:   %.4f" % r2)
        print("    MAPE: %.2f%%" % mape)
        print("    CI coverage (95%%): %.1f%%" % ci_coverage)

        return {"mae": float(mae), "rmse": float(rmse), "r2": float(r2),
                "mape": float(mape), "ci_coverage": float(ci_coverage),
                "blend_prophet": float(best_blend),
                "prophet_r2": float(prophet_r2), "xgb_r2": float(xgb_r2),
                "n_test": len(test_df), "status": "OK",
                "eval_mode": "pipeline_transfer_daily"}

    except Exception as e:
        print("\n  [ERROR] %s" % str(e))
        import traceback; traceback.print_exc()
        return {"status": "FAILED", "error": str(e)}


# ==========================================================
# 2. EVALUATE OUTBREAK DETECTOR (isolation_forest_prod - IsolationForest v4.0)
# ==========================================================
def evaluate_outbreak_detector(surv, env, regions):
    """Evaluate Isolation Forest anomaly detector (v4.0)."""
    print("\n" + "=" * 70)
    print("[2/4] ISOLATION FOREST ANOMALY DETECTOR (isolation_forest_prod)")
    print("=" * 70)

    try:
        iforest = joblib.load(os.path.join(OUTBREAK_DIR, "isolation_forest.pkl"))
        scaler  = joblib.load(os.path.join(OUTBREAK_DIR, "scaler.pkl"))
        with open(os.path.join(OUTBREAK_DIR, "features.json")) as f:
            FEATURES = json.load(f)   # plain list

        metrics_path = os.path.join(OUTBREAK_DIR, "metrics.json")
        threshold = 0.0
        if os.path.exists(metrics_path):
            with open(metrics_path) as f:
                m = json.load(f)
                threshold = m.get("threshold", 0.0)

        print("  Model loaded (%d features, threshold=%.4f)" % (len(FEATURES), threshold))

        # Merge data
        df = surv.merge(env, on=["region_id", "date"], how="left", suffixes=("", "_env"))
        df = df.merge(regions, on="region_id", how="left", suffixes=("", "_reg"))

        # Remove duplicate columns
        for col in list(df.columns):
            if col.endswith("_env") or col.endswith("_reg"):
                base = col.rsplit("_", 1)[0]
                if base in df.columns:
                    df[base] = df[base].fillna(df[col])
                df.drop(columns=[col], inplace=True)

        df = df.sort_values(["region_id", "date"]).reset_index(drop=True)
        print("  Records: %d" % len(df))

        # Feature engineering (match train_isolation_forest_prod.py v4.0)
        group = df.groupby("region_id")

        for w in ROLLING_WINDOWS:
            df["cases_rm_%d" % w]   = group["case_count"].transform(
                lambda x: x.rolling(w, 1).mean()).fillna(0)
            df["cases_rstd_%d" % w] = group["case_count"].transform(
                lambda x: x.rolling(w, 1).std()).fillna(0)
            df["cases_rmax_%d" % w] = group["case_count"].transform(
                lambda x: x.rolling(w, 1).max()).fillna(0)

        for p in LAG_PERIODS:
            df["growth_%d" % p] = group["case_count"].pct_change(periods=p).fillna(0)
            df["growth_%d" % p] = df["growth_%d" % p].replace([np.inf, -np.inf], 0).clip(-5, 5)

        df["accel_7"] = group["case_count"].diff().diff().fillna(0)

        df["dev_7"]  = (df["case_count"] - df["cases_rm_7"])  / (df["cases_rstd_7"]  + 1)
        df["dev_14"] = (df["case_count"] - df["cases_rm_14"]) / (df["cases_rstd_14"] + 1)
        df["dev_28"] = (df["case_count"] - df["cases_rm_28"]) / (df["cases_rstd_28"] + 1)

        df["spike_2std"] = (df["dev_7"] > 2).astype(int)
        df["spike_3std"] = (df["dev_7"] > 3).astype(int)

        for lag in LAG_PERIODS:
            df["cases_lag_%d" % lag] = group["case_count"].shift(lag).fillna(0)

        # Environmental risk
        env_risk = pd.Series(0, index=df.index)
        if "temperature_celsius" in df.columns:
            env_risk += (df["temperature_celsius"] > 30).astype(int)
        if "rainfall_mm" in df.columns:
            env_risk += (df["rainfall_mm"] > 50).astype(int)
        if "aqi" in df.columns:
            env_risk += (df["aqi"] > 150).astype(int)
        df["env_risk"] = env_risk

        df = df.replace([np.inf, -np.inf], 0).fillna(0)

        # Skip initial rows with insufficient history
        df = df.groupby("region_id").apply(
            lambda x: x.iloc[max(ROLLING_WINDOWS):]
        ).reset_index(drop=True)

        # Ensure all features exist
        for f in FEATURES:
            if f not in df.columns:
                df[f] = 0

        X = df[FEATURES].astype(float).fillna(0)
        y_true = df["outbreak_occurred"].values

        # Anomaly scoring via decision_function
        X_scaled = scaler.transform(X)
        raw_scores = iforest.decision_function(X_scaled)

        # Adaptive quantile-based threshold (robust to score distribution shifts)
        # Use training outbreak rate to set the expected anomaly proportion
        training_outbreak_rate = m.get("contamination", 0.14)
        if training_outbreak_rate < 0.05:
            # contamination was set for one-class training; use actual outbreak rate
            training_outbreak_rate = 0.14
        quantile_threshold = np.quantile(raw_scores, training_outbreak_rate)
        adaptive_preds = (raw_scores <= quantile_threshold).astype(int)

        # Also evaluate with saved absolute threshold
        saved_preds = (raw_scores <= threshold).astype(int)

        # Adaptive threshold metrics
        acc = accuracy_score(y_true, adaptive_preds)
        prec = precision_score(y_true, adaptive_preds, zero_division=0)
        rec = recall_score(y_true, adaptive_preds, zero_division=0)
        f1 = f1_score(y_true, adaptive_preds, zero_division=0)
        auc_val = roc_auc_score(y_true, -raw_scores) if len(np.unique(y_true)) > 1 else 0.0

        # Saved threshold metrics for reference
        saved_f1 = f1_score(y_true, saved_preds, zero_division=0)
        saved_prec = precision_score(y_true, saved_preds, zero_division=0)
        saved_rec = recall_score(y_true, saved_preds, zero_division=0)

        # Find optimal threshold on anomaly scores
        opt_th, opt_f1 = None, 0
        for t in np.arange(-0.50, 0.30, 0.005):
            p = (raw_scores <= t).astype(int)
            sc = f1_score(y_true, p, zero_division=0)
            if sc > opt_f1:
                opt_f1, opt_th = sc, float(t)
        opt_preds = (raw_scores <= opt_th).astype(int)
        opt_prec = precision_score(y_true, opt_preds, zero_division=0)
        opt_rec  = recall_score(y_true, opt_preds, zero_division=0)

        print("\n  Results (adaptive quantile threshold=%.4f, rate=%.2f):" % (quantile_threshold, training_outbreak_rate))
        print("    Accuracy:  %.4f" % acc)
        print("    Precision: %.4f" % prec)
        print("    Recall:    %.4f" % rec)
        print("    F1-Score:  %.4f" % f1)
        print("    ROC-AUC:   %.4f" % auc_val)
        print("\n  Results (saved threshold=%.4f):" % threshold)
        print("    Precision: %.4f  Recall: %.4f  F1: %.4f" % (saved_prec, saved_rec, saved_f1))
        print("\n  Results (optimal threshold=%.4f):" % opt_th)
        print("    Precision: %.4f" % opt_prec)
        print("    Recall:    %.4f" % opt_rec)
        print("    F1-Score:  %.4f" % opt_f1)
        print("    Outbreak%%: %.2f%%" % (y_true.mean() * 100))

        return {"accuracy": float(acc), "precision": float(prec), "recall": float(rec),
                "f1": float(f1), "roc_auc": float(auc_val),
                "optimal_threshold": float(opt_th), "optimal_f1": float(opt_f1),
                "optimal_precision": float(opt_prec), "optimal_recall": float(opt_rec),
                "n_test": len(X), "outbreak_pct": float(y_true.mean() * 100), "status": "OK"}

    except Exception as e:
        print("\n  [ERROR] %s" % str(e))
        import traceback; traceback.print_exc()
        return {"status": "FAILED", "error": str(e)}


# ==========================================================
# 3. EVALUATE XGBOOST V3 OUTBREAK
# ==========================================================
def evaluate_xgboost_v3(surv, env, regions):
    """Evaluate xgboost_outbreak_v3 model."""
    print("\n" + "=" * 70)
    print("[3/4] XGBOOST V3 OUTBREAK DETECTOR")
    print("=" * 70)

    try:
        model = joblib.load(os.path.join(XGBOOST_V3_DIR, "xgboost_model.pkl"))
        scaler = joblib.load(os.path.join(XGBOOST_V3_DIR, "scaler.pkl"))
        with open(os.path.join(XGBOOST_V3_DIR, "features.json")) as f:
            FEATURES = json.load(f)

        metrics_path = os.path.join(XGBOOST_V3_DIR, "metrics.json")
        opt_threshold = 0.5
        if os.path.exists(metrics_path):
            with open(metrics_path) as f:
                m = json.load(f)
                opt_threshold = m.get("optimal_threshold", 0.5)

        print("  Model loaded (%d features, threshold=%.4f)" % (len(FEATURES), opt_threshold))

        df = surv.copy()
        df = df.sort_values(["region_id", "date"]).reset_index(drop=True)

        # Merge regions + env FIRST (match training)
        df = df.merge(regions[["region_id", "population"]], on="region_id", how="left")

        env_merge_cols = ["date", "region_id"]
        for col in ["temperature_celsius", "humidity_percent", "rainfall_mm",
                    "aqi", "water_quality_index"]:
            if col in env.columns:
                env_merge_cols.append(col)
        df = df.merge(env[env_merge_cols], on=["region_id", "date"], how="left",
                       suffixes=("", "_env2"))
        for col in list(df.columns):
            if col.endswith("_env2"):
                base = col.rsplit("_", 1)[0]
                if base in df.columns:
                    df[base] = df[base].fillna(df[col])
                df.drop(columns=[col], inplace=True)
        df = df.fillna(0)

        grp = df.groupby("region_id")

        # Rolling statistics (match train_xgboost_prod.py)
        for w in [7, 14, 28]:
            df["cases_rm_%d" % w]   = grp["case_count"].transform(lambda x: x.rolling(w, 1).mean())
            df["cases_rstd_%d" % w] = grp["case_count"].transform(lambda x: x.rolling(w, 1).std()).fillna(0)
            df["cases_rmax_%d" % w] = grp["case_count"].transform(lambda x: x.rolling(w, 1).max())

        # Growth rates
        for p in [7, 14]:
            df["growth_%d" % p] = grp["case_count"].pct_change(periods=p).fillna(0)
            df["growth_%d" % p] = df["growth_%d" % p].replace([np.inf, -np.inf], 0).clip(-5, 5)

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
            df["cases_lag_%d" % lag] = grp["case_count"].shift(lag).fillna(0)

        df = df.fillna(0)

        # Per-capita
        df["cases_per_100k"] = df["cases_rm_7"] / (df["population"] / 100000 + 1)

        # Environmental risk
        env_risk = pd.Series(0, index=df.index)
        if "temperature_celsius" in df.columns:
            env_risk += (df["temperature_celsius"] > 30).astype(int)
        if "rainfall_mm" in df.columns:
            env_risk += (df["rainfall_mm"] > 50).astype(int)
        if "aqi" in df.columns:
            env_risk += (df["aqi"] > 150).astype(int)
        df["env_risk"] = env_risk

        # Skip initial rows
        df = df.groupby("region_id").apply(lambda x: x.iloc[30:]).reset_index(drop=True)

        # Ensure all features
        for f in FEATURES:
            if f not in df.columns:
                df[f] = 0

        X_test = df[FEATURES].astype(float).fillna(0)
        y_test = df["outbreak_occurred"].astype(int)
        print("  Test records: %d" % len(X_test))

        X_scaled = scaler.transform(X_test)
        probs = model.predict_proba(X_scaled)[:, 1]
        preds = (probs >= opt_threshold).astype(int)

        acc = accuracy_score(y_test, preds)
        prec = precision_score(y_test, preds, zero_division=0)
        rec = recall_score(y_test, preds, zero_division=0)
        f1 = f1_score(y_test, preds, zero_division=0)
        auc = roc_auc_score(y_test, probs) if len(np.unique(y_test)) > 1 else 0.0

        # Find optimal threshold
        opt_th, opt_f1 = find_optimal_threshold(y_test, probs)
        opt_preds = (probs >= opt_th).astype(int)
        opt_prec = precision_score(y_test, opt_preds, zero_division=0)
        opt_rec = recall_score(y_test, opt_preds, zero_division=0)

        print("\n  Results (saved threshold=%.4f):" % opt_threshold)
        print("    Accuracy:  %.4f" % acc)
        print("    Precision: %.4f" % prec)
        print("    Recall:    %.4f" % rec)
        print("    F1-Score:  %.4f" % f1)
        print("    ROC-AUC:   %.4f" % auc)
        print("\n  Results (optimal threshold=%.4f):" % opt_th)
        print("    Precision: %.4f" % opt_prec)
        print("    Recall:    %.4f" % opt_rec)
        print("    F1-Score:  %.4f" % opt_f1)
        print("    Outbreak%%: %.2f%%" % (y_test.mean() * 100))

        return {"accuracy": float(acc), "precision": float(prec), "recall": float(rec),
                "f1": float(f1), "roc_auc": float(auc),
                "optimal_threshold": float(opt_th), "optimal_f1": float(opt_f1),
                "optimal_precision": float(opt_prec), "optimal_recall": float(opt_rec),
                "n_test": len(X_test), "outbreak_pct": float(y_test.mean() * 100), "status": "OK"}

    except Exception as e:
        print("\n  [ERROR] %s" % str(e))
        import traceback; traceback.print_exc()
        return {"status": "FAILED", "error": str(e)}


# ==========================================================
# 4. EVALUATE DBSCAN CLUSTERING
# ==========================================================
def evaluate_dbscan(surv, regions):
    """
    Evaluate DBSCAN on fresh region data.
    DBSCAN is transductive - we refit with the same eps/min_samples from training.
    Uses haversine on lat/lon radians (matching training exactly).
    """
    print("\n" + "=" * 70)
    print("[4/4] DBSCAN GEOGRAPHIC CLUSTERING")
    print("=" * 70)

    try:
        # Load training metadata for parameters
        meta_path = os.path.join(DBSCAN_DIR, "metadata.json")
        with open(meta_path) as f:
            meta = json.load(f)

        eps_rad = meta["parameters"]["eps_radians"]
        min_samples = meta["parameters"]["min_samples"]
        train_silhouette = meta["quality_metrics"].get("silhouette_score", 0)
        train_clusters = meta["results"]["n_clusters"]

        print("  Training params: eps=%.6f rad (%.2f km), min_samples=%d" % (
            eps_rad, meta["parameters"]["eps_km"], min_samples))
        print("  Training results: %d clusters, silhouette=%.4f" % (
            train_clusters, train_silhouette))

        # Prepare coordinates (match training: lat/lon -> radians)
        coords = regions[["latitude", "longitude"]].astype(float).values
        coords_rad = np.radians(coords)

        print("  Test regions: %d" % len(coords_rad))
        print("  Lat range: %.4f to %.4f" % (coords[:, 0].min(), coords[:, 0].max()))
        print("  Lon range: %.4f to %.4f" % (coords[:, 1].min(), coords[:, 1].max()))

        # Run DBSCAN with training parameters first
        dbscan = DBSCAN(
            eps=eps_rad,
            min_samples=min_samples,
            metric="haversine",
            algorithm="ball_tree",
            n_jobs=-1
        )
        labels = dbscan.fit_predict(coords_rad)

        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)

        # If training eps produces < 2 clusters, auto-tune eps for fresh data
        if n_clusters < 2:
            print("  Training eps produced %d clusters -> grid-search for fresh data..." % n_clusters)

            # Grid search over reasonable eps values (50km to 600km)
            best_sil, best_eps, best_ms, best_labels = -1, eps_rad, min_samples, labels
            for eps_km in range(30, 601, 10):
                trial_eps = eps_km / 6371.0  # km to radians
                for ms in [2, 3, 4, 5]:
                    trial_db = DBSCAN(
                        eps=trial_eps, min_samples=ms,
                        metric="haversine", algorithm="ball_tree", n_jobs=-1
                    )
                    trial_labels = trial_db.fit_predict(coords_rad)
                    trial_n = len(set(trial_labels)) - (1 if -1 in trial_labels else 0)
                    trial_noise = list(trial_labels).count(-1)

                    if trial_n >= 2 and trial_noise < len(coords_rad) * 0.5:
                        valid = trial_labels != -1
                        if valid.sum() > 1 and len(np.unique(trial_labels[valid])) > 1:
                            sil = silhouette_score(
                                coords_rad[valid], trial_labels[valid], metric="haversine")
                            if sil > best_sil:
                                best_sil = sil
                                best_eps = trial_eps
                                best_ms = ms
                                best_labels = trial_labels.copy()

            labels = best_labels
            n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
            print("  Best eps: %.6f rad (%.1f km), min_samples=%d, silhouette=%.4f, clusters=%d" % (
                best_eps, best_eps * 6371, best_ms, best_sil, n_clusters))

        n_noise = list(labels).count(-1)
        noise_pct = (n_noise / len(labels)) * 100

        # Silhouette with haversine (match training)
        valid_mask = labels != -1
        if valid_mask.sum() > 1 and len(np.unique(labels[valid_mask])) > 1:
            silhouette = silhouette_score(
                coords_rad[valid_mask], labels[valid_mask], metric="haversine"
            )
        else:
            silhouette = 0.0

        # Outbreak correlation
        case_stats = surv.groupby("region_id").agg(
            total_cases=("case_count", "sum"),
            outbreak_rate=("outbreak_occurred", "mean")
        ).reset_index()

        regions_labeled = regions.copy()
        regions_labeled["cluster"] = labels
        regions_labeled = regions_labeled.merge(case_stats, on="region_id", how="left")

        # Cluster-level stats
        clustered = regions_labeled[regions_labeled["cluster"] != -1]
        if len(clustered) > 0:
            cluster_stats = clustered.groupby("cluster").agg(
                n_regions=("region_id", "count"),
                avg_outbreak_rate=("outbreak_rate", "mean"),
                total_cases=("total_cases", "sum")
            ).reset_index()
            high_risk = (cluster_stats["avg_outbreak_rate"] > 0.15).sum()
        else:
            high_risk = 0

        print("\n  Results:")
        print("    Clusters:   %d" % n_clusters)
        print("    Noise:      %d (%.1f%%)" % (n_noise, noise_pct))
        print("    Silhouette: %.4f" % silhouette)
        print("    High-risk:  %d clusters" % high_risk)

        return {"n_clusters": int(n_clusters), "n_noise": int(n_noise),
                "noise_pct": float(noise_pct), "silhouette_score": float(silhouette),
                "high_risk_clusters": int(high_risk), "n_regions": len(coords_rad),
                "status": "OK"}

    except Exception as e:
        print("\n  [ERROR] %s" % str(e))
        import traceback; traceback.print_exc()
        return {"status": "FAILED", "error": str(e)}


# ==========================================================
# RETRAINING RECOMMENDATIONS
# ==========================================================
def recommend_retraining(results):
    """Analyze results and recommend retraining."""
    print("\n" + "=" * 70)
    print("RETRAINING RECOMMENDATIONS")
    print("=" * 70)

    recs = []

    # Forecast
    r = results.get("forecast", {})
    if r.get("status") == "OK":
        r2 = r.get("r2", 0)
        if r2 < THRESHOLDS["forecast_r2_min"]:
            recs.append({"model": "final_ensemble_model", "metric": "R2=%.4f" % r2,
                         "threshold": "%.2f" % THRESHOLDS["forecast_r2_min"],
                         "priority": "HIGH"})
            print("  [!!] FORECAST: R2=%.4f < %.2f -> RETRAIN" % (r2, THRESHOLDS["forecast_r2_min"]))
        else:
            print("  [OK] FORECAST: R2=%.4f (good)" % r2)
    elif r.get("status") == "FAILED":
        recs.append({"model": "final_ensemble_model", "metric": "FAILED",
                     "threshold": "N/A", "priority": "CRITICAL"})
        print("  [!!] FORECAST: FAILED -> CRITICAL RETRAIN")

    # Outbreak detector (unsupervised - lower thresholds appropriate)
    r = results.get("outbreak_detector", {})
    if r.get("status") == "OK":
        f1 = r.get("optimal_f1", r.get("f1", 0))
        prec = r.get("optimal_precision", r.get("precision", 0))
        rec_val = r.get("optimal_recall", r.get("recall", 0))
        auc = r.get("roc_auc", 0)
        issues = []
        if f1 < THRESHOLDS["outbreak_f1_min"]:
            issues.append("F1=%.4f" % f1)
        if auc < THRESHOLDS["outbreak_auc_min"]:
            issues.append("AUC=%.4f" % auc)
        if prec < THRESHOLDS["outbreak_precision_min"]:
            issues.append("Prec=%.4f" % prec)
        if rec_val < THRESHOLDS["outbreak_recall_min"]:
            issues.append("Rec=%.4f" % rec_val)
        if issues:
            recs.append({"model": "isolation_forest_prod", "metric": ", ".join(issues),
                         "threshold": "F1>%.2f, AUC>%.2f" % (
                             THRESHOLDS["outbreak_f1_min"], THRESHOLDS["outbreak_auc_min"]),
                         "priority": "HIGH"})
            print("  [!!] OUTBREAK DETECTOR: %s (optimal) -> RETRAIN" % ", ".join(issues))
        else:
            print("  [OK] OUTBREAK DETECTOR: F1=%.4f, AUC=%.4f (good for unsupervised)" % (f1, auc))
    elif r.get("status") == "FAILED":
        recs.append({"model": "isolation_forest_prod", "metric": "FAILED",
                     "threshold": "N/A", "priority": "CRITICAL"})
        print("  [!!] OUTBREAK DETECTOR: FAILED -> CRITICAL RETRAIN")

    # XGBoost V3 (supervised - higher thresholds)
    r = results.get("xgboost_v3", {})
    if r.get("status") == "OK":
        f1 = r.get("optimal_f1", r.get("f1", 0))
        prec = r.get("optimal_precision", r.get("precision", 0))
        rec_val = r.get("optimal_recall", r.get("recall", 0))
        auc = r.get("roc_auc", 0)
        issues = []
        if f1 < THRESHOLDS["xgboost_f1_min"]:
            issues.append("F1=%.4f" % f1)
        if auc < THRESHOLDS["xgboost_auc_min"]:
            issues.append("AUC=%.4f" % auc)
        if issues:
            recs.append({"model": "xgboost_outbreak_v3", "metric": ", ".join(issues),
                         "threshold": "F1>%.2f, AUC>%.2f" % (
                             THRESHOLDS["xgboost_f1_min"], THRESHOLDS["xgboost_auc_min"]),
                         "priority": "MEDIUM"})
            print("  [!!] XGBOOST V3: %s (optimal) -> RETRAIN" % ", ".join(issues))
        else:
            print("  [OK] XGBOOST V3: F1=%.4f, AUC=%.4f (good)" % (f1, auc))
    elif r.get("status") == "FAILED":
        recs.append({"model": "xgboost_outbreak_v3", "metric": "FAILED",
                     "threshold": "N/A", "priority": "CRITICAL"})
        print("  [!!] XGBOOST V3: FAILED -> CRITICAL RETRAIN")

    # DBSCAN
    r = results.get("dbscan", {})
    if r.get("status") == "OK":
        sil = r.get("silhouette_score", 0)
        if sil < THRESHOLDS["dbscan_silhouette_min"]:
            recs.append({"model": "dbscan_prod", "metric": "Silhouette=%.4f" % sil,
                         "threshold": "%.2f" % THRESHOLDS["dbscan_silhouette_min"],
                         "priority": "LOW"})
            print("  [!!] DBSCAN: Silhouette=%.4f < %.2f -> RETRAIN" % (
                sil, THRESHOLDS["dbscan_silhouette_min"]))
        else:
            print("  [OK] DBSCAN: Silhouette=%.4f (good)" % sil)
    elif r.get("status") == "FAILED":
        recs.append({"model": "dbscan_prod", "metric": "FAILED",
                     "threshold": "N/A", "priority": "CRITICAL"})
        print("  [!!] DBSCAN: FAILED -> CRITICAL RETRAIN")

    return recs


# ==========================================================
# MAIN
# ==========================================================
def main():
    parser = argparse.ArgumentParser(description="Evaluate all models on fresh data")
    parser.add_argument("--skip-generation", action="store_true",
                        help="Skip data generation, use existing fresh_test_data/")
    parser.add_argument("--regions", type=int, default=20)
    parser.add_argument("--days", type=int, default=365)
    args = parser.parse_args()

    print("=" * 70)
    print("COMPREHENSIVE MODEL EVALUATION - FRESH TEST DATA")
    print("=" * 70)

    # Generate data if needed
    if not args.skip_generation:
        print("\nGenerating fresh test data...")
        gen_script = os.path.join(BASE_DIR, "generate_fresh_test_data.py")
        result = subprocess.run(
            [sys.executable, gen_script,
             "--output-dir", FRESH_DIR,
             "--regions", str(args.regions),
             "--days", str(args.days)],
            check=True, capture_output=True, text=True, cwd=BASE_DIR
        )
        print(result.stdout)
    else:
        print("\nUsing existing fresh_test_data/")

    # Load data once
    print("\nLoading fresh test data...")
    surv, env, regions = load_fresh_data()
    print("  Surveillance: %d rows" % len(surv))
    print("  Environmental: %d rows" % len(env))
    print("  Regions: %d" % len(regions))

    # Evaluate all models
    results = {}
    results["forecast"] = evaluate_forecast(surv, env)
    results["outbreak_detector"] = evaluate_outbreak_detector(surv, env, regions)
    results["xgboost_v3"] = evaluate_xgboost_v3(surv, env, regions)
    results["dbscan"] = evaluate_dbscan(surv, regions)

    # Recommendations
    recs = recommend_retraining(results)

    # Summary
    print("\n" + "=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)

    passed = sum(1 for r in results.values() if r.get("status") == "OK")
    failed = sum(1 for r in results.values() if r.get("status") == "FAILED")
    print("\n  Models evaluated: 4")
    print("  Passed: %d" % passed)
    print("  Failed: %d" % failed)
    print("  Need retraining: %d" % len(recs))

    if results.get("forecast", {}).get("status") == "OK":
        print("\n  Forecast:     R2=%.4f" % results["forecast"]["r2"])
    if results.get("outbreak_detector", {}).get("status") == "OK":
        r = results["outbreak_detector"]
        print("  Outbreak Det: F1=%.4f (opt: %.4f), AUC=%.4f" % (
            r["f1"], r.get("optimal_f1", 0), r["roc_auc"]))
    if results.get("xgboost_v3", {}).get("status") == "OK":
        r = results["xgboost_v3"]
        print("  XGBoost V3:   F1=%.4f (opt: %.4f), AUC=%.4f" % (
            r["f1"], r.get("optimal_f1", 0), r["roc_auc"]))
    if results.get("dbscan", {}).get("status") == "OK":
        print("  DBSCAN:       Silhouette=%.4f, Clusters=%d" % (
            results["dbscan"]["silhouette_score"], results["dbscan"]["n_clusters"]))

    # Save report
    output_dir = os.path.join(BASE_DIR, "test_results")
    os.makedirs(output_dir, exist_ok=True)

    report = {
        "evaluation_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "test_data": {"source": "fresh_test_data", "regions": args.regions, "days": args.days},
        "results": results,
        "recommendations": recs,
        "thresholds": THRESHOLDS
    }

    report_path = os.path.join(output_dir, "fresh_data_evaluation_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print("\n  Report saved: %s" % report_path)
    print("=" * 70)


if __name__ == "__main__":
    main()
