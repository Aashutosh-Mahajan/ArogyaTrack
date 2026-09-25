from collections import OrderedDict

import jwt
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsPharmacist

from patients.models import Profile
from prescriptions.models import Prescription, PrescriptionMedicine
from prescriptions.serializers import PrescriptionSerializer, PrescriptionMedicineSerializer

from .billing import allocate_gst
from .models import DispensingRecord, Invoice, Pharmacy, PharmacyInventory
from .serializers import CreateInvoiceSerializer, DispenseMedicineSerializer, DispensingRecordSerializer, InvoiceSerializer, PharmacySerializer, PharmacyInventorySerializer, ScanPrescriptionSerializer, UpdateStockSerializer


class ScanPrescriptionView(APIView):
    """Pharmacist scans prescription QR code."""

    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def post(self, request):
        serializer = ScanPrescriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prescription_data = serializer.get_prescription_data()

        return Response(prescription_data, status=status.HTTP_200_OK)


class PharmacyScanPatientView(APIView):
    """
    Pharmacist scans a patient's health-card QR code.
    Returns patient info and ALL prescriptions grouped by doctor.
    """

    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def post(self, request):
        # Only pharmacists (and admins) may use this endpoint
        if request.user.role not in ("pharmacist", "admin"):
            return Response(
                {"detail": "Only pharmacists can use this endpoint."},
                status=status.HTTP_403_FORBIDDEN,
            )

        token = request.data.get("token")
        patient_id_input = request.data.get("patient_id")

        if not token and not patient_id_input:
            return Response(
                {"detail": "QR token or Patient ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            profile = None
            if patient_id_input:
                patient_id_input = patient_id_input.strip()

                # 1) Exact match on patient_id (case-insensitive)
                profile = (
                    Profile.objects.select_related("user", "health_card")
                    .filter(patient_id__iexact=patient_id_input)
                    .first()
                )

                # 2) Fallback: try as UUID (profile.id)
                if profile is None:
                    try:
                        import uuid as _uuid
                        val = _uuid.UUID(patient_id_input)
                        profile = (
                            Profile.objects.select_related("user", "health_card")
                            .filter(id=val)
                            .first()
                        )
                    except (ValueError, AttributeError):
                        pass

                if profile is None:
                    raise Profile.DoesNotExist
            else:
                payload = jwt.decode(
                    token,
                    settings.SIMPLE_JWT.get("SIGNING_KEY"),
                    algorithms=[settings.SIMPLE_JWT.get("ALGORITHM", "HS256")],
                )
                pid = payload.get("patient_id")
                if not pid:
                    return Response(
                        {"detail": "Invalid QR code format."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                profile = Profile.objects.select_related("user", "health_card").get(id=pid)

            # Validate health card
            card = getattr(profile, "health_card", None)
            if card and not card.is_active():
                return Response(
                    {"detail": "This health card has expired or been revoked."},
                    status=status.HTTP_410_GONE,
                )
            if token and not patient_id_input and (card is None or card.token != token):
                return Response(
                    {"detail": "This QR belongs to a card that has been replaced. Ask the patient for their current card."},
                    status=status.HTTP_410_GONE,
                )

            # Fetch all prescriptions that are not fully dispensed
            prescriptions = (
                Prescription.objects.filter(patient=profile)
                .select_related("doctor")
                .prefetch_related("medicines__medicine")
                .order_by("-created_at")
            )

            # Group prescriptions by doctor
            doctors_map = OrderedDict()
            for rx in prescriptions:
                doctor = rx.doctor
                doc_key = str(doctor.id)
                if doc_key not in doctors_map:
                    first = doctor.get_first_name() if hasattr(doctor, "get_first_name") else ""
                    last = doctor.get_last_name() if hasattr(doctor, "get_last_name") else ""
                    full_name = f"{first} {last}".strip() or doctor.email
                    doctors_map[doc_key] = {
                        "doctor_id": str(doctor.id),
                        "doctor_name": full_name,
                        "prescriptions": [],
                    }
                rx_data = PrescriptionSerializer(rx).data
                doctors_map[doc_key]["prescriptions"].append(rx_data)

            # Profile photo URL
            profile_photo_url = None
            if profile.profile_photo:
                profile_photo_url = request.build_absolute_uri(profile.profile_photo.url)

            return Response(
                {
                    "patient": {
                        "id": str(profile.id),
                        "unique_patient_id": profile.patient_id or "N/A",
                        "name": profile.name,
                        "age": profile.age,
                        "gender": profile.gender,
                        "blood_group": profile.blood_group,
                        "profile_photo_url": profile_photo_url,
                    },
                    "doctors": list(doctors_map.values()),
                }
            )

        except jwt.ExpiredSignatureError:
            return Response({"detail": "This QR code has expired."}, status=status.HTTP_410_GONE)
        except jwt.InvalidTokenError:
            return Response({"detail": "Invalid QR code."}, status=status.HTTP_400_BAD_REQUEST)
        except Profile.DoesNotExist:
            return Response({"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response(
                {"detail": f"Error processing QR code: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DispenseMedicineView(APIView):
    """Pharmacist dispenses a medicine from prescription."""

    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def post(self, request):
        pharmacy = Pharmacy.objects.filter(owner=request.user, is_active=True).first()
        if pharmacy is None:
            return Response(
                {"detail": "Set up your pharmacy before dispensing.", "code": "pharmacy_missing"},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = DispenseMedicineSerializer(data=request.data, context={"request": request, "pharmacy": pharmacy})
        serializer.is_valid(raise_exception=True)
        record = serializer.save()

        return Response(DispensingRecordSerializer(record).data, status=status.HTTP_201_CREATED)


class DispensingHistoryView(APIView):
    """Get dispensing history for a pharmacy."""

    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def get(self, request):
        # Get pharmacy for current user
        try:
            pharmacy = Pharmacy.objects.get(owner=request.user, is_active=True)
        except Pharmacy.DoesNotExist:
            return Response([])

        records = (
            DispensingRecord.objects.filter(pharmacy=pharmacy)
            .select_related("prescription__patient", "prescription_medicine__medicine", "pharmacy")
            .order_by("-dispensed_at")[: min(int(request.query_params.get("limit", 200)), 500)]
        )

        return Response(DispensingRecordSerializer(records, many=True).data)


class PharmacyDetailView(APIView):
    """The signed-in pharmacist's own pharmacy: read, create once, or update."""

    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def get(self, request):
        pharmacy = Pharmacy.objects.filter(owner=request.user).first()
        if pharmacy is None:
            return Response({"detail": "No pharmacy set up yet.", "code": "pharmacy_missing"}, status=status.HTTP_404_NOT_FOUND)
        return Response(PharmacySerializer(pharmacy).data)

    def post(self, request):
        if Pharmacy.objects.filter(owner=request.user).exists():
            return Response({"detail": "You already have a pharmacy. Update it instead."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = PharmacySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pharmacy = serializer.save(owner=request.user, is_active=True)
        return Response(PharmacySerializer(pharmacy).data, status=status.HTTP_201_CREATED)

    def patch(self, request):
        pharmacy = get_object_or_404(Pharmacy, owner=request.user)
        serializer = PharmacySerializer(pharmacy, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(PharmacySerializer(serializer.save()).data)


class PharmacyInventoryView(APIView):
    """
    Manage pharmacy inventory.
    GET: List all items or filter by low stock.
    POST: Add new item.
    """
    
    permission_classes = [permissions.IsAuthenticated, IsPharmacist]
    
    def get_pharmacy(self, request):
        return get_object_or_404(Pharmacy, owner=request.user)

    def get_queryset_for(self, pharmacy):
        return PharmacyInventory.objects.filter(pharmacy=pharmacy).select_related("medicine").order_by("medicine__name", "expiry_date")

    def get(self, request):
        try:
            pharmacy = Pharmacy.objects.get(owner=request.user)
        except Pharmacy.DoesNotExist:
            return Response([])

        queryset = self.get_queryset_for(pharmacy)
        
        # Filter: Low Stock
        if request.query_params.get("low_stock") == "true":
            from django.db.models import F
            queryset = queryset.filter(quantity_in_stock__lte=F("low_stock_threshold"))
            
        return Response(PharmacyInventorySerializer(queryset, many=True).data)

    def post(self, request):
        pharmacy = self.get_pharmacy(request)
        serializer = PharmacyInventorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(pharmacy=pharmacy)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PharmacyDashboardStatsView(APIView):
    """Return real KPI stats and 7-day dispensing trend for the pharmacist dashboard."""

    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def get(self, request):
        from datetime import timedelta
        from django.db.models import Count, F
        from django.db.models.functions import TruncDate

        try:
            pharmacy = Pharmacy.objects.get(owner=request.user, is_active=True)
        except Pharmacy.DoesNotExist:
            return Response(
                {
                    "total_dispensed": 0,
                    "today_dispensed": 0,
                    "low_stock_count": 0,
                    "pending_prescriptions": 0,
                    "billed_today": "0.00",
                    "invoices_today": 0,
                    "unbilled_amount": "0.00",
                    "trend": [],
                }
            )

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Total dispensed (all time)
        total_dispensed = DispensingRecord.objects.filter(pharmacy=pharmacy, status="dispensed").count()

        # Today's dispensed count
        today_dispensed = DispensingRecord.objects.filter(
            pharmacy=pharmacy, status="dispensed", dispensed_at__gte=today_start
        ).count()

        # Low stock items
        low_stock_count = PharmacyInventory.objects.filter(
            pharmacy=pharmacy, quantity_in_stock__lte=F("low_stock_threshold")
        ).count()

        # Pending prescriptions (ones dispensed through this pharmacy that still have pending medicines)
        pending_prescriptions = (
            Prescription.objects.filter(
                status__in=[Prescription.Status.PENDING, Prescription.Status.PARTIALLY_DISPENSED],
                dispensing_records__pharmacy=pharmacy,
            )
            .distinct()
            .count()
        )

        from django.db.models import Sum

        billed = Invoice.objects.filter(pharmacy=pharmacy, created_at__gte=today_start).aggregate(total=Sum("total"), n=Count("id"))
        unbilled = DispensingRecord.objects.filter(
            pharmacy=pharmacy, status="dispensed", invoice__isnull=True, amount__isnull=False
        ).aggregate(total=Sum("amount"))

        # 7-day trend
        seven_days_ago = now - timedelta(days=7)
        trend_qs = (
            DispensingRecord.objects.filter(pharmacy=pharmacy, dispensed_at__gte=seven_days_ago)
            .annotate(day=TruncDate("dispensed_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        # Build full 7-day list (fill missing days with 0)
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        trend_map = {row["day"]: row["count"] for row in trend_qs}
        trend = []
        for i in range(7):
            d = (now - timedelta(days=6 - i)).date()
            trend.append({"name": day_names[d.weekday()], "date": str(d), "dispensed": trend_map.get(d, 0)})

        return Response(
            {
                "total_dispensed": total_dispensed,
                "today_dispensed": today_dispensed,
                "low_stock_count": low_stock_count,
                "pending_prescriptions": pending_prescriptions,
                "billed_today": str(billed["total"] or "0.00"),
                "invoices_today": billed["n"],
                "unbilled_amount": str(unbilled["total"] or "0.00"),
                "trend": trend,
            }
        )


class UpdateStockView(APIView):
    """
    Pharmacist adds received stock to an existing inventory item.
    POST /api/pharmacy/update-stock/
    """

    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def post(self, request):
        pharmacy = Pharmacy.objects.filter(owner=request.user, is_active=True).first()
        if not pharmacy:
            return Response(
                {"detail": "No pharmacy found for this user."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = UpdateStockSerializer(
            data=request.data, context={"request": request, "pharmacy": pharmacy}
        )
        serializer.is_valid(raise_exception=True)
        item = serializer.save()

        return Response(
            PharmacyInventorySerializer(item).data, status=status.HTTP_200_OK
        )


class PharmacyInventoryItemView(APIView):
    """PATCH or DELETE one inventory line of the pharmacist's own pharmacy."""

    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def _item(self, request, item_id):
        return get_object_or_404(PharmacyInventory, id=item_id, pharmacy__owner=request.user)

    def patch(self, request, item_id):
        item = self._item(request, item_id)
        serializer = PharmacyInventorySerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return Response(PharmacyInventorySerializer(serializer.save()).data)

    def delete(self, request, item_id):
        self._item(request, item_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PharmacyListView(APIView):
    """List all active pharmacies (for doctors selecting a target pharmacy)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        search = request.query_params.get("search", "").strip()
        qs = Pharmacy.objects.filter(is_active=True)
        if search:
            qs = qs.filter(name__icontains=search)
        qs = qs[:50]
        return Response(PharmacySerializer(qs, many=True).data)


def _my_pharmacy(user):
    return Pharmacy.objects.filter(owner=user, is_active=True).first()


def _invoice_queryset():
    return Invoice.objects.select_related(
        "pharmacy", "pharmacist", "patient", "prescription__doctor"
    ).prefetch_related("items__prescription_medicine__medicine")


def _new_invoice_number():
    import secrets

    while True:
        from documents.layout import local_time

        number = f"INV-{local_time():%y%m%d}-{secrets.token_hex(3).upper()}"
        if not Invoice.objects.filter(invoice_number=number).exists():
            return number


class PrescriptionBillingView(APIView):
    """GET /api/pharmacy/billing/<prescription_id>/

    What this pharmacy has dispensed against a prescription and not billed
    yet, plus the invoices it has already issued for it.
    """

    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def get(self, request, prescription_id):
        from .serializers import InvoiceItemSerializer

        pharmacy = _my_pharmacy(request.user)
        if pharmacy is None:
            return Response({"detail": "Set up your pharmacy first.", "code": "pharmacy_missing"}, status=status.HTTP_409_CONFLICT)
        unbilled = list(
            DispensingRecord.objects.filter(
                pharmacy=pharmacy, prescription_id=prescription_id, status="dispensed", invoice__isnull=True
            )
            .select_related("prescription_medicine__medicine")
            .order_by("dispensed_at")
        )
        subtotal = sum((r.amount or 0) for r in unbilled)
        invoices = _invoice_queryset().filter(pharmacy=pharmacy, prescription_id=prescription_id)
        return Response(
            {
                "unbilled_items": InvoiceItemSerializer(unbilled, many=True).data,
                "unbilled_subtotal": f"{subtotal:.2f}",
                "unpriced_items": sum(1 for r in unbilled if r.amount is None),
                "invoices": InvoiceSerializer(invoices, many=True).data,
            }
        )


class InvoiceListCreateView(APIView):
    """GET/POST /api/pharmacy/invoices/

    POST bills every item this pharmacy dispensed against the prescription
    that is not on an invoice yet. Prices were fixed at dispense time from
    the batches the stock came out of.
    """

    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def get(self, request):
        pharmacy = _my_pharmacy(request.user)
        if pharmacy is None:
            return Response([])
        qs = _invoice_queryset().filter(pharmacy=pharmacy)
        q = (request.query_params.get("search") or "").strip()
        if q:
            from django.db.models import Q

            qs = qs.filter(Q(invoice_number__icontains=q) | Q(patient__name__icontains=q) | Q(patient__patient_id__icontains=q))
        limit = min(int(request.query_params.get("limit", 200)), 500)
        return Response(InvoiceSerializer(qs[:limit], many=True).data)

    def post(self, request):
        from decimal import Decimal

        from django.db import transaction

        pharmacy = _my_pharmacy(request.user)
        if pharmacy is None:
            return Response({"detail": "Set up your pharmacy first.", "code": "pharmacy_missing"}, status=status.HTTP_409_CONFLICT)
        serializer = CreateInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            # Lock the rows so a double click cannot bill the same items twice.
            records = list(
                DispensingRecord.objects.select_for_update()
                .filter(pharmacy=pharmacy, prescription_id=data["prescription_id"], status="dispensed", invoice__isnull=True)
                .select_related("prescription", "prescription_medicine__medicine")
                .order_by("dispensed_at")
            )
            if not records:
                return Response(
                    {"detail": "Nothing to bill: every item dispensed on this prescription is already invoiced."},
                    status=status.HTTP_409_CONFLICT,
                )
            subtotal = sum((r.amount or Decimal("0")) for r in records)
            discount = data["discount"]
            if discount > subtotal:
                return Response({"discount": ["Discount cannot be more than the bill."]}, status=status.HTTP_400_BAD_REQUEST)
            prescription = records[0].prescription
            total = subtotal - discount
            taxable_value, cgst, sgst = allocate_gst(records, subtotal, total)
            invoice = Invoice.objects.create(
                invoice_number=_new_invoice_number(),
                pharmacy=pharmacy,
                pharmacist=request.user,
                prescription=prescription,
                patient=prescription.patient,
                subtotal=subtotal,
                discount=discount,
                total=total,
                taxable_value=taxable_value,
                cgst=cgst,
                sgst=sgst,
                payment_method=data["payment_method"],
            )
            for r in records:
                r.invoice = invoice
            DispensingRecord.objects.bulk_update(
                records, ["invoice", "hsn_code", "gst_rate", "taxable_value", "tax_amount"]
            )

            from accounts.audit import AuditService

            AuditService.log_event(
                event_type="invoice_created",
                action=f"Issued invoice {invoice.invoice_number}",
                user=request.user,
                resource_type="Invoice",
                resource_id=str(invoice.id),
                details={"total": str(invoice.total), "items": len(records), "pharmacy": pharmacy.name},
            )

        return Response(InvoiceSerializer(_invoice_queryset().get(id=invoice.id)).data, status=status.HTTP_201_CREATED)


class InvoiceDetailView(APIView):
    """GET /api/pharmacy/invoices/<id>/"""

    permission_classes = [permissions.IsAuthenticated, IsPharmacist]

    def get(self, request, invoice_id):
        invoice = get_object_or_404(_invoice_queryset(), id=invoice_id, pharmacy__owner=request.user)
        return Response(InvoiceSerializer(invoice).data)
