"""PDF downloads. Every view checks the caller may see the document."""

import re

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import pdfs


def _pdf_response(data, filename, inline=False):
    response = HttpResponse(data, content_type="application/pdf")
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", filename)
    response["Content-Disposition"] = f'{"inline" if inline else "attachment"}; filename="{safe}"'
    response["Cache-Control"] = "private, no-store"
    return response


def _owns_profile(user, profile):
    return user.profiles.filter(id=profile.id).exists()


def _may_see_patient(user, profile):
    """Patients see their own family profiles; doctors need current access."""
    from medical.models import HealthCardValidator

    if user.is_superuser or getattr(user, "is_admin", False):
        return True
    if user.role == "patient":
        return _owns_profile(user, profile)
    if user.role == "doctor":
        return bool(getattr(user, "is_approved_doctor", False)) and HealthCardValidator.has_access(user, profile)
    return False


def _log(request, file_type, name, file_id=None):
    if request.user.role != "patient":
        return
    from dashboard.models import DownloadLog

    DownloadLog.objects.create(
        user=request.user, file_type=file_type, file_id=file_id if isinstance(file_id, int) else None,
        file_name=name, ip_address=request.META.get("REMOTE_ADDR"),
    )


def _denied():
    return Response({"detail": "You do not have access to this document."}, status=status.HTTP_403_FORBIDDEN)


class VisitRecordPDFView(APIView):
    """GET /api/documents/visit-records/<id>/"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, record_id):
        from medical.models import PatientVisitRecord

        record = get_object_or_404(PatientVisitRecord.objects.select_related("profile", "patient"), id=record_id)
        if record.profile is None:
            # Rows from before per-profile records belong to the account holder.
            record.profile = record.patient.get_active_profile()
            if record.profile is None:
                return Response({"detail": "This record has no patient profile."}, status=status.HTTP_404_NOT_FOUND)
        if not _may_see_patient(request.user, record.profile):
            return _denied()
        name = f"Visit_record_{record.visit_date:%Y-%m-%d}_{record.profile.patient_id}.pdf"
        _log(request, "medical_record", name, record.id)
        return _pdf_response(pdfs.visit_record_pdf(record), name, inline=request.query_params.get("inline") == "1")


class LabResultsPDFView(APIView):
    """GET /api/documents/lab-results/            all results of the active profile
    GET /api/documents/lab-results/<id>/       one result
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, result_id=None):
        from medical.models import LabTestResult

        if result_id is not None:
            lab = get_object_or_404(LabTestResult.objects.select_related("profile"), id=result_id)
            if not _may_see_patient(request.user, lab.profile):
                return _denied()
            profile, labs, title = lab.profile, [lab], "Lab result"
            name = f"Lab_{lab.test_name}_{lab.tested_at:%Y-%m-%d}.pdf"
        else:
            profile = request.user.get_active_profile() if request.user.role == "patient" else None
            if profile is None:
                return Response({"detail": "No patient profile."}, status=status.HTTP_404_NOT_FOUND)
            labs = LabTestResult.objects.filter(profile=profile).order_by("-tested_at", "test_name")
            title, name = "Lab results", f"Lab_results_{profile.patient_id}.pdf"
        _log(request, "lab_report", name, result_id)
        return _pdf_response(pdfs.lab_report_pdf(profile, labs, title), name, inline=request.query_params.get("inline") == "1")


class PrescriptionPDFView(APIView):
    """GET /api/documents/prescriptions/<uuid>/?language=hi"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, prescription_id):
        from prescriptions.models import Prescription
        from prescriptions.translations import TRANSLATIONS

        rx = get_object_or_404(Prescription.objects.select_related("patient", "doctor"), id=prescription_id)
        user = request.user
        allowed = rx.doctor_id == user.id or _may_see_patient(user, rx.patient)
        if not allowed:
            return _denied()
        language = request.query_params.get("language", "en")
        if language not in TRANSLATIONS:
            language = "en"
        number = f"RX-{str(rx.id)[:8].upper()}"
        name = f"Prescription_{number}{'' if language == 'en' else '_' + language}.pdf"
        _log(request, "prescription", name)
        return _pdf_response(pdfs.prescription_pdf(rx, language), name, inline=request.query_params.get("inline") == "1")


class InvoicePDFView(APIView):
    """GET /api/documents/invoices/<uuid>/  (issuing pharmacist or the patient)"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, invoice_id):
        from pharmacy.models import Invoice

        invoice = get_object_or_404(
            Invoice.objects.select_related("pharmacy", "patient", "pharmacist", "prescription__doctor"), id=invoice_id
        )
        user = request.user
        allowed = invoice.pharmacy.owner_id == user.id or (user.role == "patient" and _owns_profile(user, invoice.patient))
        if not allowed:
            return _denied()
        name = f"{invoice.invoice_number}.pdf"
        _log(request, "invoice", name)
        return _pdf_response(pdfs.invoice_pdf(invoice), name, inline=request.query_params.get("inline") == "1")
