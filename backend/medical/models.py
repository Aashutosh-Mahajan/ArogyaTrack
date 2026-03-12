import re
from datetime import timedelta

import jwt
from django.conf import settings
from django.db import models
from django.utils import timezone

ICD10_REGEX = re.compile(r"^[A-TV-Z][0-9][0-9AB](\.[0-9A-Z]{1,4})?$")


def validate_icd10(code: str) -> bool:
    return bool(ICD10_REGEX.match(code))


class MedicalRecord(models.Model):
    patient = models.ForeignKey("patients.Profile", on_delete=models.CASCADE, related_name="medical_records")
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="doctor_records")
    symptoms = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Diagnosis(models.Model):
    record = models.ForeignKey(MedicalRecord, on_delete=models.CASCADE, related_name="diagnoses")
    icd_10_code = models.CharField(max_length=10)
    disease_name = models.CharField(max_length=255)
    severity = models.PositiveSmallIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Allergy(models.Model):
    profile = models.ForeignKey("patients.Profile", on_delete=models.CASCADE, related_name="allergies")
    allergen = models.CharField(max_length=255)
    reaction_type = models.CharField(max_length=120)
    severity = models.PositiveSmallIntegerField(default=1)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="added_allergies",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ChronicCondition(models.Model):
    profile = models.ForeignKey("patients.Profile", on_delete=models.CASCADE, related_name="chronic_conditions")
    icd_10_code = models.CharField(max_length=10)
    disease_name = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="added_conditions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class DoctorPatientAccess(models.Model):
    """
    Tracks doctor access to patient records with time-limited permissions.
    """

    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="patient_accesses")
    patient = models.ForeignKey("patients.Profile", on_delete=models.CASCADE, related_name="doctor_accesses")
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    access_method = models.CharField(max_length=50, default="qr_scan")  # qr_scan, emergency, etc.

    class Meta:
        ordering = ["-granted_at"]
        indexes = [models.Index(fields=["doctor", "patient", "expires_at"])]

    def is_valid(self) -> bool:
        return timezone.now() < self.expires_at


class HealthCardValidator:
    @staticmethod
    def decode_token(token: str) -> dict | None:
        try:
            return jwt.decode(token, settings.SIMPLE_JWT.get("SIGNING_KEY"), algorithms=[settings.SIMPLE_JWT.get("ALGORITHM", "HS256")])
        except jwt.PyJWTError:
            return False

    @staticmethod
    def validate_card(profile, token: str) -> bool:
        payload = HealthCardValidator.decode_token(token)
        if not payload:
            return False
        patient_id = payload.get("patient_id")
        if str(profile.id) != str(patient_id):
            return False
        exp_ts = payload.get("exp")
        if exp_ts and timezone.now() > timezone.datetime.fromtimestamp(exp_ts, tz=timezone.utc):
            return False
        card = getattr(profile, "health_card", None)
        if card is None or card.revoked_at is not None:
            return False
        if card.expires_at and timezone.now() > card.expires_at:
            return False
        return True

    @staticmethod
    def grant_access(doctor, patient, hours: int = 24) -> "DoctorPatientAccess":
        """Grant time-limited access to patient records."""
        return DoctorPatientAccess.objects.create(
            doctor=doctor, patient=patient, expires_at=timezone.now() + timedelta(hours=hours)
        )

    @staticmethod
    def has_access(doctor, patient) -> bool:
        """Check if doctor has valid access to patient records."""
        return DoctorPatientAccess.objects.filter(doctor=doctor, patient=patient, expires_at__gt=timezone.now()).exists()


class PatientVisitRecord(models.Model):
    """
    Simple medical visit records for patients.
    Stores visit history with diagnosis, tests, and prescriptions.
    """
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="visit_records")
    doctor_name = models.CharField(max_length=255)
    department = models.CharField(max_length=255)
    diagnosis = models.TextField()
    tests_performed = models.TextField()
    prescription = models.TextField()
    doctor_notes = models.TextField(blank=True, help_text="Important notes from the doctor")
    visit_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-visit_date"]
        verbose_name = "Patient Visit Record"
        verbose_name_plural = "Patient Visit Records"

    def __str__(self):
        return f"{self.patient.email} - {self.doctor_name} - {self.visit_date.strftime('%d %b %Y')}"


class VisitReportAttachment(models.Model):
    """
    Attachments for patient visit records (lab reports, prescriptions, etc.)
    """
    visit_record = models.ForeignKey(PatientVisitRecord, on_delete=models.CASCADE, related_name="report_attachments")
    file = models.FileField(upload_to="visit_reports/%Y/%m/")
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=100, blank=True)  # e.g., "Lab Report", "Prescription", "X-Ray"
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_reports",
        help_text="Doctor who uploaded this report",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]
        verbose_name = "Visit Report Attachment"
        verbose_name_plural = "Visit Report Attachments"

    def __str__(self):
        return f"{self.file_name} - {self.visit_record.doctor_name}"


class LabTestResult(models.Model):
    """
    Structured lab test result with numeric value and normal range.

    Allows the dashboard to show colour-coded status (High / Low / Normal)
    and trend arrows by comparing successive results for the same test.
    """

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lab_test_results",
    )
    visit_record = models.ForeignKey(
        PatientVisitRecord,
        on_delete=models.CASCADE,
        related_name="lab_tests",
        null=True,
        blank=True,
    )
    test_name = models.CharField(max_length=255, db_index=True)
    value = models.FloatField(help_text="Numeric result value")
    unit = models.CharField(max_length=50, help_text="e.g. mg/dL, mmol/L, %")
    normal_min = models.FloatField(help_text="Lower bound of normal range")
    normal_max = models.FloatField(help_text="Upper bound of normal range")
    report_file = models.FileField(
        upload_to="lab_reports/%Y/%m/",
        blank=True,
        help_text="PDF or image of the lab report",
    )
    tested_at = models.DateTimeField(help_text="When the test was performed")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-tested_at"]
        indexes = [
            models.Index(fields=["patient", "test_name", "-tested_at"]),
        ]
        verbose_name = "Lab Test Result"
        verbose_name_plural = "Lab Test Results"

    def __str__(self):
        return f"{self.patient.email} – {self.test_name}: {self.value} {self.unit}"

    @property
    def status(self) -> str:
        if self.value > self.normal_max:
            return "high"
        if self.value < self.normal_min:
            return "low"
        return "normal"


class HealthMetric(models.Model):
    """
    Point-in-time health metric recording used for trend charts.

    Supports blood_pressure (systolic/diastolic), sugar, weight and BMI.
    """

    class MetricType(models.TextChoices):
        BLOOD_PRESSURE = "blood_pressure", "Blood Pressure"
        SUGAR = "sugar", "Blood Sugar"
        WEIGHT = "weight", "Weight"
        BMI = "bmi", "BMI"

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="health_metrics",
    )
    metric_type = models.CharField(
        max_length=20,
        choices=MetricType.choices,
        db_index=True,
    )
    value = models.FloatField(help_text="Primary value (systolic for BP)")
    secondary_value = models.FloatField(
        null=True,
        blank=True,
        help_text="Diastolic for BP; unused for other metrics",
    )
    unit = models.CharField(max_length=20, help_text="mmHg, mg/dL, kg, kg/m²")
    recorded_at = models.DateTimeField(
        help_text="When the measurement was taken",
        db_index=True,
    )
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at"]
        indexes = [
            models.Index(fields=["patient", "metric_type", "-recorded_at"]),
        ]
        verbose_name = "Health Metric"
        verbose_name_plural = "Health Metrics"

    def __str__(self):
        val = f"{self.value}"
        if self.secondary_value is not None:
            val += f"/{self.secondary_value}"
        return f"{self.patient.email} – {self.get_metric_type_display()}: {val} {self.unit}"
