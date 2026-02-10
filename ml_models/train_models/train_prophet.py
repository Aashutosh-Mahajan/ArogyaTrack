import pandas as pd
from prophet import Prophet
import joblib
import os

# -------------------------------
# Load data
# -------------------------------
df = pd.read_csv("../ml_datasets/disease_surveillance_historical.csv")

# Example: Dengue in Region 1
df = df[(df["region_id"] == 1) & (df["disease_code"] == "A90")]

# Prepare Prophet format
prophet_df = df[["date", "case_count"]].rename(
    columns={"date": "ds", "case_count": "y"}
)
prophet_df["ds"] = pd.to_datetime(prophet_df["ds"])

# -------------------------------
# Train model
# -------------------------------
model = Prophet(weekly_seasonality=True)
model.fit(prophet_df)

# -------------------------------
# Save model correctly
# -------------------------------
os.makedirs("../saved_models", exist_ok=True)
joblib.dump(model, "../saved_models/prophet_region1_dengue.pkl")

print("✅ Prophet model trained & saved successfully")
