from django.urls import path

from .views import (
    CreateProfileView,
    EmergencyContactCreateView,
    HealthCardDownloadView,
    HealthCardImageView,
    MyProfilesView,
    RevokeHealthCardView,
    SwitchProfileView,
)

urlpatterns = [
    path("create-profile/", CreateProfileView.as_view(), name="create-profile"),
    path("my-profiles/", MyProfilesView.as_view(), name="my-profiles"),
    path("switch-profile/", SwitchProfileView.as_view(), name="switch-profile"),
    path("<uuid:profile_id>/emergency-contacts/", EmergencyContactCreateView.as_view(), name="add-emergency-contact"),
    path("<uuid:profile_id>/health-card/", HealthCardDownloadView.as_view(), name="health-card"),
    path("<uuid:profile_id>/health-card/image/", HealthCardImageView.as_view(), name="health-card-image"),
    path("<uuid:profile_id>/health-card/revoke/", RevokeHealthCardView.as_view(), name="revoke-health-card"),
]
