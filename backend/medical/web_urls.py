"""
medical/web_urls.py
─────────────────────────────────────────────────────
URL patterns for template-based medical records views
"""
from django.urls import path

from .web_views import DownloadMedicalRecordPDFView, MedicalRecordsListView

app_name = "medical_web"

urlpatterns = [
    path("records/", MedicalRecordsListView.as_view(), name="records_list"),
    path("records/<int:record_id>/download/", DownloadMedicalRecordPDFView.as_view(), name="download_pdf"),
]
