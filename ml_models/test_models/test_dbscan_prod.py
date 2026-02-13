#!/usr/bin/env python3
"""
DBSCAN Production Test Script
Evaluates clustering and plots clusters on India map.
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
import warnings
warnings.filterwarnings("ignore")

# ==========================================================
# PATH SETUP (MATCHES YOUR STRUCTURE)
# ==========================================================

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "ml_datasets_large_scale")
MODEL_DIR = os.path.join(BASE_DIR, "saved_models", "dbscan_prod")
OUTPUT_DIR = os.path.join(MODEL_DIR, "test_results")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("="*60)
print("DBSCAN MODEL TESTING")
print("="*60)

# ==========================================================
# LOAD MODEL
# ==========================================================

print("\nLoading model...")

model_path = os.path.join(MODEL_DIR, "dbscan_model.pkl")

if not os.path.exists(model_path):
    raise FileNotFoundError("dbscan_model.pkl not found. Train model first.")

model = joblib.load(model_path)

# ==========================================================
# LOAD DATA
# ==========================================================

print("Loading dataset...")

surv = pd.read_csv(
    os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
    usecols=['date','region_id','case_count'],
    parse_dates=['date']
)

regions = pd.read_csv(
    os.path.join(DATA_DIR, "regions.csv"),
    usecols=['region_id','latitude','longitude','population']
)

# ==========================================================
# FEATURE BUILDING (MATCH TRAINING)
# ==========================================================

print("Rebuilding clustering features...")

# Only lat/lon for haversine
df = regions[['region_id','latitude','longitude']].copy()
df = df.dropna()

# Convert degrees → radians (VERY IMPORTANT)
coords = np.radians(df[['latitude','longitude']].values)

# ==========================================================
# CLUSTERING
# ==========================================================

print("Running clustering...")

clusters = model.fit_predict(coords)

df['cluster'] = clusters

# ==========================================================
# METRICS
# ==========================================================

n_clusters = len(set(clusters)) - (1 if -1 in clusters else 0)
noise_points = list(clusters).count(-1)

print(f"\nClusters found: {n_clusters}")
print(f"Noise points: {noise_points}")

if n_clusters > 1:
    sil_score = silhouette_score(coords, clusters, metric="euclidean")
    print(f"Silhouette Score: {sil_score:.4f}")
else:
    sil_score = None
    print("Silhouette Score: Not applicable")

metrics = {
    "clusters": int(n_clusters),
    "noise_points": int(noise_points),
    "silhouette_score": float(sil_score) if sil_score else None
}


# save metrics
metrics = {
    "clusters": int(n_clusters),
    "noise_points": int(noise_points),
    "silhouette_score": float(sil_score) if sil_score else None
}

with open(os.path.join(OUTPUT_DIR, "metrics.json"), "w") as f:
    json.dump(metrics, f, indent=2)

# ==========================================================
# PLOT INDIA CLUSTER MAP
# ==========================================================

print("\nGenerating India cluster map...")

plt.figure(figsize=(10,8))

scatter = plt.scatter(
    df['longitude'],
    df['latitude'],
    c=df['cluster'],
    cmap='tab20',
    s=20,
    alpha=0.7
)

plt.colorbar(scatter, label="Cluster ID")
plt.title("DBSCAN Clusters Across India")
plt.xlabel("Longitude")
plt.ylabel("Latitude")
plt.grid(True)

map_path = os.path.join(OUTPUT_DIR, "india_clusters.png")
plt.savefig(map_path, dpi=300)
plt.close()

print(f"Map saved at: {map_path}")

print("\nDBSCAN Testing Complete.")
print("Results saved in:", OUTPUT_DIR)
