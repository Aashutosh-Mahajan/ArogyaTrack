#!/usr/bin/env python3
"""
train_dbscan_prod.py
Production-ready DBSCAN geo clustering with progress bars.
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from tqdm import tqdm
import joblib
import warnings
warnings.filterwarnings("ignore")

# ==========================================================
# CONFIG
# ==========================================================

class Config:
    DATA_DIR = r"D:\python\ml_models\ml_datasets_large_scale"
    OUTPUT_DIR = r"D:\python\ml_models\saved_models\dbscan_prod"
    EPS_METERS = 500
    MIN_SAMPLES = 5
    RANDOM_STATE = 42

os.makedirs(Config.OUTPUT_DIR, exist_ok=True)
np.random.seed(Config.RANDOM_STATE)

# ==========================================================
# LOAD DATA
# ==========================================================

print("\nLoading region coordinates...")

with tqdm(total=1, desc="Loading Data") as pbar:
    regions = pd.read_csv(
        os.path.join(Config.DATA_DIR,"regions.csv"),
        usecols=['region_id','latitude','longitude'],
        low_memory=False
    )
    pbar.update(1)

regions = regions.dropna()

# ==========================================================
# PREPARE COORDINATES
# ==========================================================

coords = regions[['latitude','longitude']].astype(float).values
coords_rad = np.radians(coords)
eps_rad = (Config.EPS_METERS / 1000.0) / 6371.0088

# ==========================================================
# CLUSTERING
# ==========================================================

print("Running DBSCAN clustering...")

with tqdm(total=1, desc="Clustering") as pbar:
    db = DBSCAN(
        eps=eps_rad,
        min_samples=Config.MIN_SAMPLES,
        metric='haversine',
        n_jobs=-1
    )
    labels = db.fit_predict(coords_rad)
    pbar.update(1)

regions['cluster'] = labels
regions.to_csv(os.path.join(Config.OUTPUT_DIR,"clusters.csv"), index=False)

summary = regions.groupby('cluster').size().reset_index(name='count')

summary.to_csv(os.path.join(Config.OUTPUT_DIR,"cluster_summary.csv"), index=False)

joblib.dump(db, os.path.join(Config.OUTPUT_DIR,"dbscan_model.pkl"))

print("\nDBSCAN clustering complete.")
print("Artifacts saved at:", Config.OUTPUT_DIR)
