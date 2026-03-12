from collections import OrderedDict

import jwt
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from patients.models import Profile
from prescriptions.models import Prescription, PrescriptionMedicine
from prescriptions.serializers import PrescriptionSerializer, PrescriptionMedicineSerializer

from .models import DispensingRecord, Pharmacy, PharmacyInventory
from .serializers import DispenseMedicineSerializer, DispensingRecordSerializer, PharmacySerializer, PharmacyInventorySerializer, ScanPrescriptionSerializer, UpdateStockSerializer


class ScanPrescriptionView(APIView):
    """Pharmacist scans prescription QR code."""

    permission_classes = [permissions.IsAuthenticated]

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

    permission_classes = [permissions.IsAuthenticated]

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
                profile = Profile.objects.select_related("user", "health_card").get(
                    patient_id=patient_id_input
                )
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
            if hasattr(profile, "health_card"):
                card = profile.health_card
                if card and not card.is_active():
                    return Response(
                        {"detail": "This health card has expired or been revoked."},
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

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Get pharmacy for current user (if pharmacist owns a pharmacy)
        pharmacy = Pharmacy.objects.filter(owner=request.user, is_active=True).first()

        serializer = DispenseMedicineSerializer(data=request.data, context={"request": request, "pharmacy": pharmacy})
        serializer.is_valid(raise_exception=True)
        record = serializer.save()

        return Response(DispensingRecordSerializer(record).data, status=status.HTTP_201_CREATED)


class DispensingHistoryView(APIView):
    """Get dispensing history for a pharmacy."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Get pharmacy for current user
        try:
            pharmacy = Pharmacy.objects.get(owner=request.user, is_active=True)
        except Pharmacy.DoesNotExist:
            return Response([])

        records = DispensingRecord.objects.filter(pharmacy=pharmacy).order_by("-dispensed_at")[:100]

        return Response(DispensingRecordSerializer(records, many=True).data)


class PharmacyDetailView(APIView):
    """Get pharmacy details."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        pharmacy = get_object_or_404(Pharmacy, owner=request.user)

class PharmacyInventoryView(APIView):
    """
    Manage pharmacy inventory.
    GET: List all items or filter by low stock.
    POST: Add new item.
    """
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get_pharmacy(self, request):
        return get_object_or_404(Pharmacy, owner=request.user)

    def get(self, request):
        try:
            pharmacy = Pharmacy.objects.get(owner=request.user)
        except Pharmacy.DoesNotExist:
            return Response([])

        queryset = PharmacyInventory.objects.filter(pharmacy=pharmacy)
        
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

    permission_classes = [permissions.IsAuthenticated]

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
                "trend": trend,
            }
        )


class UpdateStockView(APIView):
    """
    Pharmacist adds received stock to an existing inventory item.
    POST /api/pharmacy/update-stock/
    """

    permission_classes = [permissions.IsAuthenticated]

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
