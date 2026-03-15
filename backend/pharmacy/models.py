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
    district = models.CharField(max_length=120, blank=True, db_index=True)
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pharmacies")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Pharmacies"
        indexes = [
            models.Index(fields=["district"]),
        ]

    def __str__(self):
        return self.name


class DispensingRecord(models.Model):
    """Record of medicine dispensing."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prescription = models.ForeignKey("prescriptions.Prescription", on_delete=models.CASCADE, related_name="dispensing_records")
    prescription_medicine = models.ForeignKey(
        "prescriptions.PrescriptionMedicine", on_delete=models.CASCADE, related_name="dispensing_records"
    )
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.SET_NULL, null=True, blank=True, related_name="dispensing_records")
    pharmacist = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dispensing_records")
    status = models.CharField(max_length=20)  # dispensed, unavailable, patient_has
    quantity_dispensed = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    dispensed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-dispensed_at"]

    def __str__(self):
        return f"{self.prescription_medicine.medicine.name} - {self.status}"


class PharmacyInventory(models.Model):
    """Inventory management for pharmacies."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name="inventory")
    medicine = models.ForeignKey("prescriptions.Medicine", on_delete=models.CASCADE, related_name="pharmacy_inventory")
    
    # Stock details
    quantity_in_stock = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=10)
    
    # Pricing
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Batch & Expiry
    batch_number = models.CharField(max_length=50, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["medicine__name"]
        indexes = [
            models.Index(fields=["pharmacy", "medicine"]),
            models.Index(fields=["expiry_date"]),
        ]

    def __str__(self):
        return f"{self.medicine.name} ({self.quantity_in_stock})"
