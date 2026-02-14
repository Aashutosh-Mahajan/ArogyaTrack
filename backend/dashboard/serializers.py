"""
dashboard/serializers.py
──────────────────────────────────────────────────────
Serializers for the patient dashboard endpoints.
"""
from rest_framework import serializers


class DashboardSummarySerializer(serializers.Serializer):
    """Read-only serializer for the patient dashboard health snapshot."""

    # Welcome / meta
    patient_name = serializers.CharField()
    last_login = serializers.DateTimeField(allow_null=True)

    # Counts
    total_alerts = serializers.IntegerField()
    adherence_percentage = serializers.FloatField()

    # Calculated risk
    calculated_risk_score = serializers.IntegerField()
    calculated_risk_level = serializers.CharField()  # Low / Medium / High

    # Emergency card data (embedded so the frontend modal can use it)
    health_id = serializers.CharField(allow_null=True)
    blood_group = serializers.CharField(allow_null=True)
    emergency_contact_name = serializers.CharField(allow_null=True)
    emergency_contact_phone = serializers.CharField(allow_null=True)
    emergency_contact_relationship = serializers.CharField(allow_null=True)


class KPITrendSerializer(serializers.Serializer):
    """Trend comparison between current and previous 30-day periods."""
    current = serializers.IntegerField()
    previous = serializers.IntegerField()
    change = serializers.IntegerField()
    direction = serializers.CharField()  # "up" | "down" | "flat"


class DashboardKPISerializer(serializers.Serializer):
    """Read-only serializer for the patient KPI summary cards."""

    total_medical_records = serializers.IntegerField()
    active_prescriptions = serializers.IntegerField()
    pending_lab_reports = serializers.IntegerField()
    adherence_percentage = serializers.FloatField()
    alerts_count = serializers.IntegerField()
    total_downloads = serializers.IntegerField()

    # Monthly trend data  (current 30d vs previous 30d)
    monthly_trends = serializers.DictField(child=KPITrendSerializer())

    last_updated = serializers.DateTimeField()


class LabTestSerializer(serializers.Serializer):
    """Read-only serializer for a single lab test result."""
    id = serializers.IntegerField()
    test_name = serializers.CharField()
    value = serializers.FloatField()
    unit = serializers.CharField()
    normal_min = serializers.FloatField()
    normal_max = serializers.FloatField()
    status = serializers.CharField()  # high / low / normal
    trend = serializers.CharField(allow_null=True)  # up / down / null
    previous_value = serializers.FloatField(allow_null=True)
    report_url = serializers.CharField(allow_null=True)
    tested_at = serializers.DateTimeField()


class HealthMetricPointSerializer(serializers.Serializer):
    """Single data point in a health trend time-series."""
    date = serializers.DateField()
    value = serializers.FloatField()
    secondary_value = serializers.FloatField(allow_null=True)


class HealthTrendSerializer(serializers.Serializer):
    """One metric's full time-series for the health trends chart."""
    metric = serializers.CharField()
    label = serializers.CharField()
    unit = serializers.CharField()
    data = HealthMetricPointSerializer(many=True)


class HealthTrendsResponseSerializer(serializers.Serializer):
    """Top-level response for /api/dashboard/health-trends/."""
    period_months = serializers.IntegerField()
    trends = HealthTrendSerializer(many=True)


class DashboardAlertSerializer(serializers.Serializer):
    """Read-only serializer for a patient dashboard alert."""
    id = serializers.UUIDField()
    alert_type = serializers.CharField()
    severity = serializers.CharField()
    title = serializers.CharField()
    message = serializers.CharField()
    is_read = serializers.BooleanField()
    is_dismissed = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    read_at = serializers.DateTimeField(allow_null=True)


class RecentRecordAttachmentSerializer(serializers.Serializer):
    """Attachment info nested inside a recent record."""
    id = serializers.IntegerField()
    file_name = serializers.CharField()
    file_type = serializers.CharField()
    file_url = serializers.CharField()
    uploaded_at = serializers.DateTimeField()


class RecentRecordSerializer(serializers.Serializer):
    """Read-only serializer for a single recent medical visit record."""
    id = serializers.IntegerField()
    visit_date = serializers.DateTimeField()
    visit_time = serializers.CharField()
    doctor_name = serializers.CharField()
    department = serializers.CharField()
    tests_performed = serializers.CharField(allow_blank=True)
    diagnosis_summary = serializers.CharField()
    prescription_text = serializers.CharField(allow_blank=True)
    doctor_notes = serializers.CharField(allow_blank=True)
    prescriptions_count = serializers.IntegerField()
    status = serializers.CharField()  # completed / follow_up / critical
    attachments = RecentRecordAttachmentSerializer(many=True)
    created_at = serializers.DateTimeField()
