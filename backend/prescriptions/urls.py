from django.urls import path

from .views import (
    CheckAllergiesView,
    CheckDrugInteractionsView,
    CreatePrescriptionView,
    GeneratePrescriptionPDFView,
    MedicineListView,
    MyPrescriptionsView,
    PatientPrescriptionsView,
    PrescriptionDetailView,
    PrescriptionQRImageView,
    ValidatePrescriptionView,
    VerifyPrescriptionQRView,
)

urlpatterns = [
    path("my-prescriptions/", MyPrescriptionsView.as_view(), name="my-prescriptions"),
    path("medicines/", MedicineListView.as_view(), name="medicine-list"),
    path("check-interactions/", CheckDrugInteractionsView.as_view(), name="check-interactions"),
    path("check-allergies/", CheckAllergiesView.as_view(), name="check-allergies"),
    path("validate/", ValidatePrescriptionView.as_view(), name="validate-prescription"),
    path("verify-qr/", VerifyPrescriptionQRView.as_view(), name="verify-prescription-qr"),
    path("create/", CreatePrescriptionView.as_view(), name="create-prescription"),
    path("<uuid:prescription_id>/", PrescriptionDetailView.as_view(), name="prescription-detail"),
    path("<uuid:prescription_id>/qr-image/", PrescriptionQRImageView.as_view(), name="prescription-qr-image"),
    path("<uuid:prescription_id>/translated/", GeneratePrescriptionPDFView.as_view(), name="prescription-translated"),
    path("patient/<uuid:patient_id>/", PatientPrescriptionsView.as_view(), name="patient-prescriptions"),
]
