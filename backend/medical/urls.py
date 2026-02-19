from django.urls import path

from .views import (
    AddPatientToMyListView,
    AllergyCreateView,
    ChronicConditionCreateView,
    CreateMedicalRecordView,
    CreateVisitRecordView,
    DoctorDashboardSummaryView,
    DoctorRecentActivityView,
    DoctorScanHealthCardView,
    HighRiskPatientsView,
    MyPatientsListView,
    PatientHistoryView,
    PatientOwnAllergiesView,
    PatientOwnConditionsView,
    PatientOwnRecordsView,
    PatientVisitRecordDetailView,
    PatientVisitRecordsView,
    SecureReportDownloadView,
)

urlpatterns = [
    # Patient-facing endpoints (use authenticated user's profiles)
    path("my-records/", PatientOwnRecordsView.as_view(), name="patient-own-records"),
    path("my-allergies/", PatientOwnAllergiesView.as_view(), name="patient-own-allergies"),
    path("my-conditions/", PatientOwnConditionsView.as_view(), name="patient-own-conditions"),
    # Patient visit records (Consultation History)
    path("visit-records/", PatientVisitRecordsView.as_view(), name="visit-records-list"),
    path("visit-records/<int:record_id>/", PatientVisitRecordDetailView.as_view(), name="visit-record-detail"),
    # Doctor-facing endpoints - My Patients Management
    path("my-patients/", MyPatientsListView.as_view(), name="my-patients-list"),
    path("my-patients/add/", AddPatientToMyListView.as_view(), name="add-patient-to-my-list"),
    path("patients/<uuid:patient_id>/visit-records/create/", CreateVisitRecordView.as_view(), name="create-visit-record"),
    # Doctor-facing endpoints - Other
    path("scan-health-card/", DoctorScanHealthCardView.as_view(), name="scan-health-card"),
    path("medical-records/", CreateMedicalRecordView.as_view(), name="create-medical-record"),
    path("patients/<uuid:profile_id>/allergies/", AllergyCreateView.as_view(), name="add-allergy"),
    path("patients/<uuid:profile_id>/conditions/", ChronicConditionCreateView.as_view(), name="add-condition"),
    path("patient-history/<uuid:profile_id>/", PatientHistoryView.as_view(), name="patient-history"),
    # Doctor-facing endpoints - High-Risk Patients
    path("high-risk-patients/", HighRiskPatientsView.as_view(), name="high-risk-patients"),
    # Doctor-facing endpoints - Dashboard Summary & Activity
    path("dashboard-summary/", DoctorDashboardSummaryView.as_view(), name="doctor-dashboard-summary"),
    path("recent-activity/", DoctorRecentActivityView.as_view(), name="doctor-recent-activity"),
    # Secure report download
    path("reports/<int:attachment_id>/download/", SecureReportDownloadView.as_view(), name="secure-report-download"),
]
