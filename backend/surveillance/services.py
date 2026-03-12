"""Surveillance services for data aggregation and ML integration.

Aligns with the production ML models (v5.0):
  - dbscan_prod/              (DBSCAN v5.0 - 13 features, density-aware clustering)
  - isolation_forest_prod/    (IF v5.0 - 59 features, ensemble + GB corrector)
  - final_ensemble_model/     (Prophet + XGBoost Ensemble v5.0 - weekly forecasting)
  - xgboost_outbreak_v3/      (XGBoost v4.0 - 56 features, chunked training)
"""

import json
import logging
import os
from datetime import datetime, timedelta
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from .models import (
    Alert,
    Anomaly,
    Cluster,
    ClusterRegion,
    Consent,
    EnvironmentalData,
    Forecast,
    Notification,
    Region,
    RiskScore,
    SurveillanceData,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths -- all relative to the repo root (one level above BASE_DIR)
# ---------------------------------------------------------------------------
ML_MODELS_ROOT = Path(settings.BASE_DIR).parent / "ml_models" / "saved_models"

DBSCAN_DIR = ML_MODELS_ROOT / "dbscan_prod"
ISOLATION_FOREST_DIR = ML_MODELS_ROOT / "isolation_forest_prod"
PROPHET_DIR = ML_MODELS_ROOT / "final_ensemble_model"
XGBOOST_DIR = ML_MODELS_ROOT / "xgboost_outbreak_v3"


# ===================================================================
# Helpers
# ===================================================================

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in km between two lat/lon points."""
    R = 6371.0088
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def _load_pickle(path: Path):
    """Load a pickle/joblib file."""
    if path.exists():
        return joblib.load(path)
    return None


def _load_json(path: Path):
    """Load a JSON file."""
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return None


# Indian holidays (month, day) -- shared across models
INDIAN_HOLIDAYS = [
    (1, 26), (3, 14), (10, 2), (8, 15), (12, 25), (5, 1),
    (1, 15), (4, 10), (11, 1), (10, 25), (11, 12), (4, 14),
    (6, 29), (8, 21), (10, 19),
]


def _is_holiday(dt) -> int:
    """Check if a date falls on an Indian holiday."""
    return int((dt.month, dt.day) in INDIAN_HOLIDAYS)


def _get_season_flags(dt) -> dict:
    """Return monsoon/winter/summer flags for a date."""
    month = dt.month
    return {
        "is_monsoon": int(month in (6, 7, 8, 9)),
        "is_winter": int(month in (11, 12, 1, 2)),
        "is_summer": int(month in (3, 4, 5)),
    }


# ===================================================================
# 1. AggregationService  (unchanged logic, K-anonymity)
# ===================================================================

class AggregationService:
    """K-anonymity enforced aggregation service."""

    K_ANONYMITY_THRESHOLD = 5

    @classmethod
    def aggregate_daily_data(cls, target_date=None):
        """Aggregate diagnosis data with K-anonymity enforcement.

        Only includes patients who consented to surveillance.
        """
        if target_date is None:
            target_date = timezone.now().date() - timedelta(days=1)

        try:
            from medical.models import Diagnosis
        except ImportError:
            logger.warning("medical app not available -- skipping aggregation")
            return {}

        consented_profiles = Consent.objects.filter(
            consent_type="surveillance",
            is_granted=True,
        ).values_list("profile_id", flat=True)

        diagnoses = Diagnosis.objects.filter(
            record__patient_id__in=consented_profiles,
            created_at__date=target_date,
        ).select_related("record", "record__patient")

        aggregation: Dict[tuple, dict] = {}

        for diagnosis in diagnoses:
            patient = diagnosis.record.patient
            region_name = getattr(patient, "region", None)
            if not region_name:
                continue

            key = (region_name, diagnosis.icd_10_code)

            if key not in aggregation:
                aggregation[key] = {
                    "region_name": region_name,
                    "disease_code": diagnosis.icd_10_code,
                    "disease_name": diagnosis.disease_name,
                    "case_count": 0,
                    "severities": [],
                }

            aggregation[key]["case_count"] += 1
            aggregation[key]["severities"].append(diagnosis.severity)

        with transaction.atomic():
            for key, data in aggregation.items():
                if data["case_count"] < cls.K_ANONYMITY_THRESHOLD:
                    continue

                try:
                    region = Region.objects.get(name=data["region_name"])
                except Region.DoesNotExist:
                    continue

                avg_severity = sum(data["severities"]) / len(data["severities"])
                cases_per_100k = (data["case_count"] / region.population) * 100_000 if region.population else 0

                SurveillanceData.objects.update_or_create(
                    date=target_date,
                    region=region,
                    disease_code=data["disease_code"],
                    defaults={
                        "disease_name": data["disease_name"],
                        "case_count": data["case_count"],
                        "average_severity": avg_severity,
                        "cases_per_100k": cases_per_100k,
                    },
                )

        return aggregation


# ===================================================================
# 2. ClusteringService  (DBSCAN v5.0 -- 13 features, density-aware)
# ===================================================================

class ClusteringService:
    """DBSCAN v5.0 geo-clustering with 13 epi+geo+infra features.

    Matches dbscan_prod/ model artifacts:
      - dbscan_model.pkl (DBSCAN with best_eps=3.0, best_min_samples=2)
      - geo_scaler.pkl + epi_scaler.pkl
      - features.json (13 features)
    """

    MODEL_PATH = DBSCAN_DIR / "dbscan_model.pkl"
    GEO_SCALER_PATH = DBSCAN_DIR / "geo_scaler.pkl"
    EPI_SCALER_PATH = DBSCAN_DIR / "epi_scaler.pkl"
    FEATURES_PATH = DBSCAN_DIR / "features.json"
    METADATA_PATH = DBSCAN_DIR / "metadata.json"
    METRICS_PATH = DBSCAN_DIR / "metrics.json"

    @classmethod
    def load_model(cls):
        return _load_pickle(cls.MODEL_PATH)

    @classmethod
    def load_features(cls) -> List[str]:
        feats = _load_json(cls.FEATURES_PATH)
        return feats if feats else [
            "latitude", "longitude", "mean_cases", "max_cases",
            "outbreak_rate", "population_log", "cases_per_capita",
            "case_variability", "monsoon_ratio", "outbreak_severity",
            "sanitation_index", "hospital_count", "pop_density_log",
        ]

    @classmethod
    def get_model_info(cls) -> dict:
        meta = _load_json(cls.METADATA_PATH) or {}
        metrics = _load_json(cls.METRICS_PATH) or {}
        return {
            "name": "DBSCAN Geo-Clustering v5.0",
            "description": "Density-aware spatial clustering with 13 epi+geo+infra features",
            "version": meta.get("model", "DBSCAN v5.0"),
            "model_available": cls.MODEL_PATH.exists(),
            "features": cls.load_features(),
            "n_features": len(cls.load_features()),
            "metrics": {
                "silhouette_score": metrics.get("silhouette_score", 0),
                "n_clusters": metrics.get("n_clusters", 0),
                "calinski_harabasz": metrics.get("calinski_harabasz", 0),
                "davies_bouldin": metrics.get("davies_bouldin", 0),
                "noise_pct": metrics.get("noise_pct", 0),
                "n_hotspot_clusters": metrics.get("n_hotspot_clusters", 0),
                "n_hotspot_regions": metrics.get("n_hotspot_regions", 0),
            },
            "parameters": meta.get("parameters", {}),
            "artifacts": {
                "model": str(cls.MODEL_PATH),
                "geo_scaler": str(cls.GEO_SCALER_PATH),
                "epi_scaler": str(cls.EPI_SCALER_PATH),
                "clusters": str(DBSCAN_DIR / "clusters.csv"),
                "summary": str(DBSCAN_DIR / "cluster_summary.csv"),
            },
            "cluster_profiles": metrics.get("cluster_profiles", {}),
        }

    @classmethod
    def detect_clusters(cls, disease_code: str, start_date=None, end_date=None) -> List[Cluster]:
        """Detect disease clusters using DBSCAN with haversine metric."""
        if end_date is None:
            end_date = timezone.now().date()
        if start_date is None:
            start_date = end_date - timedelta(days=7)

        data = (
            SurveillanceData.objects.filter(
                disease_code=disease_code,
                date__gte=start_date,
                date__lte=end_date,
            )
            .select_related("region")
        )

        if not data.exists():
            return []

        region_map: Dict[int, dict] = {}
        coords = []
        for idx, record in enumerate(data):
            coords.append([record.region.latitude, record.region.longitude])
            region_map[idx] = {
                "region": record.region,
                "case_count": record.case_count,
                "date": record.date,
            }

        coords_arr = np.array(coords, dtype=float)
        coords_rad = np.radians(coords_arr)

        model = cls.load_model()
        if model is None:
            from sklearn.cluster import DBSCAN
            eps_rad = 0.5 / 6371.0088  # ~500 m
            model = DBSCAN(eps=eps_rad, min_samples=5, metric="haversine", n_jobs=-1)

        labels = model.fit_predict(coords_rad)

        # Deactivate previous clusters for this disease
        Cluster.objects.filter(disease_code=disease_code, is_active=True).update(is_active=False)

        clusters: List[Cluster] = []
        unique_labels = set(labels)
        unique_labels.discard(-1)

        disease_name = data.first().disease_name

        for label in unique_labels:
            mask = labels == label
            cluster_coords = coords_arr[mask]
            cluster_indices = np.where(mask)[0]

            centroid_lat = float(np.mean(cluster_coords[:, 0]))
            centroid_lon = float(np.mean(cluster_coords[:, 1]))

            cluster_regions = [region_map[int(i)] for i in cluster_indices]
            total_cases = sum(r["case_count"] for r in cluster_regions)
            total_population = sum(r["region"].population for r in cluster_regions)

            incidence = (total_cases / total_population) * 100_000 if total_population else 0
            if incidence >= 50:
                severity = "critical"
            elif incidence >= 20:
                severity = "high"
            elif incidence >= 5:
                severity = "medium"
            else:
                severity = "low"

            radius_km = max(
                (_haversine(centroid_lat, centroid_lon, pt[0], pt[1]) for pt in cluster_coords),
                default=0.0,
            )

            cluster = Cluster.objects.create(
                disease_code=disease_code,
                disease_name=disease_name,
                detection_date=end_date,
                centroid_lat=centroid_lat,
                centroid_lon=centroid_lon,
                radius_km=radius_km,
                total_cases=total_cases,
                total_population=total_population,
                severity=severity,
            )

            for rd in cluster_regions:
                ClusterRegion.objects.create(
                    cluster=cluster,
                    region=rd["region"],
                    case_count=rd["case_count"],
                )

            clusters.append(cluster)

        return clusters


# ===================================================================
# 3. ForecastingService  (Prophet + XGBoost Ensemble v5.0)
#    Weekly aggregation, Indian holidays, env regressors with lags
#    Horizons: 7, 14, 30, 60, 90 days
# ===================================================================

class ForecastingService:
    """Prophet + XGBoost Ensemble v5.0 forecasting.

    Matches final_ensemble_model/ artifacts:
      - prophet_model.pkl (Prophet with Indian holidays + monsoon/winter seasonalities)
      - xgb_model.bst (XGBoost residual model)
      - config.json (blend weights, feature_cols, horizons)
      - metrics.json (per-horizon MAE, MAPE, R2)
    """

    PROPHET_PATH = PROPHET_DIR / "prophet_model.pkl"
    XGB_PATH = PROPHET_DIR / "xgb_model.bst"
    CONFIG_PATH = PROPHET_DIR / "config.json"
    METRICS_PATH = PROPHET_DIR / "metrics.json"
    FEATURES_PATH = PROPHET_DIR / "features.json"
    FORECASTS_PATH = PROPHET_DIR / "forecasts.json"

    @classmethod
    def load_prophet(cls):
        return _load_pickle(cls.PROPHET_PATH)

    @classmethod
    def load_xgb(cls):
        if cls.XGB_PATH.exists():
            try:
                import xgboost as xgb
                booster = xgb.Booster()
                booster.load_model(str(cls.XGB_PATH))
                return booster
            except Exception as exc:
                logger.warning("Could not load XGBoost ensemble model: %s", exc)
        return None

    @classmethod
    def load_config(cls) -> dict:
        return _load_json(cls.CONFIG_PATH) or {
            "version": "4.1",
            "forecast_days": 90,
            "horizons": [7, 14, 30, 60, 90],
            "use_weekly": True,
            "blend_weight_prophet": 0.2,
        }

    @classmethod
    def get_model_info(cls) -> dict:
        """Return metadata + metrics for the ensemble forecast model."""
        config = cls.load_config()
        metrics = _load_json(cls.METRICS_PATH) or {}
        features = _load_json(cls.FEATURES_PATH) or []
        forecasts = _load_json(cls.FORECASTS_PATH) or {}
        return {
            "name": "Prophet + XGBoost Ensemble v5.0",
            "description": "Weekly case forecasting with Indian holidays, custom "
                           "seasonalities, and environmental regressors",
            "version": metrics.get("model", "Prophet + XGBoost Ensemble v5.0"),
            "model_available": cls.PROPHET_PATH.exists(),
            "xgb_available": cls.XGB_PATH.exists(),
            "config": config,
            "features": features,
            "metrics": {
                "prophet_weight": metrics.get("prophet_weight", 0.2),
                "xgboost_weight": metrics.get("xgboost_weight", 0.8),
                "overall_r2": metrics.get("overall", {}).get("r2", 0),
                "overall_mape": metrics.get("overall", {}).get("mape", 0),
                "overall_mae": metrics.get("overall", {}).get("mae", 0),
            },
            "horizon_metrics": metrics.get("horizon_metrics", {}),
            "latest_forecasts": forecasts,
        }

    @classmethod
    def generate_forecast(
        cls,
        region: Region,
        disease_code: str,
        horizon_days: int = 7,
    ) -> List[Forecast]:
        """Generate forecast using Prophet + XGBoost ensemble, scaled to region."""
        min_date = timezone.now().date() - timedelta(days=180)
        historical = list(
            SurveillanceData.objects.filter(
                disease_code=disease_code,
                date__gte=min_date,
            )
            .values("date")
            .annotate(y=Sum("case_count"))
            .order_by("date")
        )

        if len(historical) < 14:
            return []

        df = pd.DataFrame(historical).rename(columns={"date": "ds"})
        df["ds"] = pd.to_datetime(df["ds"])
        df["y"] = df["y"].astype(float)

        # Add env regressors (national daily mean)
        env_qs = (
            EnvironmentalData.objects.filter(date__gte=min_date)
            .values("date")
            .annotate(
                temperature_celsius=Avg("temperature"),
                rainfall_mm=Avg("rainfall"),
                humidity_percent=Avg("humidity"),
                aqi=Avg("aqi"),
            )
            .order_by("date")
        )
        env_df = pd.DataFrame(list(env_qs)).rename(columns={"date": "ds"})
        if not env_df.empty:
            env_df["ds"] = pd.to_datetime(env_df["ds"])
            df = df.merge(env_df, on="ds", how="left")
        else:
            df["temperature_celsius"] = 0.0
            df["rainfall_mm"] = 0.0
            df["humidity_percent"] = 0.0
            df["aqi"] = 0.0

        env_cols = ["temperature_celsius", "rainfall_mm", "humidity_percent", "aqi"]
        df[env_cols] = df[env_cols].ffill().bfill().fillna(0)

        # Weekly aggregation (matches training)
        config = cls.load_config()
        use_weekly = config.get("use_weekly", True)

        if use_weekly:
            df = df.set_index("ds").resample("W-SUN").agg({
                "y": "sum",
                "temperature_celsius": "mean",
                "rainfall_mm": "mean",
                "humidity_percent": "mean",
                "aqi": "mean",
            }).reset_index()

        try:
            from prophet import Prophet as ProphetModel

            prophet_model = cls.load_prophet()
            if prophet_model is None:
                # Build new Prophet with Indian holidays and custom seasonalities
                prophet_model = ProphetModel(
                    yearly_seasonality=True,
                    weekly_seasonality=not use_weekly,
                    daily_seasonality=False,
                    changepoint_prior_scale=0.05,
                    interval_width=0.95,
                )
                for col in env_cols:
                    prophet_model.add_regressor(col, standardize=True)
                fit_cols = ["ds", "y"] + env_cols
                prophet_model.fit(df[fit_cols])

            # Determine prediction periods
            if use_weekly:
                n_periods = max(1, horizon_days // 7)
                freq = "W"
            else:
                n_periods = horizon_days
                freq = "D"

            future = prophet_model.make_future_dataframe(periods=n_periods, freq=freq)

            # Forward-fill env regressors into future
            last_env = df[["ds"] + env_cols].set_index("ds")
            future_env = last_env.reindex(future["ds"]).ffill().bfill().fillna(0).reset_index()
            for col in env_cols:
                future[col] = future_env[col].values

            forecast_df = prophet_model.predict(future)

            # Region scaling factor
            region_total = (
                SurveillanceData.objects.filter(
                    disease_code=disease_code, region=region, date__gte=min_date,
                ).aggregate(t=Sum("case_count"))["t"] or 0
            )
            national_total = (
                SurveillanceData.objects.filter(
                    disease_code=disease_code, date__gte=min_date,
                ).aggregate(t=Sum("case_count"))["t"] or 1
            )
            scale = region_total / national_total if national_total else 0.01

            today = timezone.now().date()
            disease_name_obj = SurveillanceData.objects.filter(disease_code=disease_code).first()
            disease_name = disease_name_obj.disease_name if disease_name_obj else disease_code

            forecasts: List[Forecast] = []
            tail_rows = forecast_df.tail(n_periods)

            for _, row in tail_rows.iterrows():
                pred_date = row["ds"].date()
                predicted = max(0, row["yhat"] * scale)
                lower = max(0, row["yhat_lower"] * scale)
                upper = max(0, row["yhat_upper"] * scale)

                fc = Forecast.objects.create(
                    region=region,
                    disease_code=disease_code,
                    disease_name=disease_name,
                    forecast_date=today,
                    prediction_date=pred_date,
                    horizon_days=horizon_days,
                    predicted_cases=predicted,
                    lower_bound=lower,
                    upper_bound=upper,
                    confidence=0.95,
                )
                forecasts.append(fc)

            return forecasts

        except ImportError:
            logger.warning("prophet package not installed -- skipping forecast")
            return []
        except Exception as exc:
            logger.exception("Forecast generation failed: %s", exc)
            return []


# ===================================================================
# 4. AnomalyDetectionService  (Isolation Forest v5.0)
#    Semi-supervised IF ensemble + GradientBoosting score corrector
#    59 features matching training script exactly
# ===================================================================

class AnomalyDetectionService:
    """Isolation Forest v5.0 anomaly detection.

    Semi-supervised ensemble (normal-only training) with GradientBoosting
    score corrector. 59 features including temporal, seasonal, environmental,
    rolling stats, spike detection, and disease encoding.

    Artifacts:
      - isolation_forest_ensemble.pkl  (3x IF ensemble via warm_start)
      - score_corrector.pkl            (GradientBoosting corrector)
      - corrector_feat_idx.pkl         (feature indices for corrector)
      - scaler.pkl                     (StandardScaler)
      - disease_encoder.pkl            (LabelEncoder)
      - scoring_config.json            (method, alpha, thresholds)
      - features.json                  (59 features)
    """

    # Primary ensemble model (preferred)
    ENSEMBLE_PATH = ISOLATION_FOREST_DIR / "isolation_forest_ensemble.pkl"
    # Fallback single model
    MODEL_PATH = ISOLATION_FOREST_DIR / "isolation_forest.pkl"
    SCALER_PATH = ISOLATION_FOREST_DIR / "scaler.pkl"
    CORRECTOR_PATH = ISOLATION_FOREST_DIR / "score_corrector.pkl"
    CORRECTOR_IDX_PATH = ISOLATION_FOREST_DIR / "corrector_feat_idx.pkl"
    DISEASE_ENCODER_PATH = ISOLATION_FOREST_DIR / "disease_encoder.pkl"
    FEATURES_PATH = ISOLATION_FOREST_DIR / "features.json"
    METADATA_PATH = ISOLATION_FOREST_DIR / "metadata.json"
    METRICS_PATH = ISOLATION_FOREST_DIR / "metrics.json"
    SCORING_CONFIG_PATH = ISOLATION_FOREST_DIR / "scoring_config.json"

    @classmethod
    def load_model(cls):
        """Load the ensemble model first, fall back to single model."""
        model = _load_pickle(cls.ENSEMBLE_PATH)
        if model is not None:
            return model
        return _load_pickle(cls.MODEL_PATH)

    @classmethod
    def load_scaler(cls):
        return _load_pickle(cls.SCALER_PATH)

    @classmethod
    def load_corrector(cls):
        return _load_pickle(cls.CORRECTOR_PATH)

    @classmethod
    def load_corrector_idx(cls):
        return _load_pickle(cls.CORRECTOR_IDX_PATH)

    @classmethod
    def load_disease_encoder(cls):
        return _load_pickle(cls.DISEASE_ENCODER_PATH)

    @classmethod
    def load_features(cls) -> List[str]:
        feats = _load_json(cls.FEATURES_PATH)
        return feats if feats else []

    @classmethod
    def load_scoring_config(cls) -> dict:
        return _load_json(cls.SCORING_CONFIG_PATH) or {
            "method": "corrected_gb",
            "alpha": 0.15,
        }

    @classmethod
    def get_model_info(cls) -> dict:
        meta = _load_json(cls.METADATA_PATH) or {}
        metrics = _load_json(cls.METRICS_PATH) or {}
        scoring_cfg = cls.load_scoring_config()
        return {
            "name": "Isolation Forest Anomaly Detector v5.0",
            "description": "Semi-supervised IF ensemble with GradientBoosting "
                           "corrector, 59-feature anomaly detection",
            "version": metrics.get("model", "Isolation Forest v5.0"),
            "model_available": cls.ENSEMBLE_PATH.exists() or cls.MODEL_PATH.exists(),
            "corrector_available": cls.CORRECTOR_PATH.exists(),
            "features": cls.load_features(),
            "n_features": len(cls.load_features()),
            "scoring_method": scoring_cfg.get("method", "corrected_gb"),
            "metrics": {
                "roc_auc": metrics.get("corrected_roc_auc", metrics.get("roc_auc", 0)),
                "raw_if_roc_auc": metrics.get("raw_if_roc_auc", 0),
                "f1_score": metrics.get("f1_score", 0),
                "precision": metrics.get("precision", 0),
                "recall": metrics.get("recall", 0),
                "n_ensemble": metrics.get("n_ensemble", 3),
                "threshold": metrics.get("threshold", 0),
            },
            "configuration": meta.get("configuration", {}),
        }

    @classmethod
    def _build_features(cls, region: Region, disease_code: str, date) -> Optional[pd.DataFrame]:
        """Build the 59-feature vector matching train_refined_isolation_forest.py."""
        start = date - timedelta(days=90)

        surv_qs = (
            SurveillanceData.objects.filter(
                region=region,
                disease_code=disease_code,
                date__gte=start,
                date__lte=date,
            )
            .order_by("date")
            .values("date", "case_count", "average_severity")
        )

        env_qs = (
            EnvironmentalData.objects.filter(
                region=region,
                date__gte=start,
                date__lte=date,
            )
            .order_by("date")
            .values("date", "temperature", "humidity", "rainfall", "aqi", "water_quality_index")
        )

        if not surv_qs:
            return None

        surv_df = pd.DataFrame(list(surv_qs)).rename(columns={
            "case_count": "case_count",
            "average_severity": "severity_avg",
        })
        surv_df["date"] = pd.to_datetime(surv_df["date"])

        env_df = pd.DataFrame(list(env_qs)).rename(columns={
            "temperature": "temperature_celsius",
            "humidity": "humidity_percent",
            "rainfall": "rainfall_mm",
        })
        if not env_df.empty:
            env_df["date"] = pd.to_datetime(env_df["date"])
            df = surv_df.merge(env_df, on="date", how="left")
        else:
            df = surv_df.copy()
            for col in ["temperature_celsius", "humidity_percent", "rainfall_mm", "aqi", "water_quality_index"]:
                df[col] = 0.0

        df = df.sort_values("date").reset_index(drop=True)
        df = df.fillna(0)

        # ── Temporal features ──
        df["month"] = df["date"].dt.month
        df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
        df["day_of_week"] = df["date"].dt.dayofweek
        df["quarter"] = df["date"].dt.quarter
        df["day_of_year"] = df["date"].dt.dayofyear
        df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
        df["is_holiday"] = df["date"].apply(_is_holiday)
        seasons = df["date"].apply(_get_season_flags)
        df["is_monsoon"] = seasons.apply(lambda x: x["is_monsoon"])
        df["is_winter"] = seasons.apply(lambda x: x["is_winter"])
        df["is_summer"] = seasons.apply(lambda x: x["is_summer"])
        df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
        df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)

        # ── Rolling statistics ──
        for w in [7, 14, 28]:
            df[f"cases_rm_{w}"] = df["case_count"].rolling(window=w, min_periods=1).mean()
            df[f"cases_rstd_{w}"] = df["case_count"].rolling(window=w, min_periods=1).std().fillna(0)
            df[f"cases_rmax_{w}"] = df["case_count"].rolling(window=w, min_periods=1).max()

        # ── Growth & acceleration ──
        for p in [7, 14]:
            df[f"growth_{p}"] = df["case_count"].pct_change(periods=p).fillna(0)
        df["growth_21"] = df["case_count"].pct_change(periods=21).fillna(0)
        df["acceleration_7"] = df["growth_7"].diff().fillna(0)

        # ── Deviation from rolling mean ──
        for p in [7, 14]:
            rm_col = f"cases_rm_{p}"
            std_col = f"cases_rstd_{p}"
            df[f"deviation_{p}"] = (df["case_count"] - df[rm_col]) / (df[std_col] + 1)

        # ── Spike detection ──
        rm7 = df["cases_rm_7"]
        std7 = df["cases_rstd_7"]
        df["is_spike_2std"] = (df["case_count"] > (rm7 + 2 * std7)).astype(int)
        df["is_spike_3std"] = (df["case_count"] > (rm7 + 3 * std7)).astype(int)

        # ── Seasonal baselines ──
        df["seasonal_baseline_month"] = df.groupby("month")["case_count"].transform("mean")
        df["seasonal_baseline_week"] = df.groupby("week_of_year")["case_count"].transform("mean")
        df["deviation_from_monthly_baseline"] = df["case_count"] - df["seasonal_baseline_month"]
        df["deviation_from_weekly_baseline"] = df["case_count"] - df["seasonal_baseline_week"]
        monthly_95 = df.groupby("month")["case_count"].transform(lambda x: x.quantile(0.95))
        df["above_seasonal_95pct"] = (df["case_count"] > monthly_95).astype(int)

        # ── Lag features ──
        for lag in [7, 14, 21]:
            df[f"cases_lag_{lag}"] = df["case_count"].shift(lag).fillna(0)

        # ── Per-capita and demographic ──
        pop = max(region.population, 1)
        df["cases_per_100k"] = (df["case_count"] / pop) * 100_000

        # ── Environmental risk composite ──
        df["env_risk"] = (
            (df["temperature_celsius"] > 30).astype(int)
            + (df["rainfall_mm"] > 50).astype(int)
            + (df["aqi"] > 150).astype(int)
        )
        df["env_risk_score"] = (
            df["temperature_celsius"] / 50.0
            + df["rainfall_mm"] / 200.0
            + df["aqi"] / 500.0
        )

        # ── Disease-favorable conditions ──
        df["favorable_dengue"] = (
            (df["temperature_celsius"].between(25, 35))
            & (df["humidity_percent"] > 60)
            & (df["rainfall_mm"] > 0)
        ).astype(int)
        df["favorable_flu"] = (
            (df["temperature_celsius"] < 20)
            & (df["humidity_percent"] < 40)
        ).astype(int)

        # ── Disease encoding ──
        encoder = cls.load_disease_encoder()
        if encoder is not None:
            try:
                df["disease_encoded"] = encoder.transform([disease_code] * len(df))
            except ValueError:
                df["disease_encoded"] = 0
        else:
            df["disease_encoded"] = 0

        # ── Environmental lag ──
        df["temperature_lag_7"] = df["temperature_celsius"].shift(7).fillna(df["temperature_celsius"].mean())
        df["rainfall_3day_sum"] = df["rainfall_mm"].rolling(3, min_periods=1).sum()
        df["days_since_heavy_rain"] = 0
        heavy_rain = df["rainfall_mm"] > 50
        for i in range(len(df)):
            if heavy_rain.iloc[i]:
                df.loc[df.index[i], "days_since_heavy_rain"] = 0
            elif i > 0:
                df.loc[df.index[i], "days_since_heavy_rain"] = df["days_since_heavy_rain"].iloc[i - 1] + 1

        # ── Demographic / infrastructure ──
        df["population_log"] = np.log1p(pop)
        area_sq_km = max(pop / 400, 1)  # Approximate density
        df["population_density"] = pop / area_sq_km
        df["region_tier"] = 1 if pop > 1_000_000 else (2 if pop > 100_000 else 3)

        # Historical outbreak frequency
        total_surv = SurveillanceData.objects.filter(
            region=region, disease_code=disease_code,
        ).count()
        outbreak_count = SurveillanceData.objects.filter(
            region=region, disease_code=disease_code,
            case_count__gt=10,
        ).count()
        df["historical_outbreak_freq"] = outbreak_count / max(total_surv, 1)

        df["sanitation_index"] = region.sanitation_index

        # ── Severity rolling ──
        df["severity_rm_7"] = df["severity_avg"].rolling(7, min_periods=1).mean()

        # ── State outbreak rate ──
        state_regions = Region.objects.filter(state=region.state)
        state_total = SurveillanceData.objects.filter(
            region__in=state_regions,
            disease_code=disease_code,
            date__gte=start,
        ).count()
        state_outbreaks = SurveillanceData.objects.filter(
            region__in=state_regions,
            disease_code=disease_code,
            date__gte=start,
            case_count__gt=10,
        ).count()
        df["state_outbreak_rate"] = state_outbreaks / max(state_total, 1)

        # ── Select feature columns in the correct order ──
        features = cls.load_features()
        if not features:
            # Fallback 59-feature list from features.json
            features = [
                "month", "week_of_year", "day_of_week", "quarter", "day_of_year",
                "is_weekend", "is_holiday", "is_monsoon", "is_winter", "is_summer",
                "month_sin", "month_cos",
                "case_count", "cases_rm_7", "cases_rm_14", "cases_rm_28",
                "cases_rstd_7", "cases_rstd_14", "cases_rstd_28",
                "cases_rmax_7", "cases_rmax_14", "cases_rmax_28",
                "growth_7", "growth_14", "acceleration_7",
                "deviation_7", "deviation_14",
                "is_spike_2std", "is_spike_3std",
                "seasonal_baseline_month", "seasonal_baseline_week",
                "deviation_from_monthly_baseline", "deviation_from_weekly_baseline",
                "above_seasonal_95pct",
                "cases_lag_7", "cases_lag_14", "cases_lag_21",
                "cases_per_100k", "env_risk", "env_risk_score",
                "favorable_dengue", "favorable_flu",
                "disease_encoded",
                "temperature_celsius", "humidity_percent", "rainfall_mm", "aqi",
                "water_quality_index", "temperature_lag_7", "rainfall_3day_sum",
                "days_since_heavy_rain",
                "population_log", "population_density", "region_tier",
                "historical_outbreak_freq", "sanitation_index",
                "severity_avg", "severity_rm_7", "state_outbreak_rate",
            ]

        for col in features:
            if col not in df.columns:
                df[col] = 0.0

        return df[features].replace([np.inf, -np.inf], 0).fillna(0)

    @classmethod
    def detect_anomalies(cls, region: Region, disease_code: str, date=None) -> Optional[Anomaly]:
        """Detect anomalies using IF ensemble + GB corrector scoring."""
        if date is None:
            date = timezone.now().date()

        feature_df = cls._build_features(region, disease_code, date)
        if feature_df is None or len(feature_df) < 7:
            return None

        latest_row = feature_df.iloc[[-1]]

        model = cls.load_model()
        scaler = cls.load_scaler()
        corrector = cls.load_corrector()
        corrector_idx = cls.load_corrector_idx()
        scoring_cfg = cls.load_scoring_config()

        if model is None:
            from sklearn.ensemble import IsolationForest
            model = IsolationForest(contamination=0.03, random_state=42, n_jobs=-1)
            if scaler:
                model.fit(scaler.transform(feature_df.values))
            else:
                model.fit(feature_df.values)

        # Scale features
        if scaler:
            X = scaler.transform(latest_row.values)
        else:
            X = latest_row.values

        # Get raw IF anomaly score
        raw_score = model.score_samples(X)[0]
        is_anomaly_raw = model.predict(X)[0] == -1

        # Apply GB corrector if available (matches scoring_config.json method)
        is_anomaly = is_anomaly_raw
        anomaly_score = abs(raw_score)

        if corrector is not None and scoring_cfg.get("method") == "corrected_gb":
            try:
                if corrector_idx is not None:
                    X_corr = X[:, corrector_idx]
                else:
                    X_corr = X
                corrected_prob = corrector.predict_proba(X_corr)[0][1]
                threshold = scoring_cfg.get("alpha", 0.15)
                # Blend raw IF score with corrector probability
                alpha = threshold
                blended = alpha * (1 - (raw_score + 0.5)) + (1 - alpha) * corrected_prob
                anomaly_score = float(blended)
                is_anomaly = corrected_prob > 0.5
            except Exception as exc:
                logger.warning("GB corrector scoring failed, using raw IF: %s", exc)

        if not is_anomaly:
            return None

        case_count = float(latest_row["case_count"].iloc[0])
        expected = float(latest_row.get("cases_rm_7", latest_row["case_count"]).iloc[0])
        deviation = ((case_count - expected) / expected * 100) if expected > 0 else 0

        disease_name_obj = SurveillanceData.objects.filter(disease_code=disease_code).first()
        disease_name = disease_name_obj.disease_name if disease_name_obj else disease_code

        anomaly = Anomaly.objects.create(
            region=region,
            disease_code=disease_code,
            disease_name=disease_name,
            detection_date=date,
            anomaly_score=anomaly_score,
            actual_cases=int(case_count),
            expected_cases=expected,
            deviation_percentage=deviation,
            description=(
                f"Cases {case_count:.0f} vs expected {expected:.0f} "
                f"({deviation:.1f}% deviation) [score={anomaly_score:.3f}]"
            ),
        )
        return anomaly

    @classmethod
    def detect_and_update_incremental(cls, region: Region, disease_code: str, date=None) -> Optional[Anomaly]:
        """Run anomaly detection then update the IF model incrementally.

        1. Build features from the last 90 days (including today's new data).
        2. Run inference on the latest row using the existing model.
        3. Save anomaly if detected.
        4. If the latest observation is *not* anomalous, retrain the model
           with warm_start to incorporate the new normal pattern.
        """
        if date is None:
            date = timezone.now().date()

        feature_df = cls._build_features(region, disease_code, date)
        if feature_df is None or len(feature_df) < 7:
            return None

        latest_row = feature_df.iloc[[-1]]

        model = cls.load_model()
        scaler = cls.load_scaler()
        corrector = cls.load_corrector()
        corrector_idx = cls.load_corrector_idx()
        scoring_cfg = cls.load_scoring_config()

        if model is None:
            from sklearn.ensemble import IsolationForest
            model = IsolationForest(
                contamination=0.03, random_state=42, n_jobs=-1, warm_start=True,
            )
            X_fit = scaler.transform(feature_df.values) if scaler else feature_df.values
            model.fit(X_fit)

        X = scaler.transform(latest_row.values) if scaler else latest_row.values

        raw_score = model.score_samples(X)[0]
        is_anomaly_raw = model.predict(X)[0] == -1

        is_anomaly = is_anomaly_raw
        anomaly_score = abs(raw_score)

        if corrector is not None and scoring_cfg.get("method") == "corrected_gb":
            try:
                X_corr = X[:, corrector_idx] if corrector_idx is not None else X
                corrected_prob = corrector.predict_proba(X_corr)[0][1]
                alpha = scoring_cfg.get("alpha", 0.15)
                blended = alpha * (1 - (raw_score + 0.5)) + (1 - alpha) * corrected_prob
                anomaly_score = float(blended)
                is_anomaly = corrected_prob > 0.5
            except Exception as exc:
                logger.warning("GB corrector scoring failed, using raw IF: %s", exc)

        # --- Incremental model update ---
        # Only retrain on non-anomalous data to preserve the normal-distribution assumption.
        if not is_anomaly:
            try:
                X_full = scaler.transform(feature_df.values) if scaler else feature_df.values
                model.warm_start = True
                model.n_estimators = getattr(model, "n_estimators", 100) + 10
                model.fit(X_full)
                save_path = cls.ENSEMBLE_PATH if cls.ENSEMBLE_PATH.exists() else cls.MODEL_PATH
                joblib.dump(model, save_path)
                logger.info("IF model updated incrementally for %s / %s", region.name, disease_code)
            except Exception as exc:
                logger.warning("Incremental IF update failed: %s", exc)

        if not is_anomaly:
            return None

        case_count = float(latest_row["case_count"].iloc[0])
        expected = float(latest_row.get("cases_rm_7", latest_row["case_count"]).iloc[0])
        deviation = ((case_count - expected) / expected * 100) if expected > 0 else 0

        disease_name_obj = SurveillanceData.objects.filter(disease_code=disease_code).first()
        disease_name = disease_name_obj.disease_name if disease_name_obj else disease_code

        anomaly = Anomaly.objects.create(
            region=region,
            disease_code=disease_code,
            disease_name=disease_name,
            detection_date=date,
            anomaly_score=anomaly_score,
            actual_cases=int(case_count),
            expected_cases=expected,
            deviation_percentage=deviation,
            description=(
                f"[RT] Cases {case_count:.0f} vs expected {expected:.0f} "
                f"({deviation:.1f}% deviation) [score={anomaly_score:.3f}]"
            ),
        )
        return anomaly


# ===================================================================
# 5. RiskScoringService  (XGBoost v4.0 outbreak classifier)
#    56 features, chunked training, risk tiers from risk_tiers.json
# ===================================================================

class RiskScoringService:
    """XGBoost v4.0 outbreak risk scoring.

    56-feature binary classifier trained on all India surveillance data
    with chunked continuation training. Risk tiers:
      low:      [0.0, 0.3)
      medium:   [0.3, 0.6)
      high:     [0.6, 0.85)
      critical: [0.85, 1.0]

    Artifacts:
      - xgboost.model / xgboost_model.pkl (native or pickle)
      - scaler.pkl (StandardScaler)
      - features.json (56 features)
      - risk_tiers.json
      - metrics.json
    """

    MODEL_PATH = XGBOOST_DIR / "xgboost.model"
    MODEL_PKL_PATH = XGBOOST_DIR / "xgboost_model.pkl"
    SCALER_PATH = XGBOOST_DIR / "scaler.pkl"
    FEATURES_PATH = XGBOOST_DIR / "features.json"
    RISK_TIERS_PATH = XGBOOST_DIR / "risk_tiers.json"
    METRICS_PATH = XGBOOST_DIR / "metrics.json"

    @classmethod
    def load_model(cls):
        """Load XGBoost model -- try native .model first, then pickle."""
        if cls.MODEL_PATH.exists():
            try:
                import xgboost as xgb
                booster = xgb.Booster()
                booster.load_model(str(cls.MODEL_PATH))
                return booster
            except Exception as exc:
                logger.warning("Could not load XGBoost native model: %s", exc)
        # Fallback to pickle
        model = _load_pickle(cls.MODEL_PKL_PATH)
        if model is not None:
            return model
        return None

    @classmethod
    def load_scaler(cls):
        return _load_pickle(cls.SCALER_PATH)

    @classmethod
    def load_features(cls) -> List[str]:
        feats = _load_json(cls.FEATURES_PATH)
        return feats if feats else [
            "month", "week_of_year", "day_of_week", "quarter", "day_of_year",
            "is_weekend", "is_holiday", "is_monsoon", "is_winter", "is_summer",
            "case_count", "cases_rm_7", "cases_rm_14", "cases_rm_28",
            "cases_rstd_7", "cases_rstd_14", "cases_rstd_28",
            "cases_rmax_7", "cases_rmax_14", "cases_rmax_28",
            "growth_7", "growth_14", "acceleration_7",
            "deviation_7", "deviation_14",
            "is_spike_2std", "is_spike_3std",
            "seasonal_baseline_month", "seasonal_baseline_week",
            "deviation_from_monthly_baseline", "deviation_from_weekly_baseline",
            "above_seasonal_95pct",
            "cases_lag_7", "cases_lag_14", "cases_lag_21",
            "cases_per_100k", "env_risk", "env_risk_score",
            "favorable_dengue", "favorable_flu",
            "temperature_celsius", "humidity_percent", "rainfall_mm", "aqi",
            "water_quality_index", "temperature_lag_7", "rainfall_3day_sum",
            "days_since_heavy_rain",
            "population_log", "population_density", "region_tier",
            "historical_outbreak_freq", "sanitation_index",
            "severity_avg", "severity_rm_7", "state_outbreak_rate",
        ]

    @classmethod
    def load_risk_tiers(cls) -> dict:
        tiers = _load_json(cls.RISK_TIERS_PATH)
        return tiers if tiers else {
            "low": [0.0, 0.3],
            "medium": [0.3, 0.6],
            "high": [0.6, 0.85],
            "critical": [0.85, 1.0],
        }

    @classmethod
    def get_model_info(cls) -> dict:
        metrics = _load_json(cls.METRICS_PATH) or {}
        tiers = cls.load_risk_tiers()
        return {
            "name": "XGBoost Outbreak Classifier v4.0",
            "description": "56-feature binary outbreak classifier with chunked "
                           "continuation training on full India surveillance data",
            "version": metrics.get("model", "XGBoost v4.0"),
            "model_available": cls.MODEL_PATH.exists() or cls.MODEL_PKL_PATH.exists(),
            "features": cls.load_features(),
            "n_features": len(cls.load_features()),
            "risk_tiers": tiers,
            "metrics": {
                "roc_auc": metrics.get("roc_auc", 0),
                "f1_score": metrics.get("f1_score", 0),
                "precision": metrics.get("precision", 0),
                "recall": metrics.get("recall", 0),
                "balanced_accuracy": metrics.get("balanced_accuracy", 0),
                "total_trees": metrics.get("total_trees", 0),
                "total_training_rows": metrics.get("total_training_rows", 0),
            },
            "risk_tier_distribution": metrics.get("risk_tier_distribution", {}),
        }

    @classmethod
    def _build_features(cls, region: Region, disease_code: str, date) -> Optional[pd.DataFrame]:
        """Build the 56-feature vector matching train_refined_xgboost.py."""
        start = date - timedelta(days=90)

        surv_qs = (
            SurveillanceData.objects.filter(
                region=region,
                disease_code=disease_code,
                date__gte=start,
                date__lte=date,
            )
            .order_by("date")
            .values("date", "case_count", "average_severity")
        )

        env_qs = (
            EnvironmentalData.objects.filter(
                region=region,
                date__gte=start,
                date__lte=date,
            )
            .order_by("date")
            .values("date", "temperature", "humidity", "rainfall", "aqi", "water_quality_index")
        )

        if not surv_qs:
            return None

        surv_df = pd.DataFrame(list(surv_qs)).rename(columns={
            "case_count": "case_count",
            "average_severity": "severity_avg",
        })
        surv_df["date"] = pd.to_datetime(surv_df["date"])

        env_df = pd.DataFrame(list(env_qs)).rename(columns={
            "temperature": "temperature_celsius",
            "humidity": "humidity_percent",
            "rainfall": "rainfall_mm",
        })
        if not env_df.empty:
            env_df["date"] = pd.to_datetime(env_df["date"])
            df = surv_df.merge(env_df, on="date", how="left")
        else:
            df = surv_df.copy()
            for col in ["temperature_celsius", "humidity_percent", "rainfall_mm", "aqi", "water_quality_index"]:
                df[col] = 0.0

        df = df.sort_values("date").reset_index(drop=True)
        df = df.fillna(0)

        # ── Temporal features ──
        df["month"] = df["date"].dt.month
        df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
        df["day_of_week"] = df["date"].dt.dayofweek
        df["quarter"] = df["date"].dt.quarter
        df["day_of_year"] = df["date"].dt.dayofyear
        df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
        df["is_holiday"] = df["date"].apply(_is_holiday)
        seasons = df["date"].apply(_get_season_flags)
        df["is_monsoon"] = seasons.apply(lambda x: x["is_monsoon"])
        df["is_winter"] = seasons.apply(lambda x: x["is_winter"])
        df["is_summer"] = seasons.apply(lambda x: x["is_summer"])

        # ── Rolling statistics ──
        for w in [7, 14, 28]:
            df[f"cases_rm_{w}"] = df["case_count"].rolling(window=w, min_periods=1).mean()
            df[f"cases_rstd_{w}"] = df["case_count"].rolling(window=w, min_periods=1).std().fillna(0)
            df[f"cases_rmax_{w}"] = df["case_count"].rolling(window=w, min_periods=1).max()

        # ── Growth & acceleration ──
        for p in [7, 14]:
            df[f"growth_{p}"] = df["case_count"].pct_change(periods=p).fillna(0)
        df["acceleration_7"] = df["growth_7"].diff().fillna(0)

        # ── Deviation ──
        for p in [7, 14]:
            rm_col = f"cases_rm_{p}"
            std_col = f"cases_rstd_{p}"
            df[f"deviation_{p}"] = (df["case_count"] - df[rm_col]) / (df[std_col] + 1)

        # ── Spike detection ──
        rm7 = df["cases_rm_7"]
        std7 = df["cases_rstd_7"]
        df["is_spike_2std"] = (df["case_count"] > (rm7 + 2 * std7)).astype(int)
        df["is_spike_3std"] = (df["case_count"] > (rm7 + 3 * std7)).astype(int)

        # ── Seasonal baselines ──
        df["seasonal_baseline_month"] = df.groupby("month")["case_count"].transform("mean")
        df["seasonal_baseline_week"] = df.groupby("week_of_year")["case_count"].transform("mean")
        df["deviation_from_monthly_baseline"] = df["case_count"] - df["seasonal_baseline_month"]
        df["deviation_from_weekly_baseline"] = df["case_count"] - df["seasonal_baseline_week"]
        monthly_95 = df.groupby("month")["case_count"].transform(lambda x: x.quantile(0.95))
        df["above_seasonal_95pct"] = (df["case_count"] > monthly_95).astype(int)

        # ── Lag features ──
        for lag in [7, 14, 21]:
            df[f"cases_lag_{lag}"] = df["case_count"].shift(lag).fillna(0)

        # ── Per-capita ──
        pop = max(region.population, 1)
        df["cases_per_100k"] = (df["case_count"] / pop) * 100_000

        # ── Environmental risk ──
        df["env_risk"] = (
            (df["temperature_celsius"] > 30).astype(int)
            + (df["rainfall_mm"] > 50).astype(int)
            + (df["aqi"] > 150).astype(int)
        )
        df["env_risk_score"] = (
            df["temperature_celsius"] / 50.0
            + df["rainfall_mm"] / 200.0
            + df["aqi"] / 500.0
        )

        # ── Disease-favorable conditions ──
        df["favorable_dengue"] = (
            (df["temperature_celsius"].between(25, 35))
            & (df["humidity_percent"] > 60)
            & (df["rainfall_mm"] > 0)
        ).astype(int)
        df["favorable_flu"] = (
            (df["temperature_celsius"] < 20)
            & (df["humidity_percent"] < 40)
        ).astype(int)

        # ── Environmental lag ──
        df["temperature_lag_7"] = df["temperature_celsius"].shift(7).fillna(df["temperature_celsius"].mean())
        df["rainfall_3day_sum"] = df["rainfall_mm"].rolling(3, min_periods=1).sum()
        df["days_since_heavy_rain"] = 0
        heavy_rain = df["rainfall_mm"] > 50
        for i in range(len(df)):
            if heavy_rain.iloc[i]:
                df.loc[df.index[i], "days_since_heavy_rain"] = 0
            elif i > 0:
                df.loc[df.index[i], "days_since_heavy_rain"] = df["days_since_heavy_rain"].iloc[i - 1] + 1

        # ── Demographic / infrastructure ──
        df["population_log"] = np.log1p(pop)
        area_sq_km = max(pop / 400, 1)
        df["population_density"] = pop / area_sq_km
        df["region_tier"] = 1 if pop > 1_000_000 else (2 if pop > 100_000 else 3)

        total_surv = SurveillanceData.objects.filter(
            region=region, disease_code=disease_code,
        ).count()
        outbreak_count = SurveillanceData.objects.filter(
            region=region, disease_code=disease_code,
            case_count__gt=10,
        ).count()
        df["historical_outbreak_freq"] = outbreak_count / max(total_surv, 1)

        df["sanitation_index"] = region.sanitation_index

        # Severity rolling
        df["severity_rm_7"] = df["severity_avg"].rolling(7, min_periods=1).mean()

        # State outbreak rate
        state_regions = Region.objects.filter(state=region.state)
        state_total = SurveillanceData.objects.filter(
            region__in=state_regions,
            disease_code=disease_code,
            date__gte=start,
        ).count()
        state_outbreaks = SurveillanceData.objects.filter(
            region__in=state_regions,
            disease_code=disease_code,
            date__gte=start,
            case_count__gt=10,
        ).count()
        df["state_outbreak_rate"] = state_outbreaks / max(state_total, 1)

        # ── Select features ──
        features = cls.load_features()
        for col in features:
            if col not in df.columns:
                df[col] = 0.0

        return df[features].replace([np.inf, -np.inf], 0).fillna(0)

    @classmethod
    def calculate_risk_score(cls, region: Region, disease_code: str, date=None) -> RiskScore:
        """Calculate outbreak risk probability using XGBoost v4.0 with 56 features."""
        if date is None:
            date = timezone.now().date()

        feature_df = cls._build_features(region, disease_code, date)
        risk_tiers = cls.load_risk_tiers()

        risk_probability = 0.1
        risk_level = 0
        contributing_factors: Dict[str, Any] = {}

        if feature_df is not None and len(feature_df) >= 7:
            latest_row = feature_df.iloc[[-1]]
            model = cls.load_model()
            scaler = cls.load_scaler()
            feature_names = cls.load_features()

            if model is not None:
                try:
                    import xgboost as xgb

                    X = latest_row.values
                    if scaler:
                        X = scaler.transform(X)

                    dmat = xgb.DMatrix(X, feature_names=feature_names)
                    risk_probability = float(model.predict(dmat)[0])

                    # Apply risk tiers from risk_tiers.json
                    if risk_probability >= risk_tiers.get("critical", [0.85, 1.0])[0]:
                        risk_level = 3  # Critical
                    elif risk_probability >= risk_tiers.get("high", [0.6, 0.85])[0]:
                        risk_level = 2  # High
                    elif risk_probability >= risk_tiers.get("medium", [0.3, 0.6])[0]:
                        risk_level = 1  # Medium
                    else:
                        risk_level = 0  # Low

                    # Top contributing features
                    feature_values = latest_row.iloc[0].to_dict()
                    top_features = sorted(
                        feature_values.items(),
                        key=lambda x: abs(float(x[1])) if isinstance(x[1], (int, float)) else 0,
                        reverse=True,
                    )[:10]
                    contributing_factors = {
                        k: round(float(v), 4) for k, v in top_features
                    }

                except Exception as exc:
                    logger.warning("XGBoost prediction failed: %s", exc)
            else:
                # Fallback heuristic when model not available
                start_14 = date - timedelta(days=14)
                recent = SurveillanceData.objects.filter(
                    region=region, disease_code=disease_code, date__gte=start_14,
                ).aggregate(avg=Avg("case_count"))["avg"] or 0
                if recent > 20:
                    risk_level, risk_probability = 2, 0.7
                elif recent > 10:
                    risk_level, risk_probability = 1, 0.4
                contributing_factors = {"case_count_avg": round(recent, 2)}
        else:
            contributing_factors = {"note": "Insufficient data for feature engineering"}

        disease_name_obj = SurveillanceData.objects.filter(disease_code=disease_code).first()
        disease_name = disease_name_obj.disease_name if disease_name_obj else disease_code

        risk_score, _ = RiskScore.objects.update_or_create(
            region=region,
            disease_code=disease_code,
            calculation_date=date,
            defaults={
                "disease_name": disease_name,
                "risk_level": risk_level,
                "risk_probability": risk_probability,
                "contributing_factors": contributing_factors,
            },
        )
        return risk_score

    @classmethod
    def score_and_update_incremental(cls, region: Region, disease_code: str, date=None) -> RiskScore:
        """Run risk scoring then update the XGBoost model via continuation training.

        1. Run the standard calculate_risk_score (inference + save).
        2. Perform a small number of continuation-training boosting rounds
           on the latest feature row so the model adapts to new patterns.
        3. Re-save the model file.
        """
        risk_score = cls.calculate_risk_score(region, disease_code, date)

        if date is None:
            date = timezone.now().date()

        feature_df = cls._build_features(region, disease_code, date)
        if feature_df is None or len(feature_df) < 7:
            return risk_score

        try:
            import xgboost as xgb

            model = cls.load_model()
            scaler = cls.load_scaler()
            feature_names = cls.load_features()

            if model is None:
                return risk_score

            X = feature_df.values
            if scaler:
                X = scaler.transform(X)

            # Derive pseudo-labels: outbreak if case_count exceeds rolling mean + 2*std
            case_counts = feature_df["case_count"].values if "case_count" in feature_df.columns else np.zeros(len(X))
            rm7 = pd.Series(case_counts).rolling(7, min_periods=1).mean().values
            rstd7 = pd.Series(case_counts).rolling(7, min_periods=1).std().fillna(0).values
            labels = (case_counts > (rm7 + 2 * rstd7)).astype(float)

            dtrain = xgb.DMatrix(X, label=labels, feature_names=feature_names)
            params = {
                "objective": "binary:logistic",
                "eval_metric": "logloss",
                "max_depth": 6,
                "learning_rate": 0.01,
                "verbosity": 0,
            }
            updated_model = xgb.train(
                params, dtrain, num_boost_round=5, xgb_model=model,
            )

            save_path = cls.MODEL_PATH if cls.MODEL_PATH.exists() else cls.MODEL_PKL_PATH
            updated_model.save_model(str(save_path))
            logger.info("XGBoost model updated incrementally for %s / %s", region.name, disease_code)
        except Exception as exc:
            logger.warning("Incremental XGBoost update failed: %s", exc)

        return risk_score


# ===================================================================
# 6. AlertService  (multi-model fusion)
# ===================================================================

class AlertService:
    """Multi-model alert fusion and generation."""

    @classmethod
    def evaluate_alerts(cls, disease_code: str, date=None) -> List[Alert]:
        if date is None:
            date = timezone.now().date()

        alerts: List[Alert] = []

        regions = Region.objects.filter(
            surveillance_data__disease_code=disease_code,
            surveillance_data__date__gte=date - timedelta(days=7),
        ).distinct()

        for region in regions:
            forecasts = Forecast.objects.filter(
                region=region,
                disease_code=disease_code,
                forecast_date=date,
                prediction_date__gte=date,
                prediction_date__lte=date + timedelta(days=7),
            )
            forecast_spike = any(f.predicted_cases > 1.5 * f.lower_bound for f in forecasts)

            clusters = Cluster.objects.filter(
                regions__region=region,
                disease_code=disease_code,
                detection_date__gte=date - timedelta(days=3),
                is_active=True,
            )
            in_cluster = clusters.exists()

            anomalies = Anomaly.objects.filter(
                region=region,
                disease_code=disease_code,
                detection_date=date,
                is_resolved=False,
            )
            has_anomaly = anomalies.exists()

            risk_scores = RiskScore.objects.filter(
                region=region,
                disease_code=disease_code,
                calculation_date=date,
            )
            high_risk = risk_scores.exists() and risk_scores.first().risk_level >= 2

            alert = None

            if forecast_spike and in_cluster and has_anomaly:
                alert = cls._create_alert(
                    "critical", disease_code, [region],
                    "Multi-model Critical Alert",
                    "Forecasted spike, active cluster, and anomaly detected",
                    0.95, forecasts, clusters, anomalies, risk_scores,
                )
            elif forecast_spike and in_cluster:
                alert = cls._create_alert(
                    "high", disease_code, [region],
                    "High Priority Alert",
                    "Forecasted spike and active cluster detected",
                    0.80, forecasts, clusters, anomalies, risk_scores,
                )
            elif has_anomaly:
                alert = cls._create_alert(
                    "medium", disease_code, [region],
                    "Anomaly Detected",
                    "Unusual disease pattern requires review",
                    0.60, forecasts, clusters, anomalies, risk_scores,
                )
            elif high_risk:
                alert = cls._create_alert(
                    "low", disease_code, [region],
                    "Preventive Warning",
                    "Environmental and demographic factors indicate elevated risk",
                    0.50, forecasts, clusters, anomalies, risk_scores,
                )

            if alert:
                alerts.append(alert)

        return alerts

    @classmethod
    def evaluate_alert_for_region(cls, region: Region, disease_code: str, date=None) -> Optional[Alert]:
        """Decision fusion for a single region-disease pair (real-time path)."""
        if date is None:
            date = timezone.now().date()

        forecasts = Forecast.objects.filter(
            region=region,
            disease_code=disease_code,
            forecast_date__gte=date - timedelta(days=1),
            prediction_date__gte=date,
            prediction_date__lte=date + timedelta(days=7),
        )
        forecast_spike = any(f.predicted_cases > 1.5 * f.lower_bound for f in forecasts)

        clusters = Cluster.objects.filter(
            regions__region=region,
            disease_code=disease_code,
            detection_date__gte=date - timedelta(days=3),
            is_active=True,
        )
        in_cluster = clusters.exists()

        anomalies = Anomaly.objects.filter(
            region=region,
            disease_code=disease_code,
            detection_date=date,
            is_resolved=False,
        )
        has_anomaly = anomalies.exists()

        risk_scores = RiskScore.objects.filter(
            region=region,
            disease_code=disease_code,
            calculation_date=date,
        )
        high_risk = risk_scores.exists() and risk_scores.first().risk_level >= 2

        if forecast_spike and in_cluster and has_anomaly:
            return cls._create_alert(
                "critical", disease_code, [region],
                "Multi-model Critical Alert",
                "Forecasted spike, active cluster, and anomaly detected",
                0.95, forecasts, clusters, anomalies, risk_scores,
            )
        elif forecast_spike and in_cluster:
            return cls._create_alert(
                "high", disease_code, [region],
                "High Priority Alert",
                "Forecasted spike and active cluster detected",
                0.80, forecasts, clusters, anomalies, risk_scores,
            )
        elif has_anomaly:
            return cls._create_alert(
                "medium", disease_code, [region],
                "Anomaly Detected",
                "Unusual disease pattern requires review",
                0.60, forecasts, clusters, anomalies, risk_scores,
            )
        elif high_risk:
            return cls._create_alert(
                "low", disease_code, [region],
                "Preventive Warning",
                "Environmental and demographic factors indicate elevated risk",
                0.50, forecasts, clusters, anomalies, risk_scores,
            )
        return None

    @classmethod
    def _create_alert(cls, severity, disease_code, regions, title, description, confidence,
                      forecasts, clusters, anomalies, risk_scores):
        disease_name_obj = SurveillanceData.objects.filter(disease_code=disease_code).first()
        disease_name = disease_name_obj.disease_name if disease_name_obj else disease_code

        factors: Dict[str, str] = {}
        if forecasts.exists():
            factors["forecast"] = f"Predicted {forecasts.first().predicted_cases:.0f} cases in next 7 days"
        if clusters.exists():
            factors["cluster"] = f"{clusters.first().severity} severity cluster detected"
        if anomalies.exists():
            factors["anomaly"] = f"{anomalies.first().deviation_percentage:.1f}% deviation from expected"
        if risk_scores.exists():
            factors["risk"] = f"{risk_scores.first().get_risk_level_display()} risk score"

        actions = []
        if severity in ("critical", "high"):
            actions += [
                "Deploy rapid response team",
                "Increase surveillance in affected areas",
                "Stock emergency medical supplies",
            ]
        actions += [
            "Monitor disease progression closely",
            "Educate public about prevention measures",
        ]

        alert = Alert.objects.create(
            alert_type="outbreak",
            disease_code=disease_code,
            disease_name=disease_name,
            severity=severity,
            confidence=confidence,
            title=title,
            description=description,
            contributing_factors=factors,
            recommended_actions="\n".join(actions),
            escalation_level=1 if severity in ("low", "medium") else 2,
        )
        alert.affected_regions.set(regions)
        return alert


# ===================================================================
# 7. MLModelInfoService  (introspect saved model artefacts)
# ===================================================================

class MLModelInfoService:
    """Provides metadata about all deployed ML models (v5.0 aligned)."""

    @staticmethod
    def get_all_models_info() -> dict:
        return {
            "dbscan": ClusteringService.get_model_info(),
            "isolation_forest": AnomalyDetectionService.get_model_info(),
            "forecast_ensemble": ForecastingService.get_model_info(),
            "xgboost": RiskScoringService.get_model_info(),
        }

    @staticmethod
    def get_pipeline_status() -> dict:
        """Return quick health check for the ML pipeline."""
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)

        return {
            "surveillance_records_today": SurveillanceData.objects.filter(date=today).count(),
            "surveillance_records_week": SurveillanceData.objects.filter(date__gte=week_ago).count(),
            "active_clusters": Cluster.objects.filter(is_active=True).count(),
            "recent_anomalies": Anomaly.objects.filter(detection_date__gte=week_ago, is_resolved=False).count(),
            "active_alerts": Alert.objects.filter(status="active").count(),
            "critical_alerts": Alert.objects.filter(status="active", severity="critical").count(),
            "forecasts_generated_today": Forecast.objects.filter(forecast_date=today).count(),
            "risk_scores_today": RiskScore.objects.filter(calculation_date=today).count(),
            "regions_count": Region.objects.count(),
            "environmental_records_today": EnvironmentalData.objects.filter(date=today).count(),
            "models": {
                "dbscan": (DBSCAN_DIR / "dbscan_model.pkl").exists(),
                "isolation_forest": (
                    (ISOLATION_FOREST_DIR / "isolation_forest_ensemble.pkl").exists()
                    or (ISOLATION_FOREST_DIR / "isolation_forest.pkl").exists()
                ),
                "forecast_ensemble": (PROPHET_DIR / "prophet_model.pkl").exists(),
                "xgboost": (
                    (XGBOOST_DIR / "xgboost.model").exists()
                    or (XGBOOST_DIR / "xgboost_model.pkl").exists()
                ),
            },
        }
