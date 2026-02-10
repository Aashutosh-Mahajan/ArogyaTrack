import pandas as pd
import xgboost as xgb
import joblib
import os

# Load datasets
cases = pd.read_csv("../ml_datasets/disease_surveillance_historical.csv")
env = pd.read_csv("../ml_datasets/environmental_data.csv")
regions = pd.read_csv("../ml_datasets/regions.csv")
labels = pd.read_csv("../ml_datasets/outbreak_labels.csv")

# Merge all
df = labels.merge(cases, on=["region_id","date","disease_code"])
df = df.merge(env, on=["region_id","date"])
df = df.merge(regions, on="region_id")

# Encode target
# Encode target (XGBoost requires 0-based classes)
severity_map = {
    "low": 0,
    "medium": 1,
    "high": 2,
    "critical": 3
}

df["target"] = df["outbreak_severity"].map(severity_map)


FEATURES = [
    "case_count",
    "severity_avg",
    "temperature_celsius",
    "humidity_percent",
    "rainfall_mm",
    "aqi",
    "population",
    "hospital_count",
    "sanitation_index"
]

X = df[FEATURES]
y = df["target"]

# Train model
model = xgb.XGBClassifier(
    n_estimators=300,
    max_depth=6,
    learning_rate=0.05,
    objective="multi:softprob",
    num_class=5,
    random_state=42
)

model.fit(X, y)

# Save model
os.makedirs("../saved_models", exist_ok=True)
joblib.dump(model, "../saved_models/outbreak_risk_xgboost.pkl")

print("✅ XGBoost outbreak risk model trained & saved")
