from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import (
    SendOTPView,
    VerifyOTPView,
    DoctorRegistrationView,
    PatientRegistrationView,
    PasswordLoginView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    EmailVerificationView,
    CurrentUserView,
    PendingDoctorsView,
    DoctorApprovalView,
    AdminUserListView,
    AuditLogListView,
)

urlpatterns = [
    # JWT Token endpoints
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Auth
    path("send-otp/", SendOTPView.as_view(), name="send-otp"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("register/doctor/", DoctorRegistrationView.as_view(), name="register-doctor"),
    path("register/patient/", PatientRegistrationView.as_view(), name="register-patient"),
    path("login/", PasswordLoginView.as_view(), name="password-login"),
    path("password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("verify-email/", EmailVerificationView.as_view(), name="verify-email"),
    path("me/", CurrentUserView.as_view(), name="current-user"),
    # Admin RBAC
    path("admin/doctors/pending/", PendingDoctorsView.as_view(), name="pending-doctors"),
    path("admin/doctors/<int:pk>/approval/", DoctorApprovalView.as_view(), name="doctor-approval"),
    path("admin/users/", AdminUserListView.as_view(), name="admin-user-list"),
    path("admin/audit-logs/", AuditLogListView.as_view(), name="admin-audit-logs"),
]
