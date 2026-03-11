from rest_framework import serializers
from .models import (
    Region, SurveillanceData, Cluster, ClusterRegion, Forecast,
    Anomaly, RiskScore, EnvironmentalData, Consent, Alert, Notification
)


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = [
            'id', 'name', 'district', 'state', 'country',
            'latitude', 'longitude', 'population',
            'hospital_count', 'sanitation_index', 'created_at'
        ]


class SurveillanceDataSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source='region.name', read_only=True)
    region_details = RegionSerializer(source='region', read_only=True)
    
    class Meta:
        model = SurveillanceData
        fields = [
            'id', 'date', 'region', 'region_name', 'region_details',
            'disease_code', 'disease_name', 'case_count', 'average_severity',
            'cases_per_100k', 'created_at'
        ]


class ClusterRegionSerializer(serializers.ModelSerializer):
    region_details = RegionSerializer(source='region', read_only=True)
    
    class Meta:
        model = ClusterRegion
        fields = ['region', 'region_details', 'case_count']


class ClusterSerializer(serializers.ModelSerializer):
    regions_data = ClusterRegionSerializer(source='regions', many=True, read_only=True)
    affected_region_names = serializers.SerializerMethodField()
    
    class Meta:
        model = Cluster
        fields = [
            'id', 'disease_code', 'disease_name', 'detection_date',
            'centroid_lat', 'centroid_lon', 'radius_km',
            'total_cases', 'total_population', 'severity', 'growth_rate',
            'is_active', 'regions_data', 'affected_region_names', 'created_at'
        ]
    
    def get_affected_region_names(self, obj):
        return [cr.region.name for cr in obj.regions.all()]


class ForecastSerializer(serializers.ModelSerializer):
    region_details = RegionSerializer(source='region', read_only=True)
    
    class Meta:
        model = Forecast
        fields = [
            'id', 'region', 'region_details', 'disease_code', 'disease_name',
            'forecast_date', 'prediction_date', 'horizon_days',
            'predicted_cases', 'lower_bound', 'upper_bound', 'confidence',
            'created_at'
        ]


class AnomalySerializer(serializers.ModelSerializer):
    region_details = RegionSerializer(source='region', read_only=True)
    
    class Meta:
        model = Anomaly
        fields = [
            'id', 'region', 'region_details', 'disease_code', 'disease_name',
            'detection_date', 'anomaly_score', 'actual_cases', 'expected_cases',
            'deviation_percentage', 'description', 'is_resolved', 'created_at'
        ]


class RiskScoreSerializer(serializers.ModelSerializer):
    region_details = RegionSerializer(source='region', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    
    class Meta:
        model = RiskScore
        fields = [
            'id', 'region', 'region_details', 'disease_code', 'disease_name',
            'calculation_date', 'risk_level', 'risk_level_display',
            'risk_probability', 'contributing_factors', 'created_at'
        ]


class EnvironmentalDataSerializer(serializers.ModelSerializer):
    region_details = RegionSerializer(source='region', read_only=True)
    
    class Meta:
        model = EnvironmentalData
        fields = [
            'id', 'region', 'region_details', 'date',
            'temperature', 'humidity', 'rainfall', 'aqi', 'pm25', 'pm10',
            'water_quality_index', 'created_at'
        ]


class ConsentSerializer(serializers.ModelSerializer):
    consent_type_display = serializers.CharField(source='get_consent_type_display', read_only=True)
    
    class Meta:
        model = Consent
        fields = [
            'id', 'profile', 'consent_type', 'consent_type_display',
            'is_granted', 'granted_at', 'revoked_at', 'signature_data',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['granted_at', 'revoked_at']


class ConsentActionSerializer(serializers.Serializer):
    """Serializer for granting/revoking consent"""
    action = serializers.ChoiceField(choices=['grant', 'revoke'])
    signature_data = serializers.CharField(required=False, allow_blank=True)


class AlertSerializer(serializers.ModelSerializer):
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    affected_regions_data = RegionSerializer(source='affected_regions', many=True, read_only=True)
    acknowledged_by_email = serializers.EmailField(source='acknowledged_by.email', read_only=True, allow_null=True)
    resolved_by_email = serializers.EmailField(source='resolved_by.email', read_only=True, allow_null=True)
    
    class Meta:
        model = Alert
        fields = [
            'id', 'alert_type', 'disease_code', 'disease_name',
            'severity', 'severity_display', 'status', 'status_display',
            'confidence', 'affected_regions_data', 'title', 'description',
            'predicted_impact', 'contributing_factors', 'recommended_actions',
            'generated_at', 'acknowledged_at', 'acknowledged_by', 'acknowledged_by_email',
            'resolved_at', 'resolved_by', 'resolved_by_email',
            'escalation_level', 'escalated_at'
        ]
        read_only_fields = [
            'generated_at', 'acknowledged_at', 'acknowledged_by',
            'resolved_at', 'resolved_by', 'escalated_at'
        ]


class AlertActionSerializer(serializers.Serializer):
    """Serializer for alert actions"""
    action = serializers.ChoiceField(choices=['acknowledge', 'resolve', 'escalate'])
    notes = serializers.CharField(required=False, allow_blank=True)


class NotificationSerializer(serializers.ModelSerializer):
    alert_details = AlertSerializer(source='alert', read_only=True)
    recipient_email = serializers.EmailField(source='recipient.email', read_only=True)
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'alert', 'alert_details', 'recipient', 'recipient_email',
            'channel', 'channel_display', 'status', 'status_display',
            'sent_at', 'delivered_at', 'error_message', 'created_at'
        ]


class HeatMapDataSerializer(serializers.Serializer):
    """Serializer for heat map visualization data"""
    region_id = serializers.UUIDField()
    region_name = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    case_count = serializers.IntegerField()
    cases_per_100k = serializers.FloatField()
    average_severity = serializers.FloatField()
    risk_level = serializers.CharField()

class DiseaseStatisticsSerializer(serializers.Serializer):
    """Serializer for disease-wise statistics"""
    disease_code = serializers.CharField()
    disease_name = serializers.CharField()
    total_cases = serializers.IntegerField()
    affected_regions = serializers.IntegerField()
    growth_rate = serializers.FloatField(required=False)
    average_severity = serializers.FloatField()


class RegionalComparisonSerializer(serializers.Serializer):
    """Serializer for regional comparison"""
    region_name = serializers.CharField()
    total_cases = serializers.IntegerField()
    active_diseases = serializers.IntegerField()
    risk_level = serializers.CharField()
    population = serializers.IntegerField()
    cases_per_100k = serializers.FloatField()
