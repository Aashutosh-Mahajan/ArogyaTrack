#!/usr/bin/env python3
"""
Test Isolation Forest Prod (XGBoost Outbreak Detection)
Tests the trained outbreak detection model on test data
"""

import os
import numpy as np
import pandas as pd
import joblib
import json
import matplotlib.pyplot as plt
from sklearn.metrics import (
    roc_auc_score, classification_report, f1_score,
    precision_score, recall_score, confusion_matrix
)
import warnings
warnings.filterwarnings("ignore")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
MODEL_DIR = os.path.join(BASE_DIR, "saved_models", "isolation_forest_prod")
OUTPUT_DIR = os.path.join(BASE_DIR, "test_results", "isolation_forest_prod")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("="*70)
print("ISOLATION FOREST PROD (XGBOOST OUTBREAK) MODEL TESTING")
print("="*70)

# ==========================================================
# LOAD MODEL
# ==========================================================

print("\nLoading model...")
model = joblib.load(os.path.join(MODEL_DIR, "xgboost_model.pkl"))
scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))

with open(os.path.join(MODEL_DIR, "features.json")) as f:
    FEATURES = json.load(f)

# Load metrics for optimal threshold
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

env = pd.read_csv(
    os.path.join(DATA_DIR, "environmental_data.csv"),
    parse_dates=['date']
)

regions = pd.read_csv(
    os.path.join(DATA_DIR, "regions.csv")
)

labels = pd.read_csv(
    os.path.join(DATA_DIR, "outbreak_labels.csv"),
    parse_dates=['date']
)

print(f"Loaded {len(surv)} surveillance records")
print(f"Loaded {len(labels)} labeled outbreak records")

# ==========================================================
# FEATURE ENGINEERING (Matching Training)
# ==========================================================

print("\nEngineering features...")

# Merge regions
surv = surv.merge(regions, on='region_id', how='left')

# Sort for rolling operations
surv = surv.sort_values(['region_id','disease_id','date'])

# Per-capita calculations
surv['per_capita_cases'] = surv['case_count'] / (surv['population'] + 1)
surv['case_fatality_rate'] = surv['death_count'] / (surv['case_count'] + 1)

# Lag features
g = surv.groupby(['region_id','disease_id'])
for lag in [7, 14]:
    surv[f'cases_lag_{lag}'] = g['case_count'].shift(lag).fillna(0)
    surv[f'deaths_lag_{lag}'] = g['death_count'].shift(lag).fillna(0)
    surv[f'severity_lag_{lag}'] = g['severity_avg'].shift(lag).fillna(0)

# Rolling features
for window in [7, 14, 21]:
    surv[f'cases_rm_{window}'] = g['case_count'].transform(
        lambda x: x.rolling(window, min_periods=1).mean()
    )
    
surv['cases_rstd_7'] = g['case_count'].transform(
    lambda x: x.rolling(7, min_periods=1).std()
).fillna(0)

surv['cases_rstd_14'] = g['case_count'].transform(
    lambda x: x.rolling(14, min_periods=1).std()
).fillna(0)

surv['cases_rmax_7'] = g['case_count'].transform(
    lambda x: x.rolling(7, min_periods=1).max()
)

surv['cases_rmax_14'] = g['case_count'].transform(
    lambda x: x.rolling(14, min_periods=1).max()
)

# Growth rates
surv['growth_7'] = g['case_count'].pct_change(7).fillna(0).replace([np.inf, -np.inf], 0)
surv['growth_14'] = g['case_count'].pct_change(14).fillna(0).replace([np.inf, -np.inf], 0)

# Deviations
surv['deviation_7'] = (surv['case_count'] - surv['cases_rm_7']) / (surv['cases_rstd_7'] + 1)
surv['deviation_14'] = (surv['case_count'] - surv['cases_rm_14']) / (surv['cases_rstd_14'] + 1)

# Z-score
mean_cases = g['case_count'].transform('mean')
std_cases = g['case_count'].transform('std').fillna(1)
surv['cases_zscore'] = (surv['case_count'] - mean_cases) / std_cases

# Spike detection
surv['is_spike'] = (surv['cases_zscore'] > 2).astype(int)

# Case density
surv['case_density'] = (surv['case_count'] / (surv['population'] + 1)) * 100000

# Infrastructure
surv['cases_per_hospital'] = surv['case_count'] / (surv['hospital_count'] + 1)
surv['sanitation_weighted'] = surv['case_count'] * (10 - surv['sanitation_index']) / 10

# Environmental features
env = env.sort_values(['region_id', 'date'])
env_g = env.groupby('region_id')

env['temp_rm_7'] = env_g['temperature_celsius'].transform(
    lambda x: x.rolling(7, min_periods=1).mean()
)
env['rain_rm_7'] = env_g['rainfall_mm'].transform(
    lambda x: x.rolling(7, min_periods=1).mean()
)
env['aqi_rm_7'] = env_g['aqi'].transform(
    lambda x: x.rolling(7, min_periods=1).mean()
)

env['env_risk'] = ((env['temperature_celsius'] > 30).astype(int) +
                   (env['rainfall_mm'] > 50).astype(int) +
                   (env['aqi'] > 150).astype(int))

# Aggregate surveillance to region-date level
surv_agg = surv.groupby(['region_id', 'date']).agg({
    'case_count': 'sum',
    'death_count': 'sum',
    'per_capita_cases': 'mean',
    'case_fatality_rate': 'mean',
    'cases_lag_7': 'sum',
    'cases_lag_14': 'sum',
    'deaths_lag_7': 'sum',
    'deaths_lag_14': 'sum',
    'severity_lag_7': 'mean',
    'severity_lag_14': 'mean',
    'cases_rm_7': 'mean',
    'cases_rm_14': 'mean',
    'cases_rm_21': 'mean',
    'cases_rstd_7': 'mean',
    'cases_rstd_14': 'mean',
    'cases_rmax_7': 'max',
    'cases_rmax_14': 'max',
    'growth_7': 'mean',
    'growth_14': 'mean',
    'deviation_7': 'mean',
    'deviation_14': 'mean',
    'cases_zscore': 'max',
    'is_spike': 'max',
    'case_density': 'mean',
    'cases_per_hospital': 'mean',
    'sanitation_weighted': 'sum'
}).reset_index()

# Merge with environmental and labels
df = labels.merge(surv_agg, on=['region_id', 'date'], how='left')
df = df.merge(env[['region_id', 'date', 'temp_rm_7', 'rain_rm_7', 'aqi_rm_7', 'env_risk']],
              on=['region_id', 'date'], how='left')

df = df.fillna(0).replace([np.inf, -np.inf], 0)

print(f"\nFinal dataset: {len(df)} records")

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
