#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
XGBoost V3 Interactive Outbreak Risk Map
Comprehensive analytics with heatmaps and risk visualizations
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
MODEL_DIR = os.path.join(BASE_DIR, "saved_models", "xgboost_outbreak_v3")
OUTPUT_DIR = os.path.join(BASE_DIR, "test_results", "xgboost_interactive")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("="*70)
print("XGBOOST V3 INTERACTIVE OUTBREAK RISK MAP")
print("="*70)

# Load model
print("\nLoading model...")
model = joblib.load(os.path.join(MODEL_DIR, "xgboost_model.pkl"))
scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))

with open(os.path.join(MODEL_DIR, "features.json")) as f:
    FEATURES = json.load(f)

with open(os.path.join(MODEL_DIR, "metrics.json")) as f:
    metrics = json.load(f)
    opt_threshold = metrics.get("optimal_threshold", 0.5)

print(f"Model: {len(FEATURES)} features, Threshold: {opt_threshold:.4f}, F1: {metrics.get('f1_score', 0):.4f}")

# Load data
print("\nLoading data...")
regions = pd.read_csv(os.path.join(DATA_DIR, "regions.csv"))
surv = pd.read_csv(os.path.join(DATA_DIR, "disease_surveillance_historical.csv"), parse_dates=['date'])
env = pd.read_csv(os.path.join(DATA_DIR, "environmental_data.csv"), parse_dates=['date'])

# Simple feature engineering for visualization
print("\nEngineering features...")
surv = surv.merge(regions, on='region_id', how='left')
surv = surv.sort_values(['region_id', 'disease_code', 'date'])

# Calculate basic features
surv['per_capita_cases'] = surv['case_count'] / (surv['population'] + 1)
surv['per_capita_deaths'] = 0  # Placeholder
surv['case_fatality_rate'] = 0.02  # Placeholder since death_count may not exist

for window in [7, 14, 21, 28]:
    surv[f'cases_rolling_{window}d'] = surv.groupby(['region_id', 'disease_code'])['case_count'].transform(lambda x: x.rolling(window, 1).mean())

surv['cases_rolling_std_14d'] = surv.groupby(['region_id', 'disease_code'])['case_count'].transform(lambda x: x.rolling(14, 1).std()).fillna(0)
surv['cases_rolling_max_28d'] = surv.groupby(['region_id', 'disease_code'])['case_count'].transform(lambda x: x.rolling(28, 1).max())
surv['cases_growth_rate'] = surv.groupby(['region_id', 'disease_code'])['case_count'].pct_change().fillna(0)
surv['cases_acceleration'] = surv.groupby(['region_id', 'disease_code'])['cases_growth_rate'].diff().fillna(0)

mean_cases = surv.groupby(['region_id', 'disease_code'])['case_count'].transform('mean')
std_cases = surv.groupby(['region_id', 'disease_code'])['case_count'].transform('std').fillna(1)
surv['cases_zscore'] = (surv['case_count'] - mean_cases) / std_cases

surv['deviation_from_7d_avg'] = surv['case_count'] - surv['cases_rolling_7d']
surv['deviation_from_14d_avg'] = surv['case_count'] - surv['cases_rolling_14d']
surv['is_spike'] = (surv['cases_zscore'] > 2).astype(int)
surv['severity_index'] = surv['case_count'] * surv['case_fatality_rate']
surv['death_growth_rate'] = 0  # Placeholder

for lag in [7, 14, 21]:
    surv[f'cases_lag_{lag}d'] = surv.groupby(['region_id', 'disease_code'])['case_count'].shift(lag).fillna(0)

# Environmental
env = env.sort_values(['region_id', 'date'])
for window in [7, 14]:
    env[f'temp_rolling_{window}d'] = env.groupby('region_id')['temperature_celsius'].transform(lambda x: x.rolling(window, 1).mean())
    env[f'rainfall_rolling_{window}d'] = env.groupby('region_id')['rainfall_mm'].transform(lambda x: x.rolling(window, 1).mean())
    env[f'aqi_rolling_{window}d'] = env.groupby('region_id')['aqi'].transform(lambda x: x.rolling(window, 1).mean())

env['environmental_risk'] = (env['temperature_celsius'] / 50 + env['rainfall_mm'] / 300 + env['aqi'] / 500) / 3

# Aggregate latest data
surv_agg = surv.groupby('region_id').tail(30).groupby('region_id').agg({
    'case_count': 'sum',
    'per_capita_cases': 'mean',
    'per_capita_deaths': 'mean',
    'case_fatality_rate': 'mean',
    'cases_rolling_7d': 'mean',
    'cases_rolling_14d': 'mean',
    'cases_rolling_21d': 'mean',
    'cases_rolling_28d': 'mean',
    'cases_rolling_std_14d': 'mean',
    'cases_rolling_max_28d': 'max',
    'cases_growth_rate': 'mean',
    'cases_acceleration': 'mean',
    'cases_zscore': 'max',
    'deviation_from_7d_avg': 'mean',
    'deviation_from_14d_avg': 'mean',
    'is_spike': 'max',
    'severity_index': 'sum',
    'death_growth_rate': 'mean',
    'cases_lag_7d': 'sum',
    'cases_lag_14d': 'sum',
    'cases_lag_21d': 'sum'
}).reset_index()

# Add death_count as zero if it doesn't exist
surv_agg['death_count'] = 0

env_agg = env.groupby('region_id').tail(1)[['region_id', 'temp_rolling_7d', 'temp_rolling_14d',
                                              'rainfall_rolling_7d', 'rainfall_rolling_14d',
                                              'aqi_rolling_7d', 'aqi_rolling_14d', 'environmental_risk']]

df = regions.merge(surv_agg, on='region_id', how='left').merge(env_agg, on='region_id', how='left').fillna(0)

print(f"Prepared {len(df)} regions")

# Predict
print("\nPredicting outbreak risk...")
X = df[FEATURES].astype(float).replace([np.inf, -np.inf], 0)
X_scaled = scaler.transform(X)
pred_probs = model.predict_proba(X_scaled)[:, 1]
df['outbreak_probability'] = pred_probs
df['outbreak_predicted'] = (pred_probs >= opt_threshold).astype(int)

print(f"High-risk regions: {df['outbreak_predicted'].sum()} ({df['outbreak_predicted'].mean()*100:.1f}%)")

# Analytics
print("\nGenerating analytics...")
fig, axes = plt.subplots(2, 2, figsize=(14, 10))

axes[0, 0].hist(df['outbreak_probability'], bins=50, color='skyblue', edgecolor='black')
axes[0, 0].axvline(opt_threshold, color='red', linestyle='--', label=f'Threshold: {opt_threshold:.3f}')
axes[0, 0].set_xlabel('Outbreak Probability')
axes[0, 0].set_ylabel('Frequency')
axes[0, 0].set_title('Distribution of Outbreak Probabilities')
axes[0, 0].legend()
axes[0, 0].grid(alpha=0.3)

top_risk = df.nlargest(20, 'outbreak_probability')[['region_id', 'outbreak_probability']]
axes[0, 1].barh(range(len(top_risk)), top_risk['outbreak_probability'], color='coral')
axes[0, 1].set_yticks(range(len(top_risk)))
axes[0, 1].set_yticklabels(top_risk['region_id'].astype(str), fontsize=8)
axes[0, 1].set_xlabel('Outbreak Probability')
axes[0, 1].set_title('Top 20 High-Risk Regions')
axes[0, 1].grid(alpha=0.3, axis='x')

risk_levels = pd.cut(df['outbreak_probability'], bins=[0, 0.3, 0.5, 0.7, 1.0], labels=['Low', 'Medium', 'High', 'Critical'])
risk_counts = risk_levels.value_counts()
axes[1, 0].pie(risk_counts, labels=risk_counts.index, autopct='%1.1f%%', colors=['green', 'yellow', 'orange', 'red'])
axes[1, 0].set_title('Distribution by Risk Level')

axes[1, 1].scatter(df['environmental_risk'], df['outbreak_probability'], alpha=0.5, c=df['outbreak_probability'], cmap='YlOrRd')
axes[1, 1].set_xlabel('Environmental Risk')
axes[1, 1].set_ylabel('Outbreak Probability')
axes[1, 1].set_title('Environmental vs Outbreak Risk')
axes[1, 1].grid(alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "outbreak_risk_analytics.png"), dpi=150)
plt.close()

# Interactive map
print("\nCreating interactive map...")
india_map = folium.Map(location=[22.5937, 78.9629], zoom_start=5, tiles="OpenStreetMap")

def get_color(prob):
    if prob >= 0.7: return "darkred"
    elif prob >= 0.5: return "red"
    elif prob >= 0.3: return "orange"
    else: return "green"

# All regions
all_layer = folium.FeatureGroup(name='All Regions')
for _, row in df.iterrows():
    popup = f"<b>Region:</b> {row['region_id']}<br><b>Risk:</b> {row['outbreak_probability']:.3f}<br><b>Status:</b> {'HIGH RISK' if row['outbreak_predicted'] else 'Low'}<br><b>Pop:</b> {row['population']:,.0f}<br><b>Cases:</b> {row['case_count']:.0f}"
    folium.CircleMarker(
        location=[row['latitude'], row['longitude']],
        radius=3 + row['outbreak_probability'] * 7,
        color=get_color(row['outbreak_probability']),
        fill=True,
        fill_opacity=0.7,
        popup=folium.Popup(popup, max_width=300)
    ).add_to(all_layer)
all_layer.add_to(india_map)

# High risk markers
high_risk = df[df['outbreak_predicted'] == 1]
high_layer = folium.FeatureGroup(name='High Risk Only')
for _, row in high_risk.iterrows():
    popup = f"<b style='color:red;'>HIGH RISK</b><br><b>Region:</b> {row['region_id']}<br><b>Prob:</b> {row['outbreak_probability']:.3f}<br><b>Pop:</b> {row['population']:,.0f}"
    folium.Marker(
        location=[row['latitude'], row['longitude']],
        popup=folium.Popup(popup, max_width=300),
        icon=folium.Icon(color='red', icon='exclamation-triangle', prefix='fa')
    ).add_to(high_layer)
high_layer.add_to(india_map)

# Heatmap
heat_data = [[row['latitude'], row['longitude'], row['outbreak_probability']] for _, row in df.iterrows() if row['outbreak_probability'] > 0.1]
HeatMap(heat_data, name='Risk Heatmap', min_opacity=0.3, max_opacity=0.9, radius=20, blur=15,
        gradient={0.0: 'green', 0.4: 'yellow', 0.7: 'orange', 1.0: 'red'}).add_to(india_map)

folium.LayerControl().add_to(india_map)

# Save
output_file = os.path.join(OUTPUT_DIR, "india_xgboost_outbreak_map.html")
india_map.save(output_file)

# Report
report = {
    'model': {'f1': float(metrics.get('f1_score', 0)), 'roc_auc': float(metrics.get('roc_auc', 0)), 'threshold': float(opt_threshold)},
    'summary': {'total': len(df), 'high_risk': int(df['outbreak_predicted'].sum()), 'pct': float(df['outbreak_predicted'].mean() * 100)},
    'top_10_high_risk': df.nlargest(10, 'outbreak_probability')[['region_id', 'outbreak_probability', 'population']].to_dict('records')
}

with open(os.path.join(OUTPUT_DIR, "outbreak_risk_report.json"), 'w') as f:
    json.dump(report, f, indent=2)

print(f"\nMap saved: {output_file}")
print(f"Analytics saved: outbreak_risk_analytics.png")
print(f"Report saved: outbreak_risk_report.json")
print("\n" + "="*70)
print("COMPLETE - Open HTML file in browser")
print("="*70)
