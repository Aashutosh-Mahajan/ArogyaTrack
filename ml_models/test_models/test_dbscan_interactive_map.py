#!/usr/bin/env python3
"""
Generate Interactive Scrollable India Map with DBSCAN Clusters
Output: HTML file (Google Maps-like interaction)
"""

import os
import numpy as np
import pandas as pd
import joblib
import folium
from folium.plugins import MarkerCluster
import warnings
warnings.filterwarnings("ignore")

# ==========================================================
# PATH SETUP
# ==========================================================

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "ml_datasets_large_scale")
MODEL_DIR = os.path.join(BASE_DIR, "saved_models", "dbscan_prod")
OUTPUT_DIR = os.path.join(MODEL_DIR, "test_results")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("="*60)
print("INTERACTIVE INDIA CLUSTER MAP")
print("="*60)

# ==========================================================
# LOAD MODEL
# ==========================================================

model_path = os.path.join(MODEL_DIR, "dbscan_model.pkl")
if not os.path.exists(model_path):
    raise FileNotFoundError("dbscan_model.pkl not found")

model = joblib.load(model_path)

# ==========================================================
# LOAD DATA
# ==========================================================

regions = pd.read_csv(
    os.path.join(DATA_DIR, "regions.csv"),
    usecols=['region_id','latitude','longitude']
)

# ==========================================================
# PREPARE DATA FOR HAVERSINE
# ==========================================================

regions = regions.dropna()
coords = np.radians(regions[['latitude','longitude']].values)

# ==========================================================
# RUN CLUSTERING
# ==========================================================

clusters = model.fit_predict(coords)
regions['cluster'] = clusters

# ==========================================================
# CREATE INTERACTIVE MAP
# ==========================================================

# India center
india_map = folium.Map(
    location=[22.5937, 78.9629],  # India center
    zoom_start=5,
    tiles="OpenStreetMap"
)

# Color palette
import random
unique_clusters = list(set(clusters))
color_map = {}

for c in unique_clusters:
    if c == -1:
        color_map[c] = "gray"
    else:
        color_map[c] = "#{:06x}".format(random.randint(0, 0xFFFFFF))

# Marker clustering plugin
marker_cluster = MarkerCluster().add_to(india_map)

# Add points
for _, row in regions.iterrows():
    cluster_id = row['cluster']
    folium.CircleMarker(
        location=[row['latitude'], row['longitude']],
        radius=4,
        color=color_map[cluster_id],
        fill=True,
        fill_opacity=0.7,
        popup=f"Cluster: {cluster_id}"
    ).add_to(marker_cluster)

# ==========================================================
# SAVE HTML
# ==========================================================

output_file = os.path.join(OUTPUT_DIR, "india_dbscan_interactive_map.html")
india_map.save(output_file)

print("Interactive Map Saved At:")
print(output_file)
print("Open this file in browser.")
