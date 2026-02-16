#!/usr/bin/env python3
"""
DBSCAN Production Test Script (v5.0)
Replicates the training pipeline to assign clusters to regions.
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.metrics import silhouette_score

import warnings
warnings.filterwarnings("ignore")

# ==========================================================
# PATH SETUP
# ==========================================================

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
MODEL_DIR = os.path.join(BASE_DIR, "saved_models", "dbscan_prod")
OUTPUT_DIR = os.path.join(BASE_DIR, "test_results", "dbscan_prod")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("="*60)
print("DBSCAN MODEL TESTING v5.0")
print("="*60)

# ==========================================================
# LOAD MODEL & SCALERS
# ==========================================================

print("\nLoading model & artifacts...")

model_path = os.path.join(MODEL_DIR, "dbscan_model.pkl")
geo_scaler_path = os.path.join(MODEL_DIR, "geo_scaler.pkl")
epi_scaler_path = os.path.join(MODEL_DIR, "epi_scaler.pkl")
features_path = os.path.join(MODEL_DIR, "features.json")
metadata_path = os.path.join(MODEL_DIR, "metadata.json")

if not os.path.exists(model_path):
    raise FileNotFoundError("Model not found. Train first.")

model = joblib.load(model_path)
geo_scaler = joblib.load(geo_scaler_path)
epi_scaler = joblib.load(epi_scaler_path)

with open(features_path, "r") as f:
    feature_names = json.load(f)

with open(metadata_path, "r") as f:
    metadata = json.load(f)
    geo_weight = metadata["parameters"].get("geo_weight", 1.0)

print(f"  Model loaded (eps={model.eps}, min_samples={model.min_samples})")
print(f"  Geo weight: {geo_weight}")

# ==========================================================
# LOAD DATA & FEATURE ENG
# ==========================================================

print("\nReplicating feature pipeline...")

# Load surveillance
surv_path = os.path.join(DATA_DIR, "disease_surveillance_historical.csv")
chunk_aggs = []

for chunk in pd.read_csv(surv_path, parse_dates=["date"], chunksize=1_000_000):
    agg = chunk.groupby("region_id").agg(
        total_cases=("case_count", "sum"),
        mean_cases=("case_count", "mean"),
        std_cases=("case_count", "std"),
        max_cases=("case_count", "max"),
        min_cases=("case_count", "min"),
        outbreak_sum=("outbreak_occurred", "sum"),
        n_reports=("case_count", "count"),
    ).reset_index()

    chunk["month"] = chunk["date"].dt.month
    monsoon_mask = chunk["month"].isin([6, 7, 8, 9])
    monsoon_cases = chunk[monsoon_mask].groupby("region_id")["case_count"].sum().reset_index()
    monsoon_cases.columns = ["region_id", "monsoon_cases"]
    agg = agg.merge(monsoon_cases, on="region_id", how="left")
    agg["monsoon_cases"] = agg["monsoon_cases"].fillna(0)
    chunk_aggs.append(agg)

combined = pd.concat(chunk_aggs, ignore_index=True)
region_agg = combined.groupby("region_id").agg(
    total_cases=("total_cases", "sum"),
    max_cases=("max_cases", "max"),
    min_cases=("min_cases", "min"),
    outbreak_sum=("outbreak_sum", "sum"),
    n_reports=("n_reports", "sum"),
    monsoon_cases=("monsoon_cases", "sum"),
).reset_index()

region_agg["mean_cases"] = region_agg["total_cases"] / region_agg["n_reports"]
region_agg["outbreak_rate"] = region_agg["outbreak_sum"] / region_agg["n_reports"]
region_agg["monsoon_ratio"] = region_agg["monsoon_cases"] / (region_agg["total_cases"] + 1)

if "std_cases" in combined.columns:
    std_agg = combined.groupby("region_id")["std_cases"].mean().reset_index()
    std_agg.columns = ["region_id", "case_std"]
    region_agg = region_agg.merge(std_agg, on="region_id", how="left")
    region_agg["case_variability"] = region_agg["case_std"] / (region_agg["mean_cases"] + 1)
else:
    region_agg["case_variability"] = 0

regions = pd.read_csv(os.path.join(DATA_DIR, "regions.csv"))
merge_cols = ["region_id", "latitude", "longitude", "population"]
for col in ["region_type", "sanitation_index", "hospital_count", "area_sq_km"]:
    if col in regions.columns:
        merge_cols.append(col)

df = region_agg.merge(regions[merge_cols], on="region_id", how="left")
df = df.dropna(subset=["latitude", "longitude"]).reset_index(drop=True)

df["population_log"] = np.log1p(df["population"])
df["cases_per_capita"] = df["mean_cases"] / (df["population"] / 100_000 + 1)
if "area_sq_km" in df.columns:
    df["pop_density_log"] = np.log1p(df["population"] / (df["area_sq_km"] + 1))
df["outbreak_severity"] = df["outbreak_rate"] * df["mean_cases"]

# Select features
geo_features = ["latitude", "longitude"]
epi_features = [f for f in feature_names if f not in geo_features]

X_raw = df[feature_names].astype(float).copy()
for col in X_raw.columns:
    arr = X_raw[col].values
    arr[~np.isfinite(arr)] = 0
X_raw = X_raw.fillna(0)

# Scale
X_geo = geo_scaler.transform(X_raw[geo_features]) * geo_weight
X_epi = epi_scaler.transform(X_raw[epi_features])
X_combined = np.hstack([X_geo, X_epi])

print(f"  Feature matrix: {X_combined.shape}")

# ==========================================================
# PREDICT (Refit)
# ==========================================================

print("\nRunning clustering...")

# Since DBSCAN is transductive, we fit_predict on the new matrix
# We reuse the cached valid parameters
model.fit(X_combined)
clusters = model.labels_

df['cluster'] = clusters

# ==========================================================
# METRICS
# ==========================================================

n_clusters = len(set(clusters)) - (1 if -1 in clusters else 0)
noise_points = list(clusters).count(-1)

print(f"\nClusters found: {n_clusters}")
print(f"Noise points: {noise_points}")

if n_clusters > 1:
    valid = clusters != -1
    sil_score = silhouette_score(X_combined[valid], clusters[valid])
    print(f"Silhouette Score (valid): {sil_score:.4f}")
else:
    sil_score = None
    print("Silhouette Score: Not applicable")

metrics = {
    "clusters": int(n_clusters),
    "noise_points": int(noise_points),
    "silhouette_score": float(sil_score) if sil_score else None
}

with open(os.path.join(OUTPUT_DIR, "test_metrics.json"), "w") as f:
    json.dump(metrics, f, indent=2)

# ==========================================================
# PLOT
# ==========================================================

print("\nGenerating cluster map...")

plt.figure(figsize=(10,8))
geo_data = df[["longitude", "latitude", "cluster"]].copy()

# Plot noise first (small grey dots)
noise = geo_data[geo_data["cluster"] == -1]
plt.scatter(noise["longitude"], noise["latitude"], c="lightgrey", s=10, label="Noise", alpha=0.5)

# Plot clusters
clustered = geo_data[geo_data["cluster"] != -1]
scatter = plt.scatter(
    clustered["longitude"],
    clustered["latitude"],
    c=clustered["cluster"],
    cmap="tab20",
    s=30,
    edgecolor="k",
    linewidth=0.5,
    alpha=0.8
)

plt.colorbar(scatter, label="Cluster ID")
plt.title(f"DBSCAN v5.0 Clusters (Sil={sil_score:.3f})")
plt.xlabel("Longitude")
plt.ylabel("Latitude")
plt.grid(True, alpha=0.3)
plt.legend()

map_path = os.path.join(OUTPUT_DIR, "india_clusters_v5.png")
plt.savefig(map_path, dpi=300)
plt.close()

print(f"Map saved at: {map_path}")
print("Done.")
