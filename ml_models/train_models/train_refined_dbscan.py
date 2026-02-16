#!/usr/bin/env python3
"""
train_refined_dbscan.py  -  Density-Aware DBSCAN Clustering  (v5.0)

KEY IMPROVEMENTS over v4.0:
  - 14 features (geo, epi, infra, temporal, derived)
  - PCA decorrelation + feature subset sweeps
  - K-NN eps estimation with knee detection
  - Exhaustive (geo_w, eps, min_samples) grid  (3600+ combos)
  - Composite scoring: silhouette * (1 - Gini imbalance)
  - HDBSCAN + Agglomerative fallbacks
  - Progress bars throughout

TARGET: Silhouette > 0.60
"""

import os, sys, gc, json, time, warnings
from datetime import datetime
import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.cluster import DBSCAN, AgglomerativeClustering
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
from sklearn.neighbors import NearestNeighbors
from sklearn.decomposition import PCA

warnings.filterwarnings("ignore")

try:
    import hdbscan
    HAS_HDBSCAN = True
except ImportError:
    HAS_HDBSCAN = False

# ==========================================================
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR    = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
DATA_DIR    = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")
OUTPUT_DIR  = os.path.join(BASE_DIR, "saved_models", "dbscan_prod")
os.makedirs(OUTPUT_DIR, exist_ok=True)
np.random.seed(42)

def progress_bar(current, total, label="", width=30):
    filled = int(width * current / total) if total > 0 else 0
    bar = "█" * filled + "░" * (width - filled)
    pct = current / total * 100 if total > 0 else 0
    sys.stdout.write(f"\r  {label}[{bar}] {current}/{total} ({pct:.0f}%)")
    sys.stdout.flush()
    if current >= total:
        print()

def cluster_balance_score(labels):
    """1.0 = perfectly balanced, 0.0 = all in one cluster"""
    valid = labels[labels >= 0]
    if len(valid) < 2:
        return 0.0
    _, counts = np.unique(valid, return_counts=True)
    if len(counts) < 2:
        return 0.0
    shares = counts / counts.sum()
    # Gini coefficient
    n = len(shares)
    sorted_shares = np.sort(shares)
    index = np.arange(1, n + 1)
    gini = (2 * np.sum(index * sorted_shares) - (n + 1) * np.sum(sorted_shares)) / (n * np.sum(sorted_shares))
    return 1.0 - gini  # 1 = balanced

def composite_score(sil, labels, sil_weight=0.7, balance_weight=0.3):
    """Weighted combination of silhouette and balance"""
    bal = cluster_balance_score(labels)
    return sil_weight * sil + balance_weight * bal

print("=" * 70)
print("  DBSCAN DENSITY-AWARE CLUSTERING v5.0")
print("  PCA | Composite scoring | Exhaustive grid | Progress bars")
print("=" * 70)

# ==========================================================
# [1] LOAD DATA
# ==========================================================
print("\n[1] Loading data ...")
t0 = time.time()

surv_path = os.path.join(DATA_DIR, "disease_surveillance_historical.csv")
chunk_aggs = []
total_rows = 0

for chunk in pd.read_csv(surv_path, parse_dates=["date"], chunksize=1_000_000):
    total_rows += len(chunk)
    agg = chunk.groupby("region_id").agg(
        total_cases=("case_count", "sum"),
        mean_cases=("case_count", "mean"),
        std_cases=("case_count", "std"),
        max_cases=("case_count", "max"),
        min_cases=("case_count", "min"),
        outbreak_sum=("outbreak_occurred", "sum"),
        n_reports=("case_count", "count"),
    ).reset_index()

    chunk["month"] = chunk["date"].dt.month
    monsoon_mask = chunk["month"].isin([6, 7, 8, 9])
    monsoon_cases = chunk[monsoon_mask].groupby("region_id")["case_count"].sum().reset_index()
    monsoon_cases.columns = ["region_id", "monsoon_cases"]
    agg = agg.merge(monsoon_cases, on="region_id", how="left")
    agg["monsoon_cases"] = agg["monsoon_cases"].fillna(0)

    chunk_aggs.append(agg)

print(f"  Surveillance rows: {total_rows:,}")
regions = pd.read_csv(os.path.join(DATA_DIR, "regions.csv"))
print(f"  Regions: {len(regions):,}")

# ==========================================================
# [2] PREPARE DATA
# ==========================================================
print("\n[2] Preparing ...")

combined = pd.concat(chunk_aggs, ignore_index=True)
region_agg = combined.groupby("region_id").agg(
    total_cases=("total_cases", "sum"),
    max_cases=("max_cases", "max"),
    min_cases=("min_cases", "min"),
    outbreak_sum=("outbreak_sum", "sum"),
    n_reports=("n_reports", "sum"),
    monsoon_cases=("monsoon_cases", "sum"),
).reset_index()

region_agg["mean_cases"] = region_agg["total_cases"] / region_agg["n_reports"]
region_agg["outbreak_rate"] = region_agg["outbreak_sum"] / region_agg["n_reports"]
region_agg["case_range"] = region_agg["max_cases"] - region_agg["min_cases"]
region_agg["monsoon_ratio"] = region_agg["monsoon_cases"] / (region_agg["total_cases"] + 1)

if "std_cases" in combined.columns:
    std_agg = combined.groupby("region_id")["std_cases"].mean().reset_index()
    std_agg.columns = ["region_id", "case_std"]
    region_agg = region_agg.merge(std_agg, on="region_id", how="left")
    region_agg["case_variability"] = region_agg["case_std"] / (region_agg["mean_cases"] + 1)
else:
    region_agg["case_variability"] = 0

merge_cols = ["region_id", "latitude", "longitude", "population"]
for col in ["region_type", "sanitation_index", "hospital_count", "area_sq_km"]:
    if col in regions.columns:
        merge_cols.append(col)

df = region_agg.merge(regions[merge_cols], on="region_id", how="left")
df = df.dropna(subset=["latitude", "longitude"]).reset_index(drop=True)

df["population_log"] = np.log1p(df["population"])
df["cases_per_capita"] = df["mean_cases"] / (df["population"] / 100_000 + 1)
if "area_sq_km" in df.columns:
    df["pop_density_log"] = np.log1p(df["population"] / (df["area_sq_km"] + 1))
df["outbreak_severity"] = df["outbreak_rate"] * df["mean_cases"]

print(f"  Prepared {len(df)} regions")

# ==========================================================
# [3] FEATURES
# ==========================================================
print("\n[3] Building features ...")

geo_features = ["latitude", "longitude"]
epi_features = ["mean_cases", "max_cases", "outbreak_rate", "population_log",
                 "cases_per_capita", "case_variability", "monsoon_ratio", "outbreak_severity"]

for col in ["sanitation_index", "hospital_count", "pop_density_log"]:
    if col in df.columns:
        epi_features.append(col)

all_features = geo_features + epi_features
X_raw = df[all_features].astype(float).copy()
for col in X_raw.columns:
    arr = X_raw[col].values
    arr[~np.isfinite(arr)] = 0
    X_raw[col] = arr
X_raw = X_raw.fillna(0)

print(f"  {len(all_features)} features ({len(geo_features)} geo + {len(epi_features)} epi)")

# Scale separately
geo_scaler = RobustScaler()
epi_scaler = RobustScaler()
X_geo_scaled = geo_scaler.fit_transform(X_raw[geo_features])
X_epi_scaled = epi_scaler.fit_transform(X_raw[epi_features])

# Also prepare PCA variants
pca5 = PCA(n_components=min(5, len(epi_features)))
X_epi_pca5 = pca5.fit_transform(X_epi_scaled)
print(f"  PCA variance explained ({pca5.n_components_} comps): "
      f"{pca5.explained_variance_ratio_.sum():.2%}")

# ==========================================================
# [4] K-NN EPS ESTIMATION (on default geo_w=2 matrix)
# ==========================================================
print("\n[4] K-NN eps estimation ...")

X_default = np.hstack([X_geo_scaled * 2.0, X_epi_scaled])
knn_eps_estimates = []
for k in [4, 5, 8, 10]:
    nn = NearestNeighbors(n_neighbors=k, metric="euclidean", n_jobs=-1)
    nn.fit(X_default)
    dists, _ = nn.kneighbors(X_default)
    kth = np.sort(dists[:, k - 1])
    grad2 = np.gradient(np.gradient(kth))
    knee = np.argmax(grad2[:int(len(kth) * 0.9)])
    knn_eps_estimates.append(kth[knee])
    print(f"  k={k:2d}: knee_eps={kth[knee]:.3f}, P50={np.median(kth):.3f}")

median_eps = np.median(knn_eps_estimates)
print(f"  Median eps: {median_eps:.3f}")

# ==========================================================
# [5] EXHAUSTIVE GRID: geo_w × eps × min_samples × feature_set
# ==========================================================
print("\n[5] Exhaustive grid search ...")

# Grid dimensions
GEO_WEIGHTS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 3.5]
EPS_GRID = sorted(set([
    0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
    1.2, 1.5, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0,
    median_eps * 0.3, median_eps * 0.5, median_eps * 0.7,
    median_eps * 0.85, median_eps, median_eps * 1.2,
    median_eps * 1.5, median_eps * 2.0,
]))
MS_GRID = [2, 3, 4, 5, 6, 8, 10, 12, 15]

# Feature variants: full epi and PCA-reduced epi
FEATURE_SETS = {
    "full": X_epi_scaled,
    "pca5": X_epi_pca5,
}

total_combos = len(GEO_WEIGHTS) * len(EPS_GRID) * len(MS_GRID) * len(FEATURE_SETS)
print(f"  Grid: {len(GEO_WEIGHTS)} geo_w × {len(EPS_GRID)} eps × {len(MS_GRID)} ms × "
      f"{len(FEATURE_SETS)} fsets = {total_combos:,} combos")

best_composite = -1.0
best_sil = -1.0
best_eps = 1.0
best_ms = 5
best_gw = 2.0
best_fset = "full"
best_labels = None
best_n_clusters = 0
best_X = None

combo_i = 0
top_results = []

for fset_name, X_epi_variant in FEATURE_SETS.items():
    for gw in GEO_WEIGHTS:
        X_mat = np.hstack([X_geo_scaled * gw, X_epi_variant])
        for eps in EPS_GRID:
            for ms in MS_GRID:
                combo_i += 1
                if combo_i % 200 == 0 or combo_i == total_combos:
                    progress_bar(combo_i, total_combos, "Search ")

                db = DBSCAN(eps=eps, min_samples=ms, metric="euclidean", n_jobs=-1)
                labels = db.fit_predict(X_mat)

                n_cl = len(set(labels)) - (1 if -1 in labels else 0)
                noise_pct = (labels == -1).mean()

                if n_cl < 3 or n_cl > 100:
                    continue
                if noise_pct > 0.5:
                    continue

                valid = labels != -1
                if valid.sum() < 20:
                    continue

                sil = silhouette_score(X_mat[valid], labels[valid])
                comp = composite_score(sil, labels)

                top_results.append((comp, sil, eps, ms, gw, fset_name, n_cl, noise_pct))

                if comp > best_composite:
                    best_composite = comp
                    best_sil = sil
                    best_eps = eps
                    best_ms = ms
                    best_gw = gw
                    best_fset = fset_name
                    best_labels = labels.copy()
                    best_n_clusters = n_cl
                    best_X = X_mat.copy()

# Also track pure silhouette best
top_results.sort(key=lambda x: x[1], reverse=True)
pure_sil_best = top_results[0] if top_results else None

top_results.sort(reverse=True)

print(f"\n  Top 10 by composite score:")
for i, (comp, sil, eps, ms, gw, fset, nc, np_) in enumerate(top_results[:10]):
    marker = " ★" if i == 0 else ""
    print(f"    comp={comp:.4f} sil={sil:.4f} eps={eps:.3f} ms={ms:2d} "
          f"gw={gw:.2f} {fset:5s} cl={nc:3d} noise={np_:.1%}{marker}")

if pure_sil_best:
    pcomp, psil, peps, pms, pgw, pfset, pnc, pnp = pure_sil_best
    print(f"\n  Pure silhouette best: sil={psil:.4f} eps={peps:.3f} ms={pms} "
          f"gw={pgw:.2f} {pfset} cl={pnc} noise={pnp:.1%}")

    # If pure sil is above 0.60 and composite isn't, prefer pure sil
    if psil > best_sil and psil >= 0.60:
        print(f"  [SWITCH] Using pure silhouette winner (sil={psil:.4f} > {best_sil:.4f})")
        X_switch = np.hstack([X_geo_scaled * pgw,
                              FEATURE_SETS[pfset]])
        db = DBSCAN(eps=peps, min_samples=pms, metric="euclidean", n_jobs=-1)
        best_labels = db.fit_predict(X_switch)
        best_sil = psil
        best_eps = peps
        best_ms = pms
        best_gw = pgw
        best_fset = pfset
        best_n_clusters = pnc
        best_X = X_switch.copy()

print(f"\n  WINNER: sil={best_sil:.4f}, composite={best_composite:.4f}")
print(f"  eps={best_eps:.3f}, ms={best_ms}, gw={best_gw:.2f}, fset={best_fset}, "
      f"clusters={best_n_clusters}")

# ---- Fine grid around winner ----
print(f"\n  Fine search around winner ...")
fine_count = 0
for gw in np.linspace(max(0.1, best_gw - 0.5), best_gw + 0.5, 7):
    X_fine = np.hstack([X_geo_scaled * gw, FEATURE_SETS[best_fset]])
    for eps in np.linspace(max(0.05, best_eps * 0.6), best_eps * 1.4, 15):
        for ms in range(max(2, best_ms - 2), best_ms + 3):
            fine_count += 1
            db = DBSCAN(eps=eps, min_samples=ms, metric="euclidean", n_jobs=-1)
            labels = db.fit_predict(X_fine)
            n_cl = len(set(labels)) - (1 if -1 in labels else 0)
            valid = labels != -1
            if n_cl < 3 or valid.sum() < 20:
                continue
            sil = silhouette_score(X_fine[valid], labels[valid])
            if sil > best_sil:
                best_sil = sil
                best_eps = eps
                best_ms = ms
                best_gw = gw
                best_labels = labels.copy()
                best_n_clusters = n_cl
                best_X = X_fine.copy()
                print(f"    NEW BEST: sil={sil:.4f} eps={eps:.3f} ms={ms} gw={gw:.2f} cl={n_cl}")

print(f"  Fine search: {fine_count} combos")
print(f"  Final DBSCAN: sil={best_sil:.4f}, eps={best_eps:.3f}, ms={best_ms}, "
      f"gw={best_gw:.2f}, clusters={best_n_clusters}")

# ==========================================================
# [5b] HDBSCAN FALLBACK
# ==========================================================
if best_sil < 0.55 and HAS_HDBSCAN:
    print(f"\n[5b] HDBSCAN fallback (sil {best_sil:.3f} < 0.55) ...")
    for fset_name, X_epi_v in FEATURE_SETS.items():
        for gw in [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]:
            X_hdb = np.hstack([X_geo_scaled * gw, X_epi_v])
            for min_cs in [5, 8, 10, 15, 20, 30]:
                for min_s in [3, 5, 8]:
                    cl = hdbscan.HDBSCAN(min_cluster_size=min_cs, min_samples=min_s,
                                         metric="euclidean", cluster_selection_method="eom")
                    hlab = cl.fit_predict(X_hdb)
                    n_cl = len(set(hlab)) - (1 if -1 in hlab else 0)
                    valid = hlab != -1
                    if n_cl >= 3 and valid.sum() >= 20:
                        sil = silhouette_score(X_hdb[valid], hlab[valid])
                        if sil > best_sil:
                            best_sil = sil
                            best_labels = hlab
                            best_n_clusters = n_cl
                            best_X = X_hdb.copy()
                            print(f"    HDBSCAN NEW BEST: sil={sil:.4f} gw={gw} {fset_name} "
                                  f"min_cs={min_cs} min_s={min_s} cl={n_cl}")

# ==========================================================
# [5c] AGGLOMERATIVE FALLBACK
# ==========================================================
if best_sil < 0.50:
    print(f"\n[5c] Agglomerative fallback (sil {best_sil:.3f} < 0.50) ...")
    for fset_name, X_epi_v in FEATURE_SETS.items():
        for gw in [0.5, 1.0, 1.5, 2.0, 2.5]:
            X_agg = np.hstack([X_geo_scaled * gw, X_epi_v])
            for n_cl in range(5, 45):
                agg_model = AgglomerativeClustering(n_clusters=n_cl)
                alab = agg_model.fit_predict(X_agg)
                sil = silhouette_score(X_agg, alab)
                if sil > best_sil:
                    best_sil = sil
                    best_labels = alab
                    best_n_clusters = n_cl
                    best_X = X_agg.copy()
                    print(f"    Agg NEW BEST: sil={sil:.4f} gw={gw} {fset_name} n_cl={n_cl}")

# ==========================================================
# [6] CLUSTER PROFILES
# ==========================================================
print(f"\n[6] Cluster profiles ...")

df["cluster"] = best_labels
noise_count = int((best_labels == -1).sum())

cluster_profiles = {}
for cl in sorted(df["cluster"].unique()):
    if cl == -1:
        continue
    mask = df["cluster"] == cl
    profile = {
        "n_regions": int(mask.sum()),
        "avg_outbreak_rate": float(df.loc[mask, "outbreak_rate"].mean()),
        "avg_cases": float(df.loc[mask, "mean_cases"].mean()),
        "avg_latitude": float(df.loc[mask, "latitude"].mean()),
        "avg_longitude": float(df.loc[mask, "longitude"].mean()),
        "avg_population": float(df.loc[mask, "population"].mean()),
        "avg_cases_per_capita": float(df.loc[mask, "cases_per_capita"].mean()),
        "avg_monsoon_ratio": float(df.loc[mask, "monsoon_ratio"].mean()),
    }
    cluster_profiles[int(cl)] = profile

    risk = "HIGH" if profile["avg_outbreak_rate"] > 0.15 else \
           "MEDIUM" if profile["avg_outbreak_rate"] > 0.08 else "LOW"
    print(f"  Cl {cl:3d}: {profile['n_regions']:3d} rgns, "
          f"outbreak={profile['avg_outbreak_rate']:.3f} ({risk}), "
          f"cases={profile['avg_cases']:.1f}")

if noise_count > 0:
    print(f"  Noise: {noise_count} ({noise_count/len(df)*100:.1f}%)")

# ==========================================================
# [7] HOTSPOTS
# ==========================================================
print("\n[7] Hotspot identification ...")
hotspot_threshold = df["outbreak_rate"].quantile(0.75)
hotspot_clusters = [cl for cl, p in cluster_profiles.items()
                    if p["avg_outbreak_rate"] > hotspot_threshold]
n_hotspot_regions = df[df["cluster"].isin(hotspot_clusters)].shape[0]
print(f"  Hotspot clusters: {hotspot_clusters}")
print(f"  Hotspot regions: {n_hotspot_regions}")

# ==========================================================
# [8] QUALITY METRICS
# ==========================================================
print("\n[8] Quality metrics ...")
valid_mask = best_labels != -1
ch_score = db_score = 0
if valid_mask.sum() > 10 and best_n_clusters > 1:
    ch_score = calinski_harabasz_score(best_X[valid_mask], best_labels[valid_mask])
    db_score = davies_bouldin_score(best_X[valid_mask], best_labels[valid_mask])
    print(f"  Calinski-Harabasz: {ch_score:.2f}")
    print(f"  Davies-Bouldin:    {db_score:.4f}")

# ==========================================================
# [9] SAVE
# ==========================================================
print("\n[9] Saving ...")

dbscan_final = DBSCAN(eps=best_eps, min_samples=best_ms, metric="euclidean", n_jobs=-1)
dbscan_final.fit(best_X)
joblib.dump(dbscan_final, os.path.join(OUTPUT_DIR, "dbscan_model.pkl"))
joblib.dump(geo_scaler, os.path.join(OUTPUT_DIR, "geo_scaler.pkl"))
joblib.dump(epi_scaler, os.path.join(OUTPUT_DIR, "epi_scaler.pkl"))

save_cols = [c for c in ["region_id", "cluster", "latitude", "longitude",
             "mean_cases", "outbreak_rate", "population",
             "cases_per_capita", "monsoon_ratio"] if c in df.columns]
df[save_cols].to_csv(os.path.join(OUTPUT_DIR, "cluster_assignments.csv"), index=False)

with open(os.path.join(OUTPUT_DIR, "features.json"), "w") as f:
    json.dump(all_features, f, indent=2)

metadata = {
    "model": "DBSCAN v5.0",
    "timestamp": datetime.utcnow().isoformat(),
    "parameters": {
        "best_eps": float(best_eps), "best_min_samples": int(best_ms),
        "geo_weight": float(best_gw), "feature_set": best_fset,
        "n_features": len(all_features),
    },
    "results": {
        "n_clusters": int(best_n_clusters), "n_points": int(len(df)),
        "n_noise": noise_count, "noise_pct": float(noise_count / len(df) * 100),
    },
    "quality_metrics": {
        "silhouette_score": float(best_sil),
        "calinski_harabasz": float(ch_score), "davies_bouldin": float(db_score),
    },
    "outbreak_correlation": {
        "high_risk_clusters": len(hotspot_clusters),
        "threshold": float(hotspot_threshold),
        "n_hotspot_regions": n_hotspot_regions,
    },
}
with open(os.path.join(OUTPUT_DIR, "metadata.json"), "w") as f:
    json.dump(metadata, f, indent=2)

metrics = {
    "model": "DBSCAN v5.0",
    "silhouette_score": float(best_sil),
    "n_clusters": int(best_n_clusters),
    "best_eps": float(best_eps), "best_min_samples": int(best_ms),
    "noise_count": noise_count, "noise_pct": float(noise_count / len(df)),
    "n_hotspot_clusters": len(hotspot_clusters),
    "n_hotspot_regions": n_hotspot_regions,
    "cluster_profiles": cluster_profiles,
    "calinski_harabasz": float(ch_score), "davies_bouldin": float(db_score),
    "timestamp": datetime.utcnow().isoformat(),
}
with open(os.path.join(OUTPUT_DIR, "metrics.json"), "w") as f:
    json.dump(metrics, f, indent=2)

elapsed = time.time() - t0
sil_ok = "✓" if best_sil > 0.60 else "✗"

print(f"\n{'='*70}")
print(f"  TRAINING COMPLETE — DBSCAN v5.0")
print(f"{'='*70}")
print(f"  Silhouette: {best_sil:.4f}  (target > 0.60) {sil_ok}")
print(f"  Clusters:   {best_n_clusters}")
print(f"  Noise:      {noise_count} ({noise_count/len(df)*100:.1f}%)")
print(f"  Hotspots:   {len(hotspot_clusters)} clusters, {n_hotspot_regions} regions")
print(f"  Params:     eps={best_eps:.3f}, ms={best_ms}, gw={best_gw:.2f}, fset={best_fset}")
print(f"  Features:   {len(all_features)}")
print(f"  Time:       {elapsed:.0f}s")
print(f"{'='*70}")
