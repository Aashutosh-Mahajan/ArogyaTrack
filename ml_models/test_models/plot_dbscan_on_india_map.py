import pandas as pd
import joblib
import matplotlib.pyplot as plt
import cartopy.crs as ccrs
import cartopy.feature as cfeature
from sklearn.preprocessing import StandardScaler

# -----------------------------
# Load trained DBSCAN model
# -----------------------------
model = joblib.load("../saved_models/dbscan_model.pkl")

# -----------------------------
# Load datasets
# -----------------------------
cases = pd.read_csv("../ml_datasets/disease_surveillance_historical.csv")
regions = pd.read_csv("../ml_datasets/regions.csv")

df = cases[
    (cases["disease_code"] == "A90") &
    (cases["date"] == "2025-01-10")
].merge(regions, on="region_id")

# -----------------------------
# DBSCAN clustering
# -----------------------------
X = df[["latitude", "longitude", "case_count"]]
X_scaled = StandardScaler().fit_transform(X)
df["cluster"] = model.fit_predict(X_scaled)

# -----------------------------
# Plot on India map
# -----------------------------
fig = plt.figure(figsize=(10, 12))
ax = plt.axes(projection=ccrs.PlateCarree())

# India extent
ax.set_extent([68, 97, 6, 37], crs=ccrs.PlateCarree())

# Map features
ax.add_feature(cfeature.LAND, facecolor="lightgray")
ax.add_feature(cfeature.COASTLINE)
ax.add_feature(cfeature.BORDERS, linestyle=":")
ax.add_feature(cfeature.STATES.with_scale("10m"), linewidth=0.5)

# Plot outbreak clusters
scatter = ax.scatter(
    df["longitude"],
    df["latitude"],
    c=df["cluster"],
    s=df["case_count"] * 2,
    cmap="tab10",
    alpha=0.8,
    transform=ccrs.PlateCarree()
)

plt.colorbar(scatter, ax=ax, label="Cluster ID")
plt.title("DBSCAN Outbreak Clusters (Dengue) – India Map", fontsize=14)

plt.savefig("../plots/dbscan_clusters_india_map.png", dpi=300)
plt.show()
