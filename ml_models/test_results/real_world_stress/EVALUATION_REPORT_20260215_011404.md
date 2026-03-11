# Stress Test Evaluation Report
**Timestamp:** 20260215_011404
**Scenarios:** 7

## Executive Summary

| Model | Primary Metric | Score (Mean ± Std) | Target | Status |
|---|---|---|---|---|
| **DBSCAN v5.0** | Silhouette | 0.373 +/- 0.262 | > 0.60 | WARN |
| **Isolation Forest v5.0** | ROC-AUC | 0.885 +/- 0.072 | > 0.85 | PASS |
| **XGBoost Outbreak v3** | ROC-AUC | 0.828 +/- 0.041 | > 0.90 | WARN |
| **Forecasting (Synth)** | R2 (Learnability) | -0.355 +/- 0.477 | > 0.50 | WARN |

## Detailed Scenario Breakdown

| Scenario | Forecast (R²) | IsoForest (AUC/F1) | XGBoost (AUC/F1) | DBSCAN (Sil/Noise) |
|---|---|---|---|---|
| Seasonal_Wave | -0.76 | 0.82 / 0.17 | 0.87 / 0.04 | 0.75 (Noise: 87.5%) |
| Pandemic_Spread | 0.00 | 0.97 / 0.30 | 0.84 / 0.59 | 0.51 (Noise: 3.1%) |
| Urban_Rural_Disparity | -1.18 | 0.99 / 0.55 | 0.88 / 0.46 | 0.40 (Noise: 42.0%) |
| Delayed_Reporting | 0.26 | 0.79 / 0.31 | 0.76 / 0.32 | 0.00 (Noise: 100.0%) |
| Superspreader_Event | -0.65 | 0.89 / 0.29 | 0.85 / 0.11 | 0.57 (Noise: 24.0%) |
| Data_Entry_Errors | -0.14 | 0.83 / 0.13 | 0.82 / 0.38 | 0.00 (Noise: 100.0%) |
| Production_Scale_Small | -0.01 | 0.91 / 0.52 | 0.78 / 0.34 | 0.38 (Noise: 17.0%) |

## Findings
- **Robustness:** How well do models handle noise (data entry errors) and scale?
- **Pattern Detection:** Can models detect seasonal waves vs true outbreaks?
- **Speed:** Inference latency under load.

