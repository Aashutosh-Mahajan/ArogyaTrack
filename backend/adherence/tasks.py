from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from django.conf import settings

from .models import DoseSchedule, AdherenceReminder, AdherenceTracker
from .services import AdherenceService


@shared_task
def send_medication_reminders():
    """
    Celery task to send medication reminders
    Runs every hour to check for upcoming doses
    """
    now = timezone.now()
    reminder_window_start = now
    reminder_window_end = now + timedelta(minutes=30)
    
    # Get doses scheduled in the next 30 minutes that haven't been taken
    upcoming_doses = DoseSchedule.objects.filter(
        scheduled_time__gte=reminder_window_start,
        scheduled_time__lte=reminder_window_end,
        is_taken=False,
        reminder_sent=False,
        tracker__is_active=True,
    ).select_related('tracker', 'medicine', 'tracker__patient', 'tracker__patient__user')
    
    reminders_sent = 0
    
    for dose in upcoming_doses:
        # Send email reminder
        success = _send_email_reminder(dose)
        
        if success:
            # Create reminder record
            AdherenceReminder.objects.create(
                tracker=dose.tracker,
                dose_schedule=dose,
                channel='email',
                status='sent',
                sent_at=now,
            )
            
            # Mark reminder as sent
            dose.reminder_sent = True
            dose.save()
            
            reminders_sent += 1
    
    return f"Sent {reminders_sent} medication reminders"


def _send_email_reminder(dose: DoseSchedule) -> bool:
    """Send email reminder for a dose"""
    try:
        patient = dose.tracker.patient
        user = patient.user
        
        subject = f"Medication Reminder: {dose.medicine.name}"
        message = f"""
Hello {patient.name},

This is a reminder to take your medication:

Medicine: {dose.medicine.name}
Scheduled Time: {dose.scheduled_time.strftime('%I:%M %p')}
Dosage: {dose.prescription_medicine.dosage}

Please take your medication as prescribed.

Best regards,
Health Surveillance System
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        
        return True
    except Exception as e:
        print(f"Error sending reminder email: {e}")
        return False


@shared_task
def send_refill_reminders():
    """
    Celery task to send refill reminders
    Runs daily to check for trackers at 80% consumption
    """
    active_trackers = AdherenceTracker.objects.filter(is_active=True)
    
    refill_reminders_sent = 0
    
    for tracker in active_trackers:
        if AdherenceService.check_refill_needed(str(tracker.id)):
            # Send refill reminder
            success = _send_refill_email(tracker)
            
            if success:
                refill_reminders_sent += 1
    
    return f"Sent {refill_reminders_sent} refill reminders"


def _send_refill_email(tracker: AdherenceTracker) -> bool:
    """Send refill reminder email"""
    try:
        patient = tracker.patient
        user = patient.user
        
        subject = "Medication Refill Reminder"
        message = f"""
Hello {patient.name},

You have consumed 80% or more of your prescribed medication.

Please consult your doctor for a refill if needed.

Prescription ID: {tracker.prescription.id}
Start Date: {tracker.start_date.strftime('%Y-%m-%d')}
End Date: {tracker.end_date.strftime('%Y-%m-%d')}

Best regards,
Health Surveillance System
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        
        return True
    except Exception as e:
        print(f"Error sending refill email: {e}")
        return False


@shared_task
def flag_low_adherence_patients():
    """
    Celery task to flag patients with adherence < 80%
    Runs daily to identify patients needing follow-up
    """
    active_trackers = AdherenceTracker.objects.filter(is_active=True)
    
    flagged_count = 0
    
    for tracker in active_trackers:
        metrics = AdherenceService.calculate_adherence(str(tracker.id))
        
        if metrics and metrics['below_threshold']:
            # Send notification to doctor
            _notify_doctor_low_adherence(tracker, metrics)
            flagged_count += 1
    
    return f"Flagged {flagged_count} patients with low adherence"


def _notify_doctor_low_adherence(tracker: AdherenceTracker, metrics: dict) -> bool:
    """Notify doctor about patient with low adherence"""
    try:
        patient = tracker.patient
        doctor = tracker.prescription.doctor
        
        subject = f"Low Adherence Alert: {patient.name}"
        message = f"""
Hello Dr. {doctor.email},

Patient {patient.name} has low medication adherence:

Adherence Percentage: {metrics['adherence_percentage']}%
Expected Doses: {metrics['expected_doses']}
Actual Doses: {metrics['actual_doses']}
Missed Doses: {metrics['missed_doses']}

Please follow up with the patient.

Best regards,
Health Surveillance System
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[doctor.email],
            fail_silently=False,
        )
        
        return True
    except Exception as e:
        print(f"Error notifying doctor: {e}")
        return False
