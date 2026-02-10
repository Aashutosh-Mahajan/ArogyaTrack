from django.contrib import admin
from .models import (
    Region, SurveillanceData, Cluster, ClusterRegion, Forecast,
    Anomaly, RiskScore, EnvironmentalData, Consent, Alert, Notification
)


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ['name', 'district', 'state', 'population', 'created_at']
    list_filter = ['state', 'district']
    search_fields = ['name', 'district', 'state']


@admin.register(SurveillanceData)
class SurveillanceDataAdmin(admin.ModelAdmin):
    list_display = ['date', 'region', 'disease_name', 'case_count', 'cases_per_100k', 'average_severity']
    list_filter = ['date', 'disease_code', 'region__state']
    search_fields = ['disease_name', 'disease_code', 'region__name']
    date_hierarchy = 'date'


@admin.register(Cluster)
class ClusterAdmin(admin.ModelAdmin):
    list_display = ['disease_name', 'detection_date', 'severity', 'total_cases', 'is_active']
    list_filter = ['severity', 'is_active', 'detection_date']
    search_fields = ['disease_name', 'disease_code']
    date_hierarchy = 'detection_date'


@admin.register(Forecast)
class ForecastAdmin(admin.ModelAdmin):
    list_display = ['disease_name', 'region', 'prediction_date', 'predicted_cases', 'confidence']
    list_filter = ['forecast_date', 'horizon_days']
    search_fields = ['disease_name', 'region__name']
    date_hierarchy = 'prediction_date'


@admin.register(Anomaly)
class AnomalyAdmin(admin.ModelAdmin):
    list_display = ['disease_name', 'region', 'detection_date', 'anomaly_score', 'deviation_percentage', 'is_resolved']
    list_filter = ['is_resolved', 'detection_date']
    search_fields = ['disease_name', 'region__name']
    date_hierarchy = 'detection_date'


@admin.register(RiskScore)
class RiskScoreAdmin(admin.ModelAdmin):
    list_display = ['disease_name', 'region', 'calculation_date', 'risk_level', 'risk_probability']
    list_filter = ['risk_level', 'calculation_date']
    search_fields = ['disease_name', 'region__name']
    date_hierarchy = 'calculation_date'


@admin.register(EnvironmentalData)
class EnvironmentalDataAdmin(admin.ModelAdmin):
    list_display = ['region', 'date', 'temperature', 'humidity', 'rainfall', 'aqi']
    list_filter = ['date', 'region__state']
    search_fields = ['region__name']
    date_hierarchy = 'date'


@admin.register(Consent)
class ConsentAdmin(admin.ModelAdmin):
    list_display = ['profile', 'consent_type', 'is_granted', 'granted_at', 'revoked_at']
    list_filter = ['consent_type', 'is_granted']
    search_fields = ['profile__name', 'profile__user__email']


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ['title', 'disease_name', 'severity', 'status', 'confidence', 'generated_at']
    list_filter = ['severity', 'status', 'alert_type', 'escalation_level']
    search_fields = ['title', 'disease_name', 'description']
    date_hierarchy = 'generated_at'


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['alert', 'recipient', 'channel', 'status', 'sent_at']
    list_filter = ['channel', 'status', 'sent_at']
    search_fields = ['recipient__email', 'alert__title']
    date_hierarchy = 'sent_at'
