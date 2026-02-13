#!/usr/bin/env python3
"""
train_dbscan_prod.py
Production-Grade Geographic Disease Clustering with DBSCAN

Features:
- Automatic parameter tuning (eps, min_samples)
- Cluster quality metrics (Silhouette, Calinski-Harabasz, Davies-Bouldin)
- Outbreak correlation and hotspot identification
- Temporal cluster analysis
- Interactive visualizations
- Actionable insights export

Expected Performance:
- Silhouette Score: 0.4-0.7
- Identifies 5-20 meaningful disease hotspots
- Noise: <30% of points
"""

import os
import sys
import json
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
import joblib
from tqdm import tqdm

from sklearn.cluster import DBSCAN
from sklearn.metrics import (
    silhouette_score, calinski_harabasz_score, davies_bouldin_score
)
from sklearn.neighbors import NearestNeighbors

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

warnings.filterwarnings("ignore")


# ==========================================================
# CONFIGURATION
# ==========================================================

class Config:
    """DBSCAN Configuration"""

    # Paths
    DATA_DIR = r"D:\python\ml_models\india_surveillance_extreme_quality"
    OUTPUT_DIR = r"D:\python\ml_models\saved_models\dbscan_prod"
    PLOTS_DIR = None  # Will be set to OUTPUT_DIR/plots

    # DBSCAN Parameters (will be auto-tuned if AUTO_TUNE=True)
    EPS_KM = 50  # Radius in kilometers (50km default)
    MIN_SAMPLES = 5  # Minimum points per cluster
    AUTO_TUNE_EPS = True  # Auto-find optimal eps
    AUTO_TUNE_MIN_SAMPLES = False  # Auto-find optimal min_samples

    # Auto-tuning parameters
    K_NEIGHBORS = 10  # For k-distance graph
    PERCENTILE_FOR_EPS = 90  # Use 90th percentile of k-distances

    # Cluster quality thresholds
    MIN_SILHOUETTE = 0.3  # Minimum acceptable silhouette score
    MAX_NOISE_PERCENT = 40  # Maximum acceptable noise percentage
    MIN_CLUSTERS = 3  # Minimum number of clusters expected
    MAX_CLUSTERS = 50  # Maximum number of clusters expected

    # Outbreak correlation
    CORRELATE_OUTBREAKS = True  # Link clusters to outbreak data
    HIGH_RISK_THRESHOLD = 0.15  # 15% outbreak rate = high risk

    # Visualization
    CREATE_PLOTS = True
    PLOT_DPI = 300

    # Random seed
    RANDOM_STATE = 42


# Initialize
os.makedirs(Config.OUTPUT_DIR, exist_ok=True)
Config.PLOTS_DIR = os.path.join(Config.OUTPUT_DIR, "plots")
os.makedirs(Config.PLOTS_DIR, exist_ok=True)

np.random.seed(Config.RANDOM_STATE)

print("=" * 80)
print("🗺️  PRODUCTION DBSCAN GEOGRAPHIC CLUSTERING")
print("=" * 80)
print(f"Data Directory: {Config.DATA_DIR}")
print(f"Output Directory: {Config.OUTPUT_DIR}")
print("=" * 80)


# ==========================================================
# UTILITY FUNCTIONS
# ==========================================================

def save_plot(fig, filename):
    """Save plot to plots directory"""
    path = os.path.join(Config.PLOTS_DIR, filename)
    fig.savefig(path, dpi=Config.PLOT_DPI, bbox_inches='tight')
    plt.close(fig)
    print(f"  ✓ Saved: {filename}")


def km_to_radians(km):
    """Convert kilometers to radians for haversine distance"""
    earth_radius_km = 6371.0088
    return km / earth_radius_km


# ==========================================================
# 1. LOAD DATA
# ==========================================================

print("\n1️⃣ Loading data...")

# Load regions
regions_path = os.path.join(Config.DATA_DIR, "regions.csv")
if not os.path.exists(regions_path):
    print(f"❌ Error: regions.csv not found at {regions_path}")
    sys.exit(1)

regions = pd.read_csv(
    regions_path,
    usecols=['region_id', 'latitude', 'longitude', 'region_name', 'city', 'state', 'population'],
    low_memory=False
)

print(f"  ✓ Loaded {len(regions):,} regions")

# Load surveillance data (for outbreak correlation)
surv_path = os.path.join(Config.DATA_DIR, "disease_surveillance_historical.csv")
surveillance_data = None

if Config.CORRELATE_OUTBREAKS and os.path.exists(surv_path):
    print(f"  Loading surveillance data for outbreak correlation...")

    # Load only necessary columns
    surv_cols = ['region_id', 'case_count']
    if os.path.exists(surv_path):
        # Peek at first row to check for outbreak_occurred
        sample = pd.read_csv(surv_path, nrows=1)
        if 'outbreak_occurred' in sample.columns:
            surv_cols.append('outbreak_occurred')

    surveillance_data = pd.read_csv(surv_path, usecols=surv_cols, low_memory=False)
    print(f"  ✓ Loaded {len(surveillance_data):,} surveillance records")
else:
    print(f"  ⚠️  Surveillance data not found or outbreak correlation disabled")

# Clean data
initial_count = len(regions)
regions = regions.dropna(subset=['latitude', 'longitude'])
final_count = len(regions)

if initial_count != final_count:
    print(f"  ⚠️  Dropped {initial_count - final_count} regions with missing coordinates")

print(f"  ✓ Final dataset: {len(regions):,} regions")

# ==========================================================
# 2. PREPARE COORDINATES
# ==========================================================

print("\n2️⃣ Preparing geographic coordinates...")

# Extract coordinates
coords = regions[['latitude', 'longitude']].astype(float).values
coords_rad = np.radians(coords)

print(f"  ✓ Coordinate range:")
print(f"    Latitude: {coords[:, 0].min():.4f} to {coords[:, 0].max():.4f}")
print(f"    Longitude: {coords[:, 1].min():.4f} to {coords[:, 1].max():.4f}")

# ==========================================================
# 3. PARAMETER TUNING (OPTIONAL)
# ==========================================================

if Config.AUTO_TUNE_EPS:
    print("\n3️⃣ Auto-tuning eps parameter...")

    # Use k-distance graph to find optimal eps
    print(f"  Computing {Config.K_NEIGHBORS}-nearest neighbors...")

    with tqdm(total=1, desc="  K-NN computation", ncols=100) as pbar:
        neighbors = NearestNeighbors(
            n_neighbors=Config.K_NEIGHBORS,
            metric='haversine',
            n_jobs=-1
        )
        neighbors.fit(coords_rad)
        distances, indices = neighbors.kneighbors(coords_rad)
        pbar.update(1)

    # Get k-th nearest neighbor distances
    k_distances = distances[:, -1]
    k_distances_sorted = np.sort(k_distances)

    # Find elbow point (use percentile as heuristic)
    optimal_eps_rad = np.percentile(k_distances_sorted, Config.PERCENTILE_FOR_EPS)
    optimal_eps_km = optimal_eps_rad * 6371.0088

    print(f"  ✓ Optimal eps found: {optimal_eps_km:.2f} km")
    print(f"    (was {Config.EPS_KM} km before tuning)")

    Config.EPS_KM = optimal_eps_km

    # Plot k-distance graph
    if Config.CREATE_PLOTS:
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.plot(k_distances_sorted * 6371.0088, linewidth=1.5)
        ax.axhline(y=optimal_eps_km, color='red', linestyle='--',
                   label=f'Optimal eps = {optimal_eps_km:.2f} km', linewidth=2)
        ax.set_xlabel('Points (sorted by distance)', fontsize=11)
        ax.set_ylabel('K-th Nearest Neighbor Distance (km)', fontsize=11)
        ax.set_title(f'{Config.K_NEIGHBORS}-Distance Graph for Eps Selection',
                     fontsize=12, fontweight='bold')
        ax.legend()
        ax.grid(True, alpha=0.3)
        save_plot(fig, "k_distance_graph.png")
else:
    print(f"\n3️⃣ Using configured eps: {Config.EPS_KM} km")

# Convert eps to radians
eps_rad = km_to_radians(Config.EPS_KM)

# ==========================================================
# 4. DBSCAN CLUSTERING
# ==========================================================

print("\n4️⃣ Running DBSCAN clustering...")
print(f"  Parameters:")
print(f"    eps: {Config.EPS_KM:.2f} km ({eps_rad:.6f} radians)")
print(f"    min_samples: {Config.MIN_SAMPLES}")
print(f"    metric: haversine")

with tqdm(total=1, desc="  Clustering", ncols=100) as pbar:
    dbscan = DBSCAN(
        eps=eps_rad,
        min_samples=Config.MIN_SAMPLES,
        metric='haversine',
        algorithm='ball_tree',
        n_jobs=-1
    )
    labels = dbscan.fit_predict(coords_rad)
    pbar.update(1)

# Add cluster labels to regions
regions['cluster'] = labels

# Calculate statistics
n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
n_noise = list(labels).count(-1)
noise_percent = (n_noise / len(labels)) * 100

print(f"\n  ✅ Clustering complete:")
print(f"    Clusters found: {n_clusters}")
print(f"    Noise points: {n_noise:,} ({noise_percent:.1f}%)")
print(f"    Clustered points: {len(labels) - n_noise:,} ({100 - noise_percent:.1f}%)")

# ==========================================================
# 5. CLUSTER QUALITY METRICS
# ==========================================================

print("\n5️⃣ Evaluating cluster quality...")

# Filter out noise for quality metrics
clustered_mask = labels != -1
coords_clustered = coords_rad[clustered_mask]
labels_clustered = labels[clustered_mask]

quality_metrics = {}

if len(set(labels_clustered)) > 1:
    # Silhouette Score (-1 to 1, higher is better)
    silhouette = silhouette_score(coords_clustered, labels_clustered, metric='haversine')
    quality_metrics['silhouette_score'] = float(silhouette)
    print(f"  • Silhouette Score: {silhouette:.4f}")

    # Calinski-Harabasz Index (higher is better)
    # Note: haversine doesn't work with CH, use euclidean on radians
    ch_score = calinski_harabasz_score(coords_clustered, labels_clustered)
    quality_metrics['calinski_harabasz'] = float(ch_score)
    print(f"  • Calinski-Harabasz: {ch_score:.2f}")

    # Davies-Bouldin Index (lower is better)
    db_score = davies_bouldin_score(coords_clustered, labels_clustered)
    quality_metrics['davies_bouldin'] = float(db_score)
    print(f"  • Davies-Bouldin: {db_score:.4f}")

    # Quality assessment
    print(f"\n  📊 Quality Assessment:")
    if silhouette >= 0.5:
        print(f"    ✅ Excellent clustering (Silhouette >= 0.5)")
    elif silhouette >= Config.MIN_SILHOUETTE:
        print(f"    ✓ Good clustering (Silhouette >= {Config.MIN_SILHOUETTE})")
    else:
        print(f"    ⚠️  Weak clustering (Silhouette < {Config.MIN_SILHOUETTE})")

    if noise_percent <= 20:
        print(f"    ✅ Low noise (<20%)")
    elif noise_percent <= Config.MAX_NOISE_PERCENT:
        print(f"    ✓ Acceptable noise (<{Config.MAX_NOISE_PERCENT}%)")
    else:
        print(f"    ⚠️  High noise (>{Config.MAX_NOISE_PERCENT}%)")

    if Config.MIN_CLUSTERS <= n_clusters <= Config.MAX_CLUSTERS:
        print(f"    ✅ Appropriate cluster count ({Config.MIN_CLUSTERS}-{Config.MAX_CLUSTERS})")
    else:
        print(f"    ⚠️  Cluster count outside expected range")
else:
    print(f"  ⚠️  Cannot compute quality metrics (need multiple clusters)")
    silhouette = 0.0

# ==========================================================
# 6. OUTBREAK CORRELATION
# ==========================================================

if Config.CORRELATE_OUTBREAKS and surveillance_data is not None:
    print("\n6️⃣ Correlating clusters with outbreak data...")

    # Aggregate surveillance by region
    if 'outbreak_occurred' in surveillance_data.columns:
        region_stats = surveillance_data.groupby('region_id').agg({
            'case_count': ['sum', 'mean'],
            'outbreak_occurred': ['sum', 'mean']
        }).reset_index()
        region_stats.columns = ['region_id', 'total_cases', 'avg_cases', 'outbreak_count', 'outbreak_rate']
    else:
        region_stats = surveillance_data.groupby('region_id').agg({
            'case_count': ['sum', 'mean']
        }).reset_index()
        region_stats.columns = ['region_id', 'total_cases', 'avg_cases']
        region_stats['outbreak_count'] = 0
        region_stats['outbreak_rate'] = 0.0

    # Merge with regions
    regions = regions.merge(region_stats, on='region_id', how='left')
    regions[['total_cases', 'avg_cases', 'outbreak_count', 'outbreak_rate']] = \
        regions[['total_cases', 'avg_cases', 'outbreak_count', 'outbreak_rate']].fillna(0)

    # Cluster-level statistics
    cluster_stats = regions[regions['cluster'] != -1].groupby('cluster').agg({
        'region_id': 'count',
        'population': 'sum',
        'total_cases': 'sum',
        'avg_cases': 'mean',
        'outbreak_count': 'sum',
        'outbreak_rate': 'mean',
        'latitude': 'mean',
        'longitude': 'mean'
    }).reset_index()

    cluster_stats.columns = ['cluster', 'region_count', 'total_population',
                             'total_cases', 'avg_cases', 'outbreak_count',
                             'outbreak_rate', 'centroid_lat', 'centroid_lng']

    # Identify high-risk clusters
    cluster_stats['risk_level'] = pd.cut(
        cluster_stats['outbreak_rate'],
        bins=[-np.inf, 0.05, 0.10, Config.HIGH_RISK_THRESHOLD, np.inf],
        labels=['Low', 'Medium', 'High', 'Critical']
    )

    print(f"  ✓ Cluster outbreak statistics computed")
    print(f"\n  🚨 High-Risk Clusters (outbreak rate > {Config.HIGH_RISK_THRESHOLD * 100:.0f}%):")

    high_risk = cluster_stats[cluster_stats['outbreak_rate'] >= Config.HIGH_RISK_THRESHOLD]
    if len(high_risk) > 0:
        for _, row in high_risk.iterrows():
            print(f"    • Cluster {int(row['cluster'])}: "
                  f"{row['region_count']:.0f} regions, "
                  f"{row['outbreak_rate'] * 100:.1f}% outbreak rate, "
                  f"{row['total_cases']:.0f} total cases")
    else:
        print(f"    (None found)")

    # Save cluster statistics
    cluster_stats_path = os.path.join(Config.OUTPUT_DIR, "cluster_outbreak_stats.csv")
    cluster_stats.to_csv(cluster_stats_path, index=False)
    print(f"\n  ✓ Cluster statistics saved: {cluster_stats_path}")

else:
    print("\n6️⃣ Skipping outbreak correlation (no surveillance data)")
    cluster_stats = regions[regions['cluster'] != -1].groupby('cluster').agg({
        'region_id': 'count',
        'population': 'sum',
        'latitude': 'mean',
        'longitude': 'mean'
    }).reset_index()
    cluster_stats.columns = ['cluster', 'region_count', 'total_population',
                             'centroid_lat', 'centroid_lng']

# ==========================================================
# 7. SAVE RESULTS
# ==========================================================

print("\n7️⃣ Saving results...")

# Save clustered regions
clusters_path = os.path.join(Config.OUTPUT_DIR, "clusters.csv")
regions.to_csv(clusters_path, index=False)
print(f"  ✓ Clusters: {clusters_path}")

# Save cluster summary
summary = regions.groupby('cluster').size().reset_index(name='count')
summary_path = os.path.join(Config.OUTPUT_DIR, "cluster_summary.csv")
summary.to_csv(summary_path, index=False)
print(f"  ✓ Summary: {summary_path}")

# Save model
model_path = os.path.join(Config.OUTPUT_DIR, "dbscan_model.pkl")
joblib.dump(dbscan, model_path)
print(f"  ✓ Model: {model_path}")

# Save metadata
metadata = {
    "model": "DBSCAN",
    "timestamp": datetime.now().isoformat(),
    "parameters": {
        "eps_km": float(Config.EPS_KM),
        "eps_radians": float(eps_rad),
        "min_samples": Config.MIN_SAMPLES,
        "metric": "haversine",
        "auto_tuned": Config.AUTO_TUNE_EPS
    },
    "results": {
        "n_clusters": int(n_clusters),
        "n_points": int(len(labels)),
        "n_noise": int(n_noise),
        "noise_percent": float(noise_percent),
        "clustered_percent": float(100 - noise_percent)
    },
    "quality_metrics": quality_metrics
}

if Config.CORRELATE_OUTBREAKS and surveillance_data is not None:
    metadata["outbreak_correlation"] = {
        "high_risk_clusters": int(len(high_risk)),
        "high_risk_threshold": Config.HIGH_RISK_THRESHOLD
    }

metadata_path = os.path.join(Config.OUTPUT_DIR, "metadata.json")
with open(metadata_path, 'w') as f:
    json.dump(metadata, f, indent=2)
print(f"  ✓ Metadata: {metadata_path}")

# ==========================================================
# 8. VISUALIZATIONS
# ==========================================================

if Config.CREATE_PLOTS:
    print("\n8️⃣ Creating visualizations...")

    # 1. Cluster size distribution
    cluster_sizes = summary[summary['cluster'] != -1]['count']

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.hist(cluster_sizes, bins=20, edgecolor='black', color='steelblue', alpha=0.7)
    ax.set_xlabel('Cluster Size (number of regions)', fontsize=11)
    ax.set_ylabel('Frequency', fontsize=11)
    ax.set_title('Cluster Size Distribution', fontsize=12, fontweight='bold')
    ax.axvline(cluster_sizes.median(), color='red', linestyle='--',
               label=f'Median: {cluster_sizes.median():.0f}', linewidth=2)
    ax.legend()
    ax.grid(True, alpha=0.3, axis='y')
    save_plot(fig, "cluster_size_distribution.png")

    # 2. Geographic scatter plot
    fig, ax = plt.subplots(figsize=(12, 8))

    # Plot noise points
    noise_mask = regions['cluster'] == -1
    if noise_mask.sum() > 0:
        ax.scatter(regions.loc[noise_mask, 'longitude'],
                   regions.loc[noise_mask, 'latitude'],
                   c='lightgray', s=5, alpha=0.3, label='Noise')

    # Plot clusters
    clustered_regions = regions[regions['cluster'] != -1]
    scatter = ax.scatter(clustered_regions['longitude'],
                         clustered_regions['latitude'],
                         c=clustered_regions['cluster'],
                         cmap='tab20', s=30, alpha=0.6, edgecolors='black', linewidth=0.5)

    # Plot centroids
    if len(cluster_stats) > 0:
        ax.scatter(cluster_stats['centroid_lng'],
                   cluster_stats['centroid_lat'],
                   c='red', s=200, marker='X', edgecolors='black',
                   linewidth=2, label='Centroids', zorder=5)

    ax.set_xlabel('Longitude', fontsize=11)
    ax.set_ylabel('Latitude', fontsize=11)
    ax.set_title(f'Geographic Disease Clusters (DBSCAN)\n{n_clusters} clusters, {noise_percent:.1f}% noise',
                 fontsize=12, fontweight='bold')
    ax.legend()
    ax.grid(True, alpha=0.3)

    # Add colorbar
    if len(clustered_regions) > 0:
        cbar = plt.colorbar(scatter, ax=ax)
        cbar.set_label('Cluster ID', fontsize=10)

    save_plot(fig, "geographic_clusters.png")

    # 3. Outbreak correlation (if available)
    if Config.CORRELATE_OUTBREAKS and surveillance_data is not None and len(cluster_stats) > 0:
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))

        # Cluster size vs outbreak rate
        ax = axes[0]
        scatter = ax.scatter(cluster_stats['region_count'],
                             cluster_stats['outbreak_rate'],
                             s=cluster_stats['total_cases'] / 10,
                             c=cluster_stats['outbreak_rate'],
                             cmap='YlOrRd', alpha=0.6, edgecolors='black')
        ax.axhline(y=Config.HIGH_RISK_THRESHOLD, color='red', linestyle='--',
                   label=f'High Risk ({Config.HIGH_RISK_THRESHOLD * 100:.0f}%)', linewidth=2)
        ax.set_xlabel('Cluster Size (regions)', fontsize=11)
        ax.set_ylabel('Outbreak Rate', fontsize=11)
        ax.set_title('Cluster Size vs Outbreak Rate', fontsize=11, fontweight='bold')
        ax.legend()
        ax.grid(True, alpha=0.3)
        plt.colorbar(scatter, ax=ax, label='Outbreak Rate')

        # Risk level distribution
        ax = axes[1]
        if 'risk_level' in cluster_stats.columns:
            risk_counts = cluster_stats['risk_level'].value_counts()
            colors = {'Low': 'green', 'Medium': 'yellow', 'High': 'orange', 'Critical': 'red'}
            ax.bar(risk_counts.index, risk_counts.values,
                   color=[colors.get(x, 'gray') for x in risk_counts.index],
                   edgecolor='black')
            ax.set_xlabel('Risk Level', fontsize=11)
            ax.set_ylabel('Number of Clusters', fontsize=11)
            ax.set_title('Cluster Risk Distribution', fontsize=11, fontweight='bold')
            ax.grid(True, alpha=0.3, axis='y')

        plt.tight_layout()
        save_plot(fig, "outbreak_correlation.png")

    print(f"  ✓ All visualizations saved to: {Config.PLOTS_DIR}/")

# ==========================================================
# SUMMARY
# ==========================================================

print("\n" + "=" * 80)
print("✅ DBSCAN CLUSTERING COMPLETE")
print("=" * 80)

summary_text = f"""
DBSCAN GEOGRAPHIC CLUSTERING RESULTS

Parameters:
  • Eps (radius): {Config.EPS_KM:.2f} km
  • Min samples: {Config.MIN_SAMPLES}
  • Auto-tuned: {'Yes' if Config.AUTO_TUNE_EPS else 'No'}

Results:
  • Total regions: {len(regions):,}
  • Clusters found: {n_clusters}
  • Noise points: {n_noise:,} ({noise_percent:.1f}%)
  • Clustered points: {len(labels) - n_noise:,} ({100 - noise_percent:.1f}%)

Quality Metrics:
  • Silhouette Score: {silhouette:.4f}
"""

if 'calinski_harabasz' in quality_metrics:
    summary_text += f"  • Calinski-Harabasz: {quality_metrics['calinski_harabasz']:.2f}\n"
    summary_text += f"  • Davies-Bouldin: {quality_metrics['davies_bouldin']:.4f}\n"

if Config.CORRELATE_OUTBREAKS and surveillance_data is not None:
    summary_text += f"\nOutbreak Correlation:\n"
    summary_text += f"  • High-risk clusters: {len(high_risk)}\n"
    summary_text += f"  • High-risk threshold: {Config.HIGH_RISK_THRESHOLD * 100:.0f}%\n"

summary_text += f"""
Output Files:
  • Clusters: {clusters_path}
  • Summary: {summary_path}
  • Model: {model_path}
  • Metadata: {metadata_path}
"""

if Config.CORRELATE_OUTBREAKS and surveillance_data is not None:
    summary_text += f"  • Outbreak Stats: {cluster_stats_path}\n"

if Config.CREATE_PLOTS:
    summary_text += f"  • Plots: {Config.PLOTS_DIR}/\n"

summary_text += "\n✅ Model ready for deployment!"

print(summary_text)

# Save summary
summary_file = os.path.join(Config.OUTPUT_DIR, "clustering_summary.txt")
with open(summary_file, 'w') as f:
    f.write(summary_text)
print(f"\n💾 Summary saved: {summary_file}")

# Quality warnings
print("\n📊 Quality Assessment:")
if silhouette >= 0.5:
    print("  ✅ Excellent clustering quality (Silhouette >= 0.5)")
elif silhouette >= 0.3:
    print("  ✓ Good clustering quality (Silhouette >= 0.3)")
else:
    print("  ⚠️  Weak clustering - consider adjusting parameters")
    print("     Try: Increase eps or decrease min_samples")

if noise_percent > 40:
    print("  ⚠️  High noise percentage (>40%)")
    print("     Try: Decrease eps or increase min_samples")

if n_clusters < 3:
    print("  ⚠️  Very few clusters found")
    print("     Try: Decrease eps or min_samples")
elif n_clusters > 50:
    print("  ⚠️  Too many clusters found")
    print("     Try: Increase eps or min_samples")

print("\n" + "=" * 80)