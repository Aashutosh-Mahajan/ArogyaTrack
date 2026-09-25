from django.urls import path

from .views import InvoicePDFView, LabResultsPDFView, PrescriptionPDFView, VisitRecordPDFView

urlpatterns = [
    path("visit-records/<int:record_id>/", VisitRecordPDFView.as_view(), name="pdf-visit-record"),
    path("lab-results/", LabResultsPDFView.as_view(), name="pdf-lab-results"),
    path("lab-results/<int:result_id>/", LabResultsPDFView.as_view(), name="pdf-lab-result"),
    path("prescriptions/<uuid:prescription_id>/", PrescriptionPDFView.as_view(), name="pdf-prescription"),
    path("invoices/<uuid:invoice_id>/", InvoicePDFView.as_view(), name="pdf-invoice"),
]
