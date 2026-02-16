# Stress Test Evaluation Report
**Timestamp:** 20260215_001635
**Scenarios:** 7

## Executive Summary

| Model | Primary Metric | Score (Mean ± Std) | Target | Status |
|---|---|---|---|---|
| **DBSCAN v5.0** | Silhouette | 0.522 +/- 0.135 | > 0.60 | WARN |
| **Isolation Forest v5.0** | ROC-AUC | nan +/- nan | > 0.85 | WARN |
| **XGBoost Outbreak v3** | ROC-AUC | 0.793 +/- 0.049 | > 0.90 | WARN |
| **Forecasting (Synth)** | R2 (Learnability) | -0.355 +/- 0.477 | > 0.50 | WARN |

## Detailed Scenario Breakdown

| Scenario | Forecast (R²) | IsoForest (AUC/F1) | XGBoost (AUC/F1) | DBSCAN (Sil/Noise) |
|---|---|---|---|---|
| Seasonal_Wave | -0.76 | N/A | 0.84 / 0.03 | 0.51 (Noise: 44.0%) |
| Pandemic_Spread | 0.00 | N/A | 0.82 / 0.50 | 0.39 (Noise: 3.1%) |
| Urban_Rural_Disparity | -1.18 | N/A | 0.80 / 0.29 | 0.40 (Noise: 3.0%) |
| Delayed_Reporting | 0.26 | N/A | 0.75 / 0.26 | 0.76 (Noise: 66.0%) |
| Superspreader_Event | -0.65 | N/A | 0.84 / 0.07 | 0.46 (Noise: 20.0%) |
| Data_Entry_Errors | -0.14 | N/A | 0.69 / 0.27 | 0.68 (Noise: 82.0%) |
| Production_Scale_Small | -0.01 | N/A | 0.80 / 0.27 | 0.43 (Noise: 8.5%) |

## Findings
- **Robustness:** How well do models handle noise (data entry errors) and scale?
- **Pattern Detection:** Can models detect seasonal waves vs true outbreaks?
- **Speed:** Inference latency under load.

