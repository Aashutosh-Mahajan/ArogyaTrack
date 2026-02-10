from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DispensingRecord, Pharmacy
from .serializers import DispenseMedicineSerializer, DispensingRecordSerializer, PharmacySerializer, ScanPrescriptionSerializer


class ScanPrescriptionView(APIView):
    """Pharmacist scans prescription QR code."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ScanPrescriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prescription_data = serializer.get_prescription_data()

        return Response(prescription_data, status=status.HTTP_200_OK)


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
        pharmacy = get_object_or_404(Pharmacy, owner=request.user, is_active=True)

        records = DispensingRecord.objects.filter(pharmacy=pharmacy).order_by("-dispensed_at")[:100]

        return Response(DispensingRecordSerializer(records, many=True).data)


class PharmacyDetailView(APIView):
    """Get pharmacy details."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        pharmacy = get_object_or_404(Pharmacy, owner=request.user)
        return Response(PharmacySerializer(pharmacy).data)
