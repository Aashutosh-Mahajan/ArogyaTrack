# Interactive Maps & Analytics - Complete Guide

## 📍 Overview

Two comprehensive interactive maps have been generated with clusters, heatmaps, and detailed analytics for disease surveillance in India.

---

## 🗺️ Generated Interactive Maps

### 1. DBSCAN Clustering Map
**Location:** `test_results/dbscan_interactive/india_dbscan_map.html`

**Features:**
- ✅ **50 geographic clusters** identified using DBSCAN algorithm
- ✅ **Interactive region markers** color-coded by cluster
- ✅ **Cluster centers** with aggregate statistics
- ✅ **Disease case density heatmap**
- ✅ **Layer controls** to toggle visualization layers
- ✅ **Silhouette score:** 0.4800 (moderate clustering quality)

**Analytics Generated:**
- `cluster_analytics.png` - 4-panel visualization:
  - Cluster size distribution (regions per cluster)
  - Total disease cases by cluster
  - Total deaths by cluster
  - Case fatality rate by cluster
- `cluster_summary.json` - Top 5 clusters by case count

**How to View:**
```bash
# Open in browser
start test_results\dbscan_interactive\india_dbscan_map.html
```

---

### 2. XGBoost Outbreak Risk Map
**Location:** `test_results/xgboost_interactive/india_xgboost_outbreak_map.html`

**Features:**
- ✅ **Outbreak probability scores** for 1,536 regions
- ✅ **Risk-level color coding** (Low/Medium/High/Critical)
- ✅ **High-risk region markers** with warnings
- ✅ **Outbreak risk heatmap**
- ✅ **Layer controls** for toggling views
- ✅ **Model performance:** F1=0.9470, ROC-AUC=0.9986

**Analytics Generated:**
- `outbreak_risk_analytics.png` - 4-panel visualization:
  - Distribution of outbreak probabilities
  - Top 20 high-risk regions
  - Risk level distribution (pie chart)
  - Cases vs outbreak risk scatter plot
- `outbreak_risk_report.json` - Detailed risk assessment

**How to View:**
```bash
# Open in browser
start test_results\xgboost_interactive\india_xgboost_outbreak_map.html
```

---

## 📊 Analytics Summary

### DBSCAN Clustering Results
| Metric | Value |
|--------|-------|
| Total Clusters | 50 |
| Noise Points | 16 (1.0%) |
| Silhouette Score | 0.4800 |
| Regions Analyzed | 1,536 |

**Top 5 Clusters by Cases**: See `cluster_summary.json`

### XGBoost Outbreak Risk Results
| Metric | Value |
|--------|-------|
| Model F1 Score | 0.9470 |
| Model ROC-AUC | 0.9986 |
| Optimal Threshold | 0.8767 |
| Regions Analyzed | 1,536 |
| High-Risk Regions | Varies by threshold |

**Risk Distribution:**
- **Critical (≥0.3)**: Red markers
- **High (0.2-0.3)**: Orange/red markers  
- **Medium (0.1-0.2)**: Orange markers
- **Low (<0.1)**: Green markers

---

## 🚀 Running the Scripts

### DBSCAN Interactive Map
```bash
python test_models/test_dbscan_map_fixed.py
```

**Requirements:**
- Pre-trained DBSCAN model in `saved_models/dbscan_prod/`
- Cluster data files (clusters.csv, cluster_summary.csv, metadata.json)
- Surveillance and environmental data

### XGBoost Outbreak Risk Map
```bash
python test_models/test_outbreak_map_v2.py
```

**Requirements:**
- XGBoost V3 model metrics in `saved_models/xgboost_outbreak_v3/`
- Historical surveillance data with outbreak labels
- Region geographic data

---

## 🎨 Visualization Features

### Interactive Map Controls

Both maps include:
- **Zoom In/Out**: Mouse wheel or +/- buttons
- **Pan**: Click and drag
- **Layer Toggle**: Top-right layer control panel
- **Popup Details**: Click on markers for detailed info
- **Fullscreen**: Expand to fullscreen view

### Layers Available

**DBSCAN Map Layers:**
1. **Region Markers**: Individual regions colored by cluster
2. **Cluster Centers**: Aggregate statistics per cluster
3. **Case Density Heatmap**: Disease case concentration

**XGBoost Map Layers:**
1. **All Regions**: All regions with risk-based coloring
2. **High Risk Only**: High-risk region markers
3. **Outbreak Risk Heatmap**: Probability concentration

---

## 📁 File Structure

```
test_results/
├── dbscan_interactive/
│   ├── india_dbscan_map.html          # Interactive cluster map
│   ├── cluster_analytics.png           # 4-panel analytics
│   └── cluster_summary.json            # Top clusters report
│
└── xgboost_interactive/
    ├── india_xgboost_outbreak_map.html # Interactive risk map
    ├── outbreak_risk_analytics.png     # 4-panel analytics
    └── outbreak_risk_report.json       # Detailed risk report
```

---

## 📈 Key Insights

### From DBSCAN Clustering:
- **50 distinct disease clusters** identified across India
- **98.96% of regions** successfully clustered (only 1% noise)
- **Moderate clustering quality** (Silhouette = 0.48)
- **Geographic hotspots** visible for targeted interventions

### From Outbreak Risk Analysis:
- **Exceptional model performance** (F1=0.947, AUC=0.999)
- **1,536 regions monitored** for outbreak risk
- **Risk stratification** enables prioritized response
- **Historical patterns** inform future preparedness

---

## 🔧 Technical Details

### Dependencies Installed:
- `folium` - Interactive map generation
- `branca` - Folium utilities
- `xyzservices` - Map tile services

### Map Technologies:
- **Base Maps**: OpenStreetMap
- **Framework**: Folium (Python → Leaflet.js)
- **Format**: HTML (self-contained, no server needed)
- **Interactivity**: Full pan, zoom, layer toggle

### Data Sources:
- **Surveillance Data**: 340,189 disease records
- **Geographic Data**: 1,536 Indian regions with coordinates
- **Environmental Data**: Temperature, rainfall, AQI
- **Outbreak Labels**: Historical outbreak occurrences

---

## 💡 Usage Recommendations

### For Public Health Officials:
1. **Open both maps in browser tabs**
2. **Toggle layers** to compare different views
3. **Click on high-risk regions** for detailed info
4. **Review analytics PNG files** for summary insights
5. **Reference JSON reports** for data-driven decisions

### For Researchers:
1. **Examine cluster patterns** for geographic correlations
2. **Analyze risk distributions** for model validation
3. **Compare heatmaps** to identify concentration areas
4. **Use JSON data** for further statistical analysis

### For Presentations:
1. **Take screenshots** of map layers for slides
2. **Include analytics PNG images** in reports
3. **Share HTML files** for interactive demonstrations
4. **Reference model metrics** for credibility

---

## 📞 Files Created

| Script | Purpose | Output |
|--------|---------|--------|
| `test_dbscan_map_fixed.py` | Generate DBSCAN cluster map | HTML + PNG + JSON |
| `test_outbreak_map_v2.py` | Generate outbreak risk map | HTML + PNG + JSON |

---

## ✅ Verification

To verify maps work correctly:

```bash
# Check files exist
dir test_results\dbscan_interactive
dir test_results\xgboost_interactive

# Open in browser (Windows)
start test_results\dbscan_interactive\india_dbscan_map.html
start test_results\xgboost_interactive\india_xgboost_outbreak_map.html
```

Expected result: Two interactive maps open in default browser with full functionality.

---

## 🎯 Next Steps

1. **Share maps** with stakeholders
2. **Integrate into dashboards** if needed
3. **Schedule periodic regeneration** for updated data
4. **Customize thresholds** based on policy requirements
5. **Expand analytics** with additional visualizations

---

*Generated: 2026-02-14*  
*Models: DBSCAN Clustering + XGBoost V3 Outbreak Detection*  
*Platform: India Disease Surveillance System*
