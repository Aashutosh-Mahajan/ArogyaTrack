from django.utils import timezone
from rest_framework import serializers

from .models import Allergy, ChronicCondition, Diagnosis, MedicalRecord, PatientVisitRecord, VisitReportAttachment, validate_icd10


class DiagnosisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Diagnosis
        fields = ["icd_10_code", "disease_name", "severity"]

    def validate_icd_10_code(self, value):
        if not validate_icd10(value):
            raise serializers.ValidationError("Invalid ICD-10 code")
        return value


class MedicalRecordSerializer(serializers.ModelSerializer):
    diagnoses = DiagnosisSerializer(many=True)

    class Meta:
        model = MedicalRecord
        fields = ["id", "patient", "doctor", "symptoms", "notes", "created_at", "diagnoses"]
        read_only_fields = ["id", "doctor", "created_at"]
        extra_kwargs = {"patient": {"write_only": True}}

    def validate(self, attrs):
        patient = attrs.get("patient")
        doctor = self.context["request"].user
        if doctor.role not in (doctor.Role.DOCTOR, doctor.Role.ADMIN):
            raise serializers.ValidationError({"doctor": "Only doctors can create records"})
        if patient is None:
            raise serializers.ValidationError({"patient": "Patient is required"})
        return attrs

    def create(self, validated_data):
        diagnoses_data = validated_data.pop("diagnoses", [])
        doctor = self.context["request"].user
        record = MedicalRecord.objects.create(doctor=doctor, **validated_data)
        for diag in diagnoses_data:
            Diagnosis.objects.create(record=record, **diag)
        return record


class AllergySerializer(serializers.ModelSerializer):
    added_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Allergy
        fields = ["id", "allergen", "reaction_type", "severity", "added_by_name", "created_at"]
        read_only_fields = ["id", "added_by_name", "created_at"]

    def get_added_by_name(self, obj):
        if obj.added_by:
            name = f"{obj.added_by.get_first_name()} {obj.added_by.get_last_name()}".strip()
            if name.lower().startswith("dr.") or name.lower().startswith("dr "):
                return name
            return f"Dr. {name}" if name else obj.added_by.email
        return None


class ChronicConditionSerializer(serializers.ModelSerializer):
    added_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ChronicCondition
        fields = ["id", "icd_10_code", "disease_name", "is_active", "added_by_name", "created_at"]
        read_only_fields = ["id", "added_by_name", "created_at"]

    def get_added_by_name(self, obj):
        if obj.added_by:
            name = f"{obj.added_by.get_first_name()} {obj.added_by.get_last_name()}".strip()
            if name.lower().startswith("dr.") or name.lower().startswith("dr "):
                return name
            return f"Dr. {name}" if name else obj.added_by.email
        return None

    def validate_icd_10_code(self, value):
        if not validate_icd10(value):
            raise serializers.ValidationError("Invalid ICD-10 code")
        return value


class HistoryDiagnosisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Diagnosis
        fields = ["icd_10_code", "disease_name", "severity", "created_at"]


class MedicalHistorySerializer(serializers.ModelSerializer):
    diagnoses = HistoryDiagnosisSerializer(many=True)

    class Meta:
        model = MedicalRecord
        fields = ["id", "doctor", "symptoms", "notes", "created_at", "diagnoses"]
        depth = 1


class ScanHealthCardSerializer(serializers.Serializer):
    qr_token = serializers.CharField()

    def validate_qr_token(self, value):
        from patients.models import Profile

        from .models import HealthCardValidator

        payload = HealthCardValidator.decode_token(value)
        if not payload:
            raise serializers.ValidationError("Invalid or expired QR token")

        patient_id = payload.get("patient_id")
        if not patient_id:
            raise serializers.ValidationError("Invalid token format")

        try:
            profile = Profile.objects.get(id=patient_id)
        except Profile.DoesNotExist:
            raise serializers.ValidationError("Patient not found")

        # Validate the card
        if not HealthCardValidator.validate_card(profile, value):
            raise serializers.ValidationError("Health card is invalid, expired, or revoked")

        self.context["patient_profile"] = profile
        return value

    def save(self, **kwargs):
        from .models import HealthCardValidator

        doctor = self.context["request"].user
        patient = self.context["patient_profile"]

        # Grant 24-hour access
        access = HealthCardValidator.grant_access(doctor, patient, hours=24)

        # Log the access
        from accounts.audit import AuditService

        AuditService.log_event(
            event_type="patient_record_accessed",
            action="Doctor scanned patient health card",
            user=doctor,
            resource_type="Profile",
            resource_id=str(patient.id),
            details={"patient_name": patient.name, "access_method": "qr_scan"},
        )

        return {"patient_id": str(patient.id), "patient_name": patient.name, "access_expires_at": access.expires_at}


class VisitReportAttachmentSerializer(serializers.ModelSerializer):
    """
    Serializer for Visit Report Attachments
    """
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = VisitReportAttachment
        fields = [
            "id",
            "file",
            "file_url",
            "file_name",
            "file_type",
            "uploaded_by_name",
            "uploaded_at"
        ]
        read_only_fields = ["id", "uploaded_at", "file_url", "uploaded_by_name"]
    
    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            # Use secure download endpoint instead of raw media URL
            if request:
                return request.build_absolute_uri(f'/api/doctors/reports/{obj.id}/download/')
            return f'/api/doctors/reports/{obj.id}/download/'
        return None

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            if hasattr(obj.uploaded_by, 'doctor_profile'):
                dp = obj.uploaded_by.doctor_profile
                name = f"Dr. {dp.first_name} {dp.last_name}".strip()
                if name != "Dr.":
                    return name
            return obj.uploaded_by.email
        return None


class PatientVisitRecordSerializer(serializers.ModelSerializer):
    """
    Serializer for Patient Visit Records (Consultation History)
    """
    report_attachments = VisitReportAttachmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = PatientVisitRecord
        fields = [
            "id",
            "doctor_name",
            "department",
            "diagnosis",
            "tests_performed",
            "prescription",
            "doctor_notes",
            "visit_date",
            "created_at",
            "report_attachments"
        ]
        read_only_fields = ["id", "created_at"]

