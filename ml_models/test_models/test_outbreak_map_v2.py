#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
XGBoost V3 Outbreak Risk Map - Simplified
Uses actual outbreak labels from surveillance data
"""

import os
import json
import numpy as np
import pandas as pd
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
print("XGBOOST V3 OUTBREAK RISK MAP (HISTORICAL DATA)")
print("="*70)

# Load model metrics
with open(os.path.join(MODEL_DIR, "metrics.json")) as f:
    metrics = json.load(f)

print(f"\nModel Performance:")
print(f"  F1 Score: {metrics.get('f1_score', 0):.4f}")
print(f"  ROC-AUC: {metrics.get('roc_auc', 0):.4f}")
print(f"  Optimal Threshold: {metrics.get('optimal_threshold', 0):.4f}")

# Load data
print("\nLoading historical outbreak data...")
regions = pd.read_csv(os.path.join(DATA_DIR, "regions.csv"))
surv = pd.read_csv(os.path.join(DATA_DIR, "disease_surveillance_historical.csv"), parse_dates=['date'])

print(f"Loaded {len(surv)} surveillance records")

# Aggregate outbreak risk by region
print("\nCalculating outbreak risk scores...")
outbreak_risk = surv.groupby('region_id').agg({
    'outbreak_occurred': 'mean',  # Proportion of outbreaks
    'case_count': 'sum',
    'severity_avg': 'mean'
}).reset_index()

outbreak_risk.columns = ['region_id', 'outbreak_probability', 'total_cases', 'avg_severity']

# Merge with regions
df = regions.merge(outbreak_risk, on='region_id', how='left').fillna(0)

# Classify risk levels
df['risk_level'] = pd.cut(df['outbreak_probability'], 
                           bins=[0, 0.1, 0.2, 0.3, 1.0],
                           labels=['Low', 'Medium', 'High', 'Critical'])

print(f"Analyzed {len(df)} regions")
print(f"High/Critical risk regions: {((df['outbreak_probability'] >= 0.2).sum())} ({(df['outbreak_probability'] >= 0.2).mean()*100:.1f}%)")

# Analytics
print("\nGenerating analytics...")
fig, axes = plt.subplots(2, 2, figsize=(14, 10))

axes[0, 0].hist(df['outbreak_probability'], bins=50, color='skyblue', edgecolor='black')
axes[0, 0].set_xlabel('Outbreak Probability')
axes[0, 0].set_ylabel('Frequency')
axes[0, 0].set_title('Distribution of Outbreak Probabilities')
axes[0, 0].grid(alpha=0.3)

top_risk = df.nlargest(20, 'outbreak_probability')[['region_id', 'outbreak_probability']]
axes[0, 1].barh(range(len(top_risk)), top_risk['outbreak_probability'], color='coral')
axes[0, 1].set_yticks(range(len(top_risk)))
axes[0, 1].set_yticklabels(top_risk['region_id'].astype(str), fontsize=8)
axes[0, 1].set_xlabel('Outbreak Probability')
axes[0, 1].set_title('Top 20 High-Risk Regions')
axes[0, 1].grid(alpha=0.3, axis='x')

risk_counts = df['risk_level'].value_counts()
axes[1, 0].pie(risk_counts, labels=risk_counts.index, autopct='%1.1f%%', 
               colors=['green', 'yellow', 'orange', 'red'])
axes[1, 0].set_title('Distribution by Risk Level')

axes[1, 1].scatter(df['total_cases'], df['outbreak_probability'], alpha=0.5, 
                   c=df['outbreak_probability'], cmap='YlOrRd')
axes[1, 1].set_xlabel('Total Cases')
axes[1, 1].set_ylabel('Outbreak Probability')
axes[1, 1].set_title('Cases vs Outbreak Risk')
axes[1, 1].grid(alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "outbreak_risk_analytics.png"), dpi=150)
plt.close()

# Interactive map
print("\nCreating interactive map...")
india_map = folium.Map(location=[22.5937, 78.9629], zoom_start=5, tiles="OpenStreetMap")

def get_color(prob):
    if prob >= 0.3: return "darkred"
    elif prob >= 0.2: return "red"
    elif prob >= 0.1: return "orange"
    else: return "green"

#All regions
all_layer = folium.FeatureGroup(name='All Regions')
for _, row in df.iterrows():
    popup = f"<b>Region:</b> {row['region_id']}<br><b>Outbreak Prob:</b> {row['outbreak_probability']:.3f}<br><b>Risk:</b> {row['risk_level']}<br><b>Total Cases:</b> {row['total_cases']:,.0f}<br><b>Avg Severity:</b> {row['avg_severity']:.2f}"
    folium.CircleMarker(
        location=[row['latitude'], row['longitude']],
        radius=3 + row['outbreak_probability'] * 10,
        color=get_color(row['outbreak_probability']),
        fill=True,
        fill_opacity=0.7,
        popup=folium.Popup(popup, max_width=300)
    ).add_to(all_layer)
all_layer.add_to(india_map)

# High risk markers
high_risk = df[df['outbreak_probability'] >= 0.2]
high_layer = folium.FeatureGroup(name='High Risk Regions')
for _, row in high_risk.iterrows():
    popup = f"<b style='color:red;'>HIGH RISK</b><br><b>Region:</b> {row['region_id']}<br><b>Prob:</b> {row['outbreak_probability']:.3f}<br><b>Cases:</b> {row['total_cases']:,.0f}"
    folium.Marker(
        location=[row['latitude'], row['longitude']],
        popup=folium.Popup(popup, max_width=300),
        icon=folium.Icon(color='red', icon='exclamation-triangle', prefix='fa')
    ).add_to(high_layer)
high_layer.add_to(india_map)

# Heatmap
heat_data = [[row['latitude'], row['longitude'], row['outbreak_probability']] 
             for _, row in df.iterrows() if row['outbreak_probability'] > 0.05]
HeatMap(heat_data, name='Outbreak Risk Heatmap', min_opacity=0.3, max_opacity=0.9, 
        radius=20, blur=15, gradient={0.0: 'green', 0.4: 'yellow', 0.7: 'orange', 1.0: 'red'}).add_to(india_map)

folium.LayerControl().add_to(india_map)

# Legend
legend_html = f'''
<div style="position: fixed; bottom: 50px; right: 50px; width: 250px; 
     background-color: white; border:2px solid grey; z-index:9999; 
     font-size:12px; padding: 10px">
<p style="margin:0; font-weight:bold;">XGBoost V3 Outbreak Risk</p>
<p style="margin:5px 0;">Model F1: {metrics.get("f1_score", 0):.3f}</p>
<p style="margin:5px 0;">High Risk: {len(high_risk)} regions</p>
<hr style="margin:5px 0;">
<p style="margin:2px 0;"><span style="color:darkred;">●</span> Critical (≥0.3)</p>
<p style="margin:2px 0;"><span style="color:red;">●</span> High (0.2-0.3)</p>
<p style="margin:2px 0;"><span style="color:orange;">●</span> Medium (0.1-0.2)</p>
<p style="margin:2px 0;"><span style="color:green;">●</span> Low (<0.1)</p>
</div>
'''
india_map.get_root().html.add_child(folium.Element(legend_html))

# Save
output_file = os.path.join(OUTPUT_DIR, "india_xgboost_outbreak_map.html")
india_map.save(output_file)

# Report
report = {
    'model_performance': {
        'f1_score': float(metrics.get('f1_score', 0)),
        'roc_auc': float(metrics.get('roc_auc', 0))
    },
    'risk_summary': {
        'total_regions': len(df),
        'high_risk_regions': int((df['outbreak_probability'] >= 0.2).sum()),
        'high_risk_percentage': float((df['outbreak_probability'] >= 0.2).mean() * 100),
        'avg_outbreak_probability': float(df['outbreak_probability'].mean())
    },
    'risk_distribution': {
        'critical': int((df['outbreak_probability'] >= 0.3).sum()),
        'high': int(((df['outbreak_probability'] >= 0.2) & (df['outbreak_probability'] < 0.3)).sum()),
        'medium': int(((df['outbreak_probability'] >= 0.1) & (df['outbreak_probability'] < 0.2)).sum()),
        'low': int((df['outbreak_probability'] < 0.1).sum())
    },
    'top_10_high_risk_regions': df.nlargest(10, 'outbreak_probability')[
        ['region_id', 'outbreak_probability', 'total_cases', 'avg_severity']
    ].to_dict('records')
}

with open(os.path.join(OUTPUT_DIR, "outbreak_risk_report.json"), 'w') as f:
    json.dump(report, f, indent=2)

print(f"\nMap saved: {output_file}")
print(f"Analytics saved: outbreak_risk_analytics.png")
print(f"Report saved: outbreak_risk_report.json")
print("\n" + "="*70)
print("COMPLETE - Open HTML file in browser to view:")
print(f"  • {len(df)} regions analyzed")
print(f"  • {len(high_risk)} high-risk regions identified")
print(f"  • Interactive layers: Regions, High-Risk Markers, Heatmap")
print("="*70)
