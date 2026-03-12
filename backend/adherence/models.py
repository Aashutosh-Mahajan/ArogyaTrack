import uuid
from django.db import models
from django.utils import timezone


class AdherenceTracker(models.Model):
    """Tracks medication adherence for a prescription"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prescription = models.OneToOneField('prescriptions.Prescription', on_delete=models.CASCADE, related_name='adherence_tracker')
    patient = models.ForeignKey('patients.Profile', on_delete=models.CASCADE, related_name='adherence_trackers')
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    expected_doses = models.IntegerField(default=0)
    actual_doses = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'adherence_trackers'
        indexes = [
            models.Index(fields=['patient', 'is_active']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    @property
    def adherence_percentage(self):
        """Calculate adherence percentage"""
        if self.expected_doses == 0:
            return 0.0
        return round((self.actual_doses / self.expected_doses) * 100, 1)

    def __str__(self):
        return f"Tracker for Prescription {self.prescription_id} - {self.adherence_percentage:.1f}%"


class DoseSchedule(models.Model):
    """Individual dose schedule for a medicine"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tracker = models.ForeignKey(AdherenceTracker, on_delete=models.CASCADE, related_name='dose_schedules')
    medicine = models.ForeignKey('prescriptions.Medicine', on_delete=models.CASCADE)
    prescription_medicine = models.ForeignKey('prescriptions.PrescriptionMedicine', on_delete=models.CASCADE)
    scheduled_time = models.DateTimeField()
    is_taken = models.BooleanField(default=False)
    taken_at = models.DateTimeField(null=True, blank=True)
    reminder_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'dose_schedules'
        indexes = [
            models.Index(fields=['tracker', 'scheduled_time']),
            models.Index(fields=['scheduled_time', 'is_taken']),
        ]
        ordering = ['scheduled_time']

    def __str__(self):
        return f"{self.medicine.name} at {self.scheduled_time}"


class AdherenceReminder(models.Model):
    """Reminder sent to patient for medication"""
    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('push', 'Push Notification'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('acknowledged', 'Acknowledged'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tracker = models.ForeignKey(AdherenceTracker, on_delete=models.CASCADE, related_name='reminders')
    dose_schedule = models.ForeignKey(DoseSchedule, on_delete=models.CASCADE, related_name='reminders')
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    sent_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'adherence_reminders'
        indexes = [
            models.Index(fields=['tracker', 'status']),
            models.Index(fields=['sent_at']),
        ]

    def __str__(self):
        return f"Reminder for {self.dose_schedule} via {self.channel}"
