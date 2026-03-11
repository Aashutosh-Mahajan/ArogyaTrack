from datetime import datetime, timedelta
from typing import List, Dict
from django.utils import timezone
from django.db import transaction

from .models import AdherenceTracker, DoseSchedule, AdherenceReminder
from prescriptions.models import Prescription, PrescriptionMedicine


class AdherenceService:
    """Service for managing medication adherence tracking"""

    @staticmethod
    def activate_tracker(prescription: Prescription) -> AdherenceTracker:
        """
        Activate adherence tracker when prescription is dispensed
        Creates tracker and generates dose schedule
        """
        with transaction.atomic():
            # Create tracker
            tracker = AdherenceTracker.objects.create(
                prescription=prescription,
                patient=prescription.patient,
                start_date=timezone.now(),
                end_date=timezone.now() + timedelta(days=AdherenceService._calculate_max_duration(prescription)),
                expected_doses=0,  # Will be calculated
            )

            # Generate dose schedules for each medicine
            total_expected_doses = 0
            for pm in prescription.prescription_medicines.filter(dispense_status='dispensed'):
                doses = AdherenceService._generate_dose_schedule(tracker, pm)
                total_expected_doses += len(doses)

            # Update expected doses
            tracker.expected_doses = total_expected_doses
            tracker.save()

            return tracker

    @staticmethod
    def _calculate_max_duration(prescription: Prescription) -> int:
        """Calculate maximum duration from all medicines"""
        max_duration = 0
        for pm in prescription.prescription_medicines.all():
            if pm.duration_days > max_duration:
                max_duration = pm.duration_days
        return max_duration

    @staticmethod
    def _generate_dose_schedule(tracker: AdherenceTracker, prescription_medicine: PrescriptionMedicine) -> List[DoseSchedule]:
        """
        Generate dose schedule based on frequency and duration
        Frequency examples: "1x daily", "2x daily", "3x daily", "every 8 hours"
        """
        schedules = []
        frequency = prescription_medicine.frequency.lower()
        duration_days = prescription_medicine.duration_days
        
        # Parse frequency
        doses_per_day = AdherenceService._parse_frequency(frequency)
        
        # Generate schedules
        current_date = tracker.start_date
        for day in range(duration_days):
            for dose_num in range(doses_per_day):
                # Calculate time for this dose
                hour_offset = (24 // doses_per_day) * dose_num
                scheduled_time = current_date + timedelta(days=day, hours=hour_offset)
                
                schedule = DoseSchedule.objects.create(
                    tracker=tracker,
                    medicine=prescription_medicine.medicine,
                    prescription_medicine=prescription_medicine,
                    scheduled_time=scheduled_time,
                )
                schedules.append(schedule)
        
        return schedules

    @staticmethod
    def _parse_frequency(frequency: str) -> int:
        """Parse frequency string to get doses per day"""
        frequency = frequency.lower().strip()
        
        if '1x' in frequency or 'once' in frequency or 'daily' in frequency and '1' in frequency:
            return 1
        elif '2x' in frequency or 'twice' in frequency or 'bid' in frequency:
            return 2
        elif '3x' in frequency or 'thrice' in frequency or 'tid' in frequency:
            return 3
        elif '4x' in frequency or 'qid' in frequency:
            return 4
        elif 'every 8 hours' in frequency or 'q8h' in frequency:
            return 3
        elif 'every 6 hours' in frequency or 'q6h' in frequency:
            return 4
        elif 'every 12 hours' in frequency or 'q12h' in frequency:
            return 2
        else:
            # Default to once daily if can't parse
            return 1

    @staticmethod
    def record_dose_taken(dose_schedule_id: str, taken_at: datetime = None) -> bool:
        """Record that a dose was taken"""
        try:
            dose_schedule = DoseSchedule.objects.get(id=dose_schedule_id)
            
            if dose_schedule.is_taken:
                return False  # Already recorded
            
            dose_schedule.is_taken = True
            dose_schedule.taken_at = taken_at or timezone.now()
            dose_schedule.save()
            
            # Update tracker actual doses
            tracker = dose_schedule.tracker
            tracker.actual_doses += 1
            tracker.save()
            
            return True
        except DoseSchedule.DoesNotExist:
            return False

    @staticmethod
    def calculate_adherence(tracker_id: str) -> Dict:
        """Calculate adherence metrics for a tracker"""
        try:
            tracker = AdherenceTracker.objects.get(id=tracker_id)
            
            # Get all dose schedules
            total_doses = tracker.dose_schedules.count()
            taken_doses = tracker.dose_schedules.filter(is_taken=True).count()
            missed_doses = total_doses - taken_doses
            
            # Calculate adherence percentage
            adherence_percentage = tracker.adherence_percentage
            
            # Check if below threshold
            below_threshold = adherence_percentage < 80.0
            
            return {
                'tracker_id': str(tracker.id),
                'expected_doses': tracker.expected_doses,
                'actual_doses': tracker.actual_doses,
                'total_scheduled': total_doses,
                'taken_doses': taken_doses,
                'missed_doses': missed_doses,
                'adherence_percentage': round(adherence_percentage, 2),
                'below_threshold': below_threshold,
                'is_active': tracker.is_active,
            }
        except AdherenceTracker.DoesNotExist:
            return None

    @staticmethod
    def check_refill_needed(tracker_id: str) -> bool:
        """Check if refill reminder is needed (80% consumption)"""
        try:
            tracker = AdherenceTracker.objects.get(id=tracker_id)
            
            # Calculate consumption percentage
            if tracker.expected_doses == 0:
                return False
            
            consumption_percentage = (tracker.actual_doses / tracker.expected_doses) * 100
            
            # Return True if 80% or more consumed
            return consumption_percentage >= 80.0
        except AdherenceTracker.DoesNotExist:
            return False

    @staticmethod
    def get_upcoming_doses(patient_id: str, hours_ahead: int = 24) -> List[DoseSchedule]:
        """Get upcoming doses for a patient"""
        now = timezone.now()
        end_time = now + timedelta(hours=hours_ahead)
        
        return DoseSchedule.objects.filter(
            tracker__patient_id=patient_id,
            tracker__is_active=True,
            scheduled_time__gte=now,
            scheduled_time__lte=end_time,
            is_taken=False,
        ).select_related('medicine', 'tracker').order_by('scheduled_time')

    @staticmethod
    def get_missed_doses(patient_id: str) -> List[DoseSchedule]:
        """Get missed doses for a patient"""
        now = timezone.now()
        
        return DoseSchedule.objects.filter(
            tracker__patient_id=patient_id,
            tracker__is_active=True,
            scheduled_time__lt=now,
            is_taken=False,
        ).select_related('medicine', 'tracker').order_by('-scheduled_time')
