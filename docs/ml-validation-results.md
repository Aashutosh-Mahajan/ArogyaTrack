# ML validation results

Active bundle: `v6-20261008T123853Z`. These are **synthetic simulation results**, not clinical accuracy.

## Model selection

- Risk: `xgboost_deeper`, selected by validation PR-AUC.
- Anomaly: `seasonal_deviation`, selected by validation PR-AUC.
- Forecast: `hist_poisson`, selected by validation MAE against a trailing baseline.
- Spatial grouping: haversine DBSCAN with explicit 25-km/minimum-two-region policy.
- Features: 63, shared between training and serving.
- Dataset: 574,875 daily observations, 35 regions, 15 diseases, three simulated years.

## Fixed-threshold independent simulation

The independent dataset uses seed 137; training uses seed 42. No independent-test labels
were used for fitting, calibration or threshold selection. This is a robustness check
against another simulation, not external clinical validation.

| Metric | Risk classifier | Anomaly review signal |
|---|---:|---:|
| ROC-AUC | 0.9963 | 0.9747 |
| PR-AUC | 0.9204 | 0.4567 |
| Precision | 71.8% | 39.9% |
| Recall | 91.5% | 75.3% |
| F1 | 0.8044 | 0.5220 |
| Brier score | 0.0052 | 0.0215 |

Risk event recall (at least one detection in a consecutive labelled episode): 89.2%
on 2,032 episodes. False positive days per 1,000 observations:
7.87. The selected F2 operating point
prioritizes recall, so the risk classifier still has false positives. Anomaly precision
is lower and it must be treated as a review signal rather than confirmed outbreak evidence.

## Independent daily count forecasts

| Lead | MAE (cases) | WAPE | Baseline MAE | Nominal 95% interval coverage |
|---|---:|---:|---:|---:|
| 1 days | 10.35 | 24.2% | 10.94 | 94.8% |
| 3 days | 10.79 | 25.2% | 12.31 | 94.3% |
| 7 days | 10.68 | 24.9% | 13.16 | 94.9% |
| 14 days | 11.15 | 26.1% | 15.18 | 94.9% |
| 21 days | 11.46 | 26.9% | 16.96 | 94.6% |
| 30 days | 11.64 | 27.5% | 19.97 | 94.3% |
| 45 days | 13.51 | 31.7% | 25.18 | 94.6% |
| 60 days | 13.53 | 32.1% | 29.00 | 95.0% |
| 75 days | 13.32 | 35.3% | 31.57 | 96.1% |
| 90 days | 13.15 | 34.7% | 34.92 | 96.4% |
| 93 days | 14.24 | 33.2% | 36.83 | 96.1% |

## Actual local training time

Latest run: 142.6 seconds (about 2.4 minutes),
including feature preparation, candidate selection, calibration, and temporal test evaluation.
Feature preparation: 20.7s; risk selection/calibration:
53.3s; anomaly fitting/calibration:
9.2s; forecast selection/calibration:
51.6s. Independent evaluation:
28.0s. Observed runs varied from roughly 1–4 minutes with machine load.
Artifact compression/verification adds a little additional time. The 12-logical-CPU
machine used four training threads in the latest run.

This timing applies to this dataset and bounded forecast training sample. Larger authentic
sources, more candidate searches and more regions require a fresh benchmark; no multi-million-row
runtime has been measured. The current trainer materializes datasets in memory and should not
be treated as an out-of-core trainer for arbitrarily large datasets.

## Deployment limits

- No claim of real-world, medical, or 99% outbreak accuracy is supported.
- Disease labels in the simulation are generated from count/baseline rules, not reviewed public-health events.
- Observational data and prospective validation remain required.
- Intraday probabilities are provisional because evaluation uses complete daily observations.
- Geographic radius is a policy setting and needs local epidemiological validation.
- Prediction intervals are pointwise and partly share horizon calibration bins in serving.
- The old v4/v5 scores and these scores use different data, feature definitions and evaluation designs;
  they are not a controlled before/after comparison.

Full reports: `ml_models/saved_models/validated/v6-20261008T123853Z/report.json` and
`ml_models/test_results/validated_independent.json`. See `docs/ml-system.md` for reproduction and deployment.

## Integration verification

- 36 backend tests passed in an isolated database, including inference with the actual bundle.
- Frontend TypeScript check and production build passed.
- Docker Compose configuration validated.
- Configured backend database upgraded through surveillance migration 0006.
- Configured model health command verified all four components and artifact compatibility.
- Schema-only migrations preserve all historical ML outputs and patient medical records.
- Live worker/Beat processes must load the revised code; tests do not prove live Redis delivery or PostgreSQL concurrency under load.
