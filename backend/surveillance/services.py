"""Surveillance services for data aggregation and ML integration.

Aligns with the production ML models:
  - dbscan_prod/       (DBSCAN geo-clustering, haversine metric)
  - isolation_forest_prod/ (27-feature anomaly detection with scaler)
  - prophet_prod/      (national daily case forecast with env regressors)
  - xgboost_prod/      (binary outbreak classifier, 6 features with scaler)
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
PROPHET_DIR = ML_MODELS_ROOT / "prophet_prod"
XGBOOST_DIR = ML_MODELS_ROOT / "xgboost_prod"


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
# 2. ClusteringService  (DBSCAN -- haversine, matches train_dbscan_prod.py)
# ===================================================================

class ClusteringService:
    """DBSCAN geo-clustering aligned with dbscan_prod model."""

    MODEL_PATH = DBSCAN_DIR / "dbscan_model.pkl"

    @classmethod
    def load_model(cls):
        return _load_pickle(cls.MODEL_PATH)

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
# 3. ForecastingService  (Prophet -- matches train_prophet_prod.py)
#    National daily model with temperature / rainfall / aqi regressors
# ===================================================================

class ForecastingService:
    """Prophet forecasting -- national daily case counts with env regressors."""

    MODEL_PATH = PROPHET_DIR / "prophet_model.pkl"
    METRICS_PATH = PROPHET_DIR / "metrics.json"
    METADATA_PATH = PROPHET_DIR / "metadata.json"

    @classmethod
    def load_model(cls):
        return _load_pickle(cls.MODEL_PATH)

    @classmethod
    def get_model_info(cls) -> dict:
        """Return metadata + metrics for the Prophet model."""
        meta = _load_json(cls.METADATA_PATH) or {}
        metrics = _load_json(cls.METRICS_PATH) or {}
        return {**meta, "metrics": metrics, "model_available": cls.MODEL_PATH.exists()}

    @classmethod
    def generate_forecast(
        cls,
        region: Region,
        disease_code: str,
        horizon_days: int = 7,
    ) -> List[Forecast]:
        """Generate forecast using Prophet national model, scaled to region."""
        min_date = timezone.now().date() - timedelta(days=90)
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
            df["aqi"] = 0.0

        df[["temperature_celsius", "rainfall_mm", "aqi"]] = (
            df[["temperature_celsius", "rainfall_mm", "aqi"]]
            .ffill()
            .bfill()
            .fillna(0)
        )

        try:
            from prophet import Prophet as ProphetModel

            model = cls.load_model()
            if model is None:
                model = ProphetModel(
                    yearly_seasonality=True,
                    weekly_seasonality=True,
                    daily_seasonality=False,
                    changepoint_prior_scale=0.05,
                )
                model.add_regressor("temperature_celsius", standardize=True)
                model.add_regressor("rainfall_mm", standardize=True)
                model.add_regressor("aqi", standardize=True)
                model.fit(df[["ds", "y", "temperature_celsius", "rainfall_mm", "aqi"]])

            future = model.make_future_dataframe(periods=horizon_days)
            last_env = df[["ds", "temperature_celsius", "rainfall_mm", "aqi"]].set_index("ds")
            future_env = last_env.reindex(future["ds"]).ffill().bfill().fillna(0).reset_index()
            future["temperature_celsius"] = future_env["temperature_celsius"].values
            future["rainfall_mm"] = future_env["rainfall_mm"].values
            future["aqi"] = future_env["aqi"].values

            forecast_df = model.predict(future)

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
            for _, row in forecast_df.tail(horizon_days).iterrows():
                pred_date = row["ds"].date()
                fc = Forecast.objects.create(
                    region=region,
                    disease_code=disease_code,
                    disease_name=disease_name,
                    forecast_date=today,
                    prediction_date=pred_date,
                    horizon_days=horizon_days,
                    predicted_cases=max(0, row["yhat"] * scale),
                    lower_bound=max(0, row["yhat_lower"] * scale),
                    upper_bound=max(0, row["yhat_upper"] * scale),
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
# 4. AnomalyDetectionService  (Isolation Forest -- 27 features)
#    Matches train_isolation_forest_prod.py exactly
# ===================================================================

class AnomalyDetectionService:
    """Isolation Forest anomaly detection with 27 engineered features."""

    MODEL_PATH = ISOLATION_FOREST_DIR / "isolation_forest.pkl"
    SCALER_PATH = ISOLATION_FOREST_DIR / "scaler.pkl"
    FEATURES_PATH = ISOLATION_FOREST_DIR / "features.json"
    METADATA_PATH = ISOLATION_FOREST_DIR / "metadata.json"

    @classmethod
    def load_model(cls):
        return _load_pickle(cls.MODEL_PATH)

    @classmethod
    def load_scaler(cls):
        return _load_pickle(cls.SCALER_PATH)

    @classmethod
    def load_features(cls) -> List[str]:
        feats = _load_json(cls.FEATURES_PATH)
        return feats if feats else []

    @classmethod
    def get_model_info(cls) -> dict:
        meta = _load_json(cls.METADATA_PATH) or {}
        return {
            **meta,
            "features": cls.load_features(),
            "model_available": cls.MODEL_PATH.exists(),
        }

    @classmethod
    def _build_features(cls, region: Region, disease_code: str, date) -> Optional[pd.DataFrame]:
        """Re-create the 27-feature vector used during training."""
        start = date - timedelta(days=60)

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

        df["sanitation_index"] = region.sanitation_index
        df["hospital_count"] = region.hospital_count
        df["population"] = region.population

        df = df.sort_values("date").reset_index(drop=True)
        df = df.fillna(0)

        # Feature engineering (mirrors train_isolation_forest_prod.py)
        for lag in [7, 14]:
            df[f"cases_lag_{lag}"] = df["case_count"].shift(lag).fillna(0)
            df[f"severity_lag_{lag}"] = df["severity_avg"].shift(lag).fillna(0)

        for w in [7, 14]:
            df[f"cases_rm_{w}"] = df["case_count"].rolling(window=w, min_periods=1).mean().fillna(0)
            df[f"cases_rstd_{w}"] = df["case_count"].rolling(window=w, min_periods=1).std().fillna(0)
            df[f"cases_rmax_{w}"] = df["case_count"].rolling(window=w, min_periods=1).max().fillna(0)

        for p in [7, 14]:
            df[f"growth_{p}"] = df["case_count"].pct_change(periods=p).fillna(0)

        df["deviation_7"] = (df["case_count"] - df["cases_rm_7"]) / (df["cases_rstd_7"] + 1)
        df["case_density"] = (df["case_count"] / (df["population"] + 1)) * 100_000
        df["env_risk"] = (
            (df["temperature_celsius"] > 30).astype(int)
            + (df["rainfall_mm"] > 50).astype(int)
            + (df["aqi"] > 150).astype(int)
        )
        df["sanitation_weighted"] = df["case_count"] * (10 - df["sanitation_index"]) / 10
        df["cases_per_hospital"] = df["case_count"] / (df["hospital_count"] + 1)

        features = cls.load_features()
        if not features:
            features = [
                "case_count", "severity_avg",
                "temperature_celsius", "humidity_percent", "rainfall_mm", "aqi", "water_quality_index",
                "sanitation_index", "hospital_count", "population",
                "cases_lag_7", "cases_lag_14", "severity_lag_7", "severity_lag_14",
                "cases_rm_7", "cases_rstd_7", "cases_rmax_7", "cases_rm_14", "cases_rstd_14", "cases_rmax_14",
                "growth_7", "growth_14", "deviation_7", "case_density", "env_risk",
                "sanitation_weighted", "cases_per_hospital",
            ]

        for col in features:
            if col not in df.columns:
                df[col] = 0.0

        return df[features].replace([np.inf, -np.inf], 0).fillna(0)

    @classmethod
    def detect_anomalies(cls, region: Region, disease_code: str, date=None) -> Optional[Anomaly]:
        """Detect anomalies for a single region-disease-date combination."""
        if date is None:
            date = timezone.now().date()

        feature_df = cls._build_features(region, disease_code, date)
        if feature_df is None or len(feature_df) < 7:
            return None

        latest_row = feature_df.iloc[[-1]]

        model = cls.load_model()
        scaler = cls.load_scaler()

        if model is None:
            from sklearn.ensemble import IsolationForest
            model = IsolationForest(contamination=0.03, random_state=42, n_jobs=-1)
            if scaler:
                model.fit(scaler.transform(feature_df.values))
            else:
                model.fit(feature_df.values)

        if scaler:
            X = scaler.transform(latest_row.values)
        else:
            X = latest_row.values

        anomaly_score = model.score_samples(X)[0]
        is_anomaly = model.predict(X)[0] == -1

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
            anomaly_score=abs(anomaly_score),
            actual_cases=int(case_count),
            expected_cases=expected,
            deviation_percentage=deviation,
            description=(
                f"Cases {case_count:.0f} vs expected {expected:.0f} "
                f"({deviation:.1f}% deviation)"
            ),
        )
        return anomaly


# ===================================================================
# 5. RiskScoringService  (XGBoost binary outbreak classifier)
#    Matches train_xgboost_prod.py -- 6 features, binary:logistic
# ===================================================================

class RiskScoringService:
    """XGBoost outbreak risk scoring -- binary classification."""

    MODEL_PATH = XGBOOST_DIR / "xgboost.model"
    SCALER_PATH = XGBOOST_DIR / "scaler.pkl"
    FEATURES_PATH = XGBOOST_DIR / "features.json"
    METADATA_PATH = XGBOOST_DIR / "metadata.json"
    METRICS_PATH = XGBOOST_DIR / "metrics.json"

    @classmethod
    def load_model(cls):
        if cls.MODEL_PATH.exists():
            try:
                import xgboost as xgb
                booster = xgb.Booster()
                booster.load_model(str(cls.MODEL_PATH))
                return booster
            except Exception as exc:
                logger.warning("Could not load XGBoost model: %s", exc)
        return None

    @classmethod
    def load_scaler(cls):
        return _load_pickle(cls.SCALER_PATH)

    @classmethod
    def load_features(cls) -> List[str]:
        feats = _load_json(cls.FEATURES_PATH)
        return feats if feats else ["temp_14d", "rain_14d", "aqi_14d", "sanitation_index", "hospital_count", "population"]

    @classmethod
    def get_model_info(cls) -> dict:
        meta = _load_json(cls.METADATA_PATH) or {}
        metrics = _load_json(cls.METRICS_PATH) or {}
        return {
            **meta,
            "metrics": metrics,
            "features": cls.load_features(),
            "model_available": cls.MODEL_PATH.exists(),
        }

    @classmethod
    def calculate_risk_score(cls, region: Region, disease_code: str, date=None) -> RiskScore:
        """Calculate outbreak risk probability using XGBoost."""
        if date is None:
            date = timezone.now().date()

        start_14 = date - timedelta(days=14)

        # 14-day rolling env features (matches train_xgboost_prod.py)
        env_agg = EnvironmentalData.objects.filter(
            region=region,
            date__gte=start_14,
            date__lte=date,
        ).aggregate(
            temp_14d=Avg("temperature"),
            rain_14d=Avg("rainfall"),
            aqi_14d=Avg("aqi"),
        )

        features = {
            "temp_14d": env_agg["temp_14d"] or 25.0,
            "rain_14d": env_agg["rain_14d"] or 0.0,
            "aqi_14d": env_agg["aqi_14d"] or 100.0,
            "sanitation_index": region.sanitation_index,
            "hospital_count": float(region.hospital_count),
            "population": float(region.population),
        }

        feature_names = cls.load_features()
        feature_vector = np.array([[features.get(f, 0.0) for f in feature_names]])

        model = cls.load_model()
        scaler = cls.load_scaler()

        if model is not None:
            try:
                import xgboost as xgb

                if scaler:
                    feature_vector = scaler.transform(feature_vector)

                dmat = xgb.DMatrix(feature_vector, feature_names=feature_names)
                risk_probability = float(model.predict(dmat)[0])

                if risk_probability >= 0.7:
                    risk_level = 3  # Critical
                elif risk_probability >= 0.4:
                    risk_level = 2  # High
                elif risk_probability >= 0.2:
                    risk_level = 1  # Medium
                else:
                    risk_level = 0  # Low

                contributing_factors = {f: round(float(features.get(f, 0)), 4) for f in feature_names}

            except Exception as exc:
                logger.warning("XGBoost prediction failed: %s", exc)
                risk_level, risk_probability, contributing_factors = 0, 0.1, {}
        else:
            risk_probability = 0.1
            risk_level = 0
            recent = SurveillanceData.objects.filter(
                region=region, disease_code=disease_code, date__gte=start_14,
            ).aggregate(avg=Avg("case_count"))["avg"] or 0
            if recent > 20:
                risk_level, risk_probability = 2, 0.7
            elif recent > 10:
                risk_level, risk_probability = 1, 0.4
            contributing_factors = {"case_count_avg": round(recent, 2)}

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
    """Provides metadata about all deployed ML models."""

    @staticmethod
    def get_all_models_info() -> dict:
        return {
            "dbscan": {
                "name": "DBSCAN Geo-Clustering",
                "description": "Haversine-metric spatial clustering of disease regions",
                "model_available": (DBSCAN_DIR / "dbscan_model.pkl").exists(),
                "artifacts": {
                    "model": str(DBSCAN_DIR / "dbscan_model.pkl"),
                    "clusters": str(DBSCAN_DIR / "clusters.csv"),
                    "summary": str(DBSCAN_DIR / "cluster_summary.csv"),
                },
            },
            "isolation_forest": AnomalyDetectionService.get_model_info(),
            "prophet": ForecastingService.get_model_info(),
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
                "isolation_forest": (ISOLATION_FOREST_DIR / "isolation_forest.pkl").exists(),
                "prophet": (PROPHET_DIR / "prophet_model.pkl").exists(),
                "xgboost": (XGBOOST_DIR / "xgboost.model").exists(),
            },
        }
