import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Pharmacy(models.Model):
    """Pharmacy registration."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    license_number = models.CharField(max_length=100, unique=True)
    address = models.TextField()
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pharmacies")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Pharmacies"

    def __str__(self):
        return self.name


class DispensingRecord(models.Model):
    """Record of medicine dispensing."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prescription = models.ForeignKey("prescriptions.Prescription", on_delete=models.CASCADE, related_name="dispensing_records")
    prescription_medicine = models.ForeignKey(
        "prescriptions.PrescriptionMedicine", on_delete=models.CASCADE, related_name="dispensing_records"
    )
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name="dispensing_records")
    pharmacist = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dispensing_records")
    status = models.CharField(max_length=20)  # dispensed, unavailable, patient_has
    quantity_dispensed = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    dispensed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-dispensed_at"]

    def __str__(self):
        return f"{self.prescription_medicine.medicine.name} - {self.status}"
