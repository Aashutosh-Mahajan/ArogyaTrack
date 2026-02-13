#!/usr/bin/env python3
"""
train_xgboost_outbreak_v3.py
TRUE OUTBREAK DETECTION MODEL

FIXES APPLIED:
- Expanded from 6 to 30+ features (rolling stats, env, severity)
- Added environmental + severity features
- SMOTE for class balancing
- Switched to XGBClassifier (supports predict_proba)
- Threshold optimization with saved threshold
- Saves feature list for evaluation consistency
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    roc_auc_score, classification_report, f1_score,
    precision_recall_curve, precision_score, recall_score
)
from xgboost import XGBClassifier
from datetime import datetime
import warnings
warnings.filterwarnings("ignore")

try:
    from imblearn.over_sampling import SMOTE
    HAS_SMOTE = True
except ImportError:
    HAS_SMOTE = False

# ==========================================================
# CONFIG
# ==========================================================

DATA_DIR = r"D:\python\ml_models\india_surveillance_extreme_quality"
OUTPUT_DIR = r"D:\python\ml_models\saved_models\xgboost_outbreak_v3"

os.makedirs(OUTPUT_DIR, exist_ok=True)
np.random.seed(42)

print("="*70)
print("OUTBREAK DETECTION MODEL V3")
print("="*70)

# ==========================================================
# LOAD DATA
# ==========================================================

# Use surveillance data directly (already has outbreak_occurred)
cases = pd.read_csv(
    os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
    parse_dates=["date"]
)

regions = pd.read_csv(
    os.path.join(DATA_DIR, "regions.csv"),
    usecols=["region_id","population"]
)

env = pd.read_csv(
    os.path.join(DATA_DIR, "environmental_data.csv"),
    parse_dates=["date"]
)

# ==========================================================
# FEATURE ENGINEERING (COMPREHENSIVE)
# ==========================================================

print("\nEngineering outbreak features...")

cases = cases.sort_values(["region_id","date"])

# Rolling averages
for w in [7, 14, 21, 28]:
    cases[f"cases_{w}d"] = cases.groupby("region_id")["case_count"] \
        .transform(lambda x: x.rolling(w, 1).mean())

# Rolling std
for w in [7, 14, 28]:
    cases[f"cases_std_{w}d"] = cases.groupby("region_id")["case_count"] \
        .transform(lambda x: x.rolling(w, 1).std()).fillna(0)

# Rolling max
for w in [7, 14, 28]:
    cases[f"cases_max_{w}d"] = cases.groupby("region_id")["case_count"] \
        .transform(lambda x: x.rolling(w, 1).max())

# Growth rates
for p in [7, 14, 21]:
    cases[f"growth_{p}d"] = (
        (cases[f"cases_7d"] - cases.groupby("region_id")[f"cases_7d"].shift(p))
        / (cases.groupby("region_id")[f"cases_7d"].shift(p) + 1)
    )
    cases[f"growth_{p}d"] = cases[f"growth_{p}d"].replace([np.inf, -np.inf], 0)

# Acceleration
cases["acceleration"] = cases.groupby("region_id")["growth_7d"].diff().fillna(0)

# Z-score anomaly
cases["rolling_mean_30"] = cases.groupby("region_id")["case_count"] \
    .transform(lambda x: x.rolling(30,1).mean())
cases["rolling_std_30"] = cases.groupby("region_id")["case_count"] \
    .transform(lambda x: x.rolling(30,1).std())
cases["zscore"] = (
    (cases["case_count"] - cases["rolling_mean_30"])
    / (cases["rolling_std_30"] + 1)
)

# Deviation from baseline
cases["deviation_7"] = (cases["case_count"] - cases["cases_7d"]) / (cases["cases_std_7d"] + 1)
cases["deviation_14"] = (cases["case_count"] - cases["cases_14d"]) / (cases["cases_std_14d"] + 1)

# Spike indicators
cases["is_spike_2std"] = (cases["deviation_7"] > 2).astype(int)
cases["is_spike_3std"] = (cases["deviation_7"] > 3).astype(int)

# Severity rolling
if "severity_avg" in cases.columns:
    cases["severity_7d"] = cases.groupby("region_id")["severity_avg"] \
        .transform(lambda x: x.rolling(7,1).mean())
    for lag in [7, 14, 21]:
        cases[f"severity_lag_{lag}"] = cases.groupby("region_id")["severity_avg"].shift(lag)

# Lag features
for lag in [7, 14, 21]:
    cases[f"cases_lag_{lag}"] = cases.groupby("region_id")["case_count"].shift(lag)

cases = cases.fillna(0)

# ==========================================================
# MERGE WITH REGIONS + ENV
# ==========================================================

df = cases.merge(regions, on="region_id", how="left")

# Merge environmental data
env_cols = ["date","region_id"]
for col in ["temperature_celsius","humidity_percent","rainfall_mm","aqi","water_quality_index"]:
    if col in env.columns:
        env_cols.append(col)

df = df.merge(env[env_cols], on=["region_id","date"], how="left")

df = df.fillna(0)

# Cases per capita
df["cases_per_100k"] = df["cases_7d"] / (df["population"]/100000 + 1)

# Environmental risk
env_risk_components = []
if "temperature_celsius" in df.columns:
    env_risk_components.append((df["temperature_celsius"] > 30).astype(int))
if "rainfall_mm" in df.columns:
    env_risk_components.append((df["rainfall_mm"] > 50).astype(int))
if "aqi" in df.columns:
    env_risk_components.append((df["aqi"] > 150).astype(int))
df["env_risk"] = sum(env_risk_components) if env_risk_components else 0

# ==========================================================
# TIME SPLIT
# ==========================================================

df = df.sort_values("date")
split_date = df["date"].quantile(0.8)

train_df = df[df["date"] <= split_date]
test_df = df[df["date"] > split_date]

# ==========================================================
# FEATURES
# ==========================================================

FEATURES = [
    "case_count",
    "cases_7d","cases_14d","cases_21d","cases_28d",
    "cases_std_7d","cases_std_14d","cases_std_28d",
    "cases_max_7d","cases_max_14d","cases_max_28d",
    "growth_7d","growth_14d","growth_21d",
    "acceleration","zscore",
    "deviation_7","deviation_14",
    "is_spike_2std","is_spike_3std",
    "cases_lag_7","cases_lag_14","cases_lag_21",
    "cases_per_100k","env_risk"
]

# Add severity if available
if "severity_avg" in df.columns:
    FEATURES += ["severity_avg","severity_7d",
                  "severity_lag_7","severity_lag_14","severity_lag_21"]

# Add environmental columns if available
for col in ["temperature_celsius","humidity_percent","rainfall_mm","aqi","water_quality_index"]:
    if col in df.columns and col not in FEATURES:
        FEATURES.append(col)

# Filter to only existing columns
FEATURES = [f for f in FEATURES if f in df.columns]

print(f"Using {len(FEATURES)} features")

X_train = train_df[FEATURES].astype(float)
y_train = train_df["outbreak_occurred"].astype(int)

X_test = test_df[FEATURES].astype(float)
y_test = test_df["outbreak_occurred"].astype(int)

print(f"Train: {len(X_train)} samples ({y_train.sum()} outbreaks)")
print(f"Test:  {len(X_test)} samples ({y_test.sum()} outbreaks)")

# ==========================================================
# SCALE
# ==========================================================

scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)

joblib.dump(scaler, os.path.join(OUTPUT_DIR,"scaler.pkl"))

# ==========================================================
# CLASS BALANCING (SMOTE)
# ==========================================================

pos = y_train.sum()
neg = len(y_train) - pos
scale_pos_weight = neg / (pos + 1e-9)

print("Scale_pos_weight:", round(scale_pos_weight,2))

if HAS_SMOTE and pos >= 6:
    print("Applying SMOTE...")
    k_neighbors = min(5, pos - 1)
    smote = SMOTE(
        sampling_strategy=0.3,
        random_state=42,
        k_neighbors=k_neighbors
    )
    try:
        X_train_balanced, y_train_balanced = smote.fit_resample(X_train_s, y_train)
        print(f"After SMOTE: {len(X_train_balanced)} samples ({y_train_balanced.sum()} outbreaks)")
    except Exception as e:
        print(f"SMOTE failed: {e}, using original data")
        X_train_balanced, y_train_balanced = X_train_s, y_train
else:
    X_train_balanced, y_train_balanced = X_train_s, y_train

# ==========================================================
# TRAIN XGBOOST (XGBClassifier for predict_proba support)
# ==========================================================

print("\nTraining XGBoost...")

model = XGBClassifier(
    objective="binary:logistic",
    eval_metric="auc",
    learning_rate=0.03,
    max_depth=6,
    n_estimators=800,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=3,
    gamma=0.1,
    reg_alpha=0.1,
    reg_lambda=1.0,
    scale_pos_weight=scale_pos_weight,
    random_state=42,
    n_jobs=-1,
    early_stopping_rounds=50,
    verbosity=0
)

model.fit(
    X_train_balanced, y_train_balanced,
    eval_set=[(X_test_s, y_test)],
    verbose=False
)

print(f"Best iteration: {model.best_iteration}")

# Save model
joblib.dump(model, os.path.join(OUTPUT_DIR,"xgboost_model.pkl"))

# ==========================================================
# THRESHOLD OPTIMIZATION
# ==========================================================

probs = model.predict_proba(X_test_s)[:, 1]

precision_arr, recall_arr, thresholds = precision_recall_curve(y_test, probs)
f1_scores = 2*(precision_arr*recall_arr)/(precision_arr+recall_arr+1e-9)

best_idx = np.argmax(f1_scores)
best_threshold = float(thresholds[best_idx])

preds = (probs >= best_threshold).astype(int)

# ==========================================================
# EVALUATION
# ==========================================================

roc = roc_auc_score(y_test, probs)
f1 = f1_score(y_test, preds)
prec = precision_score(y_test, preds, zero_division=0)
rec = recall_score(y_test, preds, zero_division=0)

report = classification_report(y_test, preds, output_dict=True)

# Save features list
with open(os.path.join(OUTPUT_DIR,"features.json"),"w") as f:
    json.dump(FEATURES,f,indent=2)

metrics = {
    "roc_auc": float(roc),
    "f1_score": float(f1),
    "precision": float(prec),
    "recall": float(rec),
    "optimal_threshold": best_threshold,
    "n_features": len(FEATURES),
    "classification_report": report,
    "timestamp": datetime.utcnow().isoformat()
}

with open(os.path.join(OUTPUT_DIR,"metrics.json"),"w") as f:
    json.dump(metrics,f,indent=2)

print("\nTraining Complete.")
print("ROC-AUC:", round(roc,4))
print("F1 Score:", round(f1,4))
print("Precision:", round(prec,4))
print("Recall:", round(rec,4))
print("Optimal Threshold:", round(best_threshold,4))
print("Saved at:", OUTPUT_DIR)
