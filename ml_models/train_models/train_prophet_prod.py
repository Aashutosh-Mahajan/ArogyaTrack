#!/usr/bin/env python3
"""
train_prophet_prod.py
Production-ready Prophet forecasting model with progress bars.
Compatible with older scikit-learn versions.
"""

import os
import json
from datetime import datetime
import numpy as np
import pandas as pd
from prophet import Prophet
from prophet.diagnostics import cross_validation, performance_metrics
import joblib
from sklearn.metrics import mean_absolute_error, mean_squared_error
from tqdm import tqdm
import warnings
warnings.filterwarnings("ignore")

# ==========================================================
# CONFIG
# ==========================================================

class Config:
    DATA_DIR = r"D:\python\ml_models\ml_datasets_large_scale"
    OUTPUT_DIR = r"D:\python\ml_models\saved_models\prophet_prod"
    AGGREGATE_BY_REGION = None
    FORECAST_HORIZON_DAYS = 30
    CV_INITIAL = "365 days"
    CV_PERIOD = "30 days"
    CV_HORIZON = "90 days"
    SEED = 42

os.makedirs(Config.OUTPUT_DIR, exist_ok=True)
np.random.seed(Config.SEED)

# ==========================================================
# LOAD DATA
# ==========================================================

print("\nLoading datasets...")

with tqdm(total=2, desc="Loading Data") as pbar:
    surv = pd.read_csv(
        os.path.join(Config.DATA_DIR, "disease_surveillance_historical.csv"),
        usecols=['date','region_id','case_count'],
        parse_dates=['date'],
        low_memory=False
    )
    pbar.update(1)

    env = pd.read_csv(
        os.path.join(Config.DATA_DIR, "environmental_data.csv"),
        usecols=['date','region_id','temperature_celsius','rainfall_mm','aqi'],
        parse_dates=['date'],
        low_memory=False
    )
    pbar.update(1)

# ==========================================================
# AGGREGATION
# ==========================================================

print("Aggregating data...")

with tqdm(total=2, desc="Aggregation") as pbar:

    if Config.AGGREGATE_BY_REGION is None:
        daily = surv.groupby('date', as_index=False)['case_count'].sum()
        pbar.update(1)

        env_daily = env.groupby('date', as_index=False).agg({
            'temperature_celsius':'mean',
            'rainfall_mm':'mean',
            'aqi':'mean'
        })
        pbar.update(1)

    else:
        surv = surv[surv['region_id'] == Config.AGGREGATE_BY_REGION]
        daily = surv.groupby('date', as_index=False)['case_count'].sum()
        pbar.update(1)

        env_daily = env[env['region_id'] == Config.AGGREGATE_BY_REGION] \
            .groupby('date', as_index=False).agg({
                'temperature_celsius':'mean',
                'rainfall_mm':'mean',
                'aqi':'mean'
            })
        pbar.update(1)

df = daily.merge(env_daily, on='date', how='left') \
          .rename(columns={'date':'ds','case_count':'y'})

df['ds'] = pd.to_datetime(df['ds'])
df = df.set_index('ds').asfreq('D').reset_index()

df[['temperature_celsius','rainfall_mm','aqi']] = \
    df[['temperature_celsius','rainfall_mm','aqi']] \
    .fillna(method='ffill') \
    .fillna(method='bfill') \
    .fillna(0)

df['y'] = df['y'].fillna(0).astype(float)

# ==========================================================
# TRAIN / HOLDOUT SPLIT
# ==========================================================

train_end = df['ds'].max() - pd.Timedelta(days=Config.FORECAST_HORIZON_DAYS)
train_df = df[df['ds'] <= train_end].copy()
holdout_df = df[df['ds'] > train_end].copy()

print(f"Training days: {len(train_df)}, Holdout days: {len(holdout_df)}")

# ==========================================================
# BUILD MODEL
# ==========================================================

m = Prophet(
    yearly_seasonality=True,
    weekly_seasonality=True,
    daily_seasonality=False,
    changepoint_prior_scale=0.05
)

m.add_regressor('temperature_celsius', standardize=True)
m.add_regressor('rainfall_mm', standardize=True)
m.add_regressor('aqi', standardize=True)

# ==========================================================
# TRAIN MODEL
# ==========================================================

print("\nTraining Prophet model...")

train_for_fit = train_df[['ds','y','temperature_celsius','rainfall_mm','aqi']]

with tqdm(total=1, desc="Model Training") as pbar:
    m.fit(train_for_fit)
    pbar.update(1)

joblib.dump(m, os.path.join(Config.OUTPUT_DIR, "prophet_model.pkl"))

# ==========================================================
# FORECAST
# ==========================================================

print("Generating forecast...")

future = m.make_future_dataframe(periods=Config.FORECAST_HORIZON_DAYS, freq='D')

last_env = df[['ds','temperature_celsius','rainfall_mm','aqi']] \
    .set_index('ds') \
    .reindex(future['ds']) \
    .fillna(method='ffill') \
    .fillna(method='bfill') \
    .reset_index()

future['temperature_celsius'] = last_env['temperature_celsius'].values
future['rainfall_mm'] = last_env['rainfall_mm'].values
future['aqi'] = last_env['aqi'].values

with tqdm(total=1, desc="Forecasting") as pbar:
    forecast = m.predict(future)
    pbar.update(1)

forecast[['ds','yhat','yhat_lower','yhat_upper']] \
    .to_csv(os.path.join(Config.OUTPUT_DIR,"forecast.csv"), index=False)

# ==========================================================
# EVALUATION (FIXED FOR ALL SKLEARN VERSIONS)
# ==========================================================

if len(holdout_df) > 0:
    preds = forecast.set_index('ds').loc[holdout_df['ds'],'yhat'].values
    mae = mean_absolute_error(holdout_df['y'].values, preds)
    rmse = np.sqrt(mean_squared_error(holdout_df['y'].values, preds))
else:
    mae, rmse = None, None

metrics = {
    'mae': float(mae) if mae is not None else None,
    'rmse': float(rmse) if rmse is not None else None
}

with open(os.path.join(Config.OUTPUT_DIR,"metrics.json"), "w") as f:
    json.dump(metrics, f, indent=2)

# ==========================================================
# OPTIONAL CROSS VALIDATION
# ==========================================================

history_days = (df['ds'].max() - df['ds'].min()).days

if history_days >= 365:
    print("\nRunning Prophet Cross Validation...")

    with tqdm(total=1, desc="Cross Validation") as pbar:
        df_cv = cross_validation(
            m,
            initial=Config.CV_INITIAL,
            period=Config.CV_PERIOD,
            horizon=Config.CV_HORIZON
        )
        pbar.update(1)

    perf = performance_metrics(df_cv)
    perf[['horizon','mape','rmse','mae']] \
        .to_csv(os.path.join(Config.OUTPUT_DIR,"cv_performance.csv"), index=False)

# ==========================================================
# SAVE METADATA
# ==========================================================

meta = {
    'model': 'Prophet',
    'timestamp_utc': datetime.utcnow().isoformat(),
    'forecast_horizon_days': Config.FORECAST_HORIZON_DAYS
}

with open(os.path.join(Config.OUTPUT_DIR,"metadata.json"), "w") as f:
    json.dump(meta, f, indent=2)

print("\nProphet training complete.")
print("Artifacts saved at:", Config.OUTPUT_DIR)
