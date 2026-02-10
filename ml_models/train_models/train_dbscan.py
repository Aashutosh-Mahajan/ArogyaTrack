import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
import joblib
import os

# Load data
cases = pd.read_csv("../ml_datasets/disease_surveillance_historical.csv")
regions = pd.read_csv("../ml_datasets/regions.csv")

# Example snapshot
df = cases[
    (cases["disease_code"] == "A90") &
    (cases["date"] == "2025-01-10")
]

df = df.merge(regions, on="region_id")

X = df[["latitude","longitude","case_count"]]
X_scaled = StandardScaler().fit_transform(X)

# DBSCAN (parameters are the "training")
model = DBSCAN(eps=1.2, min_samples=3)
model.fit(X_scaled)

# Save parameters (DBSCAN has no learned weights)
os.makedirs("../saved_models", exist_ok=True)
joblib.dump(model, "../saved_models/dbscan_model.pkl")

print("✅ DBSCAN parameters saved")
