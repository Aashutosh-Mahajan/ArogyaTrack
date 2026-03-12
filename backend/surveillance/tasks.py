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
    AlertService
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


@shared_task
def daily_aggregation_pipeline():
    """
    Daily aggregation job (runs at midnight)
    Aggregates diagnosis data with K-anonymity
    """
    yesterday = timezone.now().date() - timedelta(days=1)
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
    """
    Run complete ML pipeline (v5.0 aligned):
      - DBSCAN v5.0 clustering (13 features)
      - Prophet+XGBoost Ensemble v5.0 forecasting (horizons: 7,14,30,60,90)
      - Isolation Forest v5.0 anomaly detection (59 features, ensemble+GB corrector)
      - XGBoost v4.0 risk scoring (56 features, risk tiers)
    """
    results = {
        'disease_code': disease_code,
        'timestamp': str(timezone.now()),
        'stages': {}
    }
    
    # Stage 1: Clustering (DBSCAN v5.0)
    clusters = ClusteringService.detect_clusters(disease_code)
    results['stages']['clustering'] = {
        'clusters_detected': len(clusters),
        'status': 'complete'
    }
    
    # Stage 2: Forecasting, Anomaly Detection, Risk Scoring (per region)
    regions = Region.objects.filter(
        surveillance_data__disease_code=disease_code,
        surveillance_data__date__gte=timezone.now().date() - timedelta(days=7)
    ).distinct()
    
    forecast_count = 0
    anomaly_count = 0
    risk_scores_count = 0
    
    # Forecast horizons matching Ensemble v5.0 config
    HORIZONS = [7, 14, 30, 60, 90]
    
    for region in regions:
        # Forecasting (Prophet+XGBoost Ensemble v5.0, all horizons)
        for horizon in HORIZONS:
            forecasts = ForecastingService.generate_forecast(region, disease_code, horizon)
            forecast_count += len(forecasts)
        
        # Anomaly Detection (Isolation Forest v5.0 ensemble + GB corrector)
        anomaly = AnomalyDetectionService.detect_anomalies(region, disease_code)
        if anomaly:
            anomaly_count += 1
        
        # Risk Scoring (XGBoost v4.0, 56 features)
        risk_score = RiskScoringService.calculate_risk_score(region, disease_code)
        if risk_score:
            risk_scores_count += 1
    
    results['stages']['forecasting'] = {
        'regions_processed': regions.count(),
        'horizons': HORIZONS,
        'forecasts_generated': forecast_count,
        'status': 'complete'
    }
    
    results['stages']['anomaly_detection'] = {
        'anomalies_detected': anomaly_count,
        'status': 'complete'
    }
    
    results['stages']['risk_scoring'] = {
        'risk_scores_calculated': risk_scores_count,
        'status': 'complete'
    }
    
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
def send_sms_notification(alert_id, user_id):
    """
    Send SMS notification for critical alerts
    """
    try:
        alert = Alert.objects.get(id=alert_id)
        user = User.objects.get(id=user_id)
        
        # TODO: Integrate with Twilio or other SMS service
        # For now, just create notification record
        
        message = f"CRITICAL HEALTH ALERT: {alert.title}. Login to dashboard for details."
        
        # Placeholder for actual SMS sending
        # twilio_client.messages.create(to=user.phone, body=message)
        
        Notification.objects.create(
            alert=alert,
            recipient=user,
            channel='sms',
            status='sent',
            sent_at=timezone.now()
        )
        
        return {'status': 'success'}
    
    except Exception as e:
        Notification.objects.create(
            alert_id=alert_id,
            recipient_id=user_id,
            channel='sms',
            status='failed',
            error_message=str(e)
        )
        
        return {'status': 'error', 'message': str(e)}


# ===================================================================
# Real-time pipeline tasks (Steps 2-6)
# ===================================================================

K_ANONYMITY_THRESHOLD = 5


@shared_task
def process_inference_queue():
    """Middleman aggregation task — runs every 5 minutes via Celery Beat.

    1. Read all PendingInferenceQueue records.
    2. Group by (region_id, disease_code).
    3. Count cases and average severity per group.
    4. Filter out groups with fewer than K_ANONYMITY_THRESHOLD cases.
    5. For each qualifying group, update SurveillanceData and dispatch
       Isolation Forest + XGBoost as a chord with decision-fusion callback.
    6. Clear consumed records.
    """
    pending = PendingInferenceQueue.objects.all()
    if not pending.exists():
        return {"status": "empty", "groups_dispatched": 0}

    # Aggregate in-database for efficiency
    groups = (
        pending
        .values("region_id", "disease_code")
        .annotate(case_count=Count("id"), avg_severity=Avg("severity"))
    )

    dispatched = 0
    consumed_ids = []

    for grp in groups:
        if grp["case_count"] < K_ANONYMITY_THRESHOLD:
            continue

        region_id = str(grp["region_id"])
        disease_code = grp["disease_code"]
        case_count = grp["case_count"]
        avg_severity = float(grp["avg_severity"])

        # Upsert today's SurveillanceData so feature-building has fresh data
        _upsert_surveillance_data(region_id, disease_code, case_count, avg_severity)

        # Dispatch IF + XGBoost in parallel, then decision fusion
        chord(
            [
                run_incremental_isolation_forest.si(region_id, disease_code),
                run_incremental_xgboost.si(region_id, disease_code),
            ],
            run_realtime_decision_fusion.si(region_id, disease_code),
        ).apply_async()

        # Collect IDs for this group so we can delete them
        consumed_ids.extend(
            pending.filter(region_id=grp["region_id"], disease_code=disease_code)
            .values_list("id", flat=True)
        )
        dispatched += 1

    # Clear consumed records in one bulk delete
    if consumed_ids:
        PendingInferenceQueue.objects.filter(id__in=consumed_ids).delete()

    return {"status": "ok", "groups_dispatched": dispatched}


def _upsert_surveillance_data(region_id, disease_code, case_count, avg_severity):
    """Create or update today's SurveillanceData row for the region-disease pair."""
    try:
        region = Region.objects.get(id=region_id)
    except Region.DoesNotExist:
        return

    today = timezone.now().date()
    cases_per_100k = (case_count / region.population) * 100_000 if region.population else 0

    # Try to get a display name from existing records
    existing = SurveillanceData.objects.filter(disease_code=disease_code).first()
    disease_name = existing.disease_name if existing else disease_code

    SurveillanceData.objects.update_or_create(
        date=today,
        region=region,
        disease_code=disease_code,
        defaults={
            "disease_name": disease_name,
            "case_count": case_count,
            "average_severity": avg_severity,
            "cases_per_100k": cases_per_100k,
        },
    )


@shared_task
def run_incremental_isolation_forest(region_id, disease_code):
    """Incremental Isolation Forest: inference + warm-start model update."""
    try:
        region = Region.objects.get(id=region_id)
        anomaly = AnomalyDetectionService.detect_and_update_incremental(region, disease_code)
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
        risk_score = RiskScoringService.score_and_update_incremental(region, disease_code)
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
def run_realtime_decision_fusion(region_id, disease_code):
    """Decision fusion trigger — runs after IF + XGBoost complete for a pair.

    If an alert is generated, sends notifications through the existing system.
    """
    try:
        region = Region.objects.get(id=region_id)
        alert = AlertService.evaluate_alert_for_region(region, disease_code)
        if alert is not None:
            send_alert_notifications.delay(str(alert.id))
            return {
                "region": region.name,
                "disease_code": disease_code,
                "alert_generated": True,
                "alert_severity": alert.severity,
                "status": "success",
            }
        return {
            "region": region.name,
            "disease_code": disease_code,
            "alert_generated": False,
            "status": "success",
        }
    except Region.DoesNotExist:
        return {"status": "error", "message": "Region not found"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


# ===================================================================
# Scheduled model tasks (Prophet twice daily, DBSCAN every 3 hours)
# ===================================================================

@shared_task
def run_prophet_forecasts_all():
    """Run Prophet+XGBoost Ensemble forecasts for all active region-disease pairs.

    Scheduled twice daily at 6 AM and 6 PM.
    """
    HORIZONS = [7, 14, 30, 60, 90]
    week_ago = timezone.now().date() - timedelta(days=7)

    pairs = (
        SurveillanceData.objects.filter(date__gte=week_ago)
        .values("region_id", "disease_code")
        .distinct()
    )

    forecast_count = 0
    for pair in pairs:
        try:
            region = Region.objects.get(id=pair["region_id"])
            for horizon in HORIZONS:
                forecasts = ForecastingService.generate_forecast(
                    region, pair["disease_code"], horizon,
                )
                forecast_count += len(forecasts)
        except Exception:
            continue

    return {
        "pairs_processed": len(pairs),
        "forecasts_generated": forecast_count,
        "status": "success",
    }


@shared_task
def run_dbscan_clustering_all():
    """Run DBSCAN clustering for all diseases with recent data.

    Scheduled every 3 hours.
    """
    week_ago = timezone.now().date() - timedelta(days=7)

    disease_codes = (
        SurveillanceData.objects.filter(date__gte=week_ago)
        .values_list("disease_code", flat=True)
        .distinct()
    )

    total_clusters = 0
    for disease_code in disease_codes:
        try:
            clusters = ClusteringService.detect_clusters(disease_code)
            total_clusters += len(clusters)
        except Exception:
            continue

    return {
        "diseases_processed": len(disease_codes),
        "clusters_detected": total_clusters,
        "status": "success",
    }


@shared_task
def check_alert_escalation():
    """
    Check for alerts that need escalation (no acknowledgment in 2 hours)
    """
    two_hours_ago = timezone.now() - timedelta(hours=2)
    
    unacknowledged_alerts = Alert.objects.filter(
        status='active',
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
    """
    Sync environmental data from external APIs
    """
    from .models import EnvironmentalData
    import requests
    from datetime import date
    
    regions = Region.objects.all()
    today = date.today()
    
    synced_count = 0
    
    for region in regions:
        try:
            # TODO: Replace with actual API calls
            # Example: OpenWeatherMap API
            # weather_data = requests.get(f"https://api.openweathermap.org/data/2.5/weather?lat={region.latitude}&lon={region.longitude}&appid={API_KEY}")
            
            # Placeholder data
            EnvironmentalData.objects.get_or_create(
                region=region,
                date=today,
                defaults={
                    'temperature': 28.0,
                    'humidity': 65.0,
                    'rainfall': 0.0,
                    'aqi': 100,
                    'pm25': 35.0,
                    'water_quality_index': 70.0,
                    'sanitation_index': 75.0
                }
            )
            
            synced_count += 1
        
        except Exception as e:
            # Log error
            continue
    
    return {
        'regions_synced': synced_count,
        'date': str(today),
        'status': 'success'
    }


@shared_task
def master_daily_pipeline():
    """
    Fallback batch task — runs at 2 AM every day.

    Only processes region-disease pairs that have NOT received a real-time
    update (Anomaly or RiskScore) in the last 24 hours. Acts as a safety
    net for anything the 5-minute pipeline missed.
    """
    results = {
        'timestamp': str(timezone.now()),
        'stages': {}
    }
    
    # Stage 1: Data Aggregation
    aggregation_result = daily_aggregation_pipeline()
    results['stages']['aggregation'] = aggregation_result
    
    # Stage 2: Environmental Data Sync
    env_result = environmental_data_sync()
    results['stages']['environmental_sync'] = env_result
    
    # Stage 3: ML Pipeline only for pairs NOT recently processed
    common_diseases = [
        'A90',    # Dengue Fever
        'U07.1',  # COVID-19
        'A00',    # Cholera
        'B50.0',  # Malaria
        'J18.9',  # Pneumonia
        'J10.1',  # Influenza
        'A09',    # Gastroenteritis
        'B05',    # Measles
    ]

    cutoff = timezone.now() - timedelta(hours=24)
    
    for disease_code in common_diseases:
        regions = Region.objects.filter(
            surveillance_data__disease_code=disease_code,
            surveillance_data__date__gte=timezone.now().date() - timedelta(days=7),
        ).distinct()

        skipped = 0
        processed = 0

        for region in regions:
            # Skip if the real-time pipeline already handled this pair today
            has_recent_anomaly = Anomaly.objects.filter(
                region=region,
                disease_code=disease_code,
                created_at__gte=cutoff,
            ).exists()
            has_recent_risk = RiskScore.objects.filter(
                region=region,
                disease_code=disease_code,
                created_at__gte=cutoff,
            ).exists()

            if has_recent_anomaly or has_recent_risk:
                skipped += 1
                continue

            # Run full pipeline for this stale pair
            HORIZONS = [7, 14, 30, 60, 90]
            for horizon in HORIZONS:
                ForecastingService.generate_forecast(region, disease_code, horizon)
            AnomalyDetectionService.detect_anomalies(region, disease_code)
            RiskScoringService.calculate_risk_score(region, disease_code)
            processed += 1

        # Clustering runs on full disease data (not per-region)
        ClusteringService.detect_clusters(disease_code)

        results['stages'][f'ml_pipeline_{disease_code}'] = {
            'regions_processed': processed,
            'regions_skipped_realtime': skipped,
            'status': 'complete',
        }
        
        # Alert Evaluation for stale regions
        alert_result = evaluate_and_generate_alerts(disease_code)
        results['stages'][f'alerts_{disease_code}'] = alert_result
    
    # Stage 5: Check Escalations
    escalation_result = check_alert_escalation()
    results['stages']['escalation_check'] = escalation_result
    
    return results
