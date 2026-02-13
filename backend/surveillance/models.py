import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class Region(models.Model):
    """Geographic regions for surveillance aggregation"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    district = models.CharField(max_length=255)
    state = models.CharField(max_length=255)
    country = models.CharField(max_length=255, default="India")
    latitude = models.FloatField()
    longitude = models.FloatField()
    population = models.IntegerField()
    hospital_count = models.IntegerField(default=0)
    sanitation_index = models.FloatField(default=50.0)  # 0-100
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['state', 'district', 'name']
        indexes = [
            models.Index(fields=['state', 'district']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return f"{self.name}, {self.district}, {self.state}"


class SurveillanceData(models.Model):
    """Aggregated disease surveillance data (K-anonymized)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField()
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='surveillance_data')
    disease_code = models.CharField(max_length=10)  # ICD-10 code
    disease_name = models.CharField(max_length=255)
    case_count = models.IntegerField()
    average_severity = models.FloatField()
    cases_per_100k = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('date', 'region', 'disease_code')
        ordering = ['-date', 'region']
        indexes = [
            models.Index(fields=['date', 'region', 'disease_code']),
            models.Index(fields=['disease_code', 'date']),
            models.Index(fields=['region', 'date']),
        ]

    def __str__(self):
        return f"{self.disease_name} - {self.region.name} on {self.date}"


class Cluster(models.Model):
    """Disease clusters detected by DBSCAN"""
    SEVERITY_CHOICES = [
        ('low', 'Low Risk'),
        ('medium', 'Medium Risk'),
        ('high', 'High Risk'),
        ('critical', 'Critical'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    disease_code = models.CharField(max_length=10)
    disease_name = models.CharField(max_length=255)
    detection_date = models.DateField()
    centroid_lat = models.FloatField()
    centroid_lon = models.FloatField()
    radius_km = models.FloatField()
    total_cases = models.IntegerField()
    total_population = models.IntegerField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    growth_rate = models.FloatField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-detection_date', '-severity']
        indexes = [
            models.Index(fields=['disease_code', 'detection_date', 'is_active']),
            models.Index(fields=['severity', 'is_active']),
        ]

    def __str__(self):
        return f"{self.disease_name} Cluster ({self.severity}) - {self.detection_date}"


class ClusterRegion(models.Model):
    """Regions belonging to a cluster"""
    cluster = models.ForeignKey(Cluster, on_delete=models.CASCADE, related_name='regions')
    region = models.ForeignKey(Region, on_delete=models.CASCADE)
    case_count = models.IntegerField()

    class Meta:
        unique_together = ('cluster', 'region')


class Forecast(models.Model):
    """Prophet time series forecasts"""
    HORIZON_CHOICES = [
        (7, '7 days'),
        (14, '14 days'),
        (30, '30 days'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='forecasts')
    disease_code = models.CharField(max_length=10)
    disease_name = models.CharField(max_length=255)
    forecast_date = models.DateField()  # Date the forecast was made
    prediction_date = models.DateField()  # Date being predicted
    horizon_days = models.IntegerField(choices=HORIZON_CHOICES)
    predicted_cases = models.FloatField()
    lower_bound = models.FloatField()
    upper_bound = models.FloatField()
    confidence = models.FloatField()  # 0-1
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-forecast_date', 'prediction_date']
        indexes = [
            models.Index(fields=['region', 'disease_code', 'forecast_date']),
            models.Index(fields=['prediction_date']),
        ]

    def __str__(self):
        return f"{self.disease_name} forecast for {self.prediction_date} (made on {self.forecast_date})"


class Anomaly(models.Model):
    """Anomalies detected by Isolation Forest"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='anomalies')
    disease_code = models.CharField(max_length=10)
    disease_name = models.CharField(max_length=255)
    detection_date = models.DateField()
    anomaly_score = models.FloatField()  # -1 to 1 (higher = more anomalous)
    actual_cases = models.IntegerField()
    expected_cases = models.FloatField()
    deviation_percentage = models.FloatField()
    description = models.TextField(blank=True)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-detection_date', '-anomaly_score']
        indexes = [
            models.Index(fields=['disease_code', 'detection_date', 'is_resolved']),
            models.Index(fields=['region', 'detection_date']),
        ]

    def __str__(self):
        return f"Anomaly: {self.disease_name} in {self.region.name} on {self.detection_date}"


class RiskScore(models.Model):
    """Regional risk scores from XGBoost"""
    RISK_LEVELS = [
        (0, 'Low'),
        (1, 'Medium'),
        (2, 'High'),
        (3, 'Critical'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='risk_scores')
    disease_code = models.CharField(max_length=10)
    disease_name = models.CharField(max_length=255)
    calculation_date = models.DateField()
    risk_level = models.IntegerField(choices=RISK_LEVELS)
    risk_probability = models.FloatField()  # 0-1
    contributing_factors = models.JSONField(default=dict)  # SHAP values
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('region', 'disease_code', 'calculation_date')
        ordering = ['-calculation_date', '-risk_level']
        indexes = [
            models.Index(fields=['disease_code', 'calculation_date']),
            models.Index(fields=['risk_level', 'calculation_date']),
        ]

    def __str__(self):
        return f"{self.get_risk_level_display()} risk for {self.disease_name} in {self.region.name}"


class EnvironmentalData(models.Model):
    """Environmental factors for correlation analysis"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='environmental_data')
    date = models.DateField()
    temperature = models.FloatField(null=True, blank=True)  # Celsius
    humidity = models.FloatField(null=True, blank=True)  # Percentage
    rainfall = models.FloatField(null=True, blank=True)  # mm
    aqi = models.IntegerField(null=True, blank=True)  # Air Quality Index
    pm25 = models.FloatField(null=True, blank=True)  # PM2.5
    pm10 = models.FloatField(null=True, blank=True)  # PM10
    water_quality_index = models.FloatField(null=True, blank=True)  # 0-100
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('region', 'date')
        ordering = ['-date', 'region']
        indexes = [
            models.Index(fields=['region', 'date']),
            models.Index(fields=['date']),
        ]

    def __str__(self):
        return f"Environmental data for {self.region.name} on {self.date}"


class Consent(models.Model):
    """Patient consent for data usage"""
    CONSENT_TYPES = [
        ('surveillance', 'Disease Surveillance'),
        ('research', 'Research'),
        ('data_sharing', 'Data Sharing'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey('patients.Profile', on_delete=models.CASCADE, related_name='consents')
    consent_type = models.CharField(max_length=30, choices=CONSENT_TYPES)
    is_granted = models.BooleanField(default=False)
    granted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    signature_data = models.TextField(blank=True)  # Digital signature
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('profile', 'consent_type')
        indexes = [
            models.Index(fields=['profile', 'consent_type', 'is_granted']),
        ]

    def __str__(self):
        status = "Granted" if self.is_granted else "Not Granted"
        return f"{self.get_consent_type_display()} - {self.profile.name} ({status})"

    def revoke(self):
        """Revoke consent"""
        self.is_granted = False
        self.revoked_at = timezone.now()
        self.save()

    def grant(self, signature_data=""):
        """Grant consent"""
        self.is_granted = True
        self.granted_at = timezone.now()
        self.revoked_at = None
        self.signature_data = signature_data
        self.save()


class Alert(models.Model):
    """Multi-model alert system"""
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('acknowledged', 'Acknowledged'),
        ('resolved', 'Resolved'),
        ('false_positive', 'False Positive'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alert_type = models.CharField(max_length=50)  # 'outbreak', 'cluster', 'forecast', 'anomaly', 'environmental'
    disease_code = models.CharField(max_length=10)
    disease_name = models.CharField(max_length=255)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    confidence = models.FloatField()  # 0-1
    
    # Related regions
    affected_regions = models.ManyToManyField(Region, related_name='alerts')
    
    # Alert details
    title = models.CharField(max_length=255)
    description = models.TextField()
    predicted_impact = models.TextField(blank=True)
    contributing_factors = models.JSONField(default=dict)
    recommended_actions = models.TextField(blank=True)
    
    # Timestamps
    generated_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='acknowledged_alerts'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_alerts'
    )
    
    # Escalation
    escalation_level = models.IntegerField(default=1)  # 1=District, 2=State, 3=Central
    escalated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-generated_at', '-severity']
        indexes = [
            models.Index(fields=['status', 'severity', '-generated_at']),
            models.Index(fields=['disease_code', 'status']),
            models.Index(fields=['generated_at']),
        ]

    def __str__(self):
        return f"{self.get_severity_display()} Alert: {self.title}"

    def acknowledge(self, user):
        """Acknowledge alert"""
        self.status = 'acknowledged'
        self.acknowledged_at = timezone.now()
        self.acknowledged_by = user
        self.save()

    def resolve(self, user):
        """Resolve alert"""
        self.status = 'resolved'
        self.resolved_at = timezone.now()
        self.resolved_by = user
        self.save()

    def escalate(self):
        """Escalate alert to next level"""
        if self.escalation_level < 3:
            self.escalation_level += 1
            self.escalated_at = timezone.now()
            self.save()


class Notification(models.Model):
    """Notification delivery tracking"""
    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('push', 'Push Notification'),
        ('dashboard', 'Dashboard'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('delivered', 'Delivered'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    alert = models.ForeignKey(Alert, on_delete=models.CASCADE, related_name='notifications')
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['alert', 'status']),
            models.Index(fields=['recipient', 'status']),
        ]

    def __str__(self):
        return f"{self.get_channel_display()} notification for {self.recipient.email} - {self.status}"
