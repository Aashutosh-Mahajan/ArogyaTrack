import pandas as pd
import joblib
import numpy as np
import matplotlib.pyplot as plt
import cartopy.crs as ccrs
import cartopy.feature as cfeature

# -----------------------------
# Load trained XGBoost model
# -----------------------------
model = joblib.load("../saved_models/outbreak_risk_xgboost.pkl")

# -----------------------------
# Load datasets
# -----------------------------
cases = pd.read_csv("../ml_datasets/disease_surveillance_historical.csv")
env = pd.read_csv("../ml_datasets/environmental_data.csv")
regions = pd.read_csv("../ml_datasets/regions.csv")

# Choose snapshot date
DATE = "2025-01-10"

df = cases[
    (cases["date"] == DATE) &
    (cases["disease_code"] == "A90")
]

df = df.merge(env, on=["region_id", "date"])
df = df.merge(regions, on="region_id")

# -----------------------------
# Feature set (same as training)
# -----------------------------
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

# -----------------------------
# Predict risk
# -----------------------------
probs = model.predict_proba(X)
df["risk_score"] = probs.max(axis=1)
df["risk_class"] = probs.argmax(axis=1)

# Map classes to labels & colors
RISK_LABELS = {
    0: "LOW",
    1: "MEDIUM",
    2: "HIGH",
    3: "CRITICAL"
}

RISK_COLORS = {
    0: "green",
    1: "yellow",
    2: "orange",
    3: "red"
}

df["risk_label"] = df["risk_class"].map(RISK_LABELS)
df["color"] = df["risk_class"].map(RISK_COLORS)

# -----------------------------
# Plot on India map
# -----------------------------
fig = plt.figure(figsize=(10, 12))
ax = plt.axes(projection=ccrs.PlateCarree())

# India bounds
ax.set_extent([68, 97, 6, 37], crs=ccrs.PlateCarree())

# Base map
ax.add_feature(cfeature.LAND, facecolor="lightgray")
ax.add_feature(cfeature.COASTLINE)
ax.add_feature(cfeature.BORDERS, linestyle=":")
ax.add_feature(cfeature.STATES.with_scale("10m"), linewidth=0.5)

# Scatter points
ax.scatter(
    df["longitude"],
    df["latitude"],
    c=df["color"],
    s=df["risk_score"] * 300,
    alpha=0.8,
    transform=ccrs.PlateCarree()
)

# -----------------------------
# Legend (manual, clean)
# -----------------------------
for label, color in RISK_COLORS.items():
    ax.scatter([], [], c=color, label=RISK_LABELS[label], s=80)

plt.legend(title="Outbreak Risk Level", loc="lower left")

plt.title(
    f"XGBoost Outbreak Risk Prediction (Dengue) – {DATE}",
    fontsize=14
)

plt.savefig("../plots/xgboost_risk_india_map.png", dpi=300)
plt.show()
