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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ChronicCondition(models.Model):
    profile = models.ForeignKey("patients.Profile", on_delete=models.CASCADE, related_name="chronic_conditions")
    icd_10_code = models.CharField(max_length=10)
    disease_name = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
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
