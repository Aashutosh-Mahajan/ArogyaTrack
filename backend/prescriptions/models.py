import hashlib
import hmac
import uuid
from pathlib import Path

from django.conf import settings
from django.db import models
from django.utils import timezone


class Medicine(models.Model):
    """Medicine database with standard dosages and drug information."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    generic_name = models.CharField(max_length=255)
    drug_class = models.CharField(max_length=100)
    therapeutic_category = models.CharField(max_length=100)
    standard_dosages = models.JSONField(default=dict)  # {"adult": "500mg", "child": "250mg"}
    allergens = models.JSONField(default=list)  # List of common allergens
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name", "generic_name"])]

    def __str__(self):
        return f"{self.name} ({self.generic_name})"


class DrugInteraction(models.Model):
    """Drug interaction database."""

    class Severity(models.TextChoices):
        MINOR = "minor", "Minor"
        MODERATE = "moderate", "Moderate"
        MAJOR = "major", "Major"
        CONTRAINDICATED = "contraindicated", "Contraindicated"

    medicine_a = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name="interactions_as_a")
    medicine_b = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name="interactions_as_b")
    severity = models.CharField(max_length=20, choices=Severity.choices)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("medicine_a", "medicine_b")
        indexes = [models.Index(fields=["medicine_a", "medicine_b"])]

    def __str__(self):
        return f"{self.medicine_a.name} + {self.medicine_b.name} ({self.severity})"


class Prescription(models.Model):
    """Digital prescription with QR code."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PARTIALLY_DISPENSED = "partially_dispensed", "Partially Dispensed"
        FULLY_DISPENSED = "fully_dispensed", "Fully Dispensed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey("patients.Profile", on_delete=models.CASCADE, related_name="prescriptions")
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="prescriptions")
    medical_record = models.ForeignKey(
        "medical.MedicalRecord", on_delete=models.SET_NULL, null=True, blank=True, related_name="prescriptions"
    )
    qr_code_path = models.CharField(max_length=255)
    security_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Prescription {self.id} for {self.patient.name}"


class PrescriptionMedicine(models.Model):
    """Medicines in a prescription."""

    class DispenseStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        DISPENSED = "dispensed", "Dispensed"
        UNAVAILABLE = "unavailable", "Unavailable"
        PATIENT_HAS = "patient_has", "Patient Already Has"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name="medicines")
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE)
    dosage = models.CharField(max_length=100)  # "500mg"
    frequency = models.CharField(max_length=100)  # "3 times daily"
    duration_days = models.PositiveIntegerField()
    quantity = models.PositiveIntegerField()
    special_instructions = models.TextField(blank=True)
    dispense_status = models.CharField(max_length=20, choices=DispenseStatus.choices, default=DispenseStatus.PENDING)
    dispensed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.medicine.name} - {self.dosage}"


class PrescriptionService:
    """Service for prescription operations."""

    @staticmethod
    def generate_security_hash(prescription_id: str) -> str:
        """Generate HMAC-SHA256 security hash for prescription."""
        secret = settings.SECRET_KEY.encode("utf-8")
        message = str(prescription_id).encode("utf-8")
        return hmac.new(secret, message, hashlib.sha256).hexdigest()

    @staticmethod
    def validate_security_hash(prescription_id: str, provided_hash: str) -> bool:
        """Validate prescription security hash."""
        expected_hash = PrescriptionService.generate_security_hash(prescription_id)
        return hmac.compare_digest(expected_hash, provided_hash)

    @staticmethod
    def generate_qr_code(prescription_id: str, security_hash: str, file_path: str) -> str:
        """Generate QR code for prescription."""
        import qrcode

        # QR data contains prescription ID and security hash
        qr_data = f"{prescription_id}|{security_hash}"

        path_obj = Path(file_path)
        path_obj.parent.mkdir(parents=True, exist_ok=True)

        img = qrcode.make(qr_data)
        img.save(path_obj)

        return file_path

    @staticmethod
    def check_drug_interactions(medicine_ids: list) -> list:
        """Check for drug interactions between medicines."""
        interactions = []

        for i, med_a_id in enumerate(medicine_ids):
            for med_b_id in medicine_ids[i + 1 :]:
                # Check both directions
                interaction = DrugInteraction.objects.filter(
                    models.Q(medicine_a_id=med_a_id, medicine_b_id=med_b_id)
                    | models.Q(medicine_a_id=med_b_id, medicine_b_id=med_a_id)
                ).first()

                if interaction:
                    interactions.append(
                        {
                            "medicine_a": interaction.medicine_a.name,
                            "medicine_b": interaction.medicine_b.name,
                            "severity": interaction.severity,
                            "description": interaction.description,
                        }
                    )

        return interactions

    @staticmethod
    def check_patient_allergies(patient, medicine_ids: list) -> list:
        """Check if patient is allergic to any prescribed medicines."""
        from medical.models import Allergy

        alerts = []
        patient_allergies = Allergy.objects.filter(profile=patient).values_list("allergen", flat=True)

        for medicine_id in medicine_ids:
            medicine = Medicine.objects.get(id=medicine_id)
            for allergen in medicine.allergens:
                if allergen.lower() in [a.lower() for a in patient_allergies]:
                    alerts.append(
                        {
                            "medicine": medicine.name,
                            "allergen": allergen,
                            "severity": "high",
                            "message": f"Patient is allergic to {allergen} found in {medicine.name}",
                        }
                    )

        return alerts

    @staticmethod
    def update_prescription_status(prescription: Prescription) -> None:
        """Update prescription status based on medicine dispense status."""
        medicines = prescription.medicines.all()
        total = medicines.count()

        if total == 0:
            return

        dispensed = medicines.filter(dispense_status=PrescriptionMedicine.DispenseStatus.DISPENSED).count()

        if dispensed == total:
            prescription.status = Prescription.Status.FULLY_DISPENSED
        elif dispensed > 0:
            prescription.status = Prescription.Status.PARTIALLY_DISPENSED
        else:
            prescription.status = Prescription.Status.PENDING

        prescription.save(update_fields=["status", "updated_at"])
