#!/usr/bin/env python3
"""
train_all_refined.py  -  Master Training Pipeline  (v4.0)

Orchestrates the complete data generation + model training pipeline:
  1. Generate production data (10-12M records)
  2. Validate generated data
  3. Train all 4 models in sequence
  4. Print performance summary with pass/fail targets
"""

import os
import sys
import json
import subprocess
import time
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "india_surveillance_extreme_quality")

# Scripts to run in order
PIPELINE = [
    {
        "name": "Data Generation",
        "script": os.path.join(BASE_DIR, "generate_production_data.py"),
        "description": "Generate 10-12M surveillance records",
        "timeout_minutes": 120,
    },
    {
        "name": "Forecast Model",
        "script": os.path.join(BASE_DIR, "train_models", "train_refined_forecast.py"),
        "description": "Prophet + XGBoost ensemble",
        "timeout_minutes": 30,
    },
    {
        "name": "XGBoost Outbreak Detector",
        "script": os.path.join(BASE_DIR, "train_models", "train_refined_xgboost.py"),
        "description": "50-feature supervised outbreak detection",
        "timeout_minutes": 30,
    },
    {
        "name": "Isolation Forest",
        "script": os.path.join(BASE_DIR, "train_models", "train_refined_isolation_forest.py"),
        "description": "Ensemble of 5 isolation forests",
        "timeout_minutes": 20,
    },
    {
        "name": "DBSCAN Clustering",
        "script": os.path.join(BASE_DIR, "train_models", "train_refined_dbscan.py"),
        "description": "Density-aware geographic clustering",
        "timeout_minutes": 10,
    },
]

# Target metrics for pass/fail
TARGETS = {
    "forecast": {"r2": 0.65, "mape_max": 15.0},
    "xgboost": {"auc": 0.93, "f1": 0.78},
    "isolation_forest": {"auc": 0.92, "f1": 0.55},
    "dbscan": {"silhouette": 0.60},
}


def run_step(step, step_num, total):
    """Run a pipeline step and return success status."""
    print(f"\n{'='*80}")
    print(f"  STEP {step_num}/{total}: {step['name']}")
    print(f"  {step['description']}")
    print(f"  Script: {os.path.basename(step['script'])}")
    print(f"{'='*80}\n")

    if not os.path.exists(step["script"]):
        print(f"  [ERROR] Script not found: {step['script']}")
        return False, 0.0

    t0 = time.time()
    timeout_sec = step["timeout_minutes"] * 60

    try:
        result = subprocess.run(
            [sys.executable, step["script"]],
            cwd=BASE_DIR,
            timeout=timeout_sec,
            capture_output=False,
        )
        elapsed = time.time() - t0

        if result.returncode != 0:
            print(f"\n  [ERROR] Step failed with return code {result.returncode}")
            return False, elapsed
        else:
            print(f"\n  [OK] Step completed in {elapsed/60:.1f} minutes")
            return True, elapsed

    except subprocess.TimeoutExpired:
        elapsed = time.time() - t0
        print(f"\n  [ERROR] Step timed out after {elapsed/60:.1f} minutes")
        return False, elapsed
    except Exception as e:
        elapsed = time.time() - t0
        print(f"\n  [ERROR] {e}")
        return False, elapsed


def load_metrics():
    """Load metrics from all trained models."""
    metrics = {}

    # Forecast
    forecast_path = os.path.join(BASE_DIR, "saved_models", "final_ensemble_model", "metrics.json")
    if os.path.exists(forecast_path):
        with open(forecast_path) as f:
            fm = json.load(f)
        metrics["forecast"] = {
            "r2": fm.get("overall", {}).get("r2", 0),
            "mape": fm.get("overall", {}).get("mape", 100),
        }

    # XGBoost
    xgb_path = os.path.join(BASE_DIR, "saved_models", "xgboost_outbreak_v3", "metrics.json")
    if os.path.exists(xgb_path):
        with open(xgb_path) as f:
            xm = json.load(f)
        metrics["xgboost"] = {
            "auc": xm.get("roc_auc", 0),
            "f1": xm.get("f1_score", 0),
        }

    # Isolation Forest
    if_path = os.path.join(BASE_DIR, "saved_models", "isolation_forest_prod", "metrics.json")
    if os.path.exists(if_path):
        with open(if_path) as f:
            im = json.load(f)
        metrics["isolation_forest"] = {
            "auc": im.get("roc_auc", 0),
            "f1": im.get("f1_score", 0),
        }

    # DBSCAN
    db_path = os.path.join(BASE_DIR, "saved_models", "dbscan_prod", "metrics.json")
    if os.path.exists(db_path):
        with open(db_path) as f:
            dm = json.load(f)
        metrics["dbscan"] = {
            "silhouette": dm.get("silhouette_score", 0),
        }

    return metrics


def print_summary(results, total_time, metrics):
    """Print pipeline summary with pass/fail."""
    print(f"\n{'='*80}")
    print(f"  PIPELINE SUMMARY")
    print(f"{'='*80}")
    print(f"  Total time: {total_time/60:.1f} minutes")
    print(f"  Timestamp: {datetime.now().isoformat()}")
    print()

    # Step results
    print("  Step Results:")
    for name, (success, elapsed) in results.items():
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"    {status}  {name:30s}  ({elapsed/60:.1f} min)")

    # Metrics vs targets
    print(f"\n{'='*80}")
    print("  MODEL METRICS vs TARGETS:")
    print(f"{'='*80}")

    all_pass = True

    if "forecast" in metrics:
        m = metrics["forecast"]
        r2_ok = m["r2"] > TARGETS["forecast"]["r2"]
        mape_ok = m["mape"] < TARGETS["forecast"]["mape_max"]
        r2_sym = "✓" if r2_ok else "✗"
        mape_sym = "✓" if mape_ok else "✗"
        print(f"  Forecast:        R²={m['r2']:.4f} (target >{TARGETS['forecast']['r2']}) {r2_sym}")
        print(f"                   MAPE={m['mape']:.2f}% (target <{TARGETS['forecast']['mape_max']}%) {mape_sym}")
        if not (r2_ok and mape_ok):
            all_pass = False
    else:
        print(f"  Forecast:        [NO METRICS]")
        all_pass = False

    if "xgboost" in metrics:
        m = metrics["xgboost"]
        auc_ok = m["auc"] > TARGETS["xgboost"]["auc"]
        f1_ok = m["f1"] > TARGETS["xgboost"]["f1"]
        auc_sym = "✓" if auc_ok else "✗"
        f1_sym = "✓" if f1_ok else "✗"
        print(f"  XGBoost:         AUC={m['auc']:.4f} (target >{TARGETS['xgboost']['auc']}) {auc_sym}")
        print(f"                   F1={m['f1']:.4f} (target >{TARGETS['xgboost']['f1']}) {f1_sym}")
        if not (auc_ok and f1_ok):
            all_pass = False
    else:
        print(f"  XGBoost:         [NO METRICS]")
        all_pass = False

    if "isolation_forest" in metrics:
        m = metrics["isolation_forest"]
        auc_ok = m["auc"] > TARGETS["isolation_forest"]["auc"]
        f1_ok = m["f1"] > TARGETS["isolation_forest"]["f1"]
        auc_sym = "✓" if auc_ok else "✗"
        f1_sym = "✓" if f1_ok else "✗"
        print(f"  Isolation Forest: AUC={m['auc']:.4f} (target >{TARGETS['isolation_forest']['auc']}) {auc_sym}")
        print(f"                    F1={m['f1']:.4f} (target >{TARGETS['isolation_forest']['f1']}) {f1_sym}")
        if not (auc_ok and f1_ok):
            all_pass = False
    else:
        print(f"  Isolation Forest: [NO METRICS]")
        all_pass = False

    if "dbscan" in metrics:
        m = metrics["dbscan"]
        sil_ok = m["silhouette"] > TARGETS["dbscan"]["silhouette"]
        sil_sym = "✓" if sil_ok else "✗"
        print(f"  DBSCAN:          Sil={m['silhouette']:.4f} (target >{TARGETS['dbscan']['silhouette']}) {sil_sym}")
        if not sil_ok:
            all_pass = False
    else:
        print(f"  DBSCAN:          [NO METRICS]")
        all_pass = False

    print(f"\n{'='*80}")
    overall = "✓ ALL TARGETS MET" if all_pass else "✗ SOME TARGETS NOT MET"
    print(f"  OVERALL: {overall}")
    print(f"{'='*80}")

    return all_pass


def main():
    print("=" * 80)
    print("  MASTER TRAINING PIPELINE v4.0")
    print("  Data Generation + 4 Model Training")
    print("=" * 80)
    print(f"  Start time: {datetime.now().isoformat()}")
    print()

    total_t0 = time.time()
    results = {}

    for i, step in enumerate(PIPELINE, 1):
        success, elapsed = run_step(step, i, len(PIPELINE))
        results[step["name"]] = (success, elapsed)

        if not success and step["name"] == "Data Generation":
            print("\n[FATAL] Data generation failed. Cannot continue.")
            sys.exit(1)

    total_time = time.time() - total_t0

    # Load and compare metrics
    metrics = load_metrics()
    all_pass = print_summary(results, total_time, metrics)

    # Save pipeline results
    pipeline_results = {
        "timestamp": datetime.now().isoformat(),
        "total_time_minutes": round(total_time / 60, 1),
        "steps": {
            name: {"success": s, "elapsed_minutes": round(e / 60, 1)}
            for name, (s, e) in results.items()
        },
        "metrics": metrics,
        "targets": TARGETS,
        "all_targets_met": all_pass,
    }
    with open(os.path.join(BASE_DIR, "pipeline_results.json"), "w") as f:
        json.dump(pipeline_results, f, indent=2)

    print(f"\nResults saved to pipeline_results.json")
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
