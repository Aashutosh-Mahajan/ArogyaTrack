from django.urls import path

from .views import (
    ActiveProfileView,
    CreateProfileView,
    EmergencyContactCreateView,
    HealthCardDownloadView,
    HealthCardImageView,
    MyCardPDFView,
    MyCardPhotoUploadView,
    MyCardQRImageView,
    MyCardView,
    MyProfilesView,
    PatientProfileView,
    RevokeHealthCardView,
    ScanPatientQRView,
    SwitchProfileView,
)

urlpatterns = [
    path("profile/", ActiveProfileView.as_view(), name="active-profile"),
    path("patient-profile/", PatientProfileView.as_view(), name="patient-profile"),
    path("create-profile/", CreateProfileView.as_view(), name="create-profile"),
    path("my-profiles/", MyProfilesView.as_view(), name="my-profiles"),
    path("switch-profile/", SwitchProfileView.as_view(), name="switch-profile"),
    # My Card (auto-resolve logged-in user's profile)
    path("my-card/", MyCardView.as_view(), name="my-card"),
    path("my-card/pdf/", MyCardPDFView.as_view(), name="my-card-pdf"),
    path("my-card/qr-image/", MyCardQRImageView.as_view(), name="my-card-qr-image"),
    path("my-card/upload-photo/", MyCardPhotoUploadView.as_view(), name="my-card-upload-photo"),
    # QR Scanner
    path("scan-qr/", ScanPatientQRView.as_view(), name="scan-patient-qr"),
    # Profile-specific endpoints
    path("<uuid:profile_id>/emergency-contacts/", EmergencyContactCreateView.as_view(), name="add-emergency-contact"),
    path("<uuid:profile_id>/health-card/", HealthCardDownloadView.as_view(), name="health-card"),
    path("<uuid:profile_id>/health-card/image/", HealthCardImageView.as_view(), name="health-card-image"),
    path("<uuid:profile_id>/health-card/revoke/", RevokeHealthCardView.as_view(), name="revoke-health-card"),
]
