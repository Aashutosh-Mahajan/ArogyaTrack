"""Surveillance services backed by a validated immutable causal model bundle."""
import json
import hashlib
import logging
from datetime import timedelta
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path

import numpy as np
import pandas as pd
from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Count, Max, Sum
from django.utils import timezone
from sklearn.cluster import DBSCAN

from .ml.features import prepare_daily, build_features
from .ml.runtime import ModelUnavailable, load_bundle, risk_predict, anomaly_predict, forecast_predict
from .models import (Alert, Anomaly, Cluster, ClusterRegion, Consent, EnvironmentalData,
                     Forecast, Region, RiskScore, SurveillanceData)

logger = logging.getLogger(__name__)
ML_MODELS_ROOT = Path(getattr(settings, "ML_MODELS_ROOT", Path(settings.BASE_DIR).parent/"ml_models/saved_models/validated"))


def _today():
    return timezone.localdate(timezone=timezone.get_fixed_timezone(330))


def _inference_key(*parts):
    return hashlib.sha256(json.dumps([str(p) for p in parts]).encode()).hexdigest()


def _bundle():
    try:
        version = json.loads((ML_MODELS_ROOT/"active.json").read_text())["version"]
        if Path(version).name != version or version in (".", ".."):
            raise ValueError("Invalid bundle version")
        return load_bundle(ML_MODELS_ROOT/version)
    except Exception as exc:
        raise ModelUnavailable(str(exc)) from exc


def _haversine(lat1, lon1, lat2, lon2):
    a = sin(radians(lat2-lat1)/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(radians(lon2-lon1)/2)**2
    return 6371.0088*2*atan2(sqrt(a),sqrt(max(0,1-a)))


class AggregationService:
    K_ANONYMITY_THRESHOLD = 5

    @classmethod
    def aggregate_daily_data(cls, target_date=None, region=None, disease_code=None):
        """Recompute unique patient/disease/day counts; dispensing never adds cases.

        Privacy threshold applies to distinct patients, not event counts. Suppressed
        observations carry a marker and no hidden counts into public APIs or ML.
        """
        from medical.models import Diagnosis
        from datetime import datetime, time
        from zoneinfo import ZoneInfo
        target_date = target_date or (_today()-timedelta(days=1))
        start = datetime.combine(target_date,time.min,tzinfo=ZoneInfo("Asia/Kolkata"))
        end = start+timedelta(days=1)
        consented = Consent.objects.filter(consent_type="surveillance",is_granted=True).values_list("profile_id",flat=True)
        diagnoses = Diagnosis.objects.filter(record__patient_id__in=consented,created_at__gte=start,created_at__lt=end)
        if region:
            diagnoses=diagnoses.filter(record__patient__region=region.name)
        if disease_code:
            diagnoses=diagnoses.filter(icd_10_code=disease_code)
        encounters=diagnoses.values("record__patient_id","record__patient__region","icd_10_code").annotate(
            severity=Max("severity"),name=Max("disease_name"))
        groups={}
        for entry in encounters:
            key=(entry["record__patient__region"],entry["icd_10_code"])
            group=groups.setdefault(key,{"severities":[],"patients":set(),"name":entry["name"]})
            group["severities"].append(entry["severity"])
            group["patients"].add(entry["record__patient_id"])
        existing=SurveillanceData.objects.filter(date=target_date,provenance="clinical")
        if region:
            existing=existing.filter(region=region)
        if disease_code:
            existing=existing.filter(disease_code=disease_code)
        for row in existing.select_related('region'):
            groups.setdefault((row.region.name,row.disease_code),{"severities":[],"patients":set(),"name":row.disease_name})
        # Explicitly recompute a previously queued pair even if consent was revoked.
        if region and disease_code:
            groups.setdefault((region.name,disease_code),{"severities":[],"patients":set(),"name":disease_code})
        regions={r.name:r for r in Region.objects.filter(name__in=[key[0] for key in groups])}
        with transaction.atomic():
            for (name,code),group in groups.items():
                r=regions.get(name)
                if r is None:
                    continue
                suppressed=len(group["patients"])<cls.K_ANONYMITY_THRESHOLD
                count=0 if suppressed else len(group["severities"])
                SurveillanceData.objects.update_or_create(date=target_date,region=r,disease_code=code,defaults={
                    "disease_name":group["name"],"case_count":count,
                    "average_severity":0 if suppressed else float(np.mean(group["severities"])),
                    "cases_per_100k":count/max(r.population,1)*100000,
                    "observation_status":"suppressed" if suppressed else "observed","provenance":"clinical"})
        return {f"{name}:{code}":{"observation_status":"suppressed" if len(g["patients"])<5 else "observed"}
                for (name,code),g in groups.items()}


def _features(region, disease_code, date, bundle):
    if disease_code not in bundle["disease_codes"]:
        raise ModelUnavailable("Disease is outside the trained vocabulary")
    rows=list(SurveillanceData.objects.filter(region=region,disease_code=disease_code,date__lte=date,
                  date__gte=date-timedelta(days=1095)).order_by("date").values(
                  "date","case_count","average_severity","observation_status","disease_name"))
    if not rows:
        raise ModelUnavailable("No observations")
    cases=pd.DataFrame(rows).rename(columns={"average_severity":"severity_avg"})
    cases.loc[cases.observation_status=="suppressed",["case_count","severity_avg"]]=np.nan
    # prepare_daily accepts missing count observations but validates observed values.
    cases["region_id"],cases["disease_code"]=str(region.pk),disease_code
    reg=pd.DataFrame([{"region_id":str(region.pk),"population":region.population,
        "area_sq_km":region.area_sq_km,"sanitation_index":region.sanitation_index,"hospital_count":region.hospital_count,
        "latitude":region.latitude,"longitude":region.longitude}])
    env=pd.DataFrame(list(EnvironmentalData.objects.filter(region=region,date__lte=date,
        date__gte=date-timedelta(days=1095)).values("date","temperature","humidity","rainfall","aqi","water_quality_index")))
    env=env.rename(columns={"temperature":"temperature_celsius","humidity":"humidity_percent","rainfall":"rainfall_mm"})
    env["region_id"]=str(region.pk)
    frame,X=build_features(prepare_daily(cases,reg,env),bundle["disease_codes"])
    if frame.iloc[-1].observed!=1 or frame.iloc[-1].observed_28<21:
        raise ModelUnavailable("At least 21 observed days in the prior 28 days are required")
    if (pd.Timestamp(date)-frame.iloc[-1].date).days>2:
        raise ModelUnavailable("Observations are stale")
    return frame.iloc[[-1]],X.iloc[[-1]]


class RiskScoringService:
    @classmethod
    def calculate_risk_score(cls,region,disease_code,date=None):
        date=date or _today()
        defaults={"disease_name":disease_code,"risk_level":-1,"risk_probability":None,
                  "inference_status":"unavailable","contributing_factors":{},"model_version":"",
                  "provenance":"inference","data_cutoff":None}
        try:
            bundle,manifest=_bundle()
            frame,X=_features(region,disease_code,date,bundle)
            probability=float(risk_predict(bundle,X)[0])
            defaults.update(risk_probability=probability,risk_level=3 if probability>=.85 else 2 if probability>=.6 else 1 if probability>=.3 else 0,
                disease_name=frame.iloc[0].disease_name or disease_code,
                inference_status="ok",model_version=bundle["version"],data_cutoff=frame.iloc[0].date.date(),
                provenance="synthetic_model" if manifest["data_kind"]=="synthetic" else "inference")
            factors={"outbreak_threshold":bundle["risk_threshold"],"outbreak_detected":probability>=bundle["risk_threshold"]}
            factors['observation_window']='day_to_date' if frame.iloc[0].date.date()==_today() else 'complete_day'
            if factors['observation_window']=='day_to_date':
                factors['calibration_note']='Model validated on complete daily observations; intraday probabilities are provisional'
            if hasattr(bundle["risk_model"],"get_booster"):
                import xgboost as xgb
                values=bundle["risk_model"].get_booster().predict(xgb.DMatrix(X.to_numpy()),pred_contribs=True)[0]
                pairs=sorted(zip(X.columns,values[:-1]),key=lambda p:abs(float(p[1])),reverse=True)[:10]
                factors["raw_model_margin_contributions"]={k:float(v) for k,v in pairs}
                factors["explanation_units"]="SHAP contributions to uncalibrated log odds"
            defaults["contributing_factors"]=factors
        except Exception as exc:
            logger.warning("Risk inference unavailable: %s",exc)
            defaults["contributing_factors"]={"error":str(exc)}
        return RiskScore.objects.update_or_create(region=region,disease_code=disease_code,
                    calculation_date=date,defaults=defaults)[0]

    @classmethod
    def score_and_update_incremental(cls,region,disease_code,date=None):
        """Compatibility entry point: immutable inference; retraining is offline."""
        return cls.calculate_risk_score(region,disease_code,date)


class AnomalyDetectionService:
    @classmethod
    def detect_anomalies(cls,region,disease_code,date=None):
        date=date or _today()
        bundle,manifest=_bundle()
        frame,X=_features(region,disease_code,date,bundle)
        score=float(anomaly_predict(bundle,X)[0])
        actual=float(X.case_count.iloc[0]);expected=max(0,float(X.cases_mean_28.iloc[0]))
        key=dict(region=region,disease_code=disease_code,detection_date=date)
        if score<bundle["anomaly_threshold"] or actual<=expected:
            Anomaly.objects.filter(**key,is_resolved=False,model_version=bundle['version']).update(is_resolved=True)
            return None
        deviation=(actual-expected)/max(expected,1)*100
        return Anomaly.objects.update_or_create(inference_key=_inference_key('anomaly',region.pk,disease_code,date),defaults={
            **key,"disease_name":frame.iloc[0].disease_name or disease_code,"anomaly_score":score,
            "actual_cases":int(actual),"expected_cases":expected,"deviation_percentage":deviation,
            "description":f"Cases {actual:.0f} versus prior baseline {expected:.1f}","is_resolved":False,
            "model_version":bundle["version"],"data_cutoff":frame.iloc[0].date.date(),
            "provenance":"synthetic_model" if manifest["data_kind"]=="synthetic" else "inference"})[0]

    @classmethod
    def detect_and_update_incremental(cls,region,disease_code,date=None):
        return cls.detect_anomalies(region,disease_code,date)


class ForecastingService:
    @classmethod
    def generate_forecast(cls,region,disease_code,horizon_days=7):
        if horizon_days not in (7,14,30,60,90):
            raise ValueError("Unsupported forecast horizon")
        bundle,manifest=_bundle()
        today=_today()
        # Forecast from the last complete day; do not interpret intraday totals as full days.
        frame,X=_features(region,disease_code,today-timedelta(days=1),bundle)
        origin=frame.iloc[0].date.date()
        dates=[today+timedelta(days=i) for i in range(1,horizon_days+1)]
        leads=np.array([(d-origin).days for d in dates])
        if leads.max()>manifest["max_forecast_lead"]:
            raise ModelUnavailable("Forecast origin is stale")
        repeated=pd.concat([X]*horizon_days,ignore_index=True)
        origins=pd.concat([frame]*horizon_days,ignore_index=True)
        pred=forecast_predict(bundle,origins,repeated,leads)
        results=[]
        for d,lead,p in zip(dates,leads,pred):
            supported=sorted(int(h) for h in bundle["forecast_intervals"])
            upper=[h for h in supported if h>=lead]
            key=str(min(upper)) if upper else ""
            q=bundle["forecast_intervals"].get(key,bundle["forecast_interval_fallback"])
            width=q*np.sqrt(p+1)
            results.append(Forecast(region=region,disease_code=disease_code,
                inference_key=_inference_key('forecast',region.pk,disease_code,today,d,horizon_days),
                forecast_date=today,prediction_date=d,horizon_days=horizon_days,
                disease_name=frame.iloc[0].disease_name or disease_code,predicted_cases=float(p),lower_bound=float(max(0,p-width)),
                upper_bound=float(p+width),confidence=.95,model_version=bundle["version"],
                data_cutoff=origin,provenance="synthetic_model" if manifest["data_kind"]=="synthetic" else "inference"))
        Forecast.objects.bulk_create(results,update_conflicts=True,
            unique_fields=['inference_key'],
            update_fields=['disease_name','predicted_cases','lower_bound','upper_bound','confidence','model_version','data_cutoff','provenance'])
        return list(Forecast.objects.filter(region=region,disease_code=disease_code,forecast_date=today,
                    model_version=bundle['version'],
                    horizon_days=horizon_days).order_by('prediction_date'))


class ClusteringService:
    @classmethod
    def detect_clusters(cls,disease_code,start_date=None,end_date=None):
        end_date=end_date or _today();start_date=start_date or end_date-timedelta(days=6)
        _,manifest=_bundle()
        rows=list(SurveillanceData.objects.filter(disease_code=disease_code,date__gte=start_date,date__lte=end_date,
             observation_status="observed").values("region_id").annotate(cases=Sum("case_count"),name=Max('disease_name')))
        regions={r.pk:r for r in Region.objects.filter(pk__in=[row["region_id"] for row in rows])}
        candidates=[row for row in rows if row["cases"]>0]
        clusters=[]
        with transaction.atomic():
            # Same lock serializes all spatial rebuilds and prevents partial visible replacement.
            list(Region.objects.select_for_update().filter(pk__in=regions).order_by("pk"))
            Cluster.objects.filter(disease_code=disease_code,is_active=True).update(is_active=False)
            if len(candidates)<2:
                return []
            coords=np.array([[regions[r["region_id"]].latitude,regions[r["region_id"]].longitude] for r in candidates])
            cfg=manifest["spatial"]
            labels=DBSCAN(eps=cfg["eps_km"]/6371.0088,min_samples=cfg["min_samples"],metric="haversine").fit_predict(np.radians(coords))
            for label in sorted(set(labels)-{-1}):
                indices=np.flatnonzero(labels==label);points=coords[indices]
                lat,lon=points.mean(axis=0)
                cases=sum(candidates[i]["cases"] for i in indices)
                population=sum(regions[candidates[i]["region_id"]].population for i in indices)
                incidence=cases/max(population,1)*100000
                severity="critical" if incidence>=50 else "high" if incidence>=20 else "medium" if incidence>=5 else "low"
                cluster=Cluster.objects.create(disease_code=disease_code,disease_name=candidates[0]['name'] or disease_code,detection_date=end_date,
                    centroid_lat=float(lat),centroid_lon=float(lon),radius_km=max(_haversine(lat,lon,*point) for point in points),
                    total_cases=cases,total_population=population,severity=severity,model_version=manifest['version'],
                    provenance='synthetic_model' if manifest['data_kind']=='synthetic' else 'inference')
                ClusterRegion.objects.bulk_create([ClusterRegion(cluster=cluster,region=regions[candidates[i]["region_id"]],
                    case_count=candidates[i]["cases"]) for i in indices])
                clusters.append(cluster)
        return clusters


class AlertService:
    # Noncommunicable activity increases are not infectious outbreak alerts.
    NON_OUTBREAK_CODES={"I10","E11","K29.7","J45.9"}

    @classmethod
    def evaluate_alerts(cls,disease_code,date=None):
        return [a for r in Region.objects.filter(surveillance_data__disease_code=disease_code,
            surveillance_data__date__gte=(date or _today())-timedelta(days=7)).distinct()
            if (a:=cls.evaluate_alert_for_region(r,disease_code,date)) is not None]

    @classmethod
    def evaluate_alert_for_region(cls,region,disease_code,date=None):
        date=date or _today()
        if disease_code in cls.NON_OUTBREAK_CODES:
            return None
        _,manifest=_bundle()
        if manifest["data_kind"]=="synthetic" and not getattr(settings,"ML_ALLOW_SYNTHETIC_ALERTS",False):
            return None
        if manifest['data_kind']!='synthetic' and not manifest.get('real_world_validated',False) and not getattr(settings,'ML_ENABLE_OPERATIONAL_ALERTS',False):
            return None
        with transaction.atomic():
            Region.objects.select_for_update().get(pk=region.pk)
            risk=RiskScore.objects.filter(region=region,disease_code=disease_code,calculation_date=date,inference_status="ok").first()
            anomalies=Anomaly.objects.filter(region=region,disease_code=disease_code,detection_date=date,is_resolved=False,
                model_version=manifest["version"])
            cluster=Cluster.objects.filter(regions__region=region,disease_code=disease_code,is_active=True,
                model_version=manifest['version'],
                detection_date__gte=date-timedelta(days=3)).exists()
            prior=list(SurveillanceData.objects.filter(region=region,disease_code=disease_code,date__lt=date,
                date__gte=date-timedelta(days=28),observation_status="observed").values_list("case_count",flat=True))
            forecasts=Forecast.objects.filter(region=region,disease_code=disease_code,forecast_date=date,horizon_days=7,
                model_version=manifest["version"],prediction_date__gt=date,prediction_date__lte=date+timedelta(days=7))
            spike=len(prior)>=21 and any(f.lower_bound>np.mean(prior)+2*max(np.std(prior),1) for f in forecasts)
            anomalous=anomalies.exists()
            high=risk is not None and risk.model_version==manifest["version"] and risk.contributing_factors.get("outbreak_detected",False)
            severity="critical" if spike and cluster and anomalous else "high" if spike and cluster else "medium" if anomalous else "low" if high else None
            if severity is None:
                return None
            # One active alert per pair; repeat runs update evidence without sending duplicates.
            existing=Alert.objects.filter(disease_code=disease_code,affected_regions=region,status__in=["active","acknowledged"]).first()
            if existing:
                return None
            alert=Alert.objects.create(alert_type="outbreak",disease_code=disease_code,disease_name=disease_code,
                severity=severity,confidence=None,title=f"{severity.title()} surveillance warning: {region.name}",
                description="Signals require public health review",contributing_factors={
                    "forecast_spike":bool(spike),"spatial_cluster":cluster,"anomaly":anomalous,"risk_detected":bool(high),
                    "model_version":manifest["version"],"confidence_method":"rule-based; probability not estimated"},
                recommended_actions="Review reporting completeness and confirm cases before escalation.",
                escalation_level=2 if severity in ("high","critical") else 1)
            alert.affected_regions.add(region)
            return alert


class MLModelInfoService:
    @staticmethod
    def get_all_models_info():
        try:
            bundle,manifest=_bundle()
            report=json.loads((ML_MODELS_ROOT/manifest["version"]/"report.json").read_text())
            available=True;error=None
        except Exception as exc:
            bundle={};manifest={};report={};available=False;error=str(exc)
        specs={"dbscan":("Geographic DBSCAN","Haversine geographic grouping; radius is a policy parameter",2,{}),
               "isolation_forest":(f"Anomaly detector: {report.get('anomaly_selected','unavailable')}","Validation-selected anomaly scoring",len(bundle.get("feature_names",[])),report.get("anomaly_test",{})),
               "forecast_ensemble":(f"Daily forecast: {report.get('forecast_selected','unavailable')}","Direct region/disease count forecasts; temporal model selection",len(bundle.get("feature_names",[]))+4,{}),
               "xgboost":(f"Outbreak classifier: {report.get('risk_selected','unavailable')}","Calibrated current-outbreak classifier selected by validation PR-AUC",len(bundle.get("feature_names",[])),report.get("risk_test",{}))}
        return {key:{"name":name,"description":desc,"version":manifest.get("version","unavailable"),
                     "model_available":available,"loaded":available,"n_features":n,
                     "metrics":{k:v for k,v in metrics.items() if isinstance(v,(int,float))},
                     "data_kind":manifest.get("data_kind"),"real_world_validated":False,"error":error}
                for key,(name,desc,n,metrics) in specs.items()}

    @staticmethod
    def get_pipeline_status():
        today=_today();week=today-timedelta(days=7)
        info=MLModelInfoService.get_all_models_info()
        return {"surveillance_records_today":SurveillanceData.objects.filter(date=today).count(),
                "surveillance_records_week":SurveillanceData.objects.filter(date__gte=week).count(),
                "active_clusters":Cluster.objects.filter(is_active=True).exclude(model_version='').count(),
                "recent_anomalies":Anomaly.objects.filter(detection_date__gte=week,is_resolved=False).exclude(model_version='').count(),
                "active_alerts":Alert.objects.filter(status="active").count(),
                "critical_alerts":Alert.objects.filter(status="active",severity="critical").count(),
                "forecasts_generated_today":Forecast.objects.filter(forecast_date=today).count(),
                "risk_scores_today":RiskScore.objects.filter(calculation_date=today,inference_status="ok").count(),
                "unavailable_risk_scores_today":RiskScore.objects.filter(calculation_date=today,inference_status="unavailable").count(),
                "regions_count":Region.objects.count(),"environmental_records_today":EnvironmentalData.objects.filter(date=today).count(),
                "models":{key:value["model_available"] for key,value in info.items()},"model_details":info}
