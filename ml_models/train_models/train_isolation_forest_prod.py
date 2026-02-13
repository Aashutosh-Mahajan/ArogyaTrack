#!/usr/bin/env python3
"""
train_isolation_forest_prod.py
Production-ready IsolationForest training with weak supervision tuning.
Includes full progress bars.

Dependencies:
pip install pandas numpy scikit-learn joblib tqdm
"""

import os
import json
from datetime import datetime
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import precision_score, recall_score, f1_score
import joblib
from tqdm import tqdm
import warnings
warnings.filterwarnings("ignore")

# ==========================================================
# CONFIG
# ==========================================================

class Config:
    DATA_DIR = r"D:\python\ml_models\ml_datasets_large_scale"   # <-- correct dataset path
    OUTPUT_DIR = r"D:\python\ml_models\saved_models\isolation_forest_prod"
    RANDOM_SEED = 42

    LAG_PERIODS = [7, 14]
    ROLLING_WINDOWS = [7, 14]

    N_ESTIMATORS = 300
    MAX_SAMPLES = "auto"
    MAX_FEATURES = 1.0
    N_JOBS = -1

    CONTAMINATION_GRID = [0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.10]
    TEMPORAL_SPLIT_QUANTILE = 0.80
    MIN_SAMPLES_FOR_TUNING = 1000


# ==========================================================
# INITIAL SETUP
# ==========================================================

os.makedirs(Config.OUTPUT_DIR, exist_ok=True)
np.random.seed(Config.RANDOM_SEED)

def load_csv(filename, usecols=None, parse_dates=None):
    path = os.path.join(Config.DATA_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    return pd.read_csv(path, usecols=usecols, parse_dates=parse_dates, low_memory=False)


# ==========================================================
# LOAD DATA
# ==========================================================

print("\nLoading datasets...")

surv = load_csv(
    "disease_surveillance_historical.csv",
    usecols=['date','region_id','disease_code','case_count','severity_avg'],
    parse_dates=['date']
)

env = load_csv(
    "environmental_data.csv",
    usecols=['date','region_id','temperature_celsius','humidity_percent','rainfall_mm','aqi','water_quality_index'],
    parse_dates=['date']
)

regions = load_csv(
    "regions.csv",
    usecols=['region_id','population','sanitation_index','hospital_count']
)

print("Merging datasets...")
df = surv.merge(env, on=['date','region_id'], how='left') \
         .merge(regions, on='region_id', how='left')

df['date'] = pd.to_datetime(df['date'])
df = df.sort_values(['region_id','disease_code','date']).reset_index(drop=True)
df = df.fillna(0)

print(f"Total rows after merge: {len(df):,}")


# ==========================================================
# FEATURE ENGINEERING (WITH PROGRESS BAR)
# ==========================================================

print("\nFeature engineering...")
g = df.groupby(['region_id','disease_code'])

with tqdm(total=6, desc="Feature Engineering") as pbar:

    for lag in Config.LAG_PERIODS:
        df[f'cases_lag_{lag}'] = g['case_count'].shift(lag).fillna(0)
        df[f'severity_lag_{lag}'] = g['severity_avg'].shift(lag).fillna(0)
    pbar.update(1)

    for w in Config.ROLLING_WINDOWS:
        df[f'cases_rm_{w}'] = g['case_count'].transform(
            lambda x: x.rolling(window=w, min_periods=1).mean()
        ).fillna(0)
    pbar.update(1)

    for w in Config.ROLLING_WINDOWS:
        df[f'cases_rstd_{w}'] = g['case_count'].transform(
            lambda x: x.rolling(window=w, min_periods=1).std()
        ).fillna(0)
    pbar.update(1)

    for w in Config.ROLLING_WINDOWS:
        df[f'cases_rmax_{w}'] = g['case_count'].transform(
            lambda x: x.rolling(window=w, min_periods=1).max()
        ).fillna(0)
    pbar.update(1)

    for p in Config.LAG_PERIODS:
        df[f'growth_{p}'] = g['case_count'].pct_change(periods=p).fillna(0)
    pbar.update(1)

    df['deviation_7'] = (df['case_count'] - df['cases_rm_7']) / (df['cases_rstd_7'] + 1)
    df['case_density'] = (df['case_count'] / (df['population'] + 1)) * 100000
    df['env_risk'] = (
        (df['temperature_celsius'] > 30).astype(int) +
        (df['rainfall_mm'] > 50).astype(int) +
        (df['aqi'] > 150).astype(int)
    )
    df['sanitation_weighted'] = df['case_count'] * (10 - df['sanitation_index']) / 10
    df['cases_per_hospital'] = df['case_count'] / (df['hospital_count'] + 1)
    pbar.update(1)


# ==========================================================
# FEATURE MATRIX
# ==========================================================

FEATURES = [
    'case_count','severity_avg',
    'temperature_celsius','humidity_percent','rainfall_mm','aqi','water_quality_index',
    'sanitation_index','hospital_count','population',
    'cases_lag_7','cases_lag_14','severity_lag_7','severity_lag_14',
    'cases_rm_7','cases_rstd_7','cases_rmax_7','cases_rm_14','cases_rstd_14','cases_rmax_14',
    'growth_7','growth_14','deviation_7','case_density','env_risk',
    'sanitation_weighted','cases_per_hospital'
]

X_all = df[FEATURES].replace([np.inf, -np.inf], 0).fillna(0)


# ==========================================================
# TEMPORAL SPLIT
# ==========================================================

split_date = df['date'].quantile(Config.TEMPORAL_SPLIT_QUANTILE)
train_mask = df['date'] < split_date
val_mask = df['date'] >= split_date

X_train = X_all[train_mask]
X_val = X_all[val_mask]
meta_val = df[val_mask].copy()

print(f"Train samples: {len(X_train):,}")
print(f"Validation samples: {len(X_val):,}")


# ==========================================================
# WEAK LABELS (WITH PROGRESS BAR)
# ==========================================================

labels_path = os.path.join(Config.DATA_DIR, "outbreak_labels.csv")
y_val_weak = None

if os.path.exists(labels_path):

    print("\nGenerating weak labels...")
    labels = pd.read_csv(labels_path, parse_dates=['date'])
    labels_pos = labels[labels['outbreak_occurred'] == 1][['region_id','date']]
    label_set = set(zip(labels_pos['region_id'], labels_pos['date'].dt.date))

    tqdm.pandas(desc="Weak Labels")
    meta_val['weak_outbreak'] = meta_val.progress_apply(
        lambda row: 1 if (row['region_id'], row['date'].date()) in label_set else 0,
        axis=1
    )

    y_val_weak = meta_val['weak_outbreak'].values
    print("Positive outbreak days:", int(y_val_weak.sum()))


# ==========================================================
# SCALING
# ==========================================================

scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_val_s = scaler.transform(X_val)
joblib.dump(scaler, os.path.join(Config.OUTPUT_DIR, "scaler.pkl"))


# ==========================================================
# CONTAMINATION TUNING (WITH PROGRESS BAR)
# ==========================================================

best_cont = 0.03
best_f1 = -1

if y_val_weak is not None and len(y_val_weak) > Config.MIN_SAMPLES_FOR_TUNING:

    print("\nTuning contamination...")
    for cont in tqdm(Config.CONTAMINATION_GRID, desc="Contamination Search"):

        model_temp = IsolationForest(
            n_estimators=Config.N_ESTIMATORS,
            contamination=cont,
            random_state=Config.RANDOM_SEED,
            n_jobs=Config.N_JOBS
        )

        model_temp.fit(X_train_s)
        preds = (model_temp.predict(X_val_s) == -1).astype(int)
        f1 = f1_score(y_val_weak, preds, zero_division=0)

        if f1 > best_f1:
            best_f1 = f1
            best_cont = cont

    print(f"Best contamination: {best_cont} (F1={best_f1:.4f})")


# ==========================================================
# FINAL TRAINING (WITH PROGRESS BAR)
# ==========================================================

print("\nTraining final model...")

model = IsolationForest(
    n_estimators=Config.N_ESTIMATORS,
    contamination=best_cont,
    random_state=Config.RANDOM_SEED,
    n_jobs=Config.N_JOBS
)

with tqdm(total=1, desc="Training Model") as pbar:
    model.fit(X_train_s)
    pbar.update(1)


# ==========================================================
# SAVE ARTIFACTS
# ==========================================================

joblib.dump(model, os.path.join(Config.OUTPUT_DIR, "isolation_forest.pkl"))

with open(os.path.join(Config.OUTPUT_DIR, "features.json"), "w") as f:
    json.dump(FEATURES, f, indent=2)

metadata = {
    "model": "IsolationForest",
    "timestamp": datetime.utcnow().isoformat(),
    "contamination": best_cont,
    "features_count": len(FEATURES)
}

with open(os.path.join(Config.OUTPUT_DIR, "metadata.json"), "w") as f:
    json.dump(metadata, f, indent=2)

print("\nModel training complete.")
print("Artifacts saved at:", Config.OUTPUT_DIR)
