# Validated surveillance ML system

The active v6 bundle replaces the incompatible v4/v5 serving paths. It is trained
on simulated observations and is **not clinically or publicly validated**. Model
selection uses chronological validation, calibration uses later disjoint days,
and final evaluation uses later untouched dates. An independently seeded simulation
is evaluated without fitting or changing thresholds.

## Serving architecture

- One shared feature module: `backend/surveillance/ml/features.py`.
- Immutable bundle, manifest, source hashes, dependency versions, and report under
  `ml_models/saved_models/validated/<version>/`.
- `active.json` selects a version atomically. Backend/workers read the same directory;
  Docker mounts it read-only at `/models`.
- Runtime verifies hashes, feature schema/order, dependency versions, and actual
  predictions. Missing, stale, unsupported, suppressed, or incompatible inputs never
  produce a fabricated low-risk probability.
- Risk classifier: validation-selected logistic regression, histogram gradient
  boosting, or XGBoost. Probability calibration is fitted on a separate later period.
- Anomaly detector: validation-selected Isolation Forest, rolling statistical spike,
  or causal seasonal deviation, with separate score calibration. Anomalies are review
  signals; they are not independent proof of an outbreak.
- Forecast: validation-selected trailing baseline, Poisson histogram boosting, or
  Poisson XGBoost. Direct daily region/disease forecasts use origin-time features and
  target calendar only. No future case observations or weather observations enter
  forecast features. Horizons 7/14/30/60/90 create exactly that many daily rows. The
  trained lead range includes a three-day buffer for complete-day data cutoffs.
- Geographic DBSCAN uses haversine distance, one point per region, and unique
  population denominators. A 25-km radius/minimum two regions is an explicit geographic
  policy parameter, not an epidemiologically validated outbreak radius.

## Data correctness

Clinical cases are distinct patient/disease/day diagnoses with granted surveillance
consent. Dispensing requests recomputation but never creates an additional case.
Queue entries identify their diagnosis and occurrence date. A transaction claims a
bounded snapshot, recomputes authoritative daily totals, dispatches inference, and
consumes only the exact snapshot after the callback. Publication/worker failures
retain retryable work. Expired claims are retried; writes are idempotent.

The privacy threshold is five distinct consenting patients. Suppressed observations
contain a marker and no hidden count. Missing/suppressed days are not treated as zero
cases. Historical lags are calendar days, grouped by region and disease. Seasonal
baselines use past observations only. Consent revocation triggers recomputation.

Environmental indices use the backend's 0–100 convention. Legacy generated 0–10
indices are normalized during training/import. Absent environmental readings have
explicit missing indicators. No provider configuration means `not_configured`, not
fabricated readings. To enable ingestion set `ENVIRONMENTAL_DATA_URL` to a JSON endpoint
returning an array of regional observations with `region_name`, ISO `date`, and numeric
`temperature`, `humidity`, `rainfall`, `aqi`, `water_quality_index` (optional PM fields).

Intraday clinical totals are day-to-date. The model was validated on complete daily
observations; intraday probabilities carry a provisional-calibration note. Forecasts
use the latest complete day. At least 21 observed days in the previous 28 and a fresh
observation are required. Unknown diseases are unavailable, not silently encoded as
another disease. Training data must include actual outbreak labels; pseudo-label
updates to live models are removed.

## Alerts and provenance

Results record version, source kind, data cutoff, and inference status. Forecast and
anomaly uniqueness constraints prevent duplicate daily outputs. Risk explanations
use actual XGBoost tree contributions to the **uncalibrated log-odds margin** where
the chosen classifier supports them; raw feature magnitudes are not explanations.

Alerts use forecast lower bounds versus prior historical burden, spatial grouping,
anomaly and calibrated outbreak-threshold evidence. Active alerts are deduplicated.
Rule confidence is null because no empirical fusion probability has been estimated.
Noncommunicable conditions do not generate infectious outbreak alerts.

Synthetic-trained models are available for engineering/demo inference, but automatic
public-health notifications are disabled by default. `ML_ALLOW_SYNTHETIC_ALERTS=true`
is for an explicit demo environment. Replace the training source with verified
observations and validate the system prospectively before enabling operational alerts.
Observational CSV labels alone do not establish prospective real-world validation.

## Train and evaluate (PowerShell, repository root)

```powershell
$env:PYTHONUTF8='1'
$env:OMP_NUM_THREADS='4'
backend/venv/Scripts/python.exe ml_models/generate_csv_data.py --days 1095 --start-date 2023-10-09 --seed 42 --output ml_models/training_data_v6
backend/venv/Scripts/python.exe ml_models/train_validated.py --data-dir ml_models/training_data_v6 --threads 4 --activate
backend/venv/Scripts/python.exe ml_models/generate_csv_data.py --days 1095 --start-date 2023-10-09 --seed 137 --output ml_models/independent_validation_data
backend/venv/Scripts/python.exe ml_models/evaluate_validated.py --data-dir ml_models/independent_validation_data
```

For authentic data, supply the same three CSV schemas, verified `outbreak_occurred`
labels, and `--data-kind observational`. Keep original dates. The classifier detects
a current labelled outbreak; it does not predict an outbreak seven days ahead.
Forecast outputs predict daily counts, not cumulative-horizon totals. Pointwise
intervals do not imply simultaneous or cumulative 95% coverage.

The master entry point `train_all_refined.py` forwards to the validated pipeline.
Old individual training/evaluation scripts remain historical references; they are
not used by serving or the new entry point. Generated datasets are ignored by Git;
regenerate them with the commands above. The existing original datasets/artifacts
have not been overwritten. Exact ML dependencies are in `ml_models/requirements.lock.txt`
and `backend/requirements.txt`.

## Database and deployment

Apply the new surveillance migrations before starting code that uses the new fields:

```powershell
cd backend
venv/Scripts/python.exe manage.py migrate surveillance
venv/Scripts/python.exe manage.py validate_ml_bundle
```

Migrations 0004–0006 add schema fields only. Nullable unique inference identifiers
make future writes idempotent without deleting or modifying historical outputs.
Legacy risk outputs and unvalidated alert confidences are masked as unavailable in
API responses; their stored values are preserved. No patient medical records are changed. Restart Django, Celery workers, and Beat
after code/dependency changes. The active bundle is selected on the next lookup;
already-running tasks may finish with their previously loaded version.

CSV import keeps complete source chronology and imports the requested days ending
at the latest source date. `--shift-dates` is an explicit synthetic demo option and
preserves spacing; it is forbidden for observational data. Fake ML dashboard outputs
require `--seed-demo`; ordinary import never silently creates them. To import and run
the actual models, use `load_csv_and_run_ml --csv-dir <path> --days 1095 --run-ml`.

## Verification

```powershell
cd backend
venv/Scripts/python.exe manage.py test --settings=config.test_settings --noinput
venv/Scripts/python.exe manage.py makemigrations --check --dry-run --settings=config.test_settings
```

Tests use isolated SQLite and in-memory task/cache configuration, never the configured
cloud database. Tests cover feature causality, label isolation, calendar gaps,
artifact corruption, real-artifact inference, full pipeline/API serialization,
all forecast horizons, repeated runs, correct spatial denominators, unknown/stale
inputs, consent/deduplication/backfills, broker failure and worker failure retries.
PostgreSQL locking and live Redis delivery still require deployment-level testing.

The generated `docs/ml-validation-results.md` records the current frozen bundle's
metrics, actual local training duration, and independent evaluation. Precision,
recall, PR-AUC, false alerts and lead-specific forecast errors matter more than
overall accuracy on a dataset with approximately 2% outbreak-positive observations.

Operational notifications for observational bundles require explicit enablement with
`ML_ENABLE_OPERATIONAL_ALERTS=true` after prospective validation. Migration 0006 adds
version/provenance fields to cluster results without modifying historical values.
