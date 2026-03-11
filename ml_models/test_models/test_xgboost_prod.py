#!/usr/bin/env python3
"""
Test XGBoost Outbreak V3 Model  (v3.0)
Matches feature engineering from train_xgboost_prod.py exactly.
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.metrics import (
    roc_auc_score, classification_report, f1_score,
    precision_score, recall_score, confusion_matrix
)
import warnings
warnings.filterwarnings("ignore")

BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR   = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
MODEL_DIR  = os.path.join(BASE_DIR, "saved_models", "xgboost_outbreak_v3")
OUTPUT_DIR = os.path.join(BASE_DIR, "test_results", "xgboost_outbreak_v3")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("=" * 70)
print("XGBOOST OUTBREAK V3 MODEL TESTING  (v3.0)")
print("=" * 70)

# ==========================================================
# LOAD MODEL ARTIFACTS
# ==========================================================

print("\nLoading model...")
model  = joblib.load(os.path.join(MODEL_DIR, "xgboost_model.pkl"))
scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))

with open(os.path.join(MODEL_DIR, "features.json")) as f:
    FEATURES = json.load(f)

with open(os.path.join(MODEL_DIR, "metrics.json")) as f:
    metrics = json.load(f)
    opt_threshold = metrics.get("optimal_threshold", 0.5)

print(f"Loaded model with {len(FEATURES)} features")
print(f"Optimal threshold: {opt_threshold:.4f}")

# ==========================================================
# LOAD DATA
# ==========================================================

print("\nLoading data...")
cases = pd.read_csv(
    os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
    parse_dates=["date"],
)
regions = pd.read_csv(
    os.path.join(DATA_DIR, "regions.csv"),
    usecols=["region_id", "population", "sanitation_index"],
)
env = pd.read_csv(
    os.path.join(DATA_DIR, "environmental_data.csv"),
    parse_dates=["date"],
)

print(f"Loaded {len(cases)} surveillance records")

# ==========================================================
# MERGE  (match train_xgboost_prod.py)
# ==========================================================

df = cases.merge(regions, on="region_id", how="left")

env_merge_cols = ["date", "region_id",
                  "temperature_celsius", "humidity_percent",
                  "rainfall_mm", "aqi", "water_quality_index"]
env_merge_cols = [c for c in env_merge_cols if c in env.columns]
df = df.merge(env[env_merge_cols], on=["region_id", "date"], how="left")
df = df.fillna(0)

# ==========================================================
# FEATURE ENGINEERING  (IDENTICAL to train_xgboost_prod.py)
# ==========================================================

print("\nEngineering features...")

df = df.sort_values(["region_id", "date"]).reset_index(drop=True)
grp = df.groupby("region_id")

# Rolling statistics
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

# Spike indicators
df["is_spike_2std"] = (df["deviation_7"] > 2).astype(int)
df["is_spike_3std"] = (df["deviation_7"] > 3).astype(int)

# Severity rolling
if "severity_avg" in df.columns:
    df["severity_rm_7"] = grp["severity_avg"].transform(lambda x: x.rolling(7, 1).mean())

# Lag features
for lag in [7, 14, 21]:
    df[f"cases_lag_{lag}"] = grp["case_count"].shift(lag).fillna(0)

# Cases per capita
df["cases_per_100k"] = df["cases_rm_7"] / (df["population"] / 100_000 + 1)

# Environmental risk composite
env_risk_parts = []
if "temperature_celsius" in df.columns:
    env_risk_parts.append((df["temperature_celsius"] > 30).astype(int))
if "rainfall_mm" in df.columns:
    env_risk_parts.append((df["rainfall_mm"] > 50).astype(int))
if "aqi" in df.columns:
    env_risk_parts.append((df["aqi"] > 150).astype(int))
df["env_risk"] = sum(env_risk_parts) if env_risk_parts else 0

df = df.replace([np.inf, -np.inf], 0).fillna(0)

# ==========================================================
# TEMPORAL SPLIT  (last 20% = test)
# ==========================================================

df = df.sort_values("date")
split_date = df["date"].quantile(0.80)
df_test = df[df["date"] > split_date].copy()

# Ensure all features exist
for f in FEATURES:
    if f not in df_test.columns:
        df_test[f] = 0

X_test = df_test[FEATURES].astype(float).fillna(0)
y_test = df_test["outbreak_occurred"].astype(int)

print(f"\nFinal dataset: {len(df)} records")
print(f"Testing on {len(df_test)} records (last 20%)")
print(f"Test set outbreak rate: {y_test.mean():.2%}")

# ==========================================================
# PREDICT
# ==========================================================

print("\nMaking predictions...")
X_test_scaled = scaler.transform(X_test)
pred_probs = model.predict_proba(X_test_scaled)[:, 1]
preds = (pred_probs >= opt_threshold).astype(int)

# ==========================================================
# METRICS
# ==========================================================

print("\n" + "=" * 70)
print("TEST RESULTS")
print("=" * 70)

auc = roc_auc_score(y_test, pred_probs) if len(np.unique(y_test)) > 1 else 0.0
f1  = f1_score(y_test, preds, zero_division=0)
precision = precision_score(y_test, preds, zero_division=0)
recall    = recall_score(y_test, preds, zero_division=0)

print(f"\nROC-AUC Score: {auc:.4f}")
print(f"F1 Score: {f1:.4f}")
print(f"Precision: {precision:.4f}")
print(f"Recall: {recall:.4f}")

print("\nClassification Report:")
print(classification_report(y_test, preds, zero_division=0))

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, preds))

# Save results
test_results = {
    "test_size": len(df_test),
    "outbreak_rate": float(y_test.mean()),
    "roc_auc": float(auc),
    "f1_score": float(f1),
    "precision": float(precision),
    "recall": float(recall),
    "optimal_threshold": float(opt_threshold),
}

with open(os.path.join(OUTPUT_DIR, "test_metrics.json"), "w") as f:
    json.dump(test_results, f, indent=2)

print(f"\nTest results saved to {OUTPUT_DIR}")
print("\n" + "=" * 70)
print("TESTING COMPLETE")
print("=" * 70)
