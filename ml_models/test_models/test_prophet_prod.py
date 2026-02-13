#!/usr/bin/env python3
"""
Test Prophet + XGBoost Ensemble Forecast Model
Tests the trained final_ensemble_model on test data
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
import matplotlib.pyplot as plt
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import warnings
warnings.filterwarnings("ignore")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
MODEL_DIR = os.path.join(BASE_DIR, "saved_models", "final_ensemble_model")
OUTPUT_DIR = os.path.join(BASE_DIR, "test_results", "forecast_ensemble")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("="*70)
print("PROPHET + XGBOOST ENSEMBLE FORECAST MODEL TESTING")
print("="*70)

# ==========================================================
# LOAD MODELS AND CONFIG
# ==========================================================

print("\nLoading models...")
prophet_model = joblib.load(os.path.join(MODEL_DIR, "prophet_model.pkl"))

# Load XGBoost model using xgb.Booster
xgb_model = xgb.Booster()
xgb_model.load_model(os.path.join(MODEL_DIR, "xgb_model.bst"))

# Load configuration
with open(os.path.join(MODEL_DIR, "config.json")) as f:
    config = json.load(f)

BLEND_WEIGHT_PROPHET = config.get("blend_weight_prophet", 0.05)
BLEND_WEIGHT_XGB = 1 - BLEND_WEIGHT_PROPHET
LOG_TRANSFORM = config.get("log_transform", False)
SMOOTH_WINDOW = config.get("smooth_window", 5)

print(f"Blend weights: Prophet={BLEND_WEIGHT_PROPHET:.2f}, XGBoost={BLEND_WEIGHT_XGB:.2f}")
print(f"Log transform: {LOG_TRANSFORM}")
print(f"Smoothing window: {SMOOTH_WINDOW}")

# ==========================================================
# LOAD DATA
# ==========================================================

print("\nLoading data...")
surv = pd.read_csv(
    os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
    usecols=['date','case_count'],
    parse_dates=['date']
)

env = pd.read_csv(
    os.path.join(DATA_DIR, "environmental_data.csv"),
    usecols=['date','temperature_celsius','rainfall_mm','aqi'],
    parse_dates=['date']
)

# Aggregate national daily
daily_cases = surv.groupby('date')['case_count'].sum().reset_index()
daily_env = env.groupby('date').mean().reset_index()

df = daily_cases.merge(daily_env, on='date', how='left')

# Rename for Prophet
df.columns = ['ds','y','temperature_celsius','rainfall_mm','aqi']
df['ds'] = pd.to_datetime(df['ds'])
df = df.sort_values('ds')

# Fill missing values
df[['temperature_celsius','rainfall_mm','aqi']] = (
    df[['temperature_celsius','rainfall_mm','aqi']]
    .fillna(method='ffill')
    .fillna(method='bfill')
    .fillna(0)
)

print(f"Loaded {len(df)} daily records")

# ==========================================================
# APPLY SMOOTHING (Matching Training)
# ==========================================================

df['y_raw'] = df['y'].copy()
df['y'] = df['y'].rolling(window=SMOOTH_WINDOW, min_periods=1).mean()

# ==========================================================
# SPLIT TEST SET (Last 20%)
# ==========================================================

test_size = int(len(df) * 0.2)
df_test = df.iloc[-test_size:].copy()

print(f"Testing on last {len(df_test)} records (20%)")

# ==========================================================
# PROPHET FORECAST
# ==========================================================

print("\nGenerating Prophet forecast...")
prophet_input = df_test[['ds','temperature_celsius','rainfall_mm','aqi']].copy()
prophet_input['month'] = prophet_input['ds'].dt.month
forecast = prophet_model.predict(prophet_input)

prophet_pred = forecast['yhat'].values

# ==========================================================
# XGBOOST FEATURE ENGINEERING (Matching Training)
# ==========================================================

# ==========================================================
# XGBOOST FEATURE ENGINEERING (Matching Training)
# ==========================================================

print("Engineering XGBoost features...")

# Use full dataset for feature engineering, then extract test set
df_full = df.copy()

# Rolling features
for window in [7, 14, 21]:
    df_full[f'rolling_mean_{window}'] = df_full['y'].rolling(window, min_periods=1).mean()
    df_full[f'rolling_std_{window}'] = df_full['y'].rolling(window, min_periods=1).std().fillna(0)

# Lag features
for lag in [1, 7, 14]:
    df_full[f'lag_{lag}'] = df_full['y'].shift(lag).fillna(0)

# Differences
df_full['diff_1'] = df_full['y'].diff().fillna(0)
df_full['diff_7'] = df_full['y'].diff(7).fillna(0)

# Day of week and month
df_full['day_of_week'] = df_full['ds'].dt.dayofweek
df_full['month'] = df_full['ds'].dt.month

# Environmental features
df_full['temp_rolling_7'] = df_full['temperature_celsius'].rolling(7, min_periods=1).mean()
df_full['rain_rolling_7'] = df_full['rainfall_mm'].rolling(7, min_periods=1).mean()
df_full['aqi_rolling_7'] = df_full['aqi'].rolling(7, min_periods=1).mean()

# Interactions
df_full['temp_rain'] = df_full['temperature_celsius'] * df_full['rainfall_mm']
df_full['temp_cases'] = df_full['temperature_celsius'] * df_full['y']
df_full['rain_cases'] = df_full['rainfall_mm'] * df_full['y']

# Prophet forecast as feature
df_full['prophet_forecast'] = np.nan
df_full.iloc[-test_size:, df_full.columns.get_loc('prophet_forecast')] = prophet_pred

# Fill NaN in prophet forecast for non-test rows (won't be used)
df_full['prophet_forecast'] = df_full['prophet_forecast'].fillna(0)

# Extract test features
xgb_features = [
    'rolling_mean_7', 'rolling_mean_14', 'rolling_mean_21',
    'rolling_std_7', 'rolling_std_14', 'rolling_std_21',
    'lag_1', 'lag_7', 'lag_14',
    'diff_1', 'diff_7',
    'day_of_week', 'month',
    'temperature_celsius', 'rainfall_mm', 'aqi',
    'temp_rolling_7', 'rain_rolling_7', 'aqi_rolling_7',
    'temp_rain', 'temp_cases', 'rain_cases',
    'prophet_forecast'
]

X_test = df_full.iloc[-test_size:][xgb_features]
y_test = df_test['y'].values

# ==========================================================
# XGBOOST PREDICTION
# ==========================================================

print("Generating XGBoost predictions...")
import xgboost as xgb
dtest = xgb.DMatrix(X_test)
xgb_pred = xgb_model.predict(dtest)

# ==========================================================
# ENSEMBLE BLENDING
# ==========================================================

print("Blending predictions...")
ensemble_pred = BLEND_WEIGHT_PROPHET * prophet_pred + BLEND_WEIGHT_XGB * xgb_pred

# ==========================================================
# EVALUATION
# ==========================================================

print("\n" + "="*70)
print("TEST RESULTS")
print("="*70)

mae = mean_absolute_error(y_test, ensemble_pred)
rmse = np.sqrt(mean_squared_error(y_test, ensemble_pred))
r2 = r2_score(y_test, ensemble_pred)

print(f"\nEnsemble Metrics (Test Set):")
print(f"  MAE:  {mae:.2f}")
print(f"  RMSE: {rmse:.2f}")
print(f"  R²:   {r2:.4f}")

# Individual model metrics
prophet_mae = mean_absolute_error(y_test, prophet_pred)
prophet_r2 = r2_score(y_test, prophet_pred)
xgb_mae = mean_absolute_error(y_test, xgb_pred)
xgb_r2 = r2_score(y_test, xgb_pred)

print(f"\nProphet alone:")
print(f"  MAE:  {prophet_mae:.2f}")
print(f"  R²:   {prophet_r2:.4f}")

print(f"\nXGBoost alone:")
print(f"  MAE:  {xgb_mae:.2f}")
print(f"  R²:   {xgb_r2:.4f}")

# Save test results
test_results = {
    'test_size': len(df_test),
    'ensemble_mae': float(mae),
    'ensemble_rmse': float(rmse),
    'ensemble_r2': float(r2),
    'prophet_mae': float(prophet_mae),
    'prophet_r2': float(prophet_r2),
    'xgb_mae': float(xgb_mae),
    'xgb_r2': float(xgb_r2),
    'blend_weight_prophet': BLEND_WEIGHT_PROPHET,
    'blend_weight_xgb': BLEND_WEIGHT_XGB
}

with open(os.path.join(OUTPUT_DIR, "test_metrics.json"), "w") as f:
    json.dump(test_results, f, indent=2)

# ==========================================================
# VISUALIZATION
# ==========================================================

print("\nGenerating plots...")

plt.figure(figsize=(14, 6))
plt.plot(df_test['ds'], y_test, label='Actual', linewidth=2, color='black')
plt.plot(df_test['ds'], ensemble_pred, label='Ensemble', linewidth=2, color='blue', alpha=0.7)
plt.plot(df_test['ds'], prophet_pred, label='Prophet', linewidth=1, color='red', alpha=0.5)
plt.plot(df_test['ds'], xgb_pred, label='XGBoost', linewidth=1, color='green', alpha=0.5)

plt.fill_between(
    df_test['ds'],
    forecast['yhat_lower'].values,
    forecast['yhat_upper'].values,
    alpha=0.1,
    color='red',
    label='Prophet 95% CI'
)

plt.xlabel('Date')
plt.ylabel('Case Count')
plt.title(f'Ensemble Forecast Test Results (R²={r2:.4f})')
plt.legend()
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "forecast_test_plot.png"), dpi=150)
plt.close()

print(f"\nPlots saved to {OUTPUT_DIR}")
print("\n" + "="*70)
print("TESTING COMPLETE")
print("="*70)
