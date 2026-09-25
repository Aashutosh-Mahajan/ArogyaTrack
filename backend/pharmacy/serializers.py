from decimal import Decimal

from django.db import transaction

from rest_framework import serializers

from prescriptions.models import Prescription, PrescriptionMedicine, PrescriptionService
from adherence.services import AdherenceService

from .models import DispensingRecord, Invoice, Pharmacy, PharmacyInventory


class PharmacySerializer(serializers.ModelSerializer):
    class Meta:
        model = Pharmacy
        fields = ["id", "name", "license_number", "address", "district", "phone", "email", "gstin", "is_active"]
        read_only_fields = ["id", "is_active"]

    def validate_gstin(self, value):
        # 2-digit state code, 10-character PAN, entity number, 'Z', checksum.
        import re

        value = (value or "").strip().upper()
        if value and not re.fullmatch(r"\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]", value):
            raise serializers.ValidationError("Enter a valid 15-character GSTIN, e.g. 29ABCDE1234F1Z5.")
        return value


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

        pharmacist = self.context["request"].user
        pharmacy = self.context.get("pharmacy")

        status_map = {
            "dispensed": PrescriptionMedicine.DispenseStatus.DISPENSED,
            "unavailable": PrescriptionMedicine.DispenseStatus.UNAVAILABLE,
            "patient_has": PrescriptionMedicine.DispenseStatus.PATIENT_HAS,
        }

        with transaction.atomic():
            # Re-fetch and lock the row: validate() ran before this transaction
            # started, so without a lock + re-check here, two concurrent dispense
            # requests for the same medicine could both pass the "not yet
            # dispensed" check and double-dispense.
            pm = PrescriptionMedicine.objects.select_for_update().get(
                id=self.context["prescription_medicine"].id
            )
            if pm.dispense_status == PrescriptionMedicine.DispenseStatus.DISPENSED:
                raise serializers.ValidationError("This medicine has already been dispensed")

            unit_price = amount = None
            if self.validated_data["status"] == "dispensed":
                quantity = self.validated_data.get("quantity_dispensed") or pm.quantity
                amount = self._deduct_stock(pharmacy, pm.medicine, quantity)
                if amount is not None:
                    unit_price = (amount / quantity).quantize(Decimal("0.01"))

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
                unit_price=unit_price,
                amount=amount,
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
                tracker = getattr(prescription, "adherence_tracker", None)
                has_dispensed = prescription.medicines.filter(
                    dispense_status=PrescriptionMedicine.DispenseStatus.DISPENSED
                ).exists()

                if has_dispensed and tracker is None:
                    # Create adherence tracker once per prescription after first dispense
                    AdherenceService.activate_tracker(prescription)
                elif tracker is not None and pm.dispense_status == PrescriptionMedicine.DispenseStatus.DISPENSED:
                    # Later items join the existing tracker's dose schedule
                    AdherenceService.add_dispensed_medicine(tracker, pm)

        return record


def _deduct_stock_impl(pharmacy, medicine, quantity):
    """Take `quantity` units from unexpired batches, earliest expiry first.

    Returns what those units cost at each batch's unit price, or None when
    none of the batches used has a price. Unpriced batches count as zero.
    """
    from django.db.models import Q
    from django.utils import timezone

    today = timezone.localdate()
    batches = list(
        PharmacyInventory.objects.select_for_update()
        .filter(pharmacy=pharmacy, medicine=medicine, quantity_in_stock__gt=0)
        .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gte=today))
        .order_by("expiry_date")
    )
    available = sum(b.quantity_in_stock for b in batches)
    if available < quantity:
        raise serializers.ValidationError(
            f"Only {available} unit{'s' if available != 1 else ''} of {medicine.name} in stock (unexpired). "
            "Mark it unavailable or add stock first."
        )
    remaining = quantity
    cost, priced = Decimal("0"), False
    for b in batches:
        take = min(b.quantity_in_stock, remaining)
        b.quantity_in_stock -= take
        b.save(update_fields=["quantity_in_stock", "updated_at"])
        if b.unit_price is not None:
            cost += b.unit_price * take
            priced = True
        remaining -= take
        if remaining == 0:
            break
    return cost.quantize(Decimal("0.01")) if priced else None


DispenseMedicineSerializer._deduct_stock = staticmethod(_deduct_stock_impl)


class DispensingRecordSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="prescription_medicine.medicine.name", read_only=True)
    pharmacy_name = serializers.CharField(source="pharmacy.name", read_only=True)
    patient_name = serializers.CharField(source="prescription.patient.name", read_only=True)
    patient_uid = serializers.CharField(source="prescription.patient.patient_id", read_only=True)
    prescription_number = serializers.SerializerMethodField()
    dosage = serializers.CharField(source="prescription_medicine.dosage", read_only=True)
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True, default=None)

    def get_prescription_number(self, obj):
        return f"RX-{str(obj.prescription_id)[:8].upper()}"

    class Meta:
        model = DispensingRecord
        fields = [
            "id",
            "prescription",
            "prescription_medicine",
            "medicine_name",
            "dosage",
            "patient_name",
            "patient_uid",
            "prescription_number",
            "pharmacy",
            "pharmacy_name",
            "pharmacist",
            "status",
            "quantity_dispensed",
            "notes",
            "dispensed_at",
            "unit_price",
            "amount",
            "invoice",
            "invoice_number",
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

    def validate_expiry_date(self, value):
        from django.utils import timezone
        if value and value < timezone.localdate() and not self.instance:
            raise serializers.ValidationError("This batch has already expired.")
        return value


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


class InvoiceItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="prescription_medicine.medicine.name", read_only=True)
    generic_name = serializers.CharField(source="prescription_medicine.medicine.generic_name", read_only=True)
    dosage = serializers.CharField(source="prescription_medicine.dosage", read_only=True)

    class Meta:
        model = DispensingRecord
        fields = [
            "id", "medicine_name", "generic_name", "dosage", "quantity_dispensed", "unit_price", "amount",
            "hsn_code", "gst_rate", "taxable_value", "tax_amount", "dispensed_at",
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    pharmacy = PharmacySerializer(read_only=True)
    patient_name = serializers.CharField(source="patient.name", read_only=True)
    patient_uid = serializers.CharField(source="patient.patient_id", read_only=True)
    patient_phone = serializers.CharField(source="patient.phone", read_only=True, default="")
    prescription_number = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    pharmacist_name = serializers.SerializerMethodField()
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id", "invoice_number", "created_at", "pharmacy", "pharmacist_name",
            "prescription", "prescription_number", "doctor_name",
            "patient_name", "patient_uid", "patient_phone",
            "items", "subtotal", "discount", "total", "taxable_value", "cgst", "sgst",
            "payment_method", "payment_method_display",
        ]

    def get_items(self, obj):
        # Listed in the order they were handed over (uses the prefetch cache).
        return InvoiceItemSerializer(sorted(obj.items.all(), key=lambda r: r.dispensed_at), many=True).data

    def get_prescription_number(self, obj):
        return f"RX-{str(obj.prescription_id)[:8].upper()}"

    def get_doctor_name(self, obj):
        d = obj.prescription.doctor
        name = f"{d.get_first_name()} {d.get_last_name()}".strip()
        return f"Dr. {name}" if name else d.email

    def get_pharmacist_name(self, obj):
        u = obj.pharmacist
        return f"{u.get_first_name()} {u.get_last_name()}".strip() or u.email


class CreateInvoiceSerializer(serializers.Serializer):
    prescription_id = serializers.UUIDField()
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False, default=Decimal("0"))
    payment_method = serializers.ChoiceField(choices=Invoice.PaymentMethod.choices, default=Invoice.PaymentMethod.CASH)
