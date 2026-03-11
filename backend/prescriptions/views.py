from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsApprovedDoctor, IsDoctorVerified

from .models import Medicine, Prescription
from .serializers import (
    CheckAllergiesSerializer,
    CheckInteractionsSerializer,
    CreatePrescriptionSerializer,
    MedicineSerializer,
    PrescriptionSerializer,
)


class MedicineListView(APIView):
    """List all active medicines."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        search = request.query_params.get("search", "")
        medicines = Medicine.objects.filter(is_active=True)

        if search:
            medicines = medicines.filter(name__icontains=search) | medicines.filter(generic_name__icontains=search)

        medicines = medicines[:50]  # Limit results
        return Response(MedicineSerializer(medicines, many=True).data)


class CheckDrugInteractionsView(APIView):
    """Check drug interactions for a list of medicines."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CheckInteractionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        interactions = serializer.check_interactions()

        return Response({"interactions": interactions, "count": len(interactions)})


class CheckAllergiesView(APIView):
    """Check patient allergies for a list of medicines."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CheckAllergiesSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        alerts = serializer.check_allergies()

        return Response({"allergy_alerts": alerts, "count": len(alerts)})


class CreatePrescriptionView(APIView):
    """Doctor creates a prescription for a patient."""

    permission_classes = [permissions.IsAuthenticated, IsApprovedDoctor]

    def post(self, request):
        serializer = CreatePrescriptionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        # Get warnings from validation
        drug_interactions = serializer.context.get("drug_interactions", [])
        allergy_alerts = serializer.context.get("allergy_alerts", [])

        # Create prescription
        prescription = serializer.save()

        response_data = {
            "prescription": PrescriptionSerializer(prescription).data,
            "warnings": {"drug_interactions": drug_interactions, "allergy_alerts": allergy_alerts},
        }

        return Response(response_data, status=status.HTTP_201_CREATED)


class PrescriptionDetailView(APIView):
    """Get prescription details."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, prescription_id):
        prescription = get_object_or_404(Prescription, id=prescription_id)

        user = request.user
        if user.is_patient:
            if not user.profiles.filter(id=prescription.patient_id).exists():
                return Response({"detail": "You do not have access to this prescription"}, status=status.HTTP_403_FORBIDDEN)
        elif user.is_doctor:
            if prescription.doctor_id != user.id:
                return Response({"detail": "You do not have access to this prescription"}, status=status.HTTP_403_FORBIDDEN)
        # Pharmacists and Admins can view any prescription

        return Response(PrescriptionSerializer(prescription).data)


class PrescriptionQRImageView(APIView):
    """Download prescription QR code image."""

    permission_classes = [permissions.IsAuthenticated, IsDoctorVerified]

    def get(self, request, prescription_id):
        prescription = get_object_or_404(Prescription, id=prescription_id)

        user = request.user
        if user.is_patient:
            if not user.profiles.filter(id=prescription.patient_id).exists():
                return Response({"detail": "You do not have access to this prescription"}, status=status.HTTP_403_FORBIDDEN)
        elif user.is_doctor:
            if prescription.doctor_id != user.id:
                return Response({"detail": "You do not have access to this prescription"}, status=status.HTTP_403_FORBIDDEN)

        try:
            return FileResponse(open(prescription.qr_code_path, "rb"), content_type="image/png")
        except FileNotFoundError as exc:
            raise Http404("QR code not found") from exc


class PatientPrescriptionsView(APIView):
    """Get all prescriptions for a patient."""

    permission_classes = [permissions.IsAuthenticated, IsDoctorVerified]

    def get(self, request, patient_id):
        user = request.user

        if user.is_patient:
            if not user.profiles.filter(id=patient_id).exists():
                return Response({"detail": "You do not have access to these prescriptions"}, status=status.HTTP_403_FORBIDDEN)

        prescriptions = Prescription.objects.filter(patient_id=patient_id).order_by("-created_at")
        return Response(PrescriptionSerializer(prescriptions, many=True).data)


class MyPrescriptionsView(APIView):
    """Get all prescriptions for the authenticated patient."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profiles = request.user.profiles.all()
        if not profiles.exists():
            return Response({"count": 0, "results": []})
        prescriptions = Prescription.objects.filter(patient__in=profiles).order_by("-created_at")
        limit = int(request.query_params.get("limit", 20))
        offset = int(request.query_params.get("offset", 0))
        total = prescriptions.count()
        prescriptions = prescriptions[offset : offset + limit]
        return Response({"count": total, "results": PrescriptionSerializer(prescriptions, many=True).data})



class GeneratePrescriptionPDFView(APIView):
    """Generate prescription in patient's preferred language."""

    permission_classes = [permissions.IsAuthenticated, IsDoctorVerified]

    def get(self, request, prescription_id):
        from .translations import translate_prescription_data

        prescription = get_object_or_404(Prescription, id=prescription_id)

        user = request.user
        if user.is_patient:
            if not user.profiles.filter(id=prescription.patient_id).exists():
                return Response({"detail": "You do not have access to this prescription"}, status=status.HTTP_403_FORBIDDEN)
        elif user.is_doctor:
            if prescription.doctor_id != user.id:
                return Response({"detail": "You do not have access to this prescription"}, status=status.HTTP_403_FORBIDDEN)

        # Get language from query params or patient profile
        language = request.query_params.get("language", prescription.patient.preferred_language or "en")

        # Translate prescription data
        translated_data = translate_prescription_data(prescription, language)

        return Response(translated_data)
