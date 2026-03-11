import logging
from typing import Any, Dict

from django.conf import settings
from django.apps import apps
from django.db import models

logger = logging.getLogger(__name__)


class AuditLog(models.Model):
    """
    Comprehensive audit logging for security and compliance.
    """

    class EventType(models.TextChoices):
        USER_REGISTRATION = "user_registration", "User Registration"
        USER_LOGIN = "user_login", "User Login"
        USER_LOGOUT = "user_logout", "User Logout"
        OTP_SENT = "otp_sent", "OTP Sent"
        OTP_VERIFIED = "otp_verified", "OTP Verified"
        OTP_FAILED = "otp_failed", "OTP Failed"
        PROFILE_CREATED = "profile_created", "Profile Created"
        HEALTH_CARD_GENERATED = "health_card_generated", "Health Card Generated"
        HEALTH_CARD_REVOKED = "health_card_revoked", "Health Card Revoked"
        PATIENT_RECORD_ACCESSED = "patient_record_accessed", "Patient Record Accessed"
        PRESCRIPTION_CREATED = "prescription_created", "Prescription Created"
        PRESCRIPTION_DISPENSED = "prescription_dispensed", "Prescription Dispensed"
        ALERT_GENERATED = "alert_generated", "Alert Generated"
        ALERT_ACKNOWLEDGED = "alert_acknowledged", "Alert Acknowledged"
        SECURITY_EVENT = "security_event", "Security Event"

    class Severity(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        ERROR = "error", "Error"
        CRITICAL = "critical", "Critical"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    event_type = models.CharField(max_length=50, choices=EventType.choices)
    resource_type = models.CharField(max_length=50, blank=True)
    resource_id = models.CharField(max_length=100, blank=True)
    action = models.CharField(max_length=100)
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.INFO)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "event_type", "created_at"]),
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["severity", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} - {self.user or 'Anonymous'} - {self.created_at}"


class AuditService:
    """
    Service for creating audit log entries.
    """

    @staticmethod
    def log_event(
        event_type: str,
        action: str,
        user: models.Model | None = None,
        resource_type: str = "",
        resource_id: str = "",
        details: Dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str = "",
        severity: str = AuditLog.Severity.INFO,
    ) -> AuditLog:
        """
        Create an audit log entry.
        NEVER log sensitive data (OTPs, tokens, passwords, medical details).
        """
        # Filter out sensitive keys from details
        safe_details = {}
        if details:
            sensitive_keys = {"otp", "password", "token", "secret", "key", "medical_data"}
            safe_details = {k: v for k, v in details.items() if k.lower() not in sensitive_keys}

        try:
            return AuditLog.objects.create(
                user=user,
                event_type=event_type,
                resource_type=resource_type,
                resource_id=resource_id,
                action=action,
                details=safe_details,
                ip_address=ip_address,
                user_agent=user_agent,
                severity=severity,
            )
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")
            return None

    @staticmethod
    def log_user_registration(user: models.Model, ip_address: str | None = None) -> AuditLog:
        return AuditService.log_event(
            event_type=AuditLog.EventType.USER_REGISTRATION,
            action="User registered",
            user=user,
            details={"email": user.email},
            ip_address=ip_address,
        )

    @staticmethod
    def log_user_login(user: models.Model, ip_address: str | None = None, user_agent: str = "") -> AuditLog:
        return AuditService.log_event(
            event_type=AuditLog.EventType.USER_LOGIN,
            action="User logged in",
            user=user,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    @staticmethod
    def log_otp_sent(user: models.Model, ip_address: str | None = None) -> AuditLog:
        return AuditService.log_event(
            event_type=AuditLog.EventType.OTP_SENT,
            action="OTP sent to user",
            user=user,
            ip_address=ip_address,
        )

    @staticmethod
    def log_otp_failed(user: models.Model, ip_address: str | None = None) -> AuditLog:
        return AuditService.log_event(
            event_type=AuditLog.EventType.OTP_FAILED,
            action="OTP verification failed",
            user=user,
            ip_address=ip_address,
            severity=AuditLog.Severity.WARNING,
        )

    @staticmethod
    def log_security_event(
        event_description: str, user: models.Model | None = None, ip_address: str | None = None, severity: str = AuditLog.Severity.WARNING
    ) -> AuditLog:
        return AuditService.log_event(
            event_type=AuditLog.EventType.SECURITY_EVENT,
            action=event_description,
            user=user,
            ip_address=ip_address,
            severity=severity,
        )
