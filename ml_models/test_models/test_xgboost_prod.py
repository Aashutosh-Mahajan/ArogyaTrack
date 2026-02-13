#!/usr/bin/env python3

import os
import json
import numpy as np
import pandas as pd
import xgboost as xgb
import joblib
import matplotlib.pyplot as plt
import geopandas as gpd
from sklearn.metrics import roc_auc_score, classification_report
import warnings
warnings.filterwarnings("ignore")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "ml_datasets_large_scale")
MODEL_DIR = os.path.join(BASE_DIR, "saved_models", "xgboost_prod")
OUTPUT_DIR = os.path.join(MODEL_DIR, "test_results")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("="*60)
print("XGBOOST MODEL TESTING")
print("="*60)

# ==========================================================
# LOAD MODEL
# ==========================================================

model = xgb.Booster()
model.load_model(os.path.join(MODEL_DIR, "xgboost.model"))

scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))

with open(os.path.join(MODEL_DIR, "features.json")) as f:
    FEATURES = json.load(f)

# ==========================================================
# LOAD DATA
# ==========================================================

labels = pd.read_csv(
    os.path.join(DATA_DIR, "outbreak_labels.csv"),
    parse_dates=['date']
)

regions = pd.read_csv(
    os.path.join(DATA_DIR, "regions.csv"),
    usecols=['region_id','population','sanitation_index','hospital_count',
             'latitude','longitude']
)

env = pd.read_csv(
    os.path.join(DATA_DIR, "environmental_data.csv"),
    parse_dates=['date'],
    usecols=['date','region_id','temperature_celsius','rainfall_mm','aqi']
)

# ==========================================================
# REBUILD FEATURES
# ==========================================================

env = env.sort_values(['region_id','date'])

env['temp_14d'] = env.groupby('region_id')['temperature_celsius'] \
                     .transform(lambda x: x.rolling(14,1).mean())

env['rain_14d'] = env.groupby('region_id')['rainfall_mm'] \
                     .transform(lambda x: x.rolling(14,1).mean())

env['aqi_14d'] = env.groupby('region_id')['aqi'] \
                    .transform(lambda x: x.rolling(14,1).mean())

env_feat = env[['date','region_id','temp_14d','rain_14d','aqi_14d']].drop_duplicates()

df = labels.merge(env_feat, on=['region_id','date'], how='left') \
           .merge(regions, on='region_id', how='left')

df = df.fillna(0)

X = df[FEATURES].astype(float)
y_true = df['outbreak_occurred'].astype(int)

# ==========================================================
# PREDICT
# ==========================================================

X_scaled = scaler.transform(X)
dtest = xgb.DMatrix(X_scaled)

pred_probs = model.predict(dtest)

# Lower threshold for imbalance
preds = (pred_probs > 0.25).astype(int)

# ==========================================================
# METRICS
# ==========================================================

print("\nROC-AUC:", round(roc_auc_score(y_true, pred_probs),4))
print("\nClassification Report:\n")
print(classification_report(y_true, preds))

# ==========================================================
# INDIA MAP
# ==========================================================

print("Generating India map...")

india = gpd.read_file(
    "https://naturalearth.s3.amazonaws.com/110m_cultural/ne_110m_admin_0_countries.zip"
)
india = india[india["ADMIN"] == "India"]

fig, ax = plt.subplots(figsize=(8,8))
india.plot(ax=ax, color="lightgrey")

ax.scatter(
    df['longitude'],
    df['latitude'],
    c=preds,
    cmap="Reds",
    alpha=0.5,
    s=8
)

plt.title("Predicted Outbreaks - India")
plt.savefig(os.path.join(OUTPUT_DIR,"india_outbreak_map.png"))
plt.close()

print("Map saved.")
print("Testing complete.")
