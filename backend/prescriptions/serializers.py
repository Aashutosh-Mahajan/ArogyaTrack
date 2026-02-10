from django.conf import settings
from rest_framework import serializers

from medical.models import HealthCardValidator
from patients.models import Profile

from .models import Medicine, Prescription, PrescriptionMedicine, PrescriptionService


class MedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicine
        fields = ["id", "name", "generic_name", "drug_class", "therapeutic_category", "standard_dosages"]


class PrescriptionMedicineSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    medicine_generic = serializers.CharField(source="medicine.generic_name", read_only=True)

    class Meta:
        model = PrescriptionMedicine
        fields = [
            "id",
            "medicine",
            "medicine_name",
            "medicine_generic",
            "dosage",
            "frequency",
            "duration_days",
            "quantity",
            "special_instructions",
            "dispense_status",
            "dispensed_at",
        ]
        read_only_fields = ["id", "dispense_status", "dispensed_at"]


class PrescriptionSerializer(serializers.ModelSerializer):
    medicines = PrescriptionMedicineSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source="patient.name", read_only=True)
    doctor_name = serializers.CharField(source="doctor.email", read_only=True)

    class Meta:
        model = Prescription
        fields = [
            "id",
            "patient",
            "patient_name",
            "doctor",
            "doctor_name",
            "medical_record",
            "qr_code_path",
            "security_hash",
            "status",
            "medicines",
            "created_at",
        ]
        read_only_fields = ["id", "doctor", "qr_code_path", "security_hash", "status", "created_at"]


class CreatePrescriptionSerializer(serializers.Serializer):
    patient_id = serializers.UUIDField()
    medical_record_id = serializers.UUIDField(required=False, allow_null=True)
    medicines = PrescriptionMedicineSerializer(many=True)

    def validate_patient_id(self, value):
        try:
            profile = Profile.objects.get(id=value)
        except Profile.DoesNotExist:
            raise serializers.ValidationError("Patient not found")

        # Check if doctor has access
        doctor = self.context["request"].user
        if not HealthCardValidator.has_access(doctor, profile):
            raise serializers.ValidationError("You do not have access to this patient's records")

        self.context["patient_profile"] = profile
        return value

    def validate_medicines(self, value):
        if not value:
            raise serializers.ValidationError("At least one medicine is required")

        # Validate medicine IDs
        medicine_ids = [m["medicine"].id for m in value]
        existing_count = Medicine.objects.filter(id__in=medicine_ids, is_active=True).count()

        if existing_count != len(medicine_ids):
            raise serializers.ValidationError("One or more medicines are invalid or inactive")

        return value

    def validate(self, attrs):
        # Check drug interactions
        medicine_ids = [m["medicine"].id for m in attrs["medicines"]]
        interactions = PrescriptionService.check_drug_interactions(medicine_ids)

        if interactions:
            # Store interactions for response
            self.context["drug_interactions"] = interactions

        # Check patient allergies
        patient = self.context["patient_profile"]
        allergy_alerts = PrescriptionService.check_patient_allergies(patient, medicine_ids)

        if allergy_alerts:
            # Store allergy alerts for response
            self.context["allergy_alerts"] = allergy_alerts

        return attrs

    def create(self, validated_data):
        doctor = self.context["request"].user
        patient = self.context["patient_profile"]
        medicines_data = validated_data.pop("medicines")
        medical_record_id = validated_data.get("medical_record_id")

        # Create prescription
        prescription = Prescription.objects.create(
            patient=patient,
            doctor=doctor,
            medical_record_id=medical_record_id,
            qr_code_path="",  # Will be set after QR generation
            security_hash="",  # Will be set after QR generation
        )

        # Generate security hash
        security_hash = PrescriptionService.generate_security_hash(str(prescription.id))
        prescription.security_hash = security_hash

        # Generate QR code
        media_root = settings.MEDIA_ROOT
        qr_path = f"{media_root}/qr_codes/prescriptions/{prescription.id}.png"
        PrescriptionService.generate_qr_code(str(prescription.id), security_hash, qr_path)
        prescription.qr_code_path = qr_path
        prescription.save(update_fields=["security_hash", "qr_code_path"])

        # Create prescription medicines
        for med_data in medicines_data:
            PrescriptionMedicine.objects.create(prescription=prescription, **med_data)

        # Log prescription creation
        from accounts.audit import AuditService

        AuditService.log_event(
            event_type="prescription_created",
            action="Doctor created prescription",
            user=doctor,
            resource_type="Prescription",
            resource_id=str(prescription.id),
            details={"patient_name": patient.name, "medicine_count": len(medicines_data)},
        )

        return prescription


class CheckInteractionsSerializer(serializers.Serializer):
    """Check drug interactions for a list of medicines."""

    medicine_ids = serializers.ListField(child=serializers.UUIDField(), min_length=2)

    def validate_medicine_ids(self, value):
        existing_count = Medicine.objects.filter(id__in=value, is_active=True).count()
        if existing_count != len(value):
            raise serializers.ValidationError("One or more medicines are invalid or inactive")
        return value

    def check_interactions(self):
        medicine_ids = self.validated_data["medicine_ids"]
        return PrescriptionService.check_drug_interactions(medicine_ids)


class CheckAllergiesSerializer(serializers.Serializer):
    """Check patient allergies for a list of medicines."""

    patient_id = serializers.UUIDField()
    medicine_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)

    def validate_patient_id(self, value):
        try:
            profile = Profile.objects.get(id=value)
        except Profile.DoesNotExist:
            raise serializers.ValidationError("Patient not found")
        self.context["patient_profile"] = profile
        return value

    def validate_medicine_ids(self, value):
        existing_count = Medicine.objects.filter(id__in=value, is_active=True).count()
        if existing_count != len(value):
            raise serializers.ValidationError("One or more medicines are invalid or inactive")
        return value

    def check_allergies(self):
        patient = self.context["patient_profile"]
        medicine_ids = self.validated_data["medicine_ids"]
        return PrescriptionService.check_patient_allergies(patient, medicine_ids)
