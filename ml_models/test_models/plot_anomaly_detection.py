import pandas as pd
import joblib
import matplotlib.pyplot as plt

# -----------------------------
# Load model
# -----------------------------
model = joblib.load("../saved_models/isolation_forest.pkl")

# -----------------------------
# Load and prepare data
# -----------------------------
df = pd.read_csv("../ml_datasets/disease_surveillance_historical.csv")
env = pd.read_csv("../ml_datasets/environmental_data.csv")

# Filter example: Dengue, Region 1
df = df[(df["region_id"] == 1) & (df["disease_code"] == "A90")]

# Merge environmental data
df = df.merge(env, on=["date", "region_id"])

# Feature engineering (same as training)
df["growth_rate"] = df["case_count"].pct_change().fillna(0)

FEATURES = [
    "case_count",
    "growth_rate",
    "temperature_celsius",
    "humidity_percent",
    "rainfall_mm",
    "aqi"
]

X = df[FEATURES]

# -----------------------------
# Predict anomalies
# -----------------------------
df["anomaly"] = model.predict(X)

# -----------------------------
# Plot
# -----------------------------
plt.figure(figsize=(12,5))
plt.plot(df["date"], df["case_count"], label="Cases", color="blue")

anomalies = df[df["anomaly"] == -1]
plt.scatter(
    anomalies["date"],
    anomalies["case_count"],
    color="red",
    label="Anomaly Detected",
    s=60
)

plt.title("Isolation Forest – Anomaly Detection (Dengue, Region 1)")
plt.xlabel("Date")
plt.ylabel("Case Count")
plt.legend()
plt.grid()

plt.savefig("../plots/anomaly_detection.png")
plt.show()
