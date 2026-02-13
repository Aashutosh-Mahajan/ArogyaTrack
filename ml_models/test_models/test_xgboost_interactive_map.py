#!/usr/bin/env python3
"""
Interactive India Outbreak Risk Map using XGBoost
Scrollable, Zoomable, Production Ready
"""

import os
import json
import numpy as np
import pandas as pd
import xgboost as xgb
import joblib
import folium
from folium.plugins import MarkerCluster
import warnings
warnings.filterwarnings("ignore")

# ==========================================================
# PATH CONFIG
# ==========================================================

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "ml_datasets_large_scale")
MODEL_DIR = os.path.join(BASE_DIR, "saved_models", "xgboost_prod")
OUTPUT_DIR = os.path.join(MODEL_DIR, "test_results")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("="*60)
print("XGBOOST INTERACTIVE OUTBREAK MAP")
print("="*60)

# ==========================================================
# LOAD MODEL
# ==========================================================

model_path = os.path.join(MODEL_DIR, "xgboost.model")
scaler_path = os.path.join(MODEL_DIR, "scaler.pkl")

if not os.path.exists(model_path):
    raise FileNotFoundError("xgboost.model not found")

model = xgb.Booster()
model.load_model(model_path)

scaler = joblib.load(scaler_path)

# ==========================================================
# LOAD DATA
# ==========================================================

labels = pd.read_csv(
    os.path.join(DATA_DIR, "outbreak_labels.csv"),
    parse_dates=['date']
)

regions = pd.read_csv(
    os.path.join(DATA_DIR, "regions.csv"),
    usecols=['region_id','latitude','longitude','population','sanitation_index','hospital_count']
)

env = pd.read_csv(
    os.path.join(DATA_DIR, "environmental_data.csv"),
    parse_dates=['date'],
    usecols=['date','region_id','temperature_celsius','rainfall_mm','aqi']
)

# ==========================================================
# FEATURE ENGINEERING (MUST MATCH TRAINING)
# ==========================================================

env = env.sort_values(['region_id','date'])

env['temp_14d'] = env.groupby('region_id')['temperature_celsius'] \
                     .transform(lambda x: x.rolling(14, min_periods=1).mean())

env['rain_14d'] = env.groupby('region_id')['rainfall_mm'] \
                     .transform(lambda x: x.rolling(14, min_periods=1).mean())

env['aqi_14d'] = env.groupby('region_id')['aqi'] \
                    .transform(lambda x: x.rolling(14, min_periods=1).mean())

env_latest = env.sort_values('date').groupby('region_id').tail(1)

df = env_latest.merge(regions, on='region_id', how='left')

FEATURES = [
    'temp_14d','rain_14d','aqi_14d',
    'sanitation_index','hospital_count','population'
]

X = df[FEATURES].fillna(0).astype(float)
X_scaled = scaler.transform(X)

dtest = xgb.DMatrix(X_scaled)

# ==========================================================
# PREDICT PROBABILITY
# ==========================================================

print("Predicting outbreak probabilities...")

pred_probs = model.predict(dtest)
df['outbreak_probability'] = pred_probs

# ==========================================================
# CREATE INTERACTIVE MAP
# ==========================================================

india_map = folium.Map(
    location=[22.5937, 78.9629],
    zoom_start=5,
    tiles="OpenStreetMap"
)

marker_cluster = MarkerCluster().add_to(india_map)

# Color function
def get_color(prob):
    if prob > 0.7:
        return "red"
    elif prob > 0.4:
        return "orange"
    elif prob > 0.2:
        return "yellow"
    else:
        return "green"

# Add markers
for _, row in df.iterrows():
    folium.CircleMarker(
        location=[row['latitude'], row['longitude']],
        radius=6,
        color=get_color(row['outbreak_probability']),
        fill=True,
        fill_opacity=0.7,
        popup=f"""
        Region ID: {row['region_id']}<br>
        Probability: {row['outbreak_probability']:.3f}
        """
    ).add_to(marker_cluster)

# ==========================================================
# SAVE HTML
# ==========================================================

output_file = os.path.join(OUTPUT_DIR, "india_xgboost_outbreak_map.html")
india_map.save(output_file)

print("\nInteractive outbreak map saved at:")
print(output_file)
print("Open in browser.")
