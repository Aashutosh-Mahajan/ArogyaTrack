from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsApprovedDoctor, IsDoctorVerified
from config.ai import ai_configured

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

        # Server-side safety gate: the same deterministic checks the doctor saw.
        from .safety_rules import run_rule_checks

        med_input = [
            {
                "medicine_id": str(m["medicine"].id),
                "dosage": m.get("dosage", ""),
                "frequency": m.get("frequency", ""),
                "quantity": m.get("quantity"),
            }
            for m in serializer.validated_data["medicines"]
        ]
        safety = run_rule_checks(str(serializer.validated_data["patient_id"]), med_input)
        override_reason = (request.data.get("override_reason") or "").strip()
        if safety["overall_status"] == "blocked" and not override_reason:
            return Response(
                {"detail": "This prescription is blocked by a safety check. Record an override reason to proceed.", "safety": safety},
                status=status.HTTP_409_CONFLICT,
            )

        # Create prescription
        prescription = serializer.save()

        if safety["overall_status"] == "blocked":
            from accounts.audit import AuditService
            AuditService.log_event(
                event_type="security_event",
                action="Prescription issued despite safety block",
                user=request.user,
                resource_type="Prescription",
                resource_id=str(prescription.id),
                details={"override_reason": override_reason[:500], "summary": safety["summary"]},
                severity="warning",
            )

        response_data = {
            "prescription": PrescriptionSerializer(prescription).data,
            "warnings": {"drug_interactions": drug_interactions, "allergy_alerts": allergy_alerts},
            "safety": safety,
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


def _ensure_prescription_qr(prescription):
    """Path to the prescription's QR image, regenerating it if the file is gone.

    The QR only encodes ``id|security_hash`` (both stored on the row), so a
    missing file — e.g. after moving media storage — can always be rebuilt.
    """
    import os

    path = prescription.qr_code_path or ""
    if path and not os.path.isabs(path):
        path = os.path.join(str(settings.MEDIA_ROOT), path)
    if not path or not os.path.exists(path):
        if not prescription.security_hash:
            prescription.security_hash = PrescriptionService.generate_security_hash(str(prescription.id))
        path = os.path.join(str(settings.MEDIA_ROOT), "qr_codes", "prescriptions", f"{prescription.id}.png")
        PrescriptionService.generate_qr_code(str(prescription.id), prescription.security_hash, path)
        prescription.qr_code_path = path
        prescription.save(update_fields=["qr_code_path", "security_hash"])
    return path


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

        return FileResponse(open(_ensure_prescription_qr(prescription), "rb"), content_type="image/png")


class PatientPrescriptionsView(APIView):
    """Get all prescriptions for a patient."""

    permission_classes = [permissions.IsAuthenticated, IsDoctorVerified]

    def get(self, request, patient_id):
        user = request.user

        if user.is_patient:
            if not user.profiles.filter(id=patient_id).exists():
                return Response({"detail": "You do not have access to these prescriptions"}, status=status.HTTP_403_FORBIDDEN)

        prescriptions = (
            Prescription.objects.filter(patient_id=patient_id)
            .select_related("doctor__doctor_profile", "patient")
            .prefetch_related("medicines__medicine")
            .order_by("-created_at")
        )
        return Response(PrescriptionSerializer(prescriptions, many=True).data)


class MyPrescriptionsView(APIView):
    """Get all prescriptions for the authenticated patient."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = request.user.get_active_profile()
        if not profile:
            return Response({"count": 0, "results": []})
        prescriptions = (
            Prescription.objects.filter(patient=profile)
            .select_related("doctor__doctor_profile", "patient")
            .prefetch_related("medicines__medicine")
            .order_by("-created_at")
        )
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
        language = request.query_params.get("language") or "en"

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

        from .safety_rules import run_rule_checks

        pharmacy = str(pharmacy_id) if pharmacy_id else None
        rules_report = run_rule_checks(patient_id, medicines_input, pharmacy_id=pharmacy)
        report = rules_report
        if ai_configured():
            try:
                context = gather_agent_context(patient_id, medicines_input, pharmacy_id=pharmacy)
                ai_report = run_safety_agent(context)
                if not ai_report.get("agent_unavailable"):
                    # The AI adds pharmacological reasoning, but never downgrades
                    # a block that the recorded data already justifies.
                    if rules_report["overall_status"] == "blocked":
                        ai_report["overall_status"] = "blocked"
                    # Stock is a fact from the pharmacy's inventory, not a judgement:
                    # always report it from the recorded data (both lists follow
                    # the order of the submitted medicines).
                    for ai_med, rule_med in zip(ai_report.get("medicines") or [], rules_report["medicines"]):
                        ai_med["stock_status"] = rule_med["stock_status"]
                        ai_med["stock_detail"] = rule_med["stock_detail"]
                    ai_report["engine"] = "ai"
                    report = ai_report
            except Exception as e:
                logger.error("AI prescription validation failed, using rule checks: %s", e)

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
