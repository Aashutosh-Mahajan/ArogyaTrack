from django.urls import path

from .views import (
    AllergyCreateView,
    ChronicConditionCreateView,
    CreateMedicalRecordView,
    DoctorScanHealthCardView,
    PatientHistoryView,
    PatientOwnAllergiesView,
    PatientOwnConditionsView,
    PatientOwnRecordsView,
)

urlpatterns = [
    # Patient-facing endpoints (use authenticated user's profiles)
    path("my-records/", PatientOwnRecordsView.as_view(), name="patient-own-records"),
    path("my-allergies/", PatientOwnAllergiesView.as_view(), name="patient-own-allergies"),
    path("my-conditions/", PatientOwnConditionsView.as_view(), name="patient-own-conditions"),
    # Doctor-facing endpoints
    path("scan-health-card/", DoctorScanHealthCardView.as_view(), name="scan-health-card"),
    path("medical-records/", CreateMedicalRecordView.as_view(), name="create-medical-record"),
    path("patients/<uuid:profile_id>/allergies/", AllergyCreateView.as_view(), name="add-allergy"),
    path("patients/<uuid:profile_id>/conditions/", ChronicConditionCreateView.as_view(), name="add-condition"),
    path("patient-history/<uuid:profile_id>/", PatientHistoryView.as_view(), name="patient-history"),
]
