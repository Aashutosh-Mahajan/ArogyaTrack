from django.urls import path

from .views import (
    AllergyCreateView,
    ChronicConditionCreateView,
    CreateMedicalRecordView,
    DoctorScanHealthCardView,
    PatientHistoryView,
)

urlpatterns = [
    path("scan-health-card/", DoctorScanHealthCardView.as_view(), name="scan-health-card"),
    path("medical-records/", CreateMedicalRecordView.as_view(), name="create-medical-record"),
    path("patients/<uuid:profile_id>/allergies/", AllergyCreateView.as_view(), name="add-allergy"),
    path("patients/<uuid:profile_id>/conditions/", ChronicConditionCreateView.as_view(), name="add-condition"),
    path("patient-history/<uuid:profile_id>/", PatientHistoryView.as_view(), name="patient-history"),
]
