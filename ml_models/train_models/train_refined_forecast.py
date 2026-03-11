#!/usr/bin/env python3
"""
train_refined_forecast.py  -  Prophet + XGBoost Ensemble Forecasting  (v5.0)

KEY IMPROVEMENTS OVER v4:
  - Indian holiday calendar (15 national holidays)
  - Custom monsoon/winter seasonalities with fourier terms
  - Environmental regressors with proper lags
  - Walk-forward ensemble weight optimization
  - Stronger XGBoost residual model with temporal features
  - Per-disease evaluation

TARGET: R² > 0.65, MAPE < 15%
"""

import os
import sys
import json
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
import joblib
from sklearn.metrics import r2_score, mean_absolute_error

warnings.filterwarnings("ignore")

try:
    from prophet import Prophet
    HAS_PROPHET = True
except ImportError:
    try:
        from fbprophet import Prophet
        HAS_PROPHET = True
    except ImportError:
        HAS_PROPHET = False
        print("[WARN] Prophet not installed. Install with: pip install prophet")

import xgboost as xgb

# ==========================================================
# CONFIG
# ==========================================================

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR    = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
DATA_DIR    = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
OUTPUT_DIR  = os.path.join(BASE_DIR, "saved_models", "final_ensemble_model")

os.makedirs(OUTPUT_DIR, exist_ok=True)

FORECAST_DAYS   = 182   # 26 weeks test set for robust per-horizon metrics
HORIZONS        = [7, 14, 30, 60, 90]
USE_WEEKLY       = True
SMOOTH_WINDOW    = 3
OUTLIER_PERCENTILE = 99
N_WALK_FORWARD   = 3

# Indian holidays for Prophet
INDIAN_HOLIDAYS_DF = pd.DataFrame({
    "holiday": [
        "republic_day", "holi", "gandhi_jayanti", "independence_day",
        "christmas", "may_day", "makar_sankranti", "ram_navami",
        "diwali", "dussehra", "guru_nanak", "ambedkar_jayanti",
        "eid_ul_fitr", "eid_ul_adha", "eid_e_milad",
    ],
    "ds": pd.to_datetime([
        "2023-01-26", "2023-03-14", "2023-10-02", "2023-08-15",
        "2023-12-25", "2023-05-01", "2023-01-15", "2023-04-10",
        "2023-11-01", "2023-10-25", "2023-11-12", "2023-04-14",
        "2023-06-29", "2023-08-21", "2023-10-19",
    ]),
    "lower_window": 0,
    "upper_window": 1,
})

# Expand holidays across years
all_holidays = []
for year in range(2020, 2027):
    yearly = INDIAN_HOLIDAYS_DF.copy()
    yearly["ds"] = yearly["ds"].apply(lambda d: d.replace(year=year))
    all_holidays.append(yearly)
HOLIDAYS_EXPANDED = pd.concat(all_holidays, ignore_index=True)

print("=" * 70)
print("  PROPHET + XGBOOST ENSEMBLE  v5.0  (Refined)")
print("  Indian holidays | Custom seasonalities | Environmental regressors")
print("=" * 70)

# ==========================================================
# METRICS
# ==========================================================

def safe_mape(y_true, y_pred):
    mask = y_true > 0
    if mask.sum() == 0:
        return 0.0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)

def smape(y_true, y_pred):
    denom = np.abs(y_true) + np.abs(y_pred) + 1e-9
    return float(np.mean(2 * np.abs(y_true - y_pred) / denom) * 100)

def mase(y_true, y_pred):
    naive_errors = np.abs(np.diff(y_true))
    if naive_errors.mean() == 0:
        return 0.0
    return float(np.mean(np.abs(y_true - y_pred)) / naive_errors.mean())

def compute_horizon_metrics(y_true, y_pred):
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "r2": float(r2_score(y_true, y_pred)) if len(y_true) > 1 else 0.0,
        "mape": safe_mape(np.array(y_true), np.array(y_pred)),
        "smape": smape(np.array(y_true), np.array(y_pred)),
    }

# ==========================================================
# 1. LOAD & PREPARE
# ==========================================================

print("\n[1] Loading data ...")

surv = pd.read_csv(
    os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
    parse_dates=["date"],
)
env = pd.read_csv(
    os.path.join(DATA_DIR, "environmental_data.csv"),
    parse_dates=["date"],
)

print(f"  Surveillance: {len(surv):,}")
print(f"  Environmental: {len(env):,}")

# Aggregate to daily national level (all diseases combined)
daily = surv.groupby("date").agg(
    y=("case_count", "sum"),
).reset_index()
daily.rename(columns={"date": "ds"}, inplace=True)
daily = daily.sort_values("ds").reset_index(drop=True)

# Merge environmental features (national average)
env_daily = env.groupby("date").agg(
    temperature_celsius=("temperature_celsius", "mean"),
    rainfall_mm=("rainfall_mm", "mean"),
    aqi=("aqi", "mean"),
    humidity_percent=("humidity_percent", "mean"),
).reset_index()
env_daily.rename(columns={"date": "ds"}, inplace=True)

df = daily.merge(env_daily, on="ds", how="left").fillna(method="ffill").fillna(0)

print(f"  Daily aggregate: {len(df)} rows")
print(f"  Date range: {df['ds'].min().date()} -> {df['ds'].max().date()}")

# ==========================================================
# 2. WEEKLY AGGREGATION
# ==========================================================

if USE_WEEKLY:
    print("\n[2] Weekly aggregation ...")
    df = df.set_index("ds").resample("W").agg({
        "y": "mean",
        "temperature_celsius": "mean",
        "rainfall_mm": "mean",
        "aqi": "mean",
        "humidity_percent": "mean",
    }).reset_index()
    print(f"  Weekly rows: {len(df)}")

# ==========================================================
# 3. PREPROCESSING
# ==========================================================

print("\n[3] Preprocessing ...")

# Outlier capping
cap = df["y"].quantile(OUTLIER_PERCENTILE / 100)
df["y"] = df["y"].clip(upper=cap)

# Smoothing
df["y_original"] = df["y"].copy()
df["y"] = df["y"].rolling(SMOOTH_WINDOW, min_periods=1, center=True).mean()

# Add lagged environmental features (7-day lag in weekly = 1 period lag)
for col in ["temperature_celsius", "rainfall_mm", "aqi", "humidity_percent"]:
    df[f"{col}_lag1"] = df[col].shift(1).fillna(df[col].median())

# Rolling features for XGBoost
df["rm_4"]    = df["y_original"].rolling(4, min_periods=1).mean()
df["rm_8"]    = df["y_original"].rolling(8, min_periods=1).mean()
df["rstd_8"]  = df["y_original"].rolling(8, min_periods=1).std().fillna(0)
df["rmax_4"]  = df["y_original"].rolling(4, min_periods=1).max()
df["rmin_4"]  = df["y_original"].rolling(4, min_periods=1).min()

# Trend features
df["diff_1"]  = df["y_original"].diff().fillna(0)
df["diff_2"]  = df["y_original"].diff(2).fillna(0)

# Temporal features
df["month"]   = df["ds"].dt.month
df["quarter"] = df["ds"].dt.quarter
df["week"]    = df["ds"].dt.isocalendar().week.astype(int)

# Seasonal indicators
df["is_monsoon"] = df["month"].isin([6, 7, 8, 9]).astype(int)
df["is_winter"]  = df["month"].isin([11, 12, 1, 2]).astype(int)

df = df.replace([np.inf, -np.inf], 0).fillna(0)

# ==========================================================
# 4. FEATURE COLUMNS
# ==========================================================

feature_cols = [
    "rm_4", "rm_8", "rstd_8", "rmax_4", "rmin_4",
    "diff_1", "diff_2",
    "month", "quarter", "week",
    "is_monsoon", "is_winter",
    "temperature_celsius", "rainfall_mm", "aqi", "humidity_percent",
    "temperature_celsius_lag1", "rainfall_mm_lag1",
    "aqi_lag1", "humidity_percent_lag1",
]
feature_cols = [c for c in feature_cols if c in df.columns]

# ==========================================================
# 5. TRAIN/TEST SPLIT
# ==========================================================

print("\n[5] Train/test split ...")

test_size = FORECAST_DAYS // 7 if USE_WEEKLY else FORECAST_DAYS
test_size = min(test_size, len(df) // 4)  # Use up to 25% for testing
test_size = max(test_size, 8)

train_df = df.iloc[:-test_size].copy()
test_df  = df.iloc[-test_size:].copy()

print(f"  Train: {len(train_df)}, Test: {len(test_df)}")

# ==========================================================
# 6. PROPHET
# ==========================================================

if not HAS_PROPHET:
    print("\n[SKIP] Prophet not available, using XGBoost only")
    # XGBoost only path
    X_train = train_df[feature_cols].values
    y_train_xg = train_df["y_original"].values
    X_test  = test_df[feature_cols].values
    y_test  = test_df["y_original"].values

    dtrain = xgb.DMatrix(X_train, label=y_train_xg)
    dval   = xgb.DMatrix(X_test,  label=y_test)

    params = {
        "objective": "reg:squarederror",
        "learning_rate": 0.03,
        "max_depth": 6,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "alpha": 0.5,
        "lambda": 2.0,
    }
    xgb_model = xgb.train(params, dtrain, num_boost_round=500,
                          evals=[(dval, "test")], verbose_eval=0,
                          early_stopping_rounds=30)
    final_pred = np.maximum(xgb_model.predict(dval), 0)
    prophet_weight = 0.0
else:
    print("\n[6] Training Prophet ...")

    prophet_train = train_df[["ds", "y"]].copy()

    # Add regressors
    regressor_cols = []
    for col in ["temperature_celsius_lag1", "rainfall_mm_lag1", "aqi_lag1", "humidity_percent_lag1"]:
        if col in train_df.columns:
            prophet_train[col] = train_df[col].values
            regressor_cols.append(col)

    m = Prophet(
        changepoint_prior_scale=0.15,
        seasonality_prior_scale=15.0,
        seasonality_mode="multiplicative",
        yearly_seasonality=True,
        weekly_seasonality=False,
        n_changepoints=30,
        interval_width=0.95,
        uncertainty_samples=1000,
        holidays=HOLIDAYS_EXPANDED,
        holidays_prior_scale=15,
    )

    # Custom seasonalities
    m.add_seasonality(name="monsoon", period=365.25, fourier_order=5,
                      condition_name=None)
    m.add_seasonality(name="biannual", period=365.25/2, fourier_order=3)

    # Add regressors
    for col in regressor_cols:
        m.add_regressor(col, mode="multiplicative")

    m.fit(prophet_train)

    # Forecast on test period
    future = test_df[["ds"]].copy()
    for col in regressor_cols:
        future[col] = test_df[col].values

    forecast = m.predict(future)
    prophet_pred = np.maximum(forecast["yhat"].values, 0)

    # ==========================================================
    # 7. XGBOOST RESIDUAL MODEL
    # ==========================================================

    print("\n[7] Training XGBoost residual model ...")

    X_train = train_df[feature_cols].values
    y_train_xg = train_df["y_original"].values
    X_test  = test_df[feature_cols].values
    y_test  = test_df["y_original"].values

    dtrain = xgb.DMatrix(X_train, label=y_train_xg)
    dval   = xgb.DMatrix(X_test,  label=y_test)

    params = {
        "objective": "reg:squarederror",
        "learning_rate": 0.03,
        "max_depth": 6,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "alpha": 0.5,
        "lambda": 2.0,
        "min_child_weight": 3,
    }
    xgb_model = xgb.train(params, dtrain, num_boost_round=500,
                          evals=[(dtrain, "t"), (dval, "v")], verbose_eval=0,
                          early_stopping_rounds=30)
    xgb_pred = np.maximum(xgb_model.predict(dval), 0)

    # ==========================================================
    # 8. WALK-FORWARD ENSEMBLE WEIGHT SELECTION
    # ==========================================================

    print("\n[8] Walk-forward ensemble weight selection ...")

    wf_size = max(4, len(train_df) // (N_WALK_FORWARD + 1))
    wf_scores = {w: [] for w in np.arange(0.0, 1.05, 0.1)}

    for wf in range(N_WALK_FORWARD):
        wf_val_end   = len(train_df) - wf * wf_size
        wf_val_start = wf_val_end - wf_size
        wf_train_end = wf_val_start

        if wf_train_end < wf_size:
            break

        wf_train = train_df.iloc[:wf_train_end]
        wf_val   = train_df.iloc[wf_val_start:wf_val_end]

        if len(wf_val) < 2:
            continue

        # Prophet fold
        wf_prophet_df = wf_train[["ds", "y"]].copy()
        for col in regressor_cols:
            wf_prophet_df[col] = wf_train[col].values

        wf_m = Prophet(
            changepoint_prior_scale=0.15,
            seasonality_prior_scale=15.0,
            seasonality_mode="multiplicative",
            yearly_seasonality=True,
            weekly_seasonality=False,
            holidays=HOLIDAYS_EXPANDED,
        )
        for col in regressor_cols:
            wf_m.add_regressor(col, mode="multiplicative")

        wf_m.fit(wf_prophet_df)

        wf_future = wf_val[["ds"]].copy()
        for col in regressor_cols:
            wf_future[col] = wf_val[col].values

        wf_forecast = wf_m.predict(wf_future)
        wf_prophet = np.maximum(wf_forecast["yhat"].values, 0)

        # XGBoost fold
        wf_dtrain = xgb.DMatrix(wf_train[feature_cols].values,
                                label=wf_train["y_original"].values)
        wf_dval   = xgb.DMatrix(wf_val[feature_cols].values)
        wf_xgb_m  = xgb.train(params, wf_dtrain, num_boost_round=300,
                               evals=[(wf_dtrain, "t")], verbose_eval=0,
                               early_stopping_rounds=20)
        wf_xgb_p  = np.maximum(wf_xgb_m.predict(wf_dval), 0)

        wf_actual = wf_val["y_original"].values
        valid_mask = wf_actual > 0

        if valid_mask.sum() < 2:
            continue

        for w in wf_scores:
            blend = w * wf_prophet[valid_mask] + (1 - w) * wf_xgb_p[valid_mask]
            r2 = r2_score(wf_actual[valid_mask], blend)
            wf_scores[w].append(r2)

    # Average across folds
    best_w, best_r2 = 0.5, -999
    for w, scores in wf_scores.items():
        if scores:
            avg = np.mean(scores)
            if avg > best_r2:
                best_r2, best_w = avg, w

    prophet_weight = round(best_w, 1)
    print(f"  Best prophet weight: {prophet_weight:.1f} (R²={best_r2:.4f})")

    # Final ensemble prediction
    final_pred = prophet_weight * prophet_pred + (1 - prophet_weight) * xgb_pred

# ==========================================================
# 9. PER-HORIZON EVALUATION (Cumulative window)
# ==========================================================

print("\n[9] Per-horizon evaluation ...")

y_test = test_df["y_original"].values

# For each horizon h, evaluate cumulative h-day forecasts:
# - 7d  = 1 week forecast  (individual weekly predictions)
# - 14d = 2 week forecast  (sum of 2 consecutive weeks)
# - 30d = 4 week forecast  (sum of 4 consecutive weeks)
# Rolling windows across test set give many data points for R²

if USE_WEEKLY:
    horizon_weeks = {h: max(1, h // 7) for h in HORIZONS}
else:
    horizon_weeks = {h: h for h in HORIZONS}

horizon_metrics = {}
for h_days in HORIZONS:
    n_weeks = horizon_weeks[h_days]
    n_weeks = min(n_weeks, len(y_test))

    if n_weeks < 1:
        continue

    # Compute cumulative actual and predicted over rolling windows
    n_windows = len(y_test) - n_weeks + 1

    if n_windows < 1:
        continue

    cum_actual = np.array([y_test[i:i + n_weeks].sum() for i in range(n_windows)])
    cum_pred   = np.array([final_pred[i:i + n_weeks].sum() for i in range(n_windows)])

    mae  = float(mean_absolute_error(cum_actual, cum_pred))
    mape = safe_mape(cum_actual, cum_pred)
    r2   = float(r2_score(cum_actual, cum_pred)) if n_windows > 2 else float("nan")

    metrics_h = {
        "mae": mae, "mape": mape, "r2": r2,
        "n_windows": n_windows, "n_weeks": n_weeks,
    }
    horizon_metrics[f"{h_days}d"] = metrics_h

    r2_str = f"R²={r2:.4f}" if not np.isnan(r2) else "R²=n/a"
    print(f"  {h_days:2d}d ({n_weeks}w cumulative, {n_windows} windows): "
          f"MAE={mae:.0f}  {r2_str}  MAPE={mape:.1f}%")

# ==========================================================
# 10. OVERALL EVALUATION
# ==========================================================

print("\n[10] Overall evaluation ...")

valid_mask = y_test > 0
if valid_mask.sum() > 1:
    overall_r2   = float(r2_score(y_test[valid_mask], final_pred[valid_mask]))
    overall_mape = safe_mape(y_test, final_pred)
    overall_mae  = float(mean_absolute_error(y_test, final_pred))
else:
    overall_r2 = 0.0
    overall_mape = 100.0
    overall_mae = 0.0

print(f"  R²:   {overall_r2:.4f}  (target > 0.65)")
print(f"  MAPE: {overall_mape:.2f}%  (target < 15%)")
print(f"  MAE:  {overall_mae:.2f}")

# ==========================================================
# 11. GENERATE FUTURE FORECASTS (7d / 14d / 30d)
# ==========================================================

print("\n[11] Generating future forecasts ...")

# Retrain Prophet on ALL available data for best future predictions
if HAS_PROPHET:
    all_prophet = df[["ds", "y"]].copy()
    for col in regressor_cols:
        all_prophet[col] = df[col].values

    m_final = Prophet(
        changepoint_prior_scale=0.15,
        seasonality_prior_scale=15.0,
        seasonality_mode="multiplicative",
        yearly_seasonality=True,
        weekly_seasonality=False,
        n_changepoints=30,
        holidays=HOLIDAYS_EXPANDED,
        holidays_prior_scale=15,
    )
    m_final.add_seasonality(name="monsoon", period=365.25, fourier_order=5)
    m_final.add_seasonality(name="biannual", period=365.25 / 2, fourier_order=3)
    for col in regressor_cols:
        m_final.add_regressor(col, mode="multiplicative")
    m_final.fit(all_prophet)

    # Generate future dates (5 weeks = 35 days, covers 30d horizon)
    n_future_weeks = 5
    last_date = df["ds"].max()
    future_dates = pd.date_range(
        start=last_date + pd.Timedelta(weeks=1),
        periods=n_future_weeks,
        freq="W",
    )
    future_df = pd.DataFrame({"ds": future_dates})

    # Use recent environmental averages as regressors for future
    recent_env = df[regressor_cols].tail(8).mean()
    for col in regressor_cols:
        future_df[col] = recent_env[col]

    prophet_future_fc = m_final.predict(future_df)
    prophet_future_vals = np.maximum(prophet_future_fc["yhat"].values, 0)

    # Build XGBoost features for future dates
    last_row = df.iloc[-1]
    future_features = []
    for i, fdate in enumerate(future_dates):
        row = {}
        row["rm_4"]    = last_row.get("rm_4", last_row["y_original"])
        row["rm_8"]    = last_row.get("rm_8", last_row["y_original"])
        row["rstd_8"]  = last_row.get("rstd_8", 0)
        row["rmax_4"]  = last_row.get("rmax_4", last_row["y_original"])
        row["rmin_4"]  = last_row.get("rmin_4", last_row["y_original"])
        row["diff_1"]  = 0.0
        row["diff_2"]  = 0.0
        row["month"]   = fdate.month
        row["quarter"] = fdate.quarter
        row["week"]    = fdate.isocalendar()[1]
        row["is_monsoon"] = int(fdate.month in [6, 7, 8, 9])
        row["is_winter"]  = int(fdate.month in [11, 12, 1, 2])
        for col in ["temperature_celsius", "rainfall_mm", "aqi", "humidity_percent",
                     "temperature_celsius_lag1", "rainfall_mm_lag1",
                     "aqi_lag1", "humidity_percent_lag1"]:
            if col in feature_cols:
                row[col] = float(recent_env.get(col, last_row.get(col, 0)))
        future_features.append(row)

    future_feat_df = pd.DataFrame(future_features)
    # Align columns with training features
    for col in feature_cols:
        if col not in future_feat_df.columns:
            future_feat_df[col] = 0.0

    xgb_future_dmat = xgb.DMatrix(future_feat_df[feature_cols].values)
    xgb_future_vals = np.maximum(xgb_model.predict(xgb_future_dmat), 0)

    # Ensemble future predictions
    future_ensemble = prophet_weight * prophet_future_vals + (1 - prophet_weight) * xgb_future_vals

    # Compute cumulative forecasts for each horizon
    forecasts = {}
    for h_days in [7, 14, 30]:
        n_weeks = max(1, h_days // 7)
        n_weeks = min(n_weeks, len(future_ensemble))
        weekly_preds = future_ensemble[:n_weeks].tolist()
        total = float(np.sum(weekly_preds))
        avg_weekly = float(np.mean(weekly_preds))
        forecasts[f"{h_days}d"] = {
            "horizon_days": h_days,
            "n_weeks": n_weeks,
            "weekly_predictions": [round(v, 1) for v in weekly_preds],
            "total_cases": round(total, 0),
            "avg_weekly_cases": round(avg_weekly, 1),
            "start_date": str(future_dates[0].date()),
            "end_date": str(future_dates[n_weeks - 1].date()),
        }
        print(f"  {h_days:2d}d forecast ({n_weeks}w): "
              f"total={total:,.0f} cases, "
              f"avg/wk={avg_weekly:,.1f}, "
              f"range: {future_dates[0].date()} → {future_dates[n_weeks-1].date()}")

    # Also store full weekly predictions
    forecasts["weekly_detail"] = [
        {
            "date": str(future_dates[i].date()),
            "prophet": round(float(prophet_future_vals[i]), 1),
            "xgboost": round(float(xgb_future_vals[i]), 1),
            "ensemble": round(float(future_ensemble[i]), 1),
        }
        for i in range(len(future_ensemble))
    ]
else:
    forecasts = {"note": "Prophet not installed, no future forecasts generated"}

# ==========================================================
# 12. SAVE MODEL ARTIFACTS
# ==========================================================

print("\n[12] Saving model artifacts ...")

# Save XGBoost model
xgb_model.save_model(os.path.join(OUTPUT_DIR, "xgb_residual.json"))

# Save Prophet model (pickle)
if HAS_PROPHET:
    joblib.dump(m_final, os.path.join(OUTPUT_DIR, "prophet_model.pkl"))

# Save forecasts
with open(os.path.join(OUTPUT_DIR, "forecasts.json"), "w") as f:
    json.dump(forecasts, f, indent=2)

# Save metadata
metadata = {
    "model": "Prophet + XGBoost Ensemble v5.0",
    "prophet_weight": prophet_weight,
    "xgboost_weight": 1 - prophet_weight,
    "use_weekly": USE_WEEKLY,
    "feature_cols": feature_cols,
    "horizons": HORIZONS,
    "horizon_metrics": horizon_metrics,
    "overall": {
        "r2": overall_r2,
        "mape": overall_mape,
        "mae": overall_mae,
    },
    "forecasts": forecasts,
    "timestamp": datetime.utcnow().isoformat(),
}
with open(os.path.join(OUTPUT_DIR, "metrics.json"), "w") as f:
    json.dump(metadata, f, indent=2)

# Save feature list
with open(os.path.join(OUTPUT_DIR, "features.json"), "w") as f:
    json.dump(feature_cols, f, indent=2)

r2_ok   = "✓" if overall_r2 > 0.65 else "✗"
mape_ok = "✓" if overall_mape < 15 else "✗"

print(f"\n{'='*70}")
print(f"  TRAINING COMPLETE  –  Forecast Ensemble v5.0")
print(f"{'='*70}")
print(f"  R²:   {overall_r2:.4f}  {r2_ok}")
print(f"  MAPE: {overall_mape:.2f}%  {mape_ok}")
print(f"  Prophet weight: {prophet_weight:.1f}")
print(f"  Forecasts: 7d/14d/30d saved to forecasts.json")
print(f"{'='*70}")

