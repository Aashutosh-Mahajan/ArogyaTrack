import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib
import os

# Load data
cases = pd.read_csv("../ml_datasets/disease_surveillance_historical.csv")
env = pd.read_csv("../ml_datasets/environmental_data.csv")

# Merge
df = cases.merge(env, on=["date","region_id"])

# Feature engineering
df["growth_rate"] = (
    df.groupby(["region_id","disease_code"])["case_count"]
    .pct_change()
    .fillna(0)
)

features = df[[
    "case_count",
    "growth_rate",
    "temperature_celsius",
    "humidity_percent",
    "rainfall_mm",
    "aqi"
]]

# Train model
model = IsolationForest(
    n_estimators=300,
    contamination=0.05,
    random_state=42
)
model.fit(features)

# Save model
os.makedirs("../saved_models", exist_ok=True)
joblib.dump(model, "../saved_models/isolation_forest.pkl")

print("✅ Isolation Forest trained & saved")
