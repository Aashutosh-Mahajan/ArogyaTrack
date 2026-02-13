import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.mail import send_mail, EmailMultiAlternatives
from django.db import models
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

# Import AuditLog and AuditService from audit module
from .audit import AuditLog, AuditService


class UserManager(BaseUserManager):
    def create_user(self, email: str, password: str | None = None, **extra_fields: Any) -> "User":
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str, **extra_fields: Any) -> "User":
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("verification_status", User.VerificationStatus.VERIFIED)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"

    class Role(models.TextChoices):
        PATIENT = "patient", "Patient"
        DOCTOR = "doctor", "Doctor"
        ADMIN = "admin", "Admin"

    email = models.EmailField(unique=True)
    verification_status = models.CharField(
        max_length=16, choices=VerificationStatus.choices, default=VerificationStatus.PENDING
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PATIENT)
    active_profile = models.ForeignKey(
        "patients.Profile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_for_users",
    )
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    def __str__(self) -> str:  # pragma: no cover - simple display
        return self.email

    # ── Role helper properties ──────────────────────────────────────

    @property
    def is_doctor(self) -> bool:
        return self.role == self.Role.DOCTOR

    @property
    def is_patient(self) -> bool:
        return self.role == self.Role.PATIENT

    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_approved_doctor(self) -> bool:
        """True only when the doctor's profile has been approved by admin."""
        if not self.is_doctor:
            return False
        profile = getattr(self, "doctor_profile", None)
        if profile is None:
            try:
                profile = DoctorProfile.objects.get(user=self)
            except DoctorProfile.DoesNotExist:
                return False
        return profile.approval_status == DoctorProfile.ApprovalStatus.APPROVED

    class Meta:
        ordering = ["-date_joined"]


class DoctorProfile(models.Model):
    """Extended profile for doctors. Kept separate from User."""

    class ApprovalStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="doctor_profile")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    medical_license = models.CharField(max_length=50, unique=True)
    specialization = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, blank=True)
    approval_status = models.CharField(
        max_length=16, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING
    )
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approved_doctors"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Dr. {self.first_name} {self.last_name} ({self.approval_status})"


class OTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otps")
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    is_valid = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "expires_at", "is_valid"])]
        ordering = ["-created_at"]

    @staticmethod
    def hash_code(code: str) -> str:
        return hashlib.sha256(code.encode("utf-8")).hexdigest()

    @staticmethod
    def generate_code() -> str:
        return f"{secrets.randbelow(1_000_000):06d}"

    def mark_invalid(self) -> None:
        self.is_valid = False
        self.save(update_fields=["is_valid"])

    def __str__(self) -> str:  # pragma: no cover - admin display
        return f"OTP for {self.user.email}"


class Session(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    refresh_token_hash = models.CharField(max_length=128)
    device_info = models.JSONField(default=dict)
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [models.Index(fields=["user", "expires_at"])]
        ordering = ["-created_at"]

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def __str__(self) -> str:  # pragma: no cover - admin display
        return f"Session for {self.user.email}"


class OTPService:
    @staticmethod
    def send_otp_email(email: str, code: str, purpose: str = "verification") -> None:
        """Send OTP using HTML email template."""
        purpose_config = {
            "verification": {
                "subject": "Verify Your Email – Health Surveillance",
                "heading": "Email Verification",
                "message": "Please use the code below to verify your email address and complete your registration.",
            },
            "login": {
                "subject": "Your Login Code – Health Surveillance",
                "heading": "Login Verification",
                "message": "Use the code below to securely sign in to your account.",
            },
            "password_reset": {
                "subject": "Password Reset Code – Health Surveillance",
                "heading": "Password Reset",
                "message": "You requested a password reset. Use the code below to set a new password.",
            },
        }
        config = purpose_config.get(purpose, purpose_config["verification"])

        context = {
            "otp_code": code,
            "heading": config["heading"],
            "message": config["message"],
            "expiry_minutes": 5,
            "year": timezone.now().year,
        }

        html_content = render_to_string("email/otp_email.html", context)
        text_content = strip_tags(html_content)

        msg = EmailMultiAlternatives(
            subject=config["subject"],
            body=text_content,
            from_email=None,
            to=[email],
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)

    @staticmethod
    def issue_otp(user: User, expiry_minutes: int = 5, purpose: str = "verification") -> "OTP":
        code = OTP.generate_code()
        otp = OTP.objects.create(
            user=user,
            code_hash=OTP.hash_code(code),
            expires_at=timezone.now() + timedelta(minutes=expiry_minutes),
        )
        OTPService.send_otp_email(user.email, code, purpose=purpose)
        return otp

    @staticmethod
    def verify_otp(user: User, code: str, max_attempts: int = 3) -> bool:
        otp = OTP.objects.filter(user=user, is_valid=True).order_by("-created_at").first()
        if not otp:
            return False
        now = timezone.now()
        if otp.expires_at < now:
            otp.mark_invalid()
            return False
        if otp.attempts >= max_attempts:
            otp.mark_invalid()
            return False
        if otp.code_hash != OTP.hash_code(code):
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            if otp.attempts >= max_attempts:
                otp.mark_invalid()
            return False
        otp.mark_invalid()
        return True


class SessionService:
    @staticmethod
    def create_session(user: User, refresh_token: str, device_info: Dict[str, Any] | None = None, days: int = 30) -> Session:
        return Session.objects.create(
            user=user,
            refresh_token_hash=Session.hash_token(refresh_token),
            device_info=device_info or {},
            expires_at=timezone.now() + timedelta(days=days),
        )

    @staticmethod
    def invalidate_expired() -> int:
        return Session.objects.filter(expires_at__lt=timezone.now()).delete()[0]
