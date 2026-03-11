#!/usr/bin/env python3
"""
Test Prophet + XGBoost Ensemble Forecast Model  (v4.0)
Matches feature engineering from train_prophet_prod.py exactly.

Tests:
  - 7, 14, 30-day forecast horizons
  - Confidence intervals
  - Ensemble blend accuracy
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import warnings
warnings.filterwarnings("ignore")

BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR   = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
MODEL_DIR  = os.path.join(BASE_DIR, "saved_models", "final_ensemble_model")
OUTPUT_DIR = os.path.join(BASE_DIR, "test_results", "forecast_ensemble")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("=" * 70)
print("PROPHET + XGBOOST ENSEMBLE FORECAST MODEL TESTING  (v4.0)")
print("=" * 70)

# ==========================================================
# METRICS
# ==========================================================

def safe_mape(y_true, y_pred):
    t, p = np.array(y_true, dtype=float), np.array(y_pred, dtype=float)
    m = t > 0
    return float(np.mean(np.abs((t[m] - p[m]) / t[m])) * 100) if m.sum() else np.nan

# ==========================================================
# LOAD MODELS AND CONFIG
# ==========================================================

print("\nLoading models...")
prophet_model = joblib.load(os.path.join(MODEL_DIR, "prophet_model.pkl"))

xgb_model = xgb.Booster()
xgb_model.load_model(os.path.join(MODEL_DIR, "xgb_model.bst"))

with open(os.path.join(MODEL_DIR, "config.json")) as f:
    config = json.load(f)

BLEND_WEIGHT_PROPHET = config.get("blend_weight_prophet", 0.5)
BLEND_WEIGHT_XGB     = 1 - BLEND_WEIGHT_PROPHET
LOG_TRANSFORM        = config.get("log_transform", False)
SMOOTH_WINDOW        = config.get("smooth_window", 3)
OUTLIER_PERCENTILE   = config.get("outlier_percentile", 99)
USE_WEEKLY           = config.get("use_weekly", True)
FEATURE_COLS         = config.get("feature_cols", [])
FORECAST_DAYS        = config.get("forecast_days", 90)
HORIZONS             = config.get("horizons", [7, 14, 30])

print(f"Blend weights: Prophet={BLEND_WEIGHT_PROPHET:.2f}, XGBoost={BLEND_WEIGHT_XGB:.2f}")
print(f"Horizons: {HORIZONS}")

# ==========================================================
# LOAD & PREPARE DATA (match train_prophet_prod.py)
# ==========================================================

print("\nLoading data...")
surv = pd.read_csv(
    os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
    usecols=["date", "case_count"],
    parse_dates=["date"],
)
env = pd.read_csv(
    os.path.join(DATA_DIR, "environmental_data.csv"),
    usecols=["date", "temperature_celsius", "rainfall_mm", "aqi"],
    parse_dates=["date"],
)

# Use MEAN (not sum) - matches training; scale-independent of region count
daily     = surv.groupby("date", as_index=False)["case_count"].mean()
env_daily = env.groupby("date", as_index=False).mean(numeric_only=True)

df = daily.merge(env_daily, on="date", how="left")
df = df.rename(columns={"date": "ds", "case_count": "y"}).sort_values("ds")

df = df.set_index("ds").asfreq("D").reset_index()
for col in ["temperature_celsius", "rainfall_mm", "aqi"]:
    df[col] = df[col].interpolate().ffill().bfill()
df["y"] = df["y"].fillna(0)

print(f"Daily records: {len(df)}")

if USE_WEEKLY:
    df = df.set_index("ds").resample("W").agg({
        "y": "mean", "temperature_celsius": "mean",
        "rainfall_mm": "mean", "aqi": "mean",
    }).reset_index()
    print(f"Weekly records: {len(df)}")

cap = df["y"].quantile(OUTLIER_PERCENTILE / 100)
df["y"] = df["y"].clip(upper=cap)
df["y"] = df["y"].rolling(SMOOTH_WINDOW, min_periods=1).mean()
df["y_original"] = df["y"].copy()

if LOG_TRANSFORM:
    df["y"] = np.log1p(df["y"])

# ==========================================================
# FEATURE ENGINEERING (IDENTICAL to train_prophet_prod.py)
# ==========================================================

print("Engineering features...")

df["month"]      = df["ds"].dt.month
df["weekofyear"] = df["ds"].dt.isocalendar().week.astype(int)
df["quarter"]    = df["ds"].dt.quarter

for lag in [1, 2, 3, 4, 8]:
    df[f"lag_{lag}"] = df["y_original"].shift(lag)

df["rm_4"]    = df["y_original"].rolling(4, min_periods=1).mean()
df["rstd_4"]  = df["y_original"].rolling(4, min_periods=1).std().fillna(0)
df["rm_8"]    = df["y_original"].rolling(8, min_periods=1).mean()
df["rstd_8"]  = df["y_original"].rolling(8, min_periods=1).std().fillna(0)
df["rmax_4"]  = df["y_original"].rolling(4, min_periods=1).max()
df["rmin_4"]  = df["y_original"].rolling(4, min_periods=1).min()

df["diff_1"]  = df["y_original"].diff().fillna(0)
df["diff_2"]  = df["y_original"].diff(2).fillna(0)
df["pct_1"]   = df["y_original"].pct_change().fillna(0).replace([np.inf, -np.inf], 0)

df["temp_rain"] = df["temperature_celsius"] * df["rainfall_mm"]
df["temp_aqi"]  = df["temperature_celsius"] * df["aqi"]

df = df.fillna(0)

# ==========================================================
# SPLIT TEST SET
# ==========================================================

test_start = df["ds"].max() - pd.Timedelta(days=FORECAST_DAYS)
test_df = df[df["ds"] > test_start].copy()

print(f"Testing on last {len(test_df)} records")

# ==========================================================
# PROPHET FORECAST
# ==========================================================

print("\nGenerating Prophet forecast...")
future = prophet_model.make_future_dataframe(
    periods=len(test_df), freq="W" if USE_WEEKLY else "D",
)
for col in ["temperature_celsius", "rainfall_mm", "aqi", "month"]:
    future[col] = df.set_index("ds")[col].reindex(future["ds"]).ffill().bfill().values

forecast = prophet_model.predict(future)

if LOG_TRANSFORM:
    for c in ["yhat", "yhat_lower", "yhat_upper"]:
        forecast[c] = np.expm1(forecast[c])

fc_test = forecast.set_index("ds").reindex(test_df["ds"]).reset_index()
prophet_pred  = np.maximum(fc_test["yhat"].values, 0)
prophet_lower = np.maximum(fc_test["yhat_lower"].values, 0)
prophet_upper = np.maximum(fc_test["yhat_upper"].values, 0)

# ==========================================================
# XGBOOST PREDICTION
# ==========================================================

print("Generating XGBoost predictions...")
available_feats = [f for f in FEATURE_COLS if f in test_df.columns]
X_test = test_df[available_feats].fillna(0).replace([np.inf, -np.inf], 0)
dtest  = xgb.DMatrix(X_test)
xgb_pred = np.maximum(xgb_model.predict(dtest), 0)

# ==========================================================
# ENSEMBLE BLENDING
# ==========================================================

print("Blending predictions...")

valid_mask = ~np.isnan(prophet_pred)
if not valid_mask.all():
    prophet_pred[~valid_mask] = xgb_pred[~valid_mask]

ensemble_pred = BLEND_WEIGHT_PROPHET * prophet_pred + BLEND_WEIGHT_XGB * xgb_pred
y_test = test_df["y_original"].values

# Confidence intervals
blend_lower = BLEND_WEIGHT_PROPHET * prophet_lower + BLEND_WEIGHT_XGB * xgb_pred * 0.85
blend_upper = BLEND_WEIGHT_PROPHET * prophet_upper + BLEND_WEIGHT_XGB * xgb_pred * 1.15

# ==========================================================
# PER-HORIZON EVALUATION
# ==========================================================

print("\n" + "=" * 70)
print("PER-HORIZON TEST RESULTS")
print("=" * 70)

if USE_WEEKLY:
    horizon_periods = {h: max(1, h // 7) for h in HORIZONS}
else:
    horizon_periods = {h: h for h in HORIZONS}

horizon_results = {}

for h_days in HORIZONS:
    n = min(horizon_periods[h_days], len(y_test))
    if n < 1:
        continue

    y_h = y_test[:n]
    blend_h = ensemble_pred[:n]
    lower_h = blend_lower[:n]
    upper_h = blend_upper[:n]

    mae  = float(mean_absolute_error(y_h, blend_h))
    rmse = float(np.sqrt(mean_squared_error(y_h, blend_h)))
    r2   = float(r2_score(y_h, blend_h)) if n > 1 else 0.0
    mape = safe_mape(y_h, blend_h)
    ci_cov = float(np.mean((y_h >= lower_h) & (y_h <= upper_h)))

    horizon_results[f"{h_days}d"] = {
        "n_periods": n, "mae": mae, "rmse": rmse, "r2": r2,
        "mape": None if np.isnan(mape) else mape,
        "ci_coverage_95": ci_cov,
    }
    print(f"\n  {h_days}-day horizon ({n} periods):")
    print(f"    MAE:  {mae:.2f}")
    print(f"    R2:   {r2:.4f}")
    print(f"    CI:   {ci_cov:.1%}")

# ==========================================================
# OVERALL EVALUATION
# ==========================================================

print("\n" + "=" * 70)
print("OVERALL TEST RESULTS")
print("=" * 70)

mae  = mean_absolute_error(y_test, ensemble_pred)
rmse = np.sqrt(mean_squared_error(y_test, ensemble_pred))
r2   = r2_score(y_test, ensemble_pred)

print(f"\nEnsemble Metrics (full test set):")
print(f"  MAE:  {mae:.2f}")
print(f"  RMSE: {rmse:.2f}")
print(f"  R2:   {r2:.4f}")

prophet_r2 = r2_score(y_test, prophet_pred)
xgb_r2     = r2_score(y_test, xgb_pred)

print(f"\nProphet R2:  {prophet_r2:.4f}")
print(f"XGBoost R2:  {xgb_r2:.4f}")

ci_coverage_all = float(np.mean((y_test >= blend_lower) & (y_test <= blend_upper)))
print(f"CI Coverage (95%): {ci_coverage_all:.1%}")

# Save test results
test_results = {
    "test_size": len(test_df),
    "overall": {
        "ensemble_mae": float(mae),
        "ensemble_rmse": float(rmse),
        "ensemble_r2": float(r2),
        "prophet_r2": float(prophet_r2),
        "xgb_r2": float(xgb_r2),
        "ci_coverage_95": ci_coverage_all,
    },
    "horizons": horizon_results,
    "blend_weight_prophet": BLEND_WEIGHT_PROPHET,
}

with open(os.path.join(OUTPUT_DIR, "test_metrics.json"), "w") as f:
    json.dump(test_results, f, indent=2)

# ==========================================================
# VISUALIZATION
# ==========================================================

print("\nGenerating plots...")

fig, ax = plt.subplots(figsize=(14, 6))
ax.plot(test_df["ds"], y_test, label="Actual", linewidth=2, color="black")
ax.plot(test_df["ds"], ensemble_pred, label="Ensemble", linewidth=2, color="blue", alpha=0.7)
ax.fill_between(test_df["ds"], blend_lower, blend_upper,
                alpha=0.15, color="blue", label="95% CI")
ax.plot(test_df["ds"], prophet_pred, label="Prophet", linewidth=1, color="red", alpha=0.5)
ax.plot(test_df["ds"], xgb_pred, label="XGBoost", linewidth=1, color="green", alpha=0.5)
ax.set_xlabel("Date"); ax.set_ylabel("Case Count")
ax.set_title(f"Ensemble Forecast Test (R2={r2:.4f})")
ax.legend(); plt.xticks(rotation=45); plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "forecast_test_plot.png"), dpi=150)
plt.close()

print(f"\nResults saved to {OUTPUT_DIR}")
print("\n" + "=" * 70)
print("TESTING COMPLETE")
print("=" * 70)
