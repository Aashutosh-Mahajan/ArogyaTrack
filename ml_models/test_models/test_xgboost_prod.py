#!/usr/bin/env python3
"""
Test XGBoost Outbreak V3 Model
Tests the trained xgboost_outbreak_v3 model on test data
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
import matplotlib.pyplot as plt
from sklearn.metrics import (
    roc_auc_score, classification_report, f1_score,
    precision_score, recall_score, confusion_matrix
)
import warnings
warnings.filterwarnings("ignore")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
MODEL_DIR = os.path.join(BASE_DIR, "saved_models", "xgboost_outbreak_v3")
OUTPUT_DIR = os.path.join(BASE_DIR, "test_results", "xgboost_outbreak_v3")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("="*70)
print("XGBOOST OUTBREAK V3 MODEL TESTING")
print("="*70)

# ==========================================================
# LOAD MODEL
# ==========================================================

print("\nLoading model...")
model = joblib.load(os.path.join(MODEL_DIR, "xgboost_model.pkl"))
scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))

with open(os.path.join(MODEL_DIR, "features.json")) as f:
    FEATURES = json.load(f)

# Load optimal threshold
with open(os.path.join(MODEL_DIR, "metrics.json")) as f:
    metrics = json.load(f)
    opt_threshold = metrics.get("optimal_threshold", 0.5)

print(f"Loaded model with {len(FEATURES)} features")
print(f"Optimal threshold: {opt_threshold:.4f}")

# ==========================================================
# LOAD DATA
# ==========================================================

print("\nLoading data...")
surv = pd.read_csv(
    os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
    parse_dates=['date']
)

regions = pd.read_csv(
    os.path.join(DATA_DIR, "regions.csv"),
    usecols=['region_id', 'population']
)

env = pd.read_csv(
    os.path.join(DATA_DIR, "environmental_data.csv"),
    parse_dates=['date']
)

labels = pd.read_csv(
    os.path.join(DATA_DIR, "outbreak_labels.csv"),
    parse_dates=['date']
)

print(f"Loaded {len(surv)} surveillance records")
print(f"Loaded {len(labels)} labeled records")

# ==========================================================
# REBUILD FEATURES (Matching Training)
# ==========================================================

print("\nEngineering features...")

# Merge regions for population
surv = surv.merge(regions, on='region_id', how='left')

# Sort for rolling windows
surv = surv.sort_values(['region_id', 'disease_id', 'date'])

# Per-capita calculations
surv['per_capita_cases'] = surv['case_count'] / (surv['population'] + 1)
surv['per_capita_deaths'] = surv['death_count'] / (surv['population'] + 1)
surv['case_fatality_rate'] = surv['death_count'] / (surv['case_count'] + 1)

# Rolling features for cases
for window in [7, 14, 21, 28]:
    surv[f'cases_rolling_{window}d'] = surv.groupby(['region_id', 'disease_id'])['case_count'] \
        .transform(lambda x: x.rolling(window, min_periods=1).mean())
    
surv['cases_rolling_std_14d'] = surv.groupby(['region_id', 'disease_id'])['case_count'] \
    .transform(lambda x: x.rolling(14, min_periods=1).std()).fillna(0)

surv['cases_rolling_max_28d'] = surv.groupby(['region_id', 'disease_id'])['case_count'] \
    .transform(lambda x: x.rolling(28, min_periods=1).max())

# Growth and acceleration
surv['cases_growth_rate'] = surv.groupby(['region_id', 'disease_id'])['case_count'].pct_change().fillna(0)
surv['cases_acceleration'] = surv.groupby(['region_id', 'disease_id'])['cases_growth_rate'].diff().fillna(0)

# Z-score and deviations
mean_cases = surv.groupby(['region_id', 'disease_id'])['case_count'].transform('mean')
std_cases = surv.groupby(['region_id', 'disease_id'])['case_count'].transform('std').fillna(1)
surv['cases_zscore'] = (surv['case_count'] - mean_cases) / std_cases

surv['deviation_from_7d_avg'] = surv['case_count'] - surv['cases_rolling_7d']
surv['deviation_from_14d_avg'] = surv['case_count'] - surv['cases_rolling_14d']

# Spike detection
surv['is_spike'] = (surv['cases_zscore'] > 2).astype(int)

# Severity features
surv['severity_index'] = surv['case_count'] * surv['case_fatality_rate']
surv['death_growth_rate'] = surv.groupby(['region_id', 'disease_id'])['death_count'].pct_change().fillna(0)

# Lag features
for lag in [7, 14, 21]:
    surv[f'cases_lag_{lag}d'] = surv.groupby(['region_id', 'disease_id'])['case_count'].shift(lag).fillna(0)

# Environmental features
env = env.sort_values(['region_id', 'date'])

for window in [7, 14]:
    env[f'temp_rolling_{window}d'] = env.groupby('region_id')['temperature_celsius'] \
        .transform(lambda x: x.rolling(window, min_periods=1).mean())
    env[f'rainfall_rolling_{window}d'] = env.groupby('region_id')['rainfall_mm'] \
        .transform(lambda x: x.rolling(window, min_periods=1).mean())
    env[f'aqi_rolling_{window}d'] = env.groupby('region_id')['aqi'] \
        .transform(lambda x: x.rolling(window, min_periods=1).mean())

env['environmental_risk'] = (env['temperature_celsius'] / 50 + 
                             env['rainfall_mm'] / 300 + 
                             env['aqi'] / 500) / 3

# Aggregate to region-date level
surv_agg = surv.groupby(['region_id', 'date']).agg({
    'case_count': 'sum',
    'death_count': 'sum',
    'per_capita_cases': 'mean',
    'per_capita_deaths': 'mean',
    'case_fatality_rate': 'mean',
    'cases_rolling_7d': 'mean',
    'cases_rolling_14d': 'mean',
    'cases_rolling_21d': 'mean',
    'cases_rolling_28d': 'mean',
    'cases_rolling_std_14d': 'mean',
    'cases_rolling_max_28d': 'max',
    'cases_growth_rate': 'mean',
    'cases_acceleration': 'mean',
    'cases_zscore': 'max',
    'deviation_from_7d_avg': 'mean',
    'deviation_from_14d_avg': 'mean',
    'is_spike': 'max',
    'severity_index': 'sum',
    'death_growth_rate': 'mean',
    'cases_lag_7d': 'sum',
    'cases_lag_14d': 'sum',
    'cases_lag_21d': 'sum'
}).reset_index()

# Merge with environmental and labels
df = labels.merge(surv_agg, on=['region_id', 'date'], how='left')
df = df.merge(env[['region_id', 'date', 'temp_rolling_7d', 'temp_rolling_14d',
                    'rainfall_rolling_7d', 'rainfall_rolling_14d',
                    'aqi_rolling_7d', 'aqi_rolling_14d', 'environmental_risk']],
              on=['region_id', 'date'], how='left')

df = df.fillna(0)

print(f"\nFinal dataset: {len(df)} records with {len(FEATURES)} features")

# Split into test set (last 20%)
df = df.sort_values('date')
test_size = int(len(df) * 0.2)
df_test = df.iloc[-test_size:].copy()

print(f"Testing on {len(df_test)} records (last 20%)")

X_test = df_test[FEATURES].astype(float)
y_test = df_test['outbreak_occurred'].astype(int)

print(f"Test set outbreak rate: {y_test.mean():.2%}")

# ==========================================================
# PREDICT
# ==========================================================

print("\nMaking predictions...")
X_test_scaled = scaler.transform(X_test)
pred_probs = model.predict_proba(X_test_scaled)[:, 1]

# Use optimal threshold
preds = (pred_probs >= opt_threshold).astype(int)

# ==========================================================
# METRICS
# ==========================================================

print("\n" + "="*70)
print("TEST RESULTS")
print("="*70)

auc = roc_auc_score(y_test, pred_probs)
f1 = f1_score(y_test, preds)
precision = precision_score(y_test, preds)
recall = recall_score(y_test, preds)

print(f"\nROC-AUC Score: {auc:.4f}")
print(f"F1 Score: {f1:.4f}")
print(f"Precision: {precision:.4f}")
print(f"Recall: {recall:.4f}")

print("\nClassification Report:")
print(classification_report(y_test, preds))

print("\nConfusion Matrix:")
cm = confusion_matrix(y_test, preds)
print(cm)

# Save test results
test_results = {
    'test_size': len(df_test),
    'outbreak_rate': float(y_test.mean()),
    'roc_auc': float(auc),
    'f1_score': float(f1),
    'precision': float(precision),
    'recall': float(recall),
    'optimal_threshold': float(opt_threshold)
}

with open(os.path.join(OUTPUT_DIR, "test_metrics.json"), "w") as f:
    json.dump(test_results, f, indent=2)

print(f"\nTest results saved to {OUTPUT_DIR}")
print("\n" + "="*70)
print("TESTING COMPLETE")
print("="*70)
