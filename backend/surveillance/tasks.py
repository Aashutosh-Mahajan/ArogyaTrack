"""Celery tasks for surveillance pipeline"""
from celery import shared_task
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
from .models import Region, SurveillanceData, Alert, Notification
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
    Run complete ML pipeline: clustering, forecasting, anomaly detection, risk scoring
    """
    results = {
        'disease_code': disease_code,
        'timestamp': str(timezone.now()),
        'stages': {}
    }
    
    # Stage 1: Clustering
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
    
    for region in regions:
        # Forecasting
        forecasts = ForecastingService.generate_forecast(region, disease_code)
        forecast_count += len(forecasts)
        
        # Anomaly Detection
        anomaly = AnomalyDetectionService.detect_anomalies(region, disease_code)
        if anomaly:
            anomaly_count += 1
        
        # Risk Scoring
        risk_score = RiskScoringService.calculate_risk_score(region, disease_code)
        if risk_score:
            risk_scores_count += 1
    
    results['stages']['forecasting'] = {
        'regions_processed': regions.count(),
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
    Master task that runs the complete daily pipeline
    Runs at 2 AM every day
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
    
    # Stage 3: ML Pipeline for each disease
    common_diseases = ['A90', 'U07.1', 'A00']  # Dengue, COVID, Cholera
    
    for disease_code in common_diseases:
        ml_result = run_complete_ml_pipeline(disease_code)
        results['stages'][f'ml_pipeline_{disease_code}'] = ml_result
        
        # Stage 4: Alert Evaluation
        alert_result = evaluate_and_generate_alerts(disease_code)
        results['stages'][f'alerts_{disease_code}'] = alert_result
    
    # Stage 5: Check Escalations
    escalation_result = check_alert_escalation()
    results['stages']['escalation_check'] = escalation_result
    
    return results
