from rest_framework import serializers
from .models import AdherenceTracker, DoseSchedule, AdherenceReminder
from prescriptions.serializers import MedicineSerializer


class DoseScheduleSerializer(serializers.ModelSerializer):
    medicine = MedicineSerializer(read_only=True)
    medicine_name = serializers.CharField(source='medicine.name', read_only=True)
    
    class Meta:
        model = DoseSchedule
        fields = [
            'id', 'medicine', 'medicine_name', 'scheduled_time',
            'is_taken', 'taken_at', 'reminder_sent', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class AdherenceTrackerSerializer(serializers.ModelSerializer):
    adherence_percentage = serializers.FloatField(read_only=True)
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    prescription_id = serializers.UUIDField(source='prescription.id', read_only=True)
    
    class Meta:
        model = AdherenceTracker
        fields = [
            'id', 'prescription_id', 'patient', 'patient_name',
            'start_date', 'end_date', 'expected_doses', 'actual_doses',
            'adherence_percentage', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AdherenceReminderSerializer(serializers.ModelSerializer):
    dose_schedule = DoseScheduleSerializer(read_only=True)
    
    class Meta:
        model = AdherenceReminder
        fields = [
            'id', 'tracker', 'dose_schedule', 'channel', 'status',
            'sent_at', 'acknowledged_at', 'error_message', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class RecordDoseTakenSerializer(serializers.Serializer):
    dose_schedule_id = serializers.UUIDField(required=True)
    taken_at = serializers.DateTimeField(required=False, allow_null=True)


class AdherenceMetricsSerializer(serializers.Serializer):
    tracker_id = serializers.UUIDField()
    expected_doses = serializers.IntegerField()
    actual_doses = serializers.IntegerField()
    total_scheduled = serializers.IntegerField()
    taken_doses = serializers.IntegerField()
    missed_doses = serializers.IntegerField()
    adherence_percentage = serializers.FloatField()
    below_threshold = serializers.BooleanField()
    is_active = serializers.BooleanField()
