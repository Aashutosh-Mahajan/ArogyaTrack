"""
dashboard/models.py
──────────────────────────────────────────────────────
Patient-facing dashboard alerts generated from health conditions:
  • Abnormal lab results (≥ 2)
  • Low medication adherence (< 70%)
  • Elevated risk score (≥ 4)
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class DashboardAlert(models.Model):
    """
    An alert surfaced on the patient dashboard.

    Generated automatically when specific health thresholds are breached.
    Stored persistently so the patient can review, read, and dismiss.
    """

    class AlertType(models.TextChoices):
        ABNORMAL_LABS = "abnormal_labs", "Abnormal Lab Results"
        LOW_ADHERENCE = "low_adherence", "Low Medication Adherence"
        HIGH_RISK = "high_risk", "Elevated Risk Score"
        OUTBREAK = "outbreak", "Disease Outbreak in Region"

    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="dashboard_alerts",
    )
    alert_type = models.CharField(max_length=30, choices=AlertType.choices)
    severity = models.CharField(max_length=10, choices=Severity.choices)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    is_dismissed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    dismissed_at = models.DateTimeField(null=True, blank=True)
    surveillance_alert = models.ForeignKey(
        'surveillance.Alert',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dashboard_alerts',
        help_text='Link to the surveillance alert that triggered this dashboard alert',
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["patient", "is_dismissed", "-created_at"]),
            models.Index(fields=["patient", "is_read"]),
        ]
        verbose_name = "Dashboard Alert"
        verbose_name_plural = "Dashboard Alerts"

    def __str__(self):
        return f"[{self.severity}] {self.title}"

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])

    def dismiss(self):
        self.is_dismissed = True
        self.dismissed_at = timezone.now()
        self.save(update_fields=["is_dismissed", "dismissed_at"])


class DownloadLog(models.Model):
    """
    Audit log for every file download performed by a patient.
    """

    class FileType(models.TextChoices):
        MEDICAL_RECORD = "medical_record", "Medical Record"
        PRESCRIPTION = "prescription", "Prescription"
        LAB_REPORT = "lab_report", "Lab Report"
        VISIT_ATTACHMENT = "visit_attachment", "Visit Attachment"
        BULK = "bulk", "Bulk Download"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="download_logs",
    )
    file_type = models.CharField(max_length=30, choices=FileType.choices)
    file_id = models.PositiveIntegerField(null=True, blank=True)
    file_name = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    downloaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-downloaded_at"]
        indexes = [
            models.Index(fields=["user", "-downloaded_at"]),
        ]
        verbose_name = "Download Log"
        verbose_name_plural = "Download Logs"

    def __str__(self):
        return f"{self.user.email} – {self.file_type} – {self.downloaded_at:%Y-%m-%d %H:%M}"
