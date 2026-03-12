"""
patients/models.py
─────────────────────────────────────────────────────
Production-grade patient models with comprehensive data fields
"""
import uuid
import random
import string
from datetime import date, datetime, timedelta, timezone as dt_timezone
from pathlib import Path

import jwt
from django.conf import settings
from django.db import models
from django.utils import timezone

from .validators import (
    validate_id_proof_file,
    validate_phone_number,
    validate_patient_age,
    validate_full_name,
)
from .storage import patient_id_proof_path, profile_photo_path


def generate_patient_id():
    """Generate a unique patient ID in format: HS-YYYY-XXXXXX"""
    year = timezone.now().year
    random_part = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"HS-{year}-{random_part}"


class Profile(models.Model):
    """
    Patient Profile Model (can represent self or family members).
    
    Extended with production-grade healthcare fields:
    - Personal identification (name, DOB, gender)
    - Contact information (phone, address)
    - Medical data (blood group)
    - Geographic data (district, state, country)
    
    Note: For backward compatibility, most fields are optional except core ones.
    """
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    class Relationship(models.TextChoices):
        SELF = "self", "Self"
        SPOUSE = "spouse", "Spouse"
        CHILD = "child", "Child"
        PARENT = "parent", "Parent"
        OTHER = "other", "Other"

    class BloodGroup(models.TextChoices):
        A_POS = "A+", "A+"
        A_NEG = "A-", "A-"
        B_POS = "B+", "B+"
        B_NEG = "B-", "B-"
        AB_POS = "AB+", "AB+"
        AB_NEG = "AB-", "AB-"
        O_POS = "O+", "O+"
        O_NEG = "O-", "O-"

    # ─── Core Fields (existing) ────────────────────────────────────
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient_id = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        db_index=True,
        help_text="Auto-generated unique patient identifier (HS-YYYY-XXXXXX)"
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profiles")
    name = models.CharField(max_length=120, validators=[validate_full_name])
    age = models.PositiveSmallIntegerField()
    gender = models.CharField(max_length=16, choices=Gender.choices)
    blood_group = models.CharField(max_length=3, choices=BloodGroup.choices)
    relationship = models.CharField(max_length=16, choices=Relationship.choices, default=Relationship.SELF)
    region = models.CharField(max_length=120, blank=True)  # optional region linkage
    
    # ─── New Professional Fields ───────────────────────────────────
    date_of_birth = models.DateField(null=True, blank=True, validators=[validate_patient_age])
    phone = models.CharField(max_length=20, blank=True, validators=[validate_phone_number])

    
    # Geographic Information
    district = models.CharField(max_length=120, blank=True, db_index=True)
    state = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, default="India")
    address = models.TextField(blank=True)
    pincode = models.CharField(max_length=10, blank=True)
    
    # Profile Photo
    profile_photo = models.ImageField(
        upload_to=profile_photo_path,
        null=True,
        blank=True,
        help_text="Profile photo for ID card (max 5MB, JPG/PNG)"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("user", "name", "relationship")
        indexes = [
            models.Index(fields=["user", "relationship"]),
            models.Index(fields=["district", "state"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.relationship})"
    
    def save(self, *args, **kwargs):
        """Override save to auto-generate patient_id."""
        if not self.patient_id:
            while True:
                new_id = generate_patient_id()
                if not Profile.objects.filter(patient_id=new_id).exists():
                    self.patient_id = new_id
                    break
        super().save(*args, **kwargs)

    @property
    def full_address(self) -> str:
        """Return formatted full address."""
        parts = [self.address, self.district, self.state, self.country, self.pincode]
        return ", ".join(p for p in parts if p)
    
    def calculate_age(self) -> int:
        """Calculate age from date_of_birth if available."""
        if self.date_of_birth:
            today = date.today()
            return today.year - self.date_of_birth.year - (
                (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
            )
        return self.age


class PatientProfile(models.Model):
    """
    Extended patient-specific user data (OneToOne with User).
    
    Stores patient-level information that applies to the user account,
    not individual family member profiles.
    
    Includes:
    - Legal documentation (ID proof)
    - Consent and terms acceptance
    - Privacy settings
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="patient_profile",
        primary_key=True
    )
    
    # ─── Legal & Identity Documents ────────────────────────────────
    aadhar_id_proof = models.FileField(
        upload_to=patient_id_proof_path,
        blank=True,
        validators=[validate_id_proof_file],
        help_text="Upload Aadhar card (image or PDF, max 5MB)"
    )
    
    # ─── Consent & Terms (REQUIRED for GDPR/HIPAA compliance) ──────
    terms_accepted = models.BooleanField(
        default=False,
        help_text="User accepted Terms & Conditions"
    )
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    
    consent_store_data = models.BooleanField(
        default=False,
        help_text="Consent to store medical data"
    )
    consent_store_data_at = models.DateTimeField(null=True, blank=True)
    
    consent_doctor_access = models.BooleanField(
        default=False,
        help_text="Consent for doctors to access medical records"
    )
    consent_doctor_access_at = models.DateTimeField(null=True, blank=True)
    
    # ─── Privacy & Settings ─────────────────────────────────────────
    data_sharing_enabled = models.BooleanField(
        default=False,
        help_text="Allow anonymized data sharing for research"
    )
    
    # ─── Audit Fields ───────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_consent_update = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Patient Profile"
        verbose_name_plural = "Patient Profiles"
        indexes = [
            models.Index(fields=["user", "terms_accepted"]),
            models.Index(fields=["created_at"]),
        ]
    
    def __str__(self) -> str:
        return f"Patient Profile: {self.user.email}"
    
    def has_all_consents(self) -> bool:
        """Check if user has provided all required consents."""
        return (
            self.terms_accepted
            and self.consent_store_data
            and self.consent_doctor_access
        )
    
    def update_consent(self, consent_type: str, value: bool) -> None:
        """
        Update a specific consent and log timestamp.
        
        Args:
            consent_type: 'terms', 'store_data', or 'doctor_access'
            value: Boolean consent value
        """
        now = timezone.now()
        if consent_type == "terms":
            self.terms_accepted = value
            if value:
                self.terms_accepted_at = now
        elif consent_type == "store_data":
            self.consent_store_data = value
            if value:
                self.consent_store_data_at = now
        elif consent_type == "doctor_access":
            self.consent_doctor_access = value
            if value:
                self.consent_doctor_access_at = now
        
        self.last_consent_update = now
        self.save()


class HealthCard(models.Model):
    profile = models.OneToOneField(Profile, on_delete=models.CASCADE, related_name="health_card")
    token = models.TextField()
    qr_code_path = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def is_active(self) -> bool:
        now = timezone.now()
        return self.revoked_at is None and self.expires_at > now


class HealthCardService:
    @staticmethod
    def _token_payload(profile: Profile) -> dict:
        issued_at = timezone.now()
        expires_at = issued_at + timedelta(days=365)
        return {
            "patient_id": str(profile.id),
            "issued_at": int(issued_at.timestamp()),
            "exp": int(expires_at.timestamp()),
        }

    @staticmethod
    def generate_token(profile: Profile) -> tuple[str, timezone.datetime]:
        payload = HealthCardService._token_payload(profile)
        token = jwt.encode(payload, settings.SIMPLE_JWT.get("SIGNING_KEY"), algorithm=settings.SIMPLE_JWT.get("ALGORITHM", "HS256"))
        expires_at = datetime.fromtimestamp(payload["exp"], tz=dt_timezone.utc)
        return token, expires_at

    @staticmethod
    def generate_qr_image(data: str, file_path: str) -> str:
        import qrcode
        path_obj = Path(file_path)
        path_obj.parent.mkdir(parents=True, exist_ok=True)
        img = qrcode.make(data)
        img.save(path_obj)
        return file_path

    @staticmethod
    def create_health_card(profile: Profile, media_root: str) -> HealthCard:
        token, expires_at = HealthCardService.generate_token(profile)
        file_path = f"{media_root}/qr_codes/health_cards/{profile.id}.png"
        HealthCardService.generate_qr_image(token, file_path)
        return HealthCard.objects.create(
            profile=profile,
            token=token,
            qr_code_path=file_path,
            expires_at=expires_at,
        )

    @staticmethod
    def revoke(profile: Profile) -> HealthCard:
        card = profile.health_card
        card.revoked_at = timezone.now()
        card.save(update_fields=["revoked_at"])
        return card
