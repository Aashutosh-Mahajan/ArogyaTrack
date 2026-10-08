"""Celery tasks for surveillance pipeline"""
from celery import chord, shared_task
from django.db import transaction
from django.db.models import Avg, Count
from django.utils import timezone
from datetime import timedelta

from .services import (
    AggregationService,
    ClusteringService,
    ForecastingService,
    AnomalyDetectionService,
    RiskScoringService,
    AlertService,
    _today,
    _bundle,
)
from .models import (
    Alert,
    Anomaly,
    Notification,
    PendingInferenceQueue,
    Region,
    RiskScore,
    SurveillanceData,
)
from accounts.models import User
from .ml.runtime import ModelUnavailable


@shared_task
def daily_aggregation_pipeline():
    """
    Daily aggregation job (runs at midnight)
    Aggregates diagnosis data with K-anonymity
    """
    yesterday = _today() - timedelta(days=1)
    result = AggregationService.aggregate_daily_data(yesterday)
    return {
        'date': str(yesterday),
        'aggregated_groups': len(result),
        'status': 'success'
    }


@shared_task
def run_clustering_analysis(disease_code):
    """
    Run DBSCAN clustering for a specific disease
    """
    clusters = ClusteringService.detect_clusters(disease_code)
    return {
        'disease_code': disease_code,
        'clusters_detected': len(clusters),
        'status': 'success'
    }


@shared_task
def generate_forecasts_for_region(region_id, disease_code, horizon_days=7):
    """
    Generate Prophet forecasts for a region-disease combination
    """
    try:
        region = Region.objects.get(id=region_id)
        forecasts = ForecastingService.generate_forecast(region, disease_code, horizon_days)
        return {
            'region': region.name,
            'disease_code': disease_code,
            'forecasts_generated': len(forecasts),
            'status': 'success'
        }
    except Region.DoesNotExist:
        return {'status': 'error', 'message': 'Region not found'}


@shared_task
def detect_anomalies_for_region(region_id, disease_code):
    """
    Detect anomalies using Isolation Forest
    """
    try:
        region = Region.objects.get(id=region_id)
        anomaly = AnomalyDetectionService.detect_anomalies(region, disease_code)
        return {
            'region': region.name,
            'disease_code': disease_code,
            'anomaly_detected': anomaly is not None,
            'status': 'success'
        }
    except Region.DoesNotExist:
        return {'status': 'error', 'message': 'Region not found'}


@shared_task
def calculate_risk_scores_for_region(region_id, disease_code):
    """
    Calculate XGBoost risk scores
    """
    try:
        region = Region.objects.get(id=region_id)
        risk_score = RiskScoringService.calculate_risk_score(region, disease_code)
        return {
            'region': region.name,
            'disease_code': disease_code,
            'risk_level': risk_score.get_risk_level_display(),
            'status': 'success'
        }
    except Region.DoesNotExist:
        return {'status': 'error', 'message': 'Region not found'}


@shared_task
def run_complete_ml_pipeline(disease_code):
    """Execute all selected components and alerts; report failures honestly."""
    from .services import _today
    results={'disease_code':disease_code,'timestamp':str(timezone.now()),'stages':{},'errors':[]}
    try:
        clusters=ClusteringService.detect_clusters(disease_code)
        results['stages']['clustering']={'status':'complete','clusters_detected':len(clusters)}
    except Exception as exc:
        results['stages']['clustering']={'status':'error','message':str(exc)}
        results['errors'].append(str(exc))
    regions=Region.objects.filter(surveillance_data__disease_code=disease_code,
        surveillance_data__date__gte=_today()-timedelta(days=7)).distinct()
    counts={'forecasting':0,'anomaly_detection':0,'risk_scoring':0}
    errors={key:[] for key in counts}
    for region in regions:
        for key in counts:
            try:
                if key=='forecasting':
                    counts[key]+=sum(len(ForecastingService.generate_forecast(region,disease_code,h)) for h in (7,14,30,60,90))
                elif key=='anomaly_detection':
                    counts[key]+=int(AnomalyDetectionService.detect_anomalies(region,disease_code) is not None)
                else:
                    risk=RiskScoringService.calculate_risk_score(region,disease_code)
                    if risk.inference_status!='ok':
                        raise RuntimeError(risk.contributing_factors.get('error','Unavailable inference'))
                    counts[key]+=1
            except Exception as exc:
                errors[key].append({'region':str(region.pk),'message':str(exc)})
    for key in counts:
        results['stages'][key]={'status':'partial' if errors[key] else 'complete','outputs':counts[key],'errors':errors[key]}
        results['errors'].extend(errors[key])
    try:
        alerts=AlertService.evaluate_alerts(disease_code)
        for alert in alerts:
            send_alert_notifications.delay(str(alert.pk))
        results['stages']['alerts']={'status':'complete','alerts_generated':len(alerts)}
    except Exception as exc:
        results['stages']['alerts']={'status':'error','message':str(exc)}
        results['errors'].append(str(exc))
    results['status']='partial' if results['errors'] else 'complete'
    return results



@shared_task
def evaluate_and_generate_alerts(disease_code):
    """
    Evaluate all models and generate alerts
    """
    alerts = AlertService.evaluate_alerts(disease_code)
    
    # Send notifications for new alerts
    for alert in alerts:
        send_alert_notifications.delay(str(alert.id))
    
    return {
        'disease_code': disease_code,
        'alerts_generated': len(alerts),
        'status': 'success'
    }


@shared_task
def send_alert_notifications(alert_id):
    """
    Send notifications for an alert via multiple channels
    """
    try:
        alert = Alert.objects.get(id=alert_id)
        
        # Determine recipients based on escalation level
        if alert.escalation_level == 1:
            # District level
            recipients = User.objects.filter(role='authority', is_active=True)
        elif alert.escalation_level == 2:
            # State level
            recipients = User.objects.filter(role__in=['authority', 'admin'], is_active=True)
        else:
            # Central level
            recipients = User.objects.filter(role='admin', is_active=True)
        
        notifications_sent = 0
        
        for recipient in recipients:
            # Send via dashboard (always)
            Notification.objects.create(
                alert=alert,
                recipient=recipient,
                channel='dashboard',
                status='sent',
                sent_at=timezone.now()
            )
            
            # Send via email for high/critical alerts
            if alert.severity in ['high', 'critical']:
                send_email_notification.delay(str(alert.id), recipient.id)
            
            # Send via SMS for critical alerts
            if alert.severity == 'critical':
                send_sms_notification.delay(str(alert.id), recipient.id)
            
            notifications_sent += 1
        
        return {
            'alert_id': alert_id,
            'notifications_sent': notifications_sent,
            'status': 'success'
        }
    
    except Alert.DoesNotExist:
        return {'status': 'error', 'message': 'Alert not found'}


@shared_task
def send_email_notification(alert_id, user_id):
    """
    Send email notification for alert
    """
    try:
        from django.core.mail import send_mail
        from django.conf import settings
        
        alert = Alert.objects.get(id=alert_id)
        user = User.objects.get(id=user_id)
        
        subject = f"[{alert.get_severity_display()}] Health Alert: {alert.title}"
        
        message = f"""
        {alert.title}
        
        Severity: {alert.get_severity_display()}
        Confidence: {alert.confidence * 100:.0f}%
        Disease: {alert.disease_name}
        Regions: {', '.join(r.name for r in alert.affected_regions.all()[:5])}
        
        Description:
        {alert.description}
        
        Contributing Factors:
        {', '.join(f"{k}: {v}" for k, v in alert.contributing_factors.items())}
        
        Recommended Actions:
        {alert.recommended_actions}
        
        Please login to the dashboard for more details.
        """
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False
        )
        
        # Update notification status
        Notification.objects.filter(
            alert=alert,
            recipient=user,
            channel='email'
        ).update(status='sent', sent_at=timezone.now())
        
        return {'status': 'success'}
    
    except Exception as e:
        # Log error
        Notification.objects.filter(
            alert_id=alert_id,
            recipient_id=user_id,
            channel='email'
        ).update(status='failed', error_message=str(e))
        
        return {'status': 'error', 'message': str(e)}


@shared_task
def send_sms_notification(alert_id,user_id):
    """No SMS provider is configured; never record a fabricated successful delivery."""
    Notification.objects.create(alert_id=alert_id,recipient_id=user_id,channel='sms',status='failed',
        error_message='SMS provider is not configured')
    return {'status':'not_configured'}


# ===================================================================
# Real-time pipeline tasks (Steps 2-6)
# ===================================================================

K_ANONYMITY_THRESHOLD = 5


@shared_task
def process_inference_queue():
    """Claim a fixed snapshot; recompute daily clinical totals and retain failed work."""
    from .services import _today
    claimed = []
    with transaction.atomic():
        queryset=PendingInferenceQueue.objects.filter(claimed_at__isnull=True).order_by('recorded_at')
        from django.db import connection
        if connection.features.has_select_for_update_skip_locked:
            queryset=queryset.select_for_update(skip_locked=True)
        else:
            queryset=queryset.select_for_update()
        entries=list(queryset[:5000])
        groups={}
        for entry in entries:
            day=entry.occurrence_date or timezone.localtime(entry.recorded_at,timezone.get_fixed_timezone(330)).date()
            groups.setdefault((entry.region_id,entry.disease_code,day),[]).append(str(entry.pk))
        for (rid,code,day),ids in sorted(groups.items(),key=lambda item:str(item[0])):
            region=Region.objects.select_for_update().get(pk=rid)
            AggregationService.aggregate_daily_data(day,region,code)
            PendingInferenceQueue.objects.filter(pk__in=ids).update(claimed_at=timezone.now())
            claimed.append((str(rid),code,day,ids))
    dispatched=0
    for rid,code,day,ids in claimed:
        try:
            if day!=_today():
                # Backfilled observations affect today's features, not today's case total.
                pass
            chord([run_incremental_isolation_forest.si(rid,code),run_incremental_xgboost.si(rid,code)],
                  run_realtime_decision_fusion.s(rid,code,ids)).apply_async()
            dispatched+=1
        except Exception:
            PendingInferenceQueue.objects.filter(pk__in=ids).update(claimed_at=None)
    # Retry tasks whose worker failed after dispatch. All result writes are idempotent.
    PendingInferenceQueue.objects.filter(claimed_at__lt=timezone.now()-timedelta(minutes=30)).update(claimed_at=None)
    return {'status':'ok' if dispatched==len(claimed) else 'partial','groups_dispatched':dispatched}



def _upsert_surveillance_data(region_id,disease_code,case_count=None,avg_severity=None):
    """Compatibility hook: authoritative diagnoses determine totals, never queue size."""
    from .services import _today
    return AggregationService.aggregate_daily_data(_today(),Region.objects.get(pk=region_id),disease_code)



@shared_task
def run_incremental_isolation_forest(region_id, disease_code):
    """Incremental Isolation Forest: inference + warm-start model update."""
    try:
        region = Region.objects.get(id=region_id)
        _bundle()
        try:
            anomaly = AnomalyDetectionService.detect_and_update_incremental(region, disease_code)
        except ModelUnavailable as exc:
            return {"status":"skipped","message":str(exc)}
        return {
            "region": region.name,
            "disease_code": disease_code,
            "anomaly_detected": anomaly is not None,
            "status": "success",
        }
    except Region.DoesNotExist:
        return {"status": "error", "message": "Region not found"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@shared_task
def run_incremental_xgboost(region_id, disease_code):
    """Incremental XGBoost: risk scoring + continuation training."""
    try:
        region = Region.objects.get(id=region_id)
        _bundle()
        risk_score = RiskScoringService.score_and_update_incremental(region, disease_code)
        if risk_score.inference_status != "ok":
            return {"status":"skipped","message":risk_score.contributing_factors.get("error")}
        return {
            "region": region.name,
            "disease_code": disease_code,
            "risk_level": risk_score.get_risk_level_display(),
            "status": "success",
        }
    except Region.DoesNotExist:
        return {"status": "error", "message": "Region not found"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@shared_task
def run_realtime_decision_fusion(results,region_id,disease_code,queue_ids=None):
    """Fusion is idempotent; consume only the exact successfully dispatched snapshot."""
    try:
        if any(result.get('status') == 'error' for result in results):
            raise RuntimeError('An inference stage failed; work retained for retry')
        region=Region.objects.get(pk=region_id)
        alert=AlertService.evaluate_alert_for_region(region,disease_code)
        if alert:
            send_alert_notifications.delay(str(alert.pk))
        if queue_ids:
            PendingInferenceQueue.objects.filter(pk__in=queue_ids).delete()
        return {'status':'success','alert_generated':alert is not None}
    except Exception as exc:
        if queue_ids:
            PendingInferenceQueue.objects.filter(pk__in=queue_ids).update(claimed_at=None)
        return {'status':'error','message':str(exc)}



# ===================================================================
# Scheduled model tasks (Prophet twice daily, DBSCAN every 3 hours)
# ===================================================================

@shared_task
def run_prophet_forecasts_all():
    """Run Prophet+XGBoost Ensemble forecasts for all active region-disease pairs.

    Scheduled twice daily at 6 AM and 6 PM.
    """
    HORIZONS = [7, 14, 30, 60, 90]
    week_ago = _today() - timedelta(days=7)

    pairs = (
        SurveillanceData.objects.filter(date__gte=week_ago)
        .values("region_id", "disease_code")
        .distinct()
    )

    forecast_count = 0
    errors=[]
    for pair in pairs:
        try:
            region = Region.objects.get(id=pair["region_id"])
            for horizon in HORIZONS:
                forecasts = ForecastingService.generate_forecast(
                    region, pair["disease_code"], horizon,
                )
                forecast_count += len(forecasts)
        except Exception as exc:
            errors.append({"region":str(pair["region_id"]),"message":str(exc)})

    return {
        "errors":errors,
        "pairs_processed": len(pairs),
        "forecasts_generated": forecast_count,
        "status": "partial" if errors else "success",
    }


@shared_task
def run_dbscan_clustering_all():
    """Run DBSCAN clustering for all diseases with recent data.

    Scheduled every 3 hours.
    """
    week_ago = _today() - timedelta(days=7)

    disease_codes = (
        SurveillanceData.objects.filter(date__gte=week_ago)
        .values_list("disease_code", flat=True)
        .distinct()
    )

    total_clusters = 0
    errors=[]
    for disease_code in disease_codes:
        try:
            clusters = ClusteringService.detect_clusters(disease_code)
            total_clusters += len(clusters)
        except Exception as exc:
            errors.append({"disease_code":disease_code,"message":str(exc)})

    return {
        "errors":errors,
        "diseases_processed": len(disease_codes),
        "clusters_detected": total_clusters,
        "status": "partial" if errors else "success",
    }


@shared_task
def check_alert_escalation():
    """
    Check for alerts that need escalation (no acknowledgment in 2 hours)
    """
    two_hours_ago = timezone.now() - timedelta(hours=2)
    
    unacknowledged_alerts = Alert.objects.filter(
        status='active',
        contributing_factors__has_key='model_version',
        generated_at__lte=two_hours_ago,
        escalation_level__lt=3
    )
    
    escalated_count = 0
    
    for alert in unacknowledged_alerts:
        alert.escalate()
        send_alert_notifications.delay(str(alert.id))
        escalated_count += 1
    
    return {
        'escalated_count': escalated_count,
        'status': 'success'
    }


@shared_task
def environmental_data_sync():
    """Ingest actual regional readings from an explicitly configured JSON endpoint.

    Provider contract: [{region_name,date,temperature,humidity,rainfall,aqi,
    water_quality_index,pm25,pm10}]. Missing provider/readings never become placeholders.
    """
    from django.conf import settings
    from django.utils.dateparse import parse_date
    import requests
    url=getattr(settings,'ENVIRONMENTAL_DATA_URL','')
    if not url:
        return {'status':'not_configured','regions_synced':0}
    response=requests.get(url,timeout=30)
    response.raise_for_status()
    rows=response.json()
    if not isinstance(rows,list):
        raise ValueError('Environmental provider must return a list')
    synced=0
    for row in rows:
        region=Region.objects.get(name=row['region_name'])
        day=parse_date(row['date'])
        if day is None:
            raise ValueError('Invalid observation date')
        values={k:row[k] for k in ('temperature','humidity','rainfall','aqi','pm25','pm10','water_quality_index') if k in row}
        if not values:
            continue
        for key,value in values.items():
            if value is not None and (not isinstance(value,(int,float)) or not __import__('math').isfinite(value)):
                raise ValueError('Environmental observations must be finite numbers')
        EnvironmentalData.objects.update_or_create(region=region,date=day,defaults=values)
        synced+=1
    return {'status':'success','regions_synced':synced}



@shared_task
def master_daily_pipeline():
    """Daily complete, idempotent rebuild for actual observed disease codes."""
    results={'timestamp':str(timezone.now()),'stages':{}}
    results['stages']['aggregation']=daily_aggregation_pipeline()
    try:
        results['stages']['environmental_sync']=environmental_data_sync()
    except Exception as exc:
        results['stages']['environmental_sync']={'status':'error','message':str(exc)}
    codes=SurveillanceData.objects.filter(date__gte=_today()-timedelta(days=7)).values_list('disease_code',flat=True).distinct()
    for code in codes:
        results['stages'][code]=run_complete_ml_pipeline(code)
    results['stages']['escalation']=check_alert_escalation()
    return results
