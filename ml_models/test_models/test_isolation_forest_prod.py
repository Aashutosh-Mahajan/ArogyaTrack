#!/usr/bin/env python3
"""
Test Isolation Forest Anomaly Detector  (v4.0)
Matches feature engineering from train_isolation_forest_prod.py exactly.

Tests:
  - Anomaly score distribution
  - Threshold-based classification vs ground truth
  - Per-region and per-disease analysis
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import (
    classification_report, roc_auc_score, f1_score, precision_score,
    recall_score, confusion_matrix, precision_recall_curve, auc,
)
import warnings
warnings.filterwarnings("ignore")

BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR   = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
MODEL_DIR  = os.path.join(BASE_DIR, "saved_models", "isolation_forest_prod")
OUTPUT_DIR = os.path.join(BASE_DIR, "test_results", "isolation_forest")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("=" * 70)
print("ISOLATION FOREST ANOMALY DETECTOR TESTING  (v4.0)")
print("=" * 70)


# ==========================================================
# LOAD MODEL AND CONFIG
# ==========================================================

print("\nLoading model...")
iforest = joblib.load(os.path.join(MODEL_DIR, "isolation_forest.pkl"))

with open(os.path.join(MODEL_DIR, "features.json")) as f:
    FEATURE_COLS = json.load(f)   # plain list saved by training script

with open(os.path.join(MODEL_DIR, "metrics.json")) as f:
    train_metrics = json.load(f)
THRESHOLD    = train_metrics.get("threshold", 0.0)

print(f"  Feature count:  {len(FEATURE_COLS)}")
print(f"  Threshold:      {THRESHOLD:.4f}")
print(f"  Algorithm:      {train_metrics.get('algorithm', 'IsolationForest')}")

# Load scaler if exists
scaler = None
scaler_path = os.path.join(MODEL_DIR, "scaler.pkl")
if os.path.exists(scaler_path):
    scaler = joblib.load(scaler_path)
    print("  Scaler:         loaded")


# ==========================================================
# LOAD DATA + FEATURE ENGINEERING  (match training exactly)
# ==========================================================

print("\nLoading data...")
surv = pd.read_csv(os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
                    parse_dates=["date"])
env  = pd.read_csv(os.path.join(DATA_DIR, "environmental_data.csv"),
                    parse_dates=["date"])
regions = pd.read_csv(os.path.join(DATA_DIR, "regions.csv"))

has_labels = "outbreak_occurred" in surv.columns

df = surv.merge(regions[["region_id", "state"]], on="region_id", how="left")
df = df.merge(env, on=["region_id", "date"], how="left", suffixes=("", "_env"))

# Resolve suffix duplicates
for col in list(df.columns):
    if col.endswith("_env"):
        base = col.rsplit("_", 1)[0]
        if base in df.columns:
            df[base] = df[base].fillna(df[col])
            df.drop(columns=[col], inplace=True)

df = df.sort_values(["region_id", "date"]).reset_index(drop=True)

print(f"  Total rows: {len(df):,}")
if has_labels:
    print(f"  Outbreak rate: {df['outbreak_occurred'].mean():.2%}")

# ---------- rolling features (match training: groupby region_id) ----------
grp = df.groupby("region_id")

for w in [7, 14, 28]:
    df[f"cases_rm_{w}"]   = grp["case_count"].transform(
        lambda x: x.rolling(w, 1).mean()).fillna(0)
    df[f"cases_rstd_{w}"] = grp["case_count"].transform(
        lambda x: x.rolling(w, 1).std()).fillna(0)
    df[f"cases_rmax_{w}"] = grp["case_count"].transform(
        lambda x: x.rolling(w, 1).max()).fillna(0)

# Growth rates (pct_change, clipped - match training exactly)
for p in [7, 14, 21]:
    df[f"growth_{p}"] = grp["case_count"].pct_change(periods=p).fillna(0)
    df[f"growth_{p}"] = df[f"growth_{p}"].replace([np.inf, -np.inf], 0).clip(-5, 5)

# Acceleration (second derivative of case_count)
df["accel_7"] = grp["case_count"].diff().diff().fillna(0)

# Deviation z-scores (divide by rstd + 1, match training)
df["dev_7"]  = (df["case_count"] - df["cases_rm_7"])  / (df["cases_rstd_7"]  + 1)
df["dev_14"] = (df["case_count"] - df["cases_rm_14"]) / (df["cases_rstd_14"] + 1)
df["dev_28"] = (df["case_count"] - df["cases_rm_28"]) / (df["cases_rstd_28"] + 1)

# Spike flags (based on dev_7, match training)
df["spike_2std"] = (df["dev_7"] > 2).astype(int)
df["spike_3std"] = (df["dev_7"] > 3).astype(int)

# Lag features
for lag in [7, 14, 21]:
    df[f"cases_lag_{lag}"] = grp["case_count"].shift(lag).fillna(0)

# environmental risk
# Environmental risk (match training: fixed thresholds)
env_parts = []
if "temperature_celsius" in df.columns:
    env_parts.append((df["temperature_celsius"] > 30).astype(int))
if "rainfall_mm" in df.columns:
    env_parts.append((df["rainfall_mm"] > 50).astype(int))
if "aqi" in df.columns:
    env_parts.append((df["aqi"] > 150).astype(int))
df["env_risk"] = sum(env_parts) if env_parts else 0

df = df.fillna(0).replace([np.inf, -np.inf], 0)

# Use only the features the model was trained with
available = [c for c in FEATURE_COLS if c in df.columns]
missing   = [c for c in FEATURE_COLS if c not in df.columns]
if missing:
    print(f"  Warning: Missing features (zero-filled): {missing}")
    for c in missing:
        df[c] = 0

X = df[FEATURE_COLS].values.astype(np.float32)

# ---------- Apply scaler ----------
if scaler is not None:
    X = scaler.transform(X)

print(f"  Feature matrix: {X.shape}")

# ==========================================================
# ANOMALY SCORING
# ==========================================================

print("\nComputing anomaly scores...")
raw_scores = iforest.decision_function(X)         # higher = more normal
anomaly_pred = (raw_scores <= THRESHOLD).astype(int)  # 1 = anomaly (match training)

df["anomaly_score"]  = raw_scores
df["anomaly_pred"]   = anomaly_pred

print(f"  Score range:   [{raw_scores.min():.4f}, {raw_scores.max():.4f}]")
print(f"  Threshold:      {THRESHOLD:.4f}")
print(f"  Flagged %:      {anomaly_pred.mean():.2%}")

# ==========================================================
# EVALUATION AGAINST LABELS (if available)
# ==========================================================

if has_labels:
    y_true = df["outbreak_occurred"].values
    y_pred = anomaly_pred

    print("\n" + "=" * 70)
    print("CLASSIFICATION RESULTS  vs ground truth")
    print("=" * 70)

    roc  = roc_auc_score(y_true, -raw_scores)  # negate: lower score = anomaly
    f1   = f1_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec  = recall_score(y_true, y_pred, zero_division=0)

    precision_curve, recall_curve, _ = precision_recall_curve(y_true, -raw_scores)
    pr_auc = auc(recall_curve, precision_curve)

    print(f"\n  ROC AUC:    {roc:.4f}")
    print(f"  PR AUC:     {pr_auc:.4f}")
    print(f"  F1:         {f1:.4f}")
    print(f"  Precision:  {prec:.4f}")
    print(f"  Recall:     {rec:.4f}")

    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    print(f"\n  TP: {tp:,}  FP: {fp:,}  FN: {fn:,}  TN: {tn:,}")

    report = classification_report(y_true, y_pred, target_names=["Normal", "Anomaly"],
                                   output_dict=True)

    # ---------- per-disease ----------
    print("\n  Per-disease F1:")
    disease_results = {}
    for d, g in df.groupby("disease_name"):
        d_f1 = f1_score(g["outbreak_occurred"], g["anomaly_pred"], zero_division=0)
        disease_results[d] = round(d_f1, 4)
        print(f"    {d:25s}  F1={d_f1:.4f}")

    # ---------- save results ----------
    test_results = {
        "test_size": len(df),
        "anomaly_rate_predicted": float(anomaly_pred.mean()),
        "anomaly_rate_actual": float(y_true.mean()),
        "roc_auc": float(roc),
        "pr_auc": float(pr_auc),
        "f1": float(f1),
        "precision": float(prec),
        "recall": float(rec),
        "confusion_matrix": {"TP": int(tp), "FP": int(fp), "FN": int(fn), "TN": int(tn)},
        "per_disease_f1": disease_results,
        "classification_report": report,
    }

    with open(os.path.join(OUTPUT_DIR, "test_metrics.json"), "w") as f:
        json.dump(test_results, f, indent=2)

    # ---------- plots ----------
    print("\nGenerating plots...")

    # 1. Score distribution
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.hist(raw_scores[y_true == 0], bins=100, alpha=0.6, label="Normal", density=True)
    ax.hist(raw_scores[y_true == 1], bins=100, alpha=0.6, label="Outbreak", density=True)
    ax.axvline(THRESHOLD, color="red", linestyle="--", label=f"Threshold={THRESHOLD:.3f}")
    ax.set_xlabel("Anomaly Score (decision_function)")
    ax.set_ylabel("Density")
    ax.set_title("Anomaly Score Distribution by Label")
    ax.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, "score_distribution.png"), dpi=150)
    plt.close()

    # 2. Per-disease F1 bar chart
    fig, ax = plt.subplots(figsize=(10, 5))
    diseases = list(disease_results.keys())
    f1s      = [disease_results[d] for d in diseases]
    ax.barh(diseases, f1s, color="steelblue")
    ax.set_xlabel("F1 Score")
    ax.set_title("Isolation Forest: Per-Disease F1")
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, "per_disease_f1.png"), dpi=150)
    plt.close()

else:
    print("\n  No outbreak_labels.csv found; skipping supervised evaluation.")
    test_results = {
        "test_size": len(df),
        "anomaly_rate_predicted": float(anomaly_pred.mean()),
        "score_range": [float(raw_scores.min()), float(raw_scores.max())],
    }
    with open(os.path.join(OUTPUT_DIR, "test_metrics.json"), "w") as f:
        json.dump(test_results, f, indent=2)

print(f"\nResults saved to {OUTPUT_DIR}")
print("\n" + "=" * 70)
print("TESTING COMPLETE")
print("=" * 70)
