import os
import numpy as np
import pandas as pd
import joblib
import matplotlib.pyplot as plt
from sklearn.metrics import mean_absolute_error, mean_squared_error

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "ml_datasets_large_scale")
MODEL_DIR = os.path.join(BASE_DIR, "saved_models", "prophet_prod")
OUTPUT_DIR = os.path.join(MODEL_DIR, "test_results")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("Loading model...")
model = joblib.load(os.path.join(MODEL_DIR, "prophet_model.pkl"))

print("Loading data...")
surv = pd.read_csv(
    os.path.join(DATA_DIR, "disease_surveillance_historical.csv"),
    usecols=['date','case_count'],
    parse_dates=['date']
)

env = pd.read_csv(
    os.path.join(DATA_DIR, "environmental_data.csv"),
    usecols=['date','temperature_celsius','rainfall_mm','aqi'],
    parse_dates=['date']
)

# Aggregate national daily
daily_cases = surv.groupby('date')['case_count'].sum().reset_index()
daily_env = env.groupby('date').mean().reset_index()

df = daily_cases.merge(daily_env, on='date', how='left')

df.columns = ['ds','y','temperature_celsius','rainfall_mm','aqi']
df['ds'] = pd.to_datetime(df['ds'])

# Fill missing values (important for Prophet)
df[['temperature_celsius','rainfall_mm','aqi']] = (
    df[['temperature_celsius','rainfall_mm','aqi']]
    .fillna(method='ffill')
    .fillna(method='bfill')
    .fillna(0)
)

print("Generating forecast...")

forecast = model.predict(
    df[['ds','temperature_celsius','rainfall_mm','aqi']]
)

# Evaluation
mae = mean_absolute_error(df['y'], forecast['yhat'])
rmse = np.sqrt(mean_squared_error(df['y'], forecast['yhat']))

print("\nEvaluation Metrics:")
print("MAE :", round(mae, 3))
print("RMSE:", round(rmse, 3))

# Plot
plt.figure(figsize=(12,6))
plt.plot(df['ds'], df['y'], label='Actual', linewidth=2)
plt.plot(forecast['ds'], forecast['yhat'], label='Forecast', linewidth=2)
plt.fill_between(
    forecast['ds'],
    forecast['yhat_lower'],
    forecast['yhat_upper'],
    alpha=0.2
)
plt.legend()
plt.title("Prophet Forecast vs Actual")
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR,"forecast_plot.png"))
plt.close()

print("Prophet test complete.")
