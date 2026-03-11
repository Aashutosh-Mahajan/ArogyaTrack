#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DBSCAN Interactive Map with Analytics
Generates clusters, heatmaps, and detailed analytics
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
import folium
from folium.plugins import HeatMap
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings("ignore")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
MODEL_DIR = os.path.join(BASE_DIR, "saved_models", "dbscan_prod")
OUTPUT_DIR = os.path.join(BASE_DIR, "test_results", "dbscan_interactive")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("="*70)
print("DBSCAN INTERACTIVE MAP WITH ANALYTICS")
print("="*70)

# Load model and pre-computed clusters
print("\nLoading cluster data...")
clusters_df = pd.read_csv(os.path.join(MODEL_DIR, "clusters.csv"))
cluster_summary = pd.read_csv(os.path.join(MODEL_DIR, "cluster_summary.csv"))

with open(os.path.join(MODEL_DIR, "metadata.json")) as f:
    metadata = json.load(f)

n_clusters = metadata['results']['n_clusters']
n_noise = metadata['results']['n_noise']
silhouette = metadata['quality_metrics']['silhouette_score']

print(f"Clusters: {n_clusters}, Noise: {n_noise}, Silhouette: {silhouette:.4f}")

# Load data
regions = pd.read_csv(os.path.join(DATA_DIR, "regions.csv"))
surv = pd.read_csv(os.path.join(DATA_DIR, "disease_surveillance_historical.csv"), parse_dates=['date'])

# Merge clusters with regions
regions = regions.merge(clusters_df[['region_id', 'cluster']], on='region_id', how='left')
regions = regions.dropna(subset=['latitude', 'longitude'])

# Aggregate surveillance by cluster
surv_clustered = surv.merge(regions[['region_id', 'cluster']], on='region_id', how='left')

# Check what columns are available
agg_cols = {}
if 'case_count' in surv_clustered.columns:
    agg_cols['case_count'] = 'sum'
if 'death_count' in surv_clustered.columns:
    agg_cols['death_count'] = 'sum'
agg_cols['region_id'] = 'count'

cluster_cases = surv_clustered.groupby('cluster').agg(agg_cols).rename(columns={'region_id': 'num_regions'}).reset_index()

cluster_cases = cluster_cases[cluster_cases['cluster'] != -1]

# Get cluster centers
cluster_centers = regions[regions['cluster'] != -1].groupby('cluster').agg({
    'latitude': 'mean',
    'longitude': 'mean'
}).reset_index()

cluster_data = cluster_centers.merge(cluster_cases, on='cluster')

# Calculate CFR only if death_count exists
if 'death_count' in cluster_data.columns:
    cluster_data['cfr'] = cluster_data['death_count'] / (cluster_data['case_count'] + 1)
else:
    cluster_data['cfr'] = 0
    cluster_data['death_count'] = 0

# Generate analytics
print("\nGenerating analytics...")
fig, axes = plt.subplots(2, 2, figsize=(14, 10))

axes[0, 0].bar(cluster_data['cluster'], cluster_data['num_regions'])
axes[0, 0].set_xlabel('Cluster ID')
axes[0, 0].set_ylabel('Number of Regions')
axes[0, 0].set_title('Cluster Size Distribution')
axes[0, 0].grid(alpha=0.3)

axes[0, 1].bar(cluster_data['cluster'], cluster_data['case_count'], color='coral')
axes[0, 1].set_xlabel('Cluster ID')
axes[0, 1].set_ylabel('Total Cases')
axes[0, 1].set_title('Cases by Cluster')
axes[0, 1].grid(alpha=0.3)

axes[1, 0].bar(cluster_data['cluster'], cluster_data['death_count'], color='darkred')
axes[1, 0].set_xlabel('Cluster ID')
axes[1, 0].set_ylabel('Total Deaths')
axes[1, 0].set_title('Deaths by Cluster')
axes[1, 0].grid(alpha=0.3)

axes[1, 1].bar(cluster_data['cluster'], cluster_data['cfr'] * 100, color='purple')
axes[1, 1].set_xlabel('Cluster ID')
axes[1, 1].set_ylabel('CFR (%)')
axes[1, 1].set_title('Case Fatality Rate by Cluster')
axes[1, 1].grid(alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "cluster_analytics.png"), dpi=150)
plt.close()

# Create interactive map
print("\nCreating interactive map...")
india_map = folium.Map(location=[22.5937, 78.9629], zoom_start=5, tiles="OpenStreetMap")

# Color mapping
import colorsys
unique_clusters = sorted([c for c in regions['cluster'].unique() if c != -1])
color_map = {-1: 'gray'}
for i, c in enumerate(unique_clusters):
    hue = i / len(unique_clusters)
    rgb = colorsys.hsv_to_rgb(hue, 0.8, 0.9)
    color_map[c] = '#{:02x}{:02x}{:02x}'.format(int(rgb[0]*255), int(rgb[1]*255), int(rgb[2]*255))

# Region markers
marker_layer = folium.FeatureGroup(name='Region Markers')
for _, row in regions.iterrows():
    popup_text = f"<b>Region:</b> {row['region_id']}<br><b>Cluster:</b> {row['cluster']}<br><b>Pop:</b> {row.get('population', 'N/A'):,}"
    folium.CircleMarker(
        location=[row['latitude'], row['longitude']],
        radius=4,
        color=color_map.get(row['cluster'], 'gray'),
        fill=True,
        fill_opacity=0.7,
        popup=folium.Popup(popup_text, max_width=250)
    ).add_to(marker_layer)
marker_layer.add_to(india_map)

# Cluster centers
cluster_layer = folium.FeatureGroup(name='Cluster Centers')
for _, row in cluster_data.iterrows():
    popup_text = f"<b>Cluster {int(row['cluster'])}</b><br><b>Regions:</b> {int(row['num_regions'])}<br><b>Cases:</b> {int(row['case_count']):,}<br><b>Deaths:</b> {int(row['death_count']):,}<br><b>CFR:</b> {row['cfr']*100:.2f}%"
    folium.Marker(
        location=[row['latitude'], row['longitude']],
        popup=folium.Popup(popup_text, max_width=250),
        icon=folium.Icon(color='red', icon='info-sign')
    ).add_to(cluster_layer)
cluster_layer.add_to(india_map)

# Heatmap
heat_data = [[row['latitude'], row['longitude'], np.log1p(row['case_count'])] for _, row in cluster_data.iterrows()]
HeatMap(heat_data, name='Case Density Heatmap', min_opacity=0.3, max_opacity=0.8,
        radius=25, blur=15, gradient={0.0: 'blue', 0.5: 'yellow', 1.0: 'red'}).add_to(india_map)

folium.LayerControl().add_to(india_map)

# Save
output_file = os.path.join(OUTPUT_DIR, "india_dbscan_map.html")
india_map.save(output_file)

# Save summary
summary = {
    'total_clusters': n_clusters,
    'noise_points': n_noise,
    'silhouette_score': silhouette,
    'top_5_clusters_by_cases': cluster_data.nlargest(5, 'case_count')[['cluster', 'case_count']].to_dict('records')
}

with open(os.path.join(OUTPUT_DIR, "cluster_summary.json"), 'w') as f:
    json.dump(summary, f, indent=2)

print(f"\nMap saved: {output_file}")
print(f"Analytics saved: cluster_analytics.png")
print(f"Summary saved: cluster_summary.json")
print("\n" + "="*70)
print("COMPLETE - Open HTML file in browser")
print("="*70)
