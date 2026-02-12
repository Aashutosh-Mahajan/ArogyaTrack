from django.urls import path

from .views import (
    SendOTPView,
    VerifyOTPView,
    DoctorRegistrationView,
    PatientRegistrationView,
    PharmacyRegistrationView,
    PasswordLoginView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    EmailVerificationView,
)

urlpatterns = [
    path("send-otp/", SendOTPView.as_view(), name="send-otp"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("register/doctor/", DoctorRegistrationView.as_view(), name="register-doctor"),
    path("register/patient/", PatientRegistrationView.as_view(), name="register-patient"),
    path("register/pharmacy/", PharmacyRegistrationView.as_view(), name="register-pharmacy"),
    path("login/", PasswordLoginView.as_view(), name="password-login"),
    path("password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("verify-email/", EmailVerificationView.as_view(), name="verify-email"),
]
