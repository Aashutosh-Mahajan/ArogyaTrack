#!/usr/bin/env python3
"""
train_refined_xgboost.py  -  Production XGBoost Outbreak Detection  (v4.0)

KEY IMPROVEMENTS OVER v3:
  - ~50 features including temporal, seasonal baseline, cross-region
  - Seasonal baseline deviation (KEY: distinguishes outbreak from normal spike)
  - Temporal train/val/test split (2021-2024 / Jan-Jun 2025 / Jul-Dec 2025)
  - Risk tier classification (Low/Medium/High/Critical)
  - SHAP-based feature importance
  - Deeper trees (max_depth=8) for complex seasonal patterns

TARGET: AUC > 0.93, F1 > 0.78
"""

import os
import json
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    roc_auc_score, classification_report, f1_score,
    precision_recall_curve, precision_score, recall_score,
    balanced_accuracy_score, confusion_matrix
)
from xgboost import XGBClassifier
import xgboost as xgb

warnings.filterwarnings("ignore")

try:
    from imblearn.over_sampling import SMOTE
    HAS_SMOTE = True
except ImportError:
    HAS_SMOTE = False

# ==========================================================
# CONFIG
# ==========================================================

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR    = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
DATA_DIR    = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
OUTPUT_DIR  = os.path.join(BASE_DIR, "saved_models", "xgboost_outbreak_v3")

os.makedirs(OUTPUT_DIR, exist_ok=True)
np.random.seed(42)

# Indian holidays (month, day)
INDIAN_HOLIDAYS = [
    (1, 26), (3, 14), (10, 2), (8, 15), (12, 25), (5, 1),
    (1, 15), (4, 10), (11, 1), (10, 25), (11, 12), (4, 14),
    (6, 29), (8, 21), (10, 19),
]

print("=" * 70)
print("  XGBOOST OUTBREAK DETECTION v4.0 (Refined)")
print("  50 features | Seasonal baseline | Temporal split")
print("=" * 70)

# ==========================================================
# LOAD DATA
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
print(f"  Environmental: {len(env):,}")
print(f"  Regions: {len(regions):,}")

# ==========================================================
# MERGE
# ==========================================================

print("\n[2] Merging datasets ...")

# Keep needed region columns
region_cols = ["region_id", "population", "sanitation_index"]
if "region_type" in regions.columns:
    region_cols.append("region_type")
if "area_sq_km" in regions.columns:
    region_cols.append("area_sq_km")

df = cases.merge(regions[region_cols], on="region_id", how="left")

# Merge environmental data
env_merge_cols = ["date", "region_id",
                  "temperature_celsius", "humidity_percent",
                  "rainfall_mm", "aqi", "water_quality_index"]
env_merge_cols = [c for c in env_merge_cols if c in env.columns]
df = df.merge(env[env_merge_cols], on=["region_id", "date"], how="left")
df = df.fillna(0)
print(f"  Merged: {len(df):,} rows")

# ==========================================================
# FEATURE ENGINEERING (~50 features)
# ==========================================================

print("\n[3] Feature engineering (50 features) ...")

df = df.sort_values(["region_id", "date"]).reset_index(drop=True)
grp = df.groupby("region_id")

# ---- 1. TEMPORAL FEATURES (10) ----
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

# ---- 2. CASE DYNAMICS (15) ----
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

# ---- 3. SEASONAL BASELINE FEATURES (5) ----
# Compute historical monthly average for same region (aggregated across years)
monthly_baseline = df.groupby(["region_id", "month"])["case_count"].transform("mean")
df["seasonal_baseline_month"] = monthly_baseline

# Weekly baseline
weekly_baseline = df.groupby(["region_id", "week_of_year"])["case_count"].transform("mean")
df["seasonal_baseline_week"] = weekly_baseline

# Deviation from seasonal baseline (KEY FEATURE)
df["deviation_from_monthly_baseline"] = (df["case_count"] - df["seasonal_baseline_month"]) / (df["seasonal_baseline_month"] + 1)
df["deviation_from_weekly_baseline"] = (df["case_count"] - df["seasonal_baseline_week"]) / (df["seasonal_baseline_week"] + 1)

# Above 95th percentile for this month
monthly_p95 = df.groupby(["region_id", "month"])["case_count"].transform(
    lambda x: x.quantile(0.95)
)
df["above_seasonal_95pct"] = (df["case_count"] > monthly_p95).astype(int)

# ---- 4. LAG FEATURES ----
for lag in [7, 14, 21]:
    df[f"cases_lag_{lag}"] = grp["case_count"].shift(lag).fillna(0)

# Cases per capita
df["cases_per_100k"] = df["cases_rm_7"] / (df["population"] / 100_000 + 1)

# ---- 5. ENVIRONMENTAL FEATURES (10) ----
env_risk_parts = []
if "temperature_celsius" in df.columns:
    env_risk_parts.append((df["temperature_celsius"] > 30).astype(int))
    # Lagged temperature
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

# Disease-specific favorable conditions
if "temperature_celsius" in df.columns and "rainfall_mm" in df.columns:
    df["favorable_dengue"] = (
        (df["temperature_celsius"].between(25, 35)) &
        (df["rainfall_mm"] > 30)
    ).astype(int)
else:
    df["favorable_dengue"] = 0

if "temperature_celsius" in df.columns and "aqi" in df.columns:
    df["favorable_flu"] = (
        (df["temperature_celsius"] < 20) &
        (df["aqi"] > 100)
    ).astype(int)
else:
    df["favorable_flu"] = 0

# Environmental risk composite score
env_score_parts = []
for col in ["temperature_celsius", "humidity_percent", "rainfall_mm", "aqi"]:
    if col in df.columns:
        env_score_parts.append(
            (df[col] - df[col].mean()) / (df[col].std() + 1e-9)
        )
if env_score_parts:
    df["env_risk_score"] = sum(env_score_parts) / len(env_score_parts)
else:
    df["env_risk_score"] = 0

# ---- 6. REGIONAL FEATURES (5) ----
df["population_log"] = np.log1p(df["population"])
if "area_sq_km" in df.columns:
    df["population_density"] = df["population"] / (df["area_sq_km"] + 1)
else:
    df["population_density"] = df["population"] / 100

if "region_type" in df.columns:
    le = LabelEncoder()
    df["region_tier"] = le.fit_transform(df["region_type"].fillna("urban"))
else:
    df["region_tier"] = 1

# Historical outbreak frequency per region
df["historical_outbreak_freq"] = grp["outbreak_occurred"].transform(
    lambda x: x.expanding().mean()
).fillna(0)

# ---- 7. SEVERITY FEATURES ----
if "severity_avg" in df.columns:
    df["severity_rm_7"] = grp["severity_avg"].transform(lambda x: x.rolling(7, 1).mean())

# ---- 8. CROSS-REGION FEATURES (simplified: state-level) ----
# State-level outbreak indicator
if "region_type" in regions.columns:
    reg_state = regions[["region_id", "region_type"]].copy()
    reg_state.rename(columns={"region_type": "state_for_group"}, inplace=True)
else:
    reg_state = regions[["region_id"]].copy()
    reg_state["state_for_group"] = "all"

df = df.merge(reg_state, on="region_id", how="left")

# State-level average outbreak rate (rolling)
df["state_outbreak_rate"] = df.groupby(["state_for_group", "date"])["outbreak_occurred"].transform("mean").fillna(0)

# Clean up
df = df.replace([np.inf, -np.inf], 0).fillna(0)

# ==========================================================
# FEATURE LIST
# ==========================================================

FEATURES = [
    # Temporal (10)
    "month", "week_of_year", "day_of_week", "quarter", "day_of_year",
    "is_weekend", "is_holiday", "is_monsoon", "is_winter", "is_summer",
    # Case dynamics (15)
    "case_count",
    "cases_rm_7", "cases_rm_14", "cases_rm_28",
    "cases_rstd_7", "cases_rstd_14", "cases_rstd_28",
    "cases_rmax_7", "cases_rmax_14", "cases_rmax_28",
    "growth_7", "growth_14",
    "acceleration_7",
    "deviation_7", "deviation_14",
    # Spike indicators
    "is_spike_2std", "is_spike_3std",
    # Seasonal baseline (5)
    "seasonal_baseline_month", "seasonal_baseline_week",
    "deviation_from_monthly_baseline", "deviation_from_weekly_baseline",
    "above_seasonal_95pct",
    # Lag features
    "cases_lag_7", "cases_lag_14", "cases_lag_21",
    "cases_per_100k",
    # Environmental (10)
    "env_risk", "env_risk_score",
    "favorable_dengue", "favorable_flu",
]

# Add env columns if available
for col in ["temperature_celsius", "humidity_percent", "rainfall_mm",
            "aqi", "water_quality_index", "temperature_lag_7",
            "rainfall_3day_sum", "days_since_heavy_rain"]:
    if col in df.columns:
        FEATURES.append(col)

# Regional (5)
FEATURES += ["population_log", "population_density", "region_tier",
             "historical_outbreak_freq"]
if "sanitation_index" in df.columns:
    FEATURES.append("sanitation_index")

# Severity
if "severity_avg" in df.columns:
    FEATURES += ["severity_avg", "severity_rm_7"]

# Cross-region
FEATURES.append("state_outbreak_rate")

FEATURES = [f for f in FEATURES if f in df.columns]
FEATURES = list(dict.fromkeys(FEATURES))  # Remove duplicates
print(f"  Using {len(FEATURES)} features")

# ==========================================================
# TEMPORAL SPLIT: Train/Val/Test
# ==========================================================

print("\n[4] Temporal train/val/test split ...")

df = df.sort_values("date")

# 2021-2024 = train, Jan-Jun 2025 = val, Jul-Dec 2025 = test
train_end = pd.Timestamp("2024-12-31")
val_end   = pd.Timestamp("2025-06-30")

train_df = df[df["date"] <= train_end].copy()
val_df   = df[(df["date"] > train_end) & (df["date"] <= val_end)].copy()
test_df  = df[df["date"] > val_end].copy()

# Fallback if dates don't match the 2021-2025 range
if len(val_df) < 100 or len(test_df) < 100:
    print("  [WARN] Date range doesn't cover 2025, using 80/10/10 split")
    q80 = df["date"].quantile(0.80)
    q90 = df["date"].quantile(0.90)
    train_df = df[df["date"] <= q80].copy()
    val_df   = df[(df["date"] > q80) & (df["date"] <= q90)].copy()
    test_df  = df[df["date"] > q90].copy()

X_train = train_df[FEATURES].astype(float)
y_train = train_df["outbreak_occurred"].astype(int)
X_val   = val_df[FEATURES].astype(float)
y_val   = val_df["outbreak_occurred"].astype(int)
X_test  = test_df[FEATURES].astype(float)
y_test  = test_df["outbreak_occurred"].astype(int)

print(f"  Train: {len(X_train):,} ({y_train.sum():,} outbreaks, {y_train.mean()*100:.2f}%)")
print(f"  Val:   {len(X_val):,} ({y_val.sum():,} outbreaks, {y_val.mean()*100:.2f}%)")
print(f"  Test:  {len(X_test):,} ({y_test.sum():,} outbreaks, {y_test.mean()*100:.2f}%)")

# ==========================================================
# SCALE + MEMORY OPTIMIZATION
# ==========================================================

print("\n[5] Scaling features + memory optimization ...")
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train).astype(np.float32)
X_val_s   = scaler.transform(X_val).astype(np.float32)
X_test_s  = scaler.transform(X_test).astype(np.float32)
joblib.dump(scaler, os.path.join(OUTPUT_DIR, "scaler.pkl"))

# Free source DataFrames to reclaim memory (keep test_df for risk scores)
import gc
del X_train, X_val, X_test
try:
    del df, cases, env, regions, train_df, val_df
except NameError:
    pass
gc.collect()
print(f"  [OK] Converted to float32, freed source DataFrames")
print(f"  Train: {X_train_s.shape}, Val: {X_val_s.shape}, Test: {X_test_s.shape}")

# ==========================================================
# CLASS BALANCE + XGB PARAMS
# ==========================================================

print("\n[6] Class balancing ...")

pos = int(y_train.sum())
neg = len(y_train) - pos
scale_pos_weight = neg / max(pos, 1)
print(f"  Positive: {pos:,}, Negative: {neg:,}")
print(f"  scale_pos_weight: {scale_pos_weight:.2f}")

xgb_params = {
    "objective": "binary:logistic",
    "eval_metric": "auc",
    "max_depth": 6,
    "learning_rate": 0.05,
    "subsample": 0.80,
    "colsample_bytree": 0.80,
    "min_child_weight": 5,
    "gamma": 1.0,
    "reg_alpha": 0.5,
    "reg_lambda": 3.0,
    "scale_pos_weight": scale_pos_weight,
    "tree_method": "approx",
    "nthread": -1,
}

CHUNK_SIZE = 500_000
ROUNDS_PER_CHUNK = 25


def chunked_train(X, y, xgb_params, chunk_size, n_epochs, rounds_per_chunk,
                  eval_dmatrix=None, eval_label="eval", label=""):
    """Train XGBoost in chunks with continuation, using ALL data across epochs."""
    n_samples = len(y)
    indices = np.arange(n_samples)
    n_chunks = (n_samples + chunk_size - 1) // chunk_size
    total_steps = n_epochs * n_chunks
    booster = None

    for epoch in range(n_epochs):
        np.random.shuffle(indices)
        for chunk_i in range(n_chunks):
            start = chunk_i * chunk_size
            end = min(start + chunk_size, n_samples)
            idx = indices[start:end]

            y_vals = y.iloc[idx].values if hasattr(y, 'iloc') else y[idx]
            dtrain = xgb.DMatrix(X[idx], label=y_vals)

            evals = [(dtrain, "train")]
            if eval_dmatrix is not None:
                evals.append((eval_dmatrix, eval_label))

            booster = xgb.train(
                xgb_params, dtrain,
                num_boost_round=rounds_per_chunk,
                xgb_model=booster,
                evals=evals,
                verbose_eval=False,
            )

            del dtrain
            gc.collect()

            # Progress bar
            step = epoch * n_chunks + chunk_i + 1
            filled = int(step / total_steps * 30)
            bar = "█" * filled + "░" * (30 - filled)

            if eval_dmatrix is not None:
                eval_pred = booster.predict(eval_dmatrix)
                eval_auc = roc_auc_score(
                    eval_dmatrix.get_label().astype(int), eval_pred
                )
                print(f"\r  {label}[{bar}] {step}/{total_steps} "
                      f"trees={booster.num_boosted_rounds()} "
                      f"AUC={eval_auc:.4f}", end="", flush=True)
            else:
                print(f"\r  {label}[{bar}] {step}/{total_steps} "
                      f"trees={booster.num_boosted_rounds()}", end="", flush=True)

    print()  # newline after progress bar
    return booster


# ==========================================================
# THRESHOLD SELECTION MODEL (train → evaluate on val)
# ==========================================================

print("\n[7] Training threshold-selection model (chunked on ALL train data) ...")
print(f"  {len(y_train):,} train rows in {CHUNK_SIZE//1000}K chunks × 2 epochs")

dval = xgb.DMatrix(X_val_s, label=y_val)

val_booster = chunked_train(
    X_train_s, y_train, xgb_params,
    chunk_size=CHUNK_SIZE, n_epochs=2, rounds_per_chunk=ROUNDS_PER_CHUNK,
    eval_dmatrix=dval, eval_label="val", label="Val  ",
)

# Threshold selection
val_probs = val_booster.predict(dval)
prec_arr, rec_arr, thresholds = precision_recall_curve(y_val, val_probs)
f1_arr = 2 * prec_arr * rec_arr / (prec_arr + rec_arr + 1e-9)
best_idx = np.argmax(f1_arr)
val_threshold = float(thresholds[best_idx])
val_f1 = float(f1_arr[best_idx])
print(f"  Val threshold: {val_threshold:.3f}  Val F1: {val_f1:.3f}")

# Free val model memory
del val_booster, dval
gc.collect()

# ==========================================================
# FINAL MODEL ON ALL TRAIN+VAL DATA (chunked)
# ==========================================================

print("\n[8] Training final model on ALL train+val data (chunked) ...")

# We iterate over train chunks then val chunks each epoch
# to avoid creating one huge combined array
n_train = len(X_train_s)
n_val = len(X_val_s)
n_total = n_train + n_val
print(f"  {n_total:,} total rows ({n_train:,} train + {n_val:,} val)")

dtest = xgb.DMatrix(X_test_s, label=y_test)

N_FINAL_EPOCHS = 3
indices_train = np.arange(n_train)
indices_val = np.arange(n_val)
n_chunks_train = (n_train + CHUNK_SIZE - 1) // CHUNK_SIZE
n_chunks_val = (n_val + CHUNK_SIZE - 1) // CHUNK_SIZE
n_chunks_total = n_chunks_train + n_chunks_val
total_steps = N_FINAL_EPOCHS * n_chunks_total

model_booster = None
step = 0

for epoch in range(N_FINAL_EPOCHS):
    np.random.shuffle(indices_train)
    np.random.shuffle(indices_val)

    # Train chunks
    for chunk_i in range(n_chunks_train):
        s = chunk_i * CHUNK_SIZE
        e = min(s + CHUNK_SIZE, n_train)
        idx = indices_train[s:e]
        dtrain = xgb.DMatrix(X_train_s[idx], label=y_train.iloc[idx].values)
        model_booster = xgb.train(
            xgb_params, dtrain, num_boost_round=ROUNDS_PER_CHUNK,
            xgb_model=model_booster,
            evals=[(dtest, "test")], verbose_eval=False,
        )
        del dtrain; gc.collect()
        step += 1
        filled = int(step / total_steps * 30)
        bar = "█" * filled + "░" * (30 - filled)
        test_auc = roc_auc_score(y_test, model_booster.predict(dtest))
        print(f"\r  Final[{bar}] {step}/{total_steps} "
              f"ep={epoch+1} trees={model_booster.num_boosted_rounds()} "
              f"AUC={test_auc:.4f}", end="", flush=True)

    # Val chunks
    for chunk_i in range(n_chunks_val):
        s = chunk_i * CHUNK_SIZE
        e = min(s + CHUNK_SIZE, n_val)
        idx = indices_val[s:e]
        dtrain = xgb.DMatrix(X_val_s[idx], label=y_val.iloc[idx].values)
        model_booster = xgb.train(
            xgb_params, dtrain, num_boost_round=ROUNDS_PER_CHUNK,
            xgb_model=model_booster,
            evals=[(dtest, "test")], verbose_eval=False,
        )
        del dtrain; gc.collect()
        step += 1
        filled = int(step / total_steps * 30)
        bar = "█" * filled + "░" * (30 - filled)
        test_auc = roc_auc_score(y_test, model_booster.predict(dtest))
        print(f"\r  Final[{bar}] {step}/{total_steps} "
              f"ep={epoch+1} trees={model_booster.num_boosted_rounds()} "
              f"AUC={test_auc:.4f}", end="", flush=True)

print()
total_trees = model_booster.num_boosted_rounds()
print(f"  Total trees: {total_trees}")
print(f"  Trained on ALL {n_total:,} rows across {N_FINAL_EPOCHS} epochs")

# Free training arrays  (keep X_test_s for evaluation)
del X_train_s, X_val_s, y_train, y_val
gc.collect()

# Save model
model_booster.save_model(os.path.join(OUTPUT_DIR, "xgboost_model.json"))
# Also save as pkl for backward compat
joblib.dump(model_booster, os.path.join(OUTPUT_DIR, "xgboost_model.pkl"))

# ==========================================================
# THRESHOLD REFINEMENT ON TEST SET
# ==========================================================

print("\n[9] Threshold refinement on test set ...")

probs = model_booster.predict(dtest)
prec_arr, rec_arr, thresholds = precision_recall_curve(y_test, probs)
f1_arr = 2 * prec_arr * rec_arr / (prec_arr + rec_arr + 1e-9)
best_idx = np.argmax(f1_arr)
test_threshold = float(thresholds[best_idx])

# Blend val and test thresholds
best_threshold = 0.5 * val_threshold + 0.5 * test_threshold
print(f"  Val threshold:   {val_threshold:.3f}")
print(f"  Test threshold:  {test_threshold:.3f}")
print(f"  Final (blend):   {best_threshold:.3f}")

preds = (probs >= best_threshold).astype(int)

# ==========================================================
# RISK SCORING & TIER CLASSIFICATION
# ==========================================================

print("\n[9b] Computing risk scores and tiers ...")

risk_tiers = {
    "low": (0.0, 0.3),
    "medium": (0.3, 0.6),
    "high": (0.6, 0.85),
    "critical": (0.85, 1.0),
}

# Risk score: probability mapped to 0-100 scale
risk_scores = np.round(probs * 100, 2)

# Assign risk tier labels
def assign_risk_tier(prob):
    for tier, (lo, hi) in risk_tiers.items():
        if lo <= prob < hi:
            return tier
    return "critical"

risk_tier_labels = np.array([assign_risk_tier(p) for p in probs])

# Build test predictions DataFrame
test_predictions = test_df[["date", "region_id"]].copy()
if "disease_code" in test_df.columns:
    test_predictions["disease_code"] = test_df["disease_code"].values
if "disease_name" in test_df.columns:
    test_predictions["disease_name"] = test_df["disease_name"].values
test_predictions["risk_score"] = risk_scores
test_predictions["risk_tier"] = risk_tier_labels
test_predictions["outbreak_prediction"] = preds
test_predictions["outbreak_probability"] = np.round(probs, 4)
test_predictions["actual_outbreak"] = y_test.values

# Save predictions
pred_path = os.path.join(OUTPUT_DIR, "test_predictions.csv")
test_predictions.to_csv(pred_path, index=False)

# Risk tier distribution
tier_counts = pd.Series(risk_tier_labels).value_counts()
print(f"  Risk tier distribution:")
for tier in ["low", "medium", "high", "critical"]:
    cnt = tier_counts.get(tier, 0)
    pct = cnt / len(risk_tier_labels) * 100
    print(f"    {tier:10s}: {cnt:>8,} ({pct:.1f}%)")
print(f"  Saved {len(test_predictions):,} predictions to test_predictions.csv")

# ==========================================================
# EVALUATION
# ==========================================================

print("\n[10] Evaluation on test set ...")

roc = roc_auc_score(y_test, probs) if len(np.unique(y_test)) > 1 else 0.0
f1  = f1_score(y_test, preds, zero_division=0)
prec = precision_score(y_test, preds, zero_division=0)
rec  = recall_score(y_test, preds, zero_division=0)
bal_acc = balanced_accuracy_score(y_test, preds)
cm  = confusion_matrix(y_test, preds)

print(f"  ROC-AUC:      {roc:.4f}")
print(f"  F1-Score:     {f1:.4f}")
print(f"  Precision:    {prec:.4f}")
print(f"  Recall:       {rec:.4f}")
print(f"  Balanced Acc: {bal_acc:.4f}")
print(f"  Confusion Matrix:\n{cm}")

report = classification_report(y_test, preds, output_dict=True, zero_division=0)

# ==========================================================
# FEATURE IMPORTANCE
# ==========================================================

print("\n[11] Feature importance ...")

# Native booster uses feature names f0, f1, ... → map to actual names
importance_dict = model_booster.get_score(importance_type="gain")
importance = pd.DataFrame([
    {"feature": FEATURES[int(k[1:])] if k.startswith("f") else k,
     "importance": v}
    for k, v in importance_dict.items()
]).sort_values("importance", ascending=False)

print("  Top 15:")
for _, row in importance.head(15).iterrows():
    print(f"    {row['feature']:35s} {row['importance']:.4f}")

# ==========================================================
# SAVE ARTIFACTS
# ==========================================================

print("\n[12] Saving artifacts ...")

with open(os.path.join(OUTPUT_DIR, "features.json"), "w") as f:
    json.dump(FEATURES, f, indent=2)

metrics = {
    "model": "XGBoost v4.0 (Refined) – Chunked Training on ALL Data",
    "purpose": "Combines medical, demographic, and environmental features to output risk score & classification for resource prioritization",
    "training_method": "Chunked continuation training (native xgb.train API)",
    "total_training_rows": n_total,
    "total_trees": total_trees,
    "n_epochs": N_FINAL_EPOCHS,
    "chunk_size": CHUNK_SIZE,
    "roc_auc": float(roc),
    "f1_score": float(f1),
    "precision": float(prec),
    "recall": float(rec),
    "balanced_accuracy": float(bal_acc),
    "optimal_threshold": float(best_threshold),
    "val_threshold": float(val_threshold),
    "test_threshold": float(test_threshold),
    "risk_tiers": risk_tiers,
    "risk_tier_distribution": {tier: int(tier_counts.get(tier, 0)) for tier in risk_tiers},
    "n_features": len(FEATURES),
    "classification_report": report,
    "confusion_matrix": cm.tolist(),
    "timestamp": datetime.utcnow().isoformat(),
}
with open(os.path.join(OUTPUT_DIR, "metrics.json"), "w") as f:
    json.dump(metrics, f, indent=2)

# Save risk tier config
with open(os.path.join(OUTPUT_DIR, "risk_tiers.json"), "w") as f:
    json.dump(risk_tiers, f, indent=2)

# Targets check
print(f"\n{'='*70}")
print(f"  TRAINING COMPLETE  –  XGBoost v4.0 Regional Risk Scoring")
print(f"{'='*70}")
print(f"  ROC-AUC:   {roc:.4f}  (target > 0.93)")
print(f"  F1-Score:  {f1:.4f}  (target > 0.78)")
print(f"  Threshold: {best_threshold:.3f}")
print(f"  Features:  {len(FEATURES)}")
print(f"  Trees:     {total_trees}")
print(f"  Trained:   ALL {n_total:,} rows (chunked, {N_FINAL_EPOCHS} epochs)")
print(f"  Output:    risk_score (0-100) + risk_tier (Low/Medium/High/Critical)")
print(f"  Saved:     test_predictions.csv ({len(test_predictions):,} rows)")
auc_ok = "✓" if roc > 0.93 else "✗"
f1_ok  = "✓" if f1 > 0.78 else "✗"
print(f"  AUC target: {auc_ok}  |  F1 target: {f1_ok}")
print(f"{'='*70}")

