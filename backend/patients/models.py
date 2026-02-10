import uuid
from datetime import timedelta
from pathlib import Path

import jwt
from django.conf import settings
from django.db import models
from django.utils import timezone


class Profile(models.Model):
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

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profiles")
    name = models.CharField(max_length=120)
    age = models.PositiveSmallIntegerField()
    gender = models.CharField(max_length=16, choices=Gender.choices)
    blood_group = models.CharField(max_length=3, choices=BloodGroup.choices)
    relationship = models.CharField(max_length=16, choices=Relationship.choices, default=Relationship.SELF)
    region = models.CharField(max_length=120, blank=True)  # optional region linkage
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("user", "name", "relationship")

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.name} ({self.relationship})"


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


class EmergencyContact(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="emergency_contacts")
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=32)
    relationship = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.name} ({self.relationship})"


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
        expires_at = timezone.datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
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
