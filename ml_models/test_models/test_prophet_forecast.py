import joblib
import pandas as pd
import matplotlib.pyplot as plt

# Load trained Prophet model
model = joblib.load("../saved_models/prophet_region1_dengue.pkl")

# Load historical data
df = pd.read_csv("../ml_datasets/disease_surveillance_historical.csv")
df = df[(df["region_id"] == 1) & (df["disease_code"] == "A90")]

df["date"] = pd.to_datetime(df["date"])

prophet_df = df[["date","case_count"]].rename(
    columns={"date":"ds","case_count":"y"}
)

# Forecast 30 days
future = model.make_future_dataframe(periods=30)
forecast = model.predict(future)

# Plot
plt.figure(figsize=(12,6))
plt.plot(prophet_df["ds"], prophet_df["y"], label="Historical Cases", color="blue")
plt.plot(forecast["ds"], forecast["yhat"], label="Forecast", color="red")
plt.fill_between(
    forecast["ds"],
    forecast["yhat_lower"],
    forecast["yhat_upper"],
    color="pink",
    alpha=0.3,
    label="Confidence Interval"
)

plt.axvline(prophet_df["ds"].max(), color="black", linestyle="--", label="Forecast Start")
plt.title("Dengue Forecast (Region 1)")
plt.xlabel("Date")
plt.ylabel("Cases")
plt.legend()
plt.grid()

plt.savefig("../plots/prophet_forecast.png")
plt.show()
