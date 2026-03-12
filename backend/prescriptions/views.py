from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsApprovedDoctor, IsDoctorVerified

from .models import Medicine, Prescription, PrescriptionService
from .serializers import (
    CheckAllergiesSerializer,
    CheckInteractionsSerializer,
    CreatePrescriptionSerializer,
    MedicineSerializer,
    PrescriptionSerializer,
    ValidatePrescriptionSerializer,
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


class ValidatePrescriptionView(APIView):
    """
    AI-powered prescription safety validation.
    POST /api/prescriptions/validate/
    Accepts patient_id + medicines list, calls the GPT-5.1 agent,
    returns a structured safety report.
    """

    permission_classes = [permissions.IsAuthenticated, IsApprovedDoctor]

    def post(self, request):
        serializer = ValidatePrescriptionSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        from .agent_context import gather_agent_context
        from .agent_service import run_safety_agent

        patient_id = str(serializer.validated_data["patient_id"])
        pharmacy_id = serializer.validated_data.get("pharmacy_id")
        medicines_input = serializer.validated_data["medicines"]

        import logging
        logger = logging.getLogger(__name__)

        try:
            context = gather_agent_context(patient_id, medicines_input, pharmacy_id=str(pharmacy_id) if pharmacy_id else None)
            report = run_safety_agent(context)
        except Exception as e:
            logger.error("Prescription validation failed: %s", e)
            report = {
                "overall_status": "warning",
                "medicines": [],
                "drug_interactions": [],
                "alternatives": [],
                "summary": "Automated validation was unavailable. Please review the prescription manually.",
                "agent_unavailable": True,
            }

        # Audit log the validation
        from accounts.audit import AuditService

        AuditService.log_event(
            event_type="prescription_validated",
            action="AI prescription safety validation",
            user=request.user,
            resource_type="PrescriptionValidation",
            resource_id=patient_id,
            details={
                "overall_status": report.get("overall_status"),
                "medicine_count": len(medicines_input),
                "agent_unavailable": report.get("agent_unavailable", False),
            },
        )

        return Response(report, status=status.HTTP_200_OK)


class VerifyPrescriptionQRView(APIView):
    """
    Public endpoint to verify and view a prescription via QR code data.
    POST /api/prescriptions/verify-qr/
    Accepts: { "prescription_id": "<uuid>", "hash": "<security_hash>" }
    No authentication required — anyone scanning the QR code can verify.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        prescription_id = request.data.get("prescription_id", "").strip()
        provided_hash = request.data.get("hash", "").strip()

        if not prescription_id or not provided_hash:
            return Response(
                {"detail": "prescription_id and hash are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            prescription = Prescription.objects.get(id=prescription_id)
        except (Prescription.DoesNotExist, ValueError):
            return Response(
                {"detail": "Prescription not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not PrescriptionService.validate_security_hash(str(prescription.id), provided_hash):
            return Response(
                {"detail": "Invalid security hash. This prescription may be tampered with."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response({
            "verified": True,
            "prescription": PrescriptionSerializer(prescription).data,
        })
