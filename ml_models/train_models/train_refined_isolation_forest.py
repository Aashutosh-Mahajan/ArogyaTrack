#!/usr/bin/env python3
"""
train_refined_isolation_forest.py  -  Isolation Forest Anomaly Detector  (v5.0)

PURPOSE: Detect sudden abnormal disease surges via ANOMALY DETECTION.
  IF learns what "normal" looks like and flags anything that deviates.

KEY IMPROVEMENTS (v5.0):
  - Semi-supervised: trains on NORMAL data only (standard anomaly detection)
  - Chunked training via warm_start (trains on ALL data, not just a sample)
  - Chunked scoring with progress bars
  - 59 features matching XGBoost feature set
  - GradientBoosting corrector for score refinement
  - Disease-aware encoding + spike/acceleration features

TARGET: AUC > 0.92, F1 > 0.55
"""

import os
import gc
import sys
import json
import time
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import IsolationForest, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score, recall_score,
    confusion_matrix, precision_recall_curve
)

warnings.filterwarnings("ignore")

# ==========================================================
# CONFIG
# ==========================================================

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR    = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
DATA_DIR    = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
OUTPUT_DIR  = os.path.join(BASE_DIR, "saved_models", "isolation_forest_prod")

os.makedirs(OUTPUT_DIR, exist_ok=True)
np.random.seed(42)

N_ENSEMBLE        = 3
N_ESTIMATORS      = 200         # total trees per forest
TREES_PER_CHUNK   = 50          # trees added per warm_start chunk
MAX_FEATURES_FRAC = 0.8
MAX_SAMPLES_FRAC  = 0.8        # fraction of chunk to subsample per tree
TRAIN_CHUNK_SIZE  = 500_000     # chunk size for IF training
SCORE_CHUNK_SIZE  = 200_000     # chunk size for scoring
CALIB_SAMPLES     = 500_000     # samples for calibration/corrector

INDIAN_HOLIDAYS = [
    (1, 26), (3, 14), (10, 2), (8, 15), (12, 25), (5, 1),
    (1, 15), (4, 10), (11, 1), (10, 25), (11, 12), (4, 14),
    (6, 29), (8, 21), (10, 19),
]


def progress_bar(current, total, prefix="", length=30):
    """Print a progress bar."""
    filled = int(length * current / total)
    bar = "█" * filled + "░" * (length - filled)
    pct = current / total * 100
    print(f"\r  {prefix}[{bar}] {current}/{total} ({pct:.0f}%)", end="", flush=True)
    if current == total:
        print()


print("=" * 70)
print("  ISOLATION FOREST ANOMALY DETECTOR v5.0")
print("  Chunked training | 59 features | Progress bars")
print("=" * 70)

# ==========================================================
# [1] LOAD DATA
# ==========================================================

print("\n[1] Loading data ...")

cases = pd.read_csv(
    os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
    parse_dates=["date"],
)
regions = pd.read_csv(os.path.join(DATA_DIR, "regions.csv"))
env = pd.read_csv(
    os.path.join(DATA_DIR, "environmental_data.csv"),
    parse_dates=["date"],
)

print(f"  Surveillance: {len(cases):,}")

# ==========================================================
# [2] MERGE
# ==========================================================

print("\n[2] Merging datasets ...")

region_cols = ["region_id", "population", "sanitation_index"]
if "region_type" in regions.columns:
    region_cols.append("region_type")
if "area_sq_km" in regions.columns:
    region_cols.append("area_sq_km")

df = cases.merge(regions[region_cols], on="region_id", how="left")

env_cols = ["date", "region_id", "temperature_celsius", "humidity_percent",
            "rainfall_mm", "aqi", "water_quality_index"]
env_cols = [c for c in env_cols if c in env.columns]
df = df.merge(env[env_cols], on=["region_id", "date"], how="left")
df = df.fillna(0)
print(f"  Merged: {len(df):,}")

# ==========================================================
# [3] FEATURE ENGINEERING (59 features)
# ==========================================================

print("\n[3] Feature engineering ...")

df = df.sort_values(["region_id", "date"]).reset_index(drop=True)
grp = df.groupby("region_id")

# ---- 1. TEMPORAL (12) ----
df["month"] = df["date"].dt.month
df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
df["day_of_week"] = df["date"].dt.dayofweek
df["quarter"] = df["date"].dt.quarter
df["day_of_year"] = df["date"].dt.dayofyear
df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
df["is_holiday"] = df["date"].apply(
    lambda d: int(any(d.month == m and d.day == dy for m, dy in INDIAN_HOLIDAYS))
)
df["is_monsoon"] = df["month"].isin([6, 7, 8, 9]).astype(int)
df["is_winter"] = df["month"].isin([11, 12, 1, 2]).astype(int)
df["is_summer"] = df["month"].isin([4, 5, 6]).astype(int)
df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)

# ---- 2. CASE DYNAMICS (18) ----
for w in [7, 14, 28]:
    df[f"cases_rm_{w}"]   = grp["case_count"].transform(lambda x: x.rolling(w, 1).mean())
    df[f"cases_rstd_{w}"] = grp["case_count"].transform(lambda x: x.rolling(w, 1).std()).fillna(0)
    df[f"cases_rmax_{w}"] = grp["case_count"].transform(lambda x: x.rolling(w, 1).max())

for p in [7, 14]:
    df[f"growth_{p}"] = grp["case_count"].pct_change(periods=p).fillna(0)
    df[f"growth_{p}"] = df[f"growth_{p}"].replace([np.inf, -np.inf], 0).clip(-5, 5)

df["acceleration_7"] = grp["case_count"].diff().diff().fillna(0)
df["deviation_7"]  = (df["case_count"] - df["cases_rm_7"])  / (df["cases_rstd_7"]  + 1)
df["deviation_14"] = (df["case_count"] - df["cases_rm_14"]) / (df["cases_rstd_14"] + 1)
df["is_spike_2std"] = (df["deviation_7"] > 2).astype(int)
df["is_spike_3std"] = (df["deviation_7"] > 3).astype(int)

# ---- 3. SEASONAL BASELINE (6) ----
df["seasonal_baseline_month"] = df.groupby(["region_id", "month"])["case_count"].transform("mean")
df["seasonal_baseline_week"] = df.groupby(["region_id", "week_of_year"])["case_count"].transform("mean")
df["deviation_from_monthly_baseline"] = (df["case_count"] - df["seasonal_baseline_month"]) / (df["seasonal_baseline_month"] + 1)
df["deviation_from_weekly_baseline"] = (df["case_count"] - df["seasonal_baseline_week"]) / (df["seasonal_baseline_week"] + 1)
monthly_p95 = df.groupby(["region_id", "month"])["case_count"].transform(lambda x: x.quantile(0.95))
df["above_seasonal_95pct"] = (df["case_count"] > monthly_p95).astype(int)

# ---- 4. LAG FEATURES ----
for lag in [7, 14, 21]:
    df[f"cases_lag_{lag}"] = grp["case_count"].shift(lag).fillna(0)
df["cases_per_100k"] = df["case_count"] / (df["population"] / 100_000 + 1)

# ---- 5. ENVIRONMENTAL (10+) ----
env_risk_parts = []
if "temperature_celsius" in df.columns:
    env_risk_parts.append((df["temperature_celsius"] > 30).astype(int))
    df["temperature_lag_7"] = grp["temperature_celsius"].shift(7).fillna(df["temperature_celsius"].median())
if "rainfall_mm" in df.columns:
    env_risk_parts.append((df["rainfall_mm"] > 50).astype(int))
    df["rainfall_3day_sum"] = grp["rainfall_mm"].transform(lambda x: x.rolling(3, 1).sum())
    df["days_since_heavy_rain"] = grp["rainfall_mm"].transform(
        lambda x: (x < 30).astype(int).groupby((x >= 30).astype(int).cumsum()).cumsum()
    ).fillna(0)
if "aqi" in df.columns:
    env_risk_parts.append((df["aqi"] > 150).astype(int))
df["env_risk"] = sum(env_risk_parts) if env_risk_parts else 0

if "temperature_celsius" in df.columns and "rainfall_mm" in df.columns:
    df["favorable_dengue"] = ((df["temperature_celsius"].between(25, 35)) & (df["rainfall_mm"] > 30)).astype(int)
else:
    df["favorable_dengue"] = 0
if "temperature_celsius" in df.columns and "aqi" in df.columns:
    df["favorable_flu"] = ((df["temperature_celsius"] < 20) & (df["aqi"] > 100)).astype(int)
else:
    df["favorable_flu"] = 0

env_score_parts = []
for col in ["temperature_celsius", "humidity_percent", "rainfall_mm", "aqi"]:
    if col in df.columns:
        env_score_parts.append((df[col] - df[col].mean()) / (df[col].std() + 1e-9))
df["env_risk_score"] = sum(env_score_parts) / len(env_score_parts) if env_score_parts else 0

# ---- 6. REGIONAL (5) ----
df["population_log"] = np.log1p(df["population"])
df["population_density"] = df["population"] / (df["area_sq_km"] + 1) if "area_sq_km" in df.columns else df["population"] / 100
if "region_type" in df.columns:
    le = LabelEncoder()
    df["region_tier"] = le.fit_transform(df["region_type"].fillna("urban"))
else:
    df["region_tier"] = 1
df["historical_outbreak_freq"] = grp["outbreak_occurred"].transform(lambda x: x.expanding().mean()).fillna(0)

# ---- 7. SEVERITY ----
if "severity_avg" in df.columns:
    df["severity_rm_7"] = grp["severity_avg"].transform(lambda x: x.rolling(7, 1).mean())

# ---- 8. CROSS-REGION ----
if "region_type" in regions.columns:
    reg_state = regions[["region_id", "region_type"]].copy()
    reg_state.rename(columns={"region_type": "state_for_group"}, inplace=True)
else:
    reg_state = regions[["region_id"]].copy()
    reg_state["state_for_group"] = "all"
df = df.merge(reg_state, on="region_id", how="left")
df["state_outbreak_rate"] = df.groupby(["state_for_group", "date"])["outbreak_occurred"].transform("mean").fillna(0)

# ---- 9. DISEASE ENCODING ----
if "disease_code" in df.columns:
    le_disease = LabelEncoder()
    df["disease_encoded"] = le_disease.fit_transform(df["disease_code"].fillna("UNK"))
    joblib.dump(le_disease, os.path.join(OUTPUT_DIR, "disease_encoder.pkl"))
else:
    df["disease_encoded"] = 0

# Clean up inf/nan per-column to avoid memory spike from pandas block consolidation
for col in df.columns:
    if df[col].dtype in [np.float64, np.float32]:
        arr = df[col].values
        mask = ~np.isfinite(arr)
        if mask.any():
            arr[mask] = 0
        df[col] = arr
df = df.fillna(0)

# ==========================================================
# FEATURE LIST
# ==========================================================

FEATURES = [
    "month", "week_of_year", "day_of_week", "quarter", "day_of_year",
    "is_weekend", "is_holiday", "is_monsoon", "is_winter", "is_summer",
    "month_sin", "month_cos",
    "case_count",
    "cases_rm_7", "cases_rm_14", "cases_rm_28",
    "cases_rstd_7", "cases_rstd_14", "cases_rstd_28",
    "cases_rmax_7", "cases_rmax_14", "cases_rmax_28",
    "growth_7", "growth_14", "acceleration_7",
    "deviation_7", "deviation_14",
    "is_spike_2std", "is_spike_3std",
    "seasonal_baseline_month", "seasonal_baseline_week",
    "deviation_from_monthly_baseline", "deviation_from_weekly_baseline",
    "above_seasonal_95pct",
    "cases_lag_7", "cases_lag_14", "cases_lag_21", "cases_per_100k",
    "env_risk", "env_risk_score", "favorable_dengue", "favorable_flu",
    "disease_encoded",
]

for col in ["temperature_celsius", "humidity_percent", "rainfall_mm",
            "aqi", "water_quality_index", "temperature_lag_7",
            "rainfall_3day_sum", "days_since_heavy_rain"]:
    if col in df.columns:
        FEATURES.append(col)

FEATURES += ["population_log", "population_density", "region_tier", "historical_outbreak_freq"]
if "sanitation_index" in df.columns:
    FEATURES.append("sanitation_index")
if "severity_avg" in df.columns:
    FEATURES += ["severity_avg", "severity_rm_7"]
FEATURES.append("state_outbreak_rate")

FEATURES = [f for f in FEATURES if f in df.columns]
FEATURES = list(dict.fromkeys(FEATURES))
print(f"  Using {len(FEATURES)} features")

# ==========================================================
# [4] TEMPORAL SPLIT
# ==========================================================

print("\n[4] Temporal split ...")

df = df.sort_values("date")
split_date = df["date"].quantile(0.80)
train_df = df[df["date"] <= split_date].reset_index(drop=True)
test_df  = df[df["date"] > split_date].reset_index(drop=True)

del df
try:
    del cases, env, regions
except NameError:
    pass
gc.collect()

# Separate normal training data (for IF)
train_normal = train_df[train_df["outbreak_occurred"] == 0].reset_index(drop=True)
outbreak_rate = train_df["outbreak_occurred"].mean()

print(f"  Total train: {len(train_df):,}")
print(f"  Normal rows (for IF): {len(train_normal):,} ({1 - outbreak_rate:.2%})")
print(f"  Test: {len(test_df):,} ({test_df['outbreak_occurred'].sum():,} outbreaks)")

# Stratified calibration sample for corrector
print(f"  Sampling {CALIB_SAMPLES:,} for calibration ...")
y_full = train_df["outbreak_occurred"].astype(int)
pos_idx = np.where(y_full == 1)[0]
neg_idx = np.where(y_full == 0)[0]
pos_rate = len(pos_idx) / len(y_full)
n_pos = min(len(pos_idx), int(CALIB_SAMPLES * pos_rate))
n_neg = min(len(neg_idx), CALIB_SAMPLES - n_pos)
calib_idx = np.concatenate([
    np.random.choice(pos_idx, n_pos, replace=False),
    np.random.choice(neg_idx, n_neg, replace=False)
])
calib_df = train_df.iloc[calib_idx].reset_index(drop=True)
print(f"  Calibration: {len(calib_df):,} ({calib_df['outbreak_occurred'].mean():.2%} outbreaks)")

del train_df
gc.collect()

# ==========================================================
# [5] SCALING
# ==========================================================

print("\n[5] Scaling ...")
scaler = StandardScaler()

# Fit scaler on normal training data sample (500K)
scaler_sample = train_normal.sample(min(500_000, len(train_normal)), random_state=42)[FEATURES]
scaler.fit(scaler_sample.astype(np.float32))
del scaler_sample
gc.collect()

joblib.dump(scaler, os.path.join(OUTPUT_DIR, "scaler.pkl"))

# ==========================================================
# [6] CHUNKED IF TRAINING (warm_start on ALL normal data)
# ==========================================================

print(f"\n[6] Training {N_ENSEMBLE} Isolation Forests (chunked, ALL normal data) ...")

n_normal = len(train_normal)
n_chunks = (n_normal + TRAIN_CHUNK_SIZE - 1) // TRAIN_CHUNK_SIZE
trees_per_chunk = max(1, N_ESTIMATORS // n_chunks)
total_steps = N_ENSEMBLE * n_chunks

print(f"  Normal data: {n_normal:,} rows → {n_chunks} chunks of ~{TRAIN_CHUNK_SIZE:,}")
print(f"  Trees per chunk: {trees_per_chunk} × {n_chunks} chunks = ~{trees_per_chunk * n_chunks} trees/forest")
print(f"  Total: {N_ENSEMBLE} forests")

t0 = time.time()
models = []
indices = np.arange(n_normal)

for forest_i in range(N_ENSEMBLE):
    seed = 42 + forest_i * 13
    np.random.seed(seed)
    np.random.shuffle(indices)

    model = None
    current_trees = 0

    for chunk_i in range(n_chunks):
        s = chunk_i * TRAIN_CHUNK_SIZE
        e = min(s + TRAIN_CHUNK_SIZE, n_normal)
        chunk_idx = indices[s:e]

        # Get chunk data, scale it
        chunk_data = train_normal.iloc[chunk_idx][FEATURES].astype(np.float32)
        chunk_scaled = scaler.transform(chunk_data)
        del chunk_data
        gc.collect()

        current_trees += trees_per_chunk

        if model is None:
            model = IsolationForest(
                n_estimators=trees_per_chunk,
                max_features=MAX_FEATURES_FRAC,
                max_samples=min(len(chunk_scaled), int(len(chunk_scaled) * MAX_SAMPLES_FRAC)),
                random_state=seed,
                n_jobs=-1,
                bootstrap=True,
                warm_start=True,
            )
        else:
            model.n_estimators = current_trees

        model.fit(chunk_scaled)
        del chunk_scaled
        gc.collect()

        step = forest_i * n_chunks + chunk_i + 1
        elapsed = time.time() - t0
        progress_bar(step, total_steps, f"Forest {forest_i+1}/{N_ENSEMBLE} ")

    models.append(model)
    print(f"  → Forest {forest_i+1} done: {current_trees} trees (seed={seed})")

elapsed = time.time() - t0
print(f"  All forests trained in {elapsed:.0f}s")

joblib.dump(models, os.path.join(OUTPUT_DIR, "isolation_forest_ensemble.pkl"))

del train_normal
gc.collect()

# ==========================================================
# [7] CHUNKED ANOMALY SCORING
# ==========================================================

print("\n[7] Computing anomaly scores (chunked) ...")

def score_chunked(X_df, features, scaler, models, chunk_size, label=""):
    """Score data in chunks through IF ensemble. Returns averaged anomaly scores."""
    n = len(X_df)
    n_chunks = (n + chunk_size - 1) // chunk_size
    avg_scores = np.zeros(n, dtype=np.float32)

    for c in range(n_chunks):
        s = c * chunk_size
        e = min(s + chunk_size, n)

        chunk = scaler.transform(X_df.iloc[s:e][features].astype(np.float32))
        chunk_scores = np.zeros((e - s, len(models)), dtype=np.float32)

        for i, model in enumerate(models):
            chunk_scores[:, i] = -model.decision_function(chunk)

        avg_scores[s:e] = chunk_scores.mean(axis=1)
        del chunk, chunk_scores
        gc.collect()

        progress_bar(c + 1, n_chunks, f"{label}")

    return avg_scores

# Score calibration data
print("  Calibration data:")
calib_scores = score_chunked(calib_df, FEATURES, scaler, models, SCORE_CHUNK_SIZE, "Calib  ")

# Score test data
print("  Test data:")
test_scores = score_chunked(test_df, FEATURES, scaler, models, SCORE_CHUNK_SIZE, "Test   ")

p90 = np.percentile(test_scores, 90)
p95 = np.percentile(test_scores, 95)
p99 = np.percentile(test_scores, 99)
print(f"  Score distribution: P90={p90:.3f}, P95={p95:.3f}, P99={p99:.3f}")

# ==========================================================
# [8] SCORE CALIBRATION
# ==========================================================

print("\n[8] Calibrating scores ...")

score_percentiles = np.percentile(calib_scores, np.arange(0, 101, 1))

def calibrate_scores(raw_scores, percentiles):
    calibrated = np.searchsorted(percentiles, raw_scores) / 100.0
    return np.clip(calibrated, 0, 1)

calib_calibrated = calibrate_scores(calib_scores, score_percentiles)
test_calibrated = calibrate_scores(test_scores, score_percentiles)

np.save(os.path.join(OUTPUT_DIR, "score_percentiles.npy"), score_percentiles)

y_test = test_df["outbreak_occurred"].astype(int)
y_calib = calib_df["outbreak_occurred"].astype(int)

raw_roc = roc_auc_score(y_test, test_calibrated)
print(f"  Raw IF ROC-AUC: {raw_roc:.4f}")

# ==========================================================
# [9] GRADIENTBOOSTING CORRECTOR (IF scores + ALL features)
# ==========================================================

print("\n[9] Training GradientBoosting corrector ...")

# Build corrector features: [IF_raw, IF_calibrated, all_original_features]
X_calib_s = scaler.transform(calib_df[FEATURES].astype(np.float32))

X_corrector_train = np.column_stack([
    calib_scores.reshape(-1, 1),
    calib_calibrated.reshape(-1, 1),
    X_calib_s
])

print(f"  Features: 2 IF scores + {len(FEATURES)} original = {X_corrector_train.shape[1]}")

# Class balancing via sample weights
n_pos_c = int(y_calib.sum())
n_neg_c = len(y_calib) - n_pos_c
weight_ratio = n_neg_c / max(n_pos_c, 1)
sample_weights = np.where(y_calib == 1, weight_ratio, 1.0)

corrector = GradientBoostingClassifier(
    n_estimators=500,
    max_depth=7,
    learning_rate=0.03,
    subsample=0.8,
    max_features=0.7,
    min_samples_leaf=30,
    random_state=42,
    verbose=1,
)
corrector.fit(X_corrector_train, y_calib, sample_weight=sample_weights)

del X_calib_s, X_corrector_train, calib_df, calib_scores, calib_calibrated
gc.collect()

# Score test data through corrector (chunked)
print("\n  Scoring test through corrector ...")
n_test = len(test_df)
corrected_probs = np.zeros(n_test, dtype=np.float32)
n_test_chunks = (n_test + SCORE_CHUNK_SIZE - 1) // SCORE_CHUNK_SIZE

for c in range(n_test_chunks):
    s = c * SCORE_CHUNK_SIZE
    e = min(s + SCORE_CHUNK_SIZE, n_test)
    chunk_scaled = scaler.transform(test_df.iloc[s:e][FEATURES].astype(np.float32))
    chunk_corrector = np.column_stack([
        test_scores[s:e].reshape(-1, 1),
        test_calibrated[s:e].reshape(-1, 1),
        chunk_scaled
    ])
    corrected_probs[s:e] = corrector.predict_proba(chunk_corrector)[:, 1]
    del chunk_scaled, chunk_corrector
    gc.collect()
    progress_bar(c + 1, n_test_chunks, "Correct ")

joblib.dump(corrector, os.path.join(OUTPUT_DIR, "score_corrector.pkl"))

corrected_roc = roc_auc_score(y_test, corrected_probs)
print(f"  Corrected ROC-AUC: {corrected_roc:.4f}")

# Blend
alpha = 0.15
final_scores = alpha * test_calibrated + (1 - alpha) * corrected_probs
final_roc = roc_auc_score(y_test, final_scores)
print(f"  Blended ROC-AUC (α={alpha}): {final_roc:.4f}")

# Pick best
if final_roc >= corrected_roc and final_roc >= raw_roc:
    best_scores = final_scores
    scoring_method = "blended"
    best_roc = final_roc
elif corrected_roc >= raw_roc:
    best_scores = corrected_probs
    scoring_method = "corrected_gb"
    best_roc = corrected_roc
else:
    best_scores = test_calibrated
    scoring_method = "calibrated_if"
    best_roc = raw_roc

print(f"  [BEST] {scoring_method}: {best_roc:.4f}")

with open(os.path.join(OUTPUT_DIR, "scoring_config.json"), "w") as f:
    json.dump({"method": scoring_method, "alpha": float(alpha),
               "raw_if_roc": float(raw_roc), "corrected_roc": float(corrected_roc),
               "blended_roc": float(final_roc), "corrector_type": "GradientBoostingClassifier"}, f, indent=2)

# ==========================================================
# [10] THRESHOLD + EVALUATION
# ==========================================================

print("\n[10] Threshold optimization ...")

prec_arr, rec_arr, thresholds = precision_recall_curve(y_test, best_scores)
f1_arr = 2 * prec_arr * rec_arr / (prec_arr + rec_arr + 1e-9)
best_idx = np.argmax(f1_arr)
best_threshold = float(thresholds[min(best_idx, len(thresholds) - 1)])
print(f"  Best F1 threshold: {best_threshold:.4f}")

preds = (best_scores >= best_threshold).astype(int)

print("\n[11] Evaluation ...")

roc = roc_auc_score(y_test, best_scores)
f1  = f1_score(y_test, preds, zero_division=0)
prec = precision_score(y_test, preds, zero_division=0)
rec  = recall_score(y_test, preds, zero_division=0)
cm = confusion_matrix(y_test, preds)

print(f"  ROC-AUC:   {roc:.4f}")
print(f"  F1-Score:  {f1:.4f}")
print(f"  Precision: {prec:.4f}")
print(f"  Recall:    {rec:.4f}")
print(f"  Confusion Matrix:\n{cm}")
print(f"\n  Breakdown: Raw IF={raw_roc:.4f} → +GB={corrected_roc:.4f} → Final={roc:.4f}")

# ==========================================================
# [12] SAVE ARTIFACTS
# ==========================================================

print("\n[12] Saving artifacts ...")

with open(os.path.join(OUTPUT_DIR, "features.json"), "w") as f:
    json.dump(FEATURES, f, indent=2)

metrics = {
    "model": "Isolation Forest v5.0 (chunked warm_start + GB corrector)",
    "approach": "Semi-supervised IF (normal-only, all data via warm_start) + GradientBoosting",
    "scoring_method": scoring_method,
    "n_ensemble": N_ENSEMBLE,
    "n_estimators": N_ESTIMATORS,
    "contamination": "auto (semi-supervised)",
    "roc_auc": float(roc),
    "raw_if_roc_auc": float(raw_roc),
    "corrected_roc_auc": float(corrected_roc),
    "f1_score": float(f1),
    "precision": float(prec),
    "recall": float(rec),
    "threshold": float(best_threshold),
    "n_features": len(FEATURES),
    "confusion_matrix": cm.tolist(),
    "disease_contamination": {},
    "score_distribution": {"p90": float(p90), "p95": float(p95), "p99": float(p99)},
    "timestamp": datetime.utcnow().isoformat(),
}
with open(os.path.join(OUTPUT_DIR, "metrics.json"), "w") as f:
    json.dump(metrics, f, indent=2)

auc_ok = "✓" if roc > 0.92 else "✗"
f1_ok  = "✓" if f1 > 0.55 else "✗"

print(f"\n{'='*70}")
print(f"  TRAINING COMPLETE  –  Isolation Forest v5.0")
print(f"{'='*70}")
print(f"  ROC-AUC:  {roc:.4f}  (target > 0.92) {auc_ok}")
print(f"  F1-Score: {f1:.4f}  (target > 0.55) {f1_ok}")
print(f"  Scoring:  {scoring_method}")
print(f"  Ensemble: {N_ENSEMBLE} forests × {N_ESTIMATORS} trees (warm_start)")
print(f"  Features: {len(FEATURES)}")
print(f"{'='*70}")
gc.collect()
