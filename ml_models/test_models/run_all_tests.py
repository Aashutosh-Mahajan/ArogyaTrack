#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Run All Model Tests
Executes comprehensive testing for all trained models and saves results
"""

import os
import sys
import json
import subprocess
from datetime import datetime

# Add parent directory to path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

TEST_RESULTS_DIR = os.path.join(BASE_DIR, "test_results")
os.makedirs(TEST_RESULTS_DIR, exist_ok=True)

print("=" * 80)
print("ML MODELS - COMPREHENSIVE TEST SUITE")
print("=" * 80)
print(f"Test Results Directory: {TEST_RESULTS_DIR}")
print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 80)

# Run main evaluation
print("\n1. Running comprehensive model evaluation...")
try:
    result = subprocess.run(
        [sys.executable, os.path.join(BASE_DIR, "test_models", "evaluate_all_models.py")],
        cwd=BASE_DIR,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace'
    )
    
    if result.returncode == 0:
        print("   ✓ Evaluation completed successfully")
        # Extract key metrics from output
        for line in result.stdout.split('\n'):
            if 'R2:' in line or 'F1:' in line or 'Silhouette:' in line:
                print(f"   {line.strip()}")
    else:
        print(f"   ✗ Evaluation failed with code {result.returncode}")
        if result.stderr:
            print(f"   Error: {result.stderr[:200]}")
            
except Exception as e:
    print(f"   ✗ Error running evaluation: {e}")

# Load and display results
print("\n" + "=" * 80)
print("FINAL TEST RESULTS SUMMARY")
print("=" * 80)

eval_report_path = os.path.join(TEST_RESULTS_DIR, "evaluation_report.json")
if os.path.exists(eval_report_path):
    with open(eval_report_path) as f:
        results = json.load(f)
    
    print("\nModel Performance:")
    print(f"  • Forecast Model (R²):              {results.get('forecast_r2', 'N/A'):.4f}" if isinstance(results.get('forecast_r2'), (int, float)) else f"  • Forecast Model (R²):              {results.get('forecast_r2', 'N/A')}")
    print(f"  • Outbreak Detector (F1):           {results.get('outbreak_f1', 'N/A'):.4f}" if isinstance(results.get('outbreak_f1'), (int, float)) else f"  • Outbreak Detector (F1):           {results.get('outbreak_f1', 'N/A')}")
    print(f"  • XGBoost V3 Outbreak (F1):         {results.get('xgboost_v3_f1', 'N/A'):.4f}" if isinstance(results.get('xgboost_v3_f1'), (int, float)) else f"  • XGBoost V3 Outbreak (F1):         {results.get('xgboost_v3_f1', 'N/A')}")
    print(f"  • DBSCAN Clustering (Silhouette):   {results.get('dbscan_silhouette', 'N/A'):.4f}" if isinstance(results.get('dbscan_silhouette'), (int, float)) else f"  • DBSCAN Clustering (Silhouette):   {results.get('dbscan_silhouette', 'N/A')}")
    
    # Grade models
    print("\nModel Grades:")
    
    forecast_r2 = results.get('forecast_r2', 0)
    if isinstance(forecast_r2, (int, float)):
        if forecast_r2 >= 0.9:
            print("  • Forecast Model: EXCELLENT (R² ≥ 0.90)")
        elif forecast_r2 >= 0.7:
            print("  • Forecast Model: GOOD (R² ≥ 0.70)")
        elif forecast_r2 >= 0.5:
            print("  • Forecast Model: MODERATE (R² ≥ 0.50)")
        else:
            print("  • Forecast Model: NEEDS IMPROVEMENT (R² < 0.50)")
    
    outbreak_f1 = results.get('outbreak_f1', 0)
    xgboost_v3_f1 = results.get('xgboost_v3_f1', 0)
    avg_outbreak_f1 = (outbreak_f1 + xgboost_v3_f1) / 2 if isinstance(outbreak_f1, (int, float)) and isinstance(xgboost_v3_f1, (int, float)) else 0
    
    if avg_outbreak_f1 >= 0.85:
        print(f"  • Outbreak Detection: EXCELLENT (Avg F1 = {avg_outbreak_f1:.4f})")
    elif avg_outbreak_f1 >= 0.70:
        print(f"  • Outbreak Detection: GOOD (Avg F1 = {avg_outbreak_f1:.4f})")
    elif avg_outbreak_f1 >= 0.50:
        print(f"  • Outbreak Detection: MODERATE (Avg F1 = {avg_outbreak_f1:.4f})")
    else:
        print(f"  • Outbreak Detection: NEEDS IMPROVEMENT (Avg F1 = {avg_outbreak_f1:.4f})")
    
    dbscan_sil = results.get('dbscan_silhouette', 0)
    if isinstance(dbscan_sil, (int, float)):
        if dbscan_sil >= 0.5:
            print("  • Clustering: GOOD (Silhouette ≥ 0.50)")
        elif dbscan_sil >= 0.3:
            print("  • Clustering: MODERATE (Silhouette ≥ 0.30)")
        else:
            print("  • Clustering: NEEDS IMPROVEMENT (Silhouette < 0.30)")

else:
    print("\n⚠ Evaluation report not found")

print("\n" + "=" * 80)
print(f"Tests completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Results saved to: {TEST_RESULTS_DIR}")
print("=" * 80)
