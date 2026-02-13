import os
import numpy as np
import pandas as pd
import joblib
import json
import matplotlib.pyplot as plt

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "ml_datasets_large_scale")
MODEL_DIR = os.path.join(BASE_DIR, "saved_models", "isolation_forest_prod")
OUTPUT_DIR = os.path.join(MODEL_DIR, "test_results")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("Loading model...")
model = joblib.load(os.path.join(MODEL_DIR, "isolation_forest.pkl"))
scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))

with open(os.path.join(MODEL_DIR, "features.json")) as f:
    FEATURES = json.load(f)

print("Loading data...")

surv = pd.read_csv(
    os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
    parse_dates=['date']
)

env = pd.read_csv(
    os.path.join(DATA_DIR, "environmental_data.csv"),
    parse_dates=['date']
)

regions = pd.read_csv(
    os.path.join(DATA_DIR, "regions.csv")
)

# Merge
df = surv.merge(env, on=['date','region_id'], how='left') \
         .merge(regions, on='region_id', how='left')

df = df.sort_values(['region_id','disease_code','date']).reset_index(drop=True)
df = df.fillna(0)

# Recreate feature engineering
g = df.groupby(['region_id','disease_code'])

df['cases_lag_7'] = g['case_count'].shift(7).fillna(0)
df['cases_lag_14'] = g['case_count'].shift(14).fillna(0)

df['severity_lag_7'] = g['severity_avg'].shift(7).fillna(0)
df['severity_lag_14'] = g['severity_avg'].shift(14).fillna(0)

df['cases_rm_7'] = g['case_count'].transform(lambda x: x.rolling(7,1).mean())
df['cases_rm_14'] = g['case_count'].transform(lambda x: x.rolling(14,1).mean())

df['cases_rstd_7'] = g['case_count'].transform(lambda x: x.rolling(7,1).std()).fillna(0)
df['cases_rstd_14'] = g['case_count'].transform(lambda x: x.rolling(14,1).std()).fillna(0)

df['cases_rmax_7'] = g['case_count'].transform(lambda x: x.rolling(7,1).max())
df['cases_rmax_14'] = g['case_count'].transform(lambda x: x.rolling(14,1).max())

df['growth_7'] = g['case_count'].pct_change(7).fillna(0)
df['growth_14'] = g['case_count'].pct_change(14).fillna(0)

df['deviation_7'] = (df['case_count'] - df['cases_rm_7']) / (df['cases_rstd_7'] + 1)
df['case_density'] = (df['case_count'] / (df['population'] + 1)) * 100000
df['env_risk'] = ((df['temperature_celsius'] > 30).astype(int) +
                  (df['rainfall_mm'] > 50).astype(int) +
                  (df['aqi'] > 150).astype(int))

df['sanitation_weighted'] = df['case_count'] * (10 - df['sanitation_index']) / 10
df['cases_per_hospital'] = df['case_count'] / (df['hospital_count'] + 1)

# Select EXACT training features
X = df[FEATURES].replace([np.inf, -np.inf], 0).fillna(0)

X_scaled = scaler.transform(X)
preds = (model.predict(X_scaled) == -1).astype(int)

print("Total anomalies detected:", preds.sum())

plt.hist(preds, bins=2)
plt.title("Anomaly Distribution")
plt.savefig(os.path.join(OUTPUT_DIR, "anomaly_distribution.png"))
plt.close()

print("Isolation Forest test complete.")
