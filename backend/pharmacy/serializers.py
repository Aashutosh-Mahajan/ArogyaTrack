from rest_framework import serializers

from prescriptions.models import Prescription, PrescriptionMedicine, PrescriptionService
from adherence.services import AdherenceService

from .models import DispensingRecord, Pharmacy, PharmacyInventory


class PharmacySerializer(serializers.ModelSerializer):
    class Meta:
        model = Pharmacy
        fields = ["id", "name", "license_number", "address", "phone", "email", "is_active"]
        read_only_fields = ["id"]


class ScanPrescriptionSerializer(serializers.Serializer):
    """Scan prescription QR code."""

    qr_data = serializers.CharField()

    def validate_qr_data(self, value):
        # QR data format: "prescription_id|security_hash"
        try:
            parts = value.split("|")
            if len(parts) != 2:
                raise serializers.ValidationError("Invalid QR code format")

            prescription_id, security_hash = parts

            # Validate prescription exists
            try:
                prescription = Prescription.objects.get(id=prescription_id)
            except Prescription.DoesNotExist:
                raise serializers.ValidationError("Prescription not found")

            # Validate security hash
            if not PrescriptionService.validate_security_hash(prescription_id, security_hash):
                raise serializers.ValidationError("Invalid or tampered prescription")

            # Check if already fully dispensed
            if prescription.status == Prescription.Status.FULLY_DISPENSED:
                self.context["warning"] = "This prescription has already been fully dispensed"

            self.context["prescription"] = prescription
            return value

        except Exception as e:
            raise serializers.ValidationError(f"Invalid QR code: {str(e)}")

    def get_prescription_data(self):
        prescription = self.context["prescription"]
        warning = self.context.get("warning")

        from prescriptions.serializers import PrescriptionSerializer

        return {"prescription": PrescriptionSerializer(prescription).data, "warning": warning}


class DispenseMedicineSerializer(serializers.Serializer):
    """Dispense a medicine from prescription."""

    prescription_medicine_id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=["dispensed", "unavailable", "patient_has"])
    quantity_dispensed = serializers.IntegerField(min_value=0, required=False, default=0)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_prescription_medicine_id(self, value):
        try:
            pm = PrescriptionMedicine.objects.get(id=value)
        except PrescriptionMedicine.DoesNotExist:
            raise serializers.ValidationError("Prescription medicine not found")

        self.context["prescription_medicine"] = pm
        return value

    def validate(self, attrs):
        pm = self.context["prescription_medicine"]

        # Check if already dispensed
        if pm.dispense_status == PrescriptionMedicine.DispenseStatus.DISPENSED:
            raise serializers.ValidationError("This medicine has already been dispensed")

        # Validate quantity for dispensed status
        if attrs["status"] == "dispensed":
            if attrs.get("quantity_dispensed", 0) == 0:
                attrs["quantity_dispensed"] = pm.quantity

        return attrs

    def save(self, **kwargs):
        from django.utils import timezone

        pm = self.context["prescription_medicine"]
        pharmacist = self.context["request"].user
        pharmacy = self.context.get("pharmacy")

        # Update prescription medicine status
        status_map = {
            "dispensed": PrescriptionMedicine.DispenseStatus.DISPENSED,
            "unavailable": PrescriptionMedicine.DispenseStatus.UNAVAILABLE,
            "patient_has": PrescriptionMedicine.DispenseStatus.PATIENT_HAS,
        }

        pm.dispense_status = status_map[self.validated_data["status"]]
        if pm.dispense_status == PrescriptionMedicine.DispenseStatus.DISPENSED:
            pm.dispensed_at = timezone.now()
        pm.save()

        # Create dispensing record
        record = DispensingRecord.objects.create(
            prescription=pm.prescription,
            prescription_medicine=pm,
            pharmacy=pharmacy,
            pharmacist=pharmacist,
            status=self.validated_data["status"],
            quantity_dispensed=self.validated_data.get("quantity_dispensed", 0),
            notes=self.validated_data.get("notes", ""),
        )

        # Update prescription status
        PrescriptionService.update_prescription_status(pm.prescription)

        # Log dispensing
        from accounts.audit import AuditService

        AuditService.log_event(
            event_type="prescription_dispensed",
            action="Pharmacist dispensed medicine",
            user=pharmacist,
            resource_type="Prescription",
            resource_id=str(pm.prescription.id),
            details={
                "medicine": pm.medicine.name,
                "status": self.validated_data["status"],
                "pharmacy": pharmacy.name if pharmacy else "Unknown",
            },
        )

        # Check if prescription is partially fulfilled
        if pm.prescription.status == Prescription.Status.PARTIALLY_DISPENSED:
            # TODO: Send notification to patient about partial fulfillment
            pass

        # Activate adherence tracker if fully or partially dispensed
        if pm.prescription.status in [Prescription.Status.FULLY_DISPENSED, Prescription.Status.PARTIALLY_DISPENSED]:
            prescription = pm.prescription
            has_tracker = hasattr(prescription, "adherence_tracker")
            has_dispensed = prescription.prescription_medicines.filter(
                dispense_status=PrescriptionMedicine.DispenseStatus.DISPENSED
            ).exists()

            if has_dispensed and not has_tracker:
                # Create adherence tracker once per prescription after first dispense
                AdherenceService.activate_tracker(prescription)

        return record


class DispensingRecordSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="prescription_medicine.medicine.name", read_only=True)
    pharmacy_name = serializers.CharField(source="pharmacy.name", read_only=True)

    class Meta:
        model = DispensingRecord
        fields = [
            "id",
            "prescription",
            "prescription_medicine",
            "medicine_name",
            "pharmacy",
            "pharmacy_name",
            "pharmacist",
            "status",
            "quantity_dispensed",
            "notes",
            "dispensed_at",
        ]
        read_only_fields = ["id", "dispensed_at"]


class PharmacyInventorySerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    medicine_generic = serializers.CharField(source="medicine.generic_name", read_only=True)
    
    class Meta:
        model = PharmacyInventory
        fields = [
            "id",
            "medicine",
            "medicine_name",
            "medicine_generic",
            "quantity_in_stock",
            "low_stock_threshold",
            "unit_price",
            "batch_number",
            "expiry_date",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]


class UpdateStockSerializer(serializers.Serializer):
    """Pharmacist updates stock quantity for an inventory item."""
    inventory_id = serializers.UUIDField()
    quantity_received = serializers.IntegerField(min_value=1)

    def validate_inventory_id(self, value):
        pharmacy = self.context.get("pharmacy")
        if not pharmacy:
            raise serializers.ValidationError("No pharmacy found for this user")
        try:
            item = PharmacyInventory.objects.get(id=value, pharmacy=pharmacy)
        except PharmacyInventory.DoesNotExist:
            raise serializers.ValidationError("Inventory item not found in your pharmacy")
        self.context["inventory_item"] = item
        return value

    def save(self, **kwargs):
        item = self.context["inventory_item"]
        item.quantity_in_stock += self.validated_data["quantity_received"]
        item.save(update_fields=["quantity_in_stock", "updated_at"])
        return item
