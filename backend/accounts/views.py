from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenRefreshView
from django_ratelimit.decorators import ratelimit
from django.conf import settings
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator

from django.core import signing

from .cookies import set_auth_cookies, set_access_cookie, clear_auth_cookies
from .audit import AuditService
from .models import OTPService, Session, SessionService
from .permissions import IsAdmin
from .serializers import (
    SendOTPSerializer,
    VerifyOTPSerializer,
    DoctorApprovalSerializer,
    DoctorProfileSerializer,
    DoctorRegistrationSerializer,
    EmailVerificationSerializer,
    PasswordLoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    PatientRegistrationSerializer,
    SendOTPSerializer,
    UserListSerializer,
    VerifyOTPSerializer,
    PharmacistRegistrationSerializer,
)


class SendOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "OTP sent if email is registered/created."}, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tokens = serializer.save()
        response = Response(tokens, status=status.HTTP_200_OK)
        set_auth_cookies(response, tokens["access"], tokens["refresh"])
        get_token(request)  # primes the csrftoken cookie for subsequent cookie-authenticated requests
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """
    Mobile clients: POST {"refresh": "<token>"} in the body, get {"access": "..."} back — unchanged
    behavior, identical to the stock simplejwt TokenRefreshView.

    Web clients: the refresh cookie is used automatically when the body omits "refresh", and the
    new access token is written back into the access-token cookie instead of only the JSON body,
    so the browser never needs to read or store the raw value.
    """

    def post(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        used_cookie = False
        if not data.get("refresh"):
            cookie_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
            if cookie_refresh:
                data["refresh"] = cookie_refresh
                used_cookie = True

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        access = serializer.validated_data.get("access")
        if access and used_cookie:
            set_access_cookie(response, access)
        return response


class LogoutView(APIView):
    """Blacklist the caller's refresh token so it can no longer be used to mint new access tokens."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh") or request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if refresh_token:
            Session.objects.filter(user=request.user, refresh_token_hash=Session.hash_token(refresh_token)).delete()
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                # Already expired/invalid/blacklisted — logout still succeeds client-side.
                pass
        response = Response({"detail": "Logged out."}, status=status.HTTP_200_OK)
        clear_auth_cookies(response)
        return response


@method_decorator(ratelimit(key='ip', rate='5/h', method='POST'), name='dispatch')
class DoctorRegistrationView(APIView):
    """
    Doctor registration endpoint with file uploads.
    
    Requires multipart/form-data for document uploads:
    - license_certificate (required)
    - degree_certificate (required)
    - government_id (required)
    
    Rate limit: 5 attempts per hour per IP address.
    """
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = DoctorRegistrationSerializer(data=request.data)
        
        if not serializer.is_valid():
            # Enhanced error response for file upload issues
            errors = serializer.errors
            return Response({
                "detail": "Registration failed. Please check the errors below.",
                "errors": errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = serializer.save()
        
        # TODO: Send admin notification email for new doctor registration
        # from django.core.mail import send_mail
        # send_mail(
        #     'New Doctor Registration - Approval Required',
        #     f'Dr. {user.first_name} {user.last_name} has registered and needs approval.',
        #     settings.DEFAULT_FROM_EMAIL,
        #     [settings.ADMIN_EMAIL],
        #     fail_silently=True,
        # )
        
        return Response({
            "detail": "Registration successful. Your documents are under review. Please check your email for OTP verification.",
            "status": "pending_approval",
            "approval_message": "Your application will be reviewed by our admin team within 24-48 hours."
        }, status=status.HTTP_201_CREATED)


@method_decorator(ratelimit(key='ip', rate='10/h', method='POST'), name='dispatch')
class PatientRegistrationView(APIView):
    """
    Patient registration endpoint with file uploads.
    
    Requires multipart/form-data for document upload:
    - aadhar_id_proof (required)
    
    All consent fields are mandatory.
    Rate limit: 10 attempts per hour per IP address.
    """
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = PatientRegistrationSerializer(data=request.data)
        
        if not serializer.is_valid():
            # Enhanced error response for file upload and consent issues
            errors = serializer.errors
            return Response({
                "detail": "Registration failed. Please check the errors below.",
                "errors": errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = serializer.save()
        
        return Response({
            "detail": "Registration successful. Please check your email for OTP verification.",
            "user_id": user.id,
            "email": user.email
        }, status=status.HTTP_201_CREATED)


TWO_FACTOR_SALT = "accounts.login.2fa"
TWO_FACTOR_MAX_AGE = 10 * 60  # seconds a password-verified challenge stays usable


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _describe_agent(ua):
    ua_l = (ua or "").lower()
    if "okhttp" in ua_l or "dart" in ua_l:
        return "ArogyaTrack mobile app"
    browsers = (("edg", "Edge"), ("opr", "Opera"), ("chrome", "Chrome"), ("firefox", "Firefox"), ("safari", "Safari"))
    systems = (("windows", "Windows"), ("android", "Android"), ("iphone", "iOS"), ("ipad", "iPadOS"), ("mac os", "macOS"), ("linux", "Linux"))
    browser = next((name for key, name in browsers if key in ua_l), "Browser")
    system = next((name for key, name in systems if key in ua_l), "Unknown OS")
    return f"{browser} on {system}"


def _login_response(request, user):
    """Issue tokens, record the session with its device, and set auth cookies."""
    from django.contrib.auth.models import update_last_login

    refresh = RefreshToken.for_user(user)
    ua = request.META.get("HTTP_USER_AGENT", "")[:255]
    SessionService.create_session(
        user=user,
        refresh_token=str(refresh),
        device_info={"device": _describe_agent(ua), "ip_address": _client_ip(request), "user_agent": ua},
        days=int(refresh.lifetime.total_seconds() // 86400) or 30,
    )
    update_last_login(None, user)
    AuditService.log_event(
        event_type="user_login",
        action="Signed in",
        user=user,
        ip_address=_client_ip(request) or None,
        user_agent=ua,
        details={"device": _describe_agent(ua), "two_factor": user.is_2fa_enabled},
    )
    body = {
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": user.get_first_name(),
            "last_name": user.get_last_name(),
            "role": user.role,
            "verification_status": user.verification_status,
            "approval_status": user.get_approval_status(),
        },
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "expires_in": int(refresh.access_token.lifetime.total_seconds()),
        "refresh_expires_in": int(refresh.lifetime.total_seconds()),
    }
    response = Response(body, status=status.HTTP_200_OK)
    set_auth_cookies(response, body["access"], body["refresh"])
    get_token(request)  # primes the csrftoken cookie for subsequent cookie-authenticated requests
    return response


def _challenge_user(challenge):
    """Resolve a signed 2FA challenge to its user, or None if expired/tampered."""
    from .models import User

    try:
        payload = signing.loads(challenge or "", salt=TWO_FACTOR_SALT, max_age=TWO_FACTOR_MAX_AGE)
    except signing.BadSignature:
        return None
    user = User.objects.filter(pk=payload.get("uid"), is_active=True).first()
    return user if user and user.is_2fa_enabled else None


class PasswordLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        if user.is_2fa_enabled:
            # Password is correct; hold the session until the emailed code is confirmed.
            OTPService.issue_otp(user, purpose="login")
            return Response({
                "requires_2fa": True,
                "challenge": signing.dumps({"uid": user.pk}, salt=TWO_FACTOR_SALT),
                "email": user.email,
                "detail": "Enter the 6-digit code we emailed you.",
            }, status=status.HTTP_200_OK)

        return _login_response(request, user)


@method_decorator(ratelimit(key="ip", rate="10/m", method="POST", block=True), name="dispatch")
class TwoFactorLoginView(APIView):
    """Second login step: exchange a password-verified challenge plus the emailed code for a session."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = _challenge_user(request.data.get("challenge"))
        if user is None:
            return Response({"detail": "This sign-in attempt expired. Enter your password again."}, status=status.HTTP_400_BAD_REQUEST)
        code = str(request.data.get("otp") or "").strip()
        if len(code) != 6 or not OTPService.verify_otp(user, code):
            return Response({"otp": ["Invalid or expired code."]}, status=status.HTTP_400_BAD_REQUEST)
        return _login_response(request, user)


@method_decorator(ratelimit(key="ip", rate="5/10m", method="POST", block=True), name="dispatch")
class ResendTwoFactorCodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = _challenge_user(request.data.get("challenge"))
        if user is None:
            return Response({"detail": "This sign-in attempt expired. Enter your password again."}, status=status.HTTP_400_BAD_REQUEST)
        OTPService.issue_otp(user, purpose="login")
        return Response({"detail": "A new code has been sent."})


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_200_OK)


class EmailVerificationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    """
    Get current authenticated user's profile information.
    Returns user data along with role-specific profile (doctor or patient).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        
        user_data = {
            "id": user.id,
            "email": user.email,
            "first_name": user.get_first_name(),
            "last_name": user.get_last_name(),
            "role": user.role,
            "verification_status": user.verification_status,
            "approval_status": user.get_approval_status(),
            "is_active": user.is_active,
            "is_staff": user.is_staff,
            "date_joined": user.date_joined.isoformat(),
            "updated_at": user.updated_at.isoformat(),
            "active_profile": str(user.active_profile_id) if user.active_profile_id else None,
        }
        
        # Add role-specific profile data
        if user.is_doctor:
            try:
                doctor_profile = user.doctor_profile
                user_data["doctor_profile"] = DoctorProfileSerializer(doctor_profile).data
            except:
                user_data["doctor_profile"] = None
        
        elif user.is_patient:
            from patients.serializers import ProfileSerializer, PatientProfileSerializer
            
            # Get active profile
            if user.active_profile_id:
                try:
                    from patients.models import Profile
                    profile = Profile.objects.get(id=user.active_profile_id)
                    user_data["profile"] = ProfileSerializer(profile).data
                except:
                    user_data["profile"] = None
            
            # Get patient profile (consent data)
            try:
                from patients.models import PatientProfile
                patient_profile = PatientProfile.objects.get(user=user)
                user_data["patient_profile"] = PatientProfileSerializer(patient_profile).data
            except:
                user_data["patient_profile"] = None
        
        return Response(user_data)


# ─── Admin views ─────────────────────────────────────────────────────


class PendingDoctorsView(APIView):
    """List doctors awaiting admin approval."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        from .models import DoctorProfile
        wanted = request.query_params.get("status", DoctorProfile.ApprovalStatus.PENDING)
        qs = DoctorProfile.objects.select_related("user", "approved_by").order_by("-created_at")
        if wanted != "all":
            qs = qs.filter(approval_status=wanted)
        return Response(DoctorProfileSerializer(qs, many=True, context={"request": request}).data)


class DoctorApprovalView(APIView):
    """Approve or reject a doctor by DoctorProfile pk."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        from .models import DoctorProfile

        doctor_profile = get_object_or_404(DoctorProfile, pk=pk)
        serializer = DoctorApprovalSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        profile = serializer.update(doctor_profile, serializer.validated_data)
        AuditService.log_event(
            event_type="security_event",
            action=f"Doctor licence {serializer.validated_data['action']}d",
            user=request.user,
            resource_type="DoctorProfile",
            resource_id=str(profile.pk),
            details={"doctor": profile.user.email, "licence": profile.medical_license},
            severity="warning" if serializer.validated_data["action"] == "reject" else "info",
        )
        return Response(DoctorProfileSerializer(profile, context={"request": request}).data)


class PharmacistRegistrationView(APIView):
    """
    Register a new pharmacist.
    """
    
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PharmacistRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "detail": "Registration failed. Please check the errors below.",
                "errors": serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        
        return Response({
            "message": "Registration successful. Please check your email for verification code.",
            "email": user.email
        }, status=status.HTTP_201_CREATED)


class AdminUserListView(APIView):
    """Admin: list all users with optional role filter."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        qs = User.objects.select_related("doctor_profile", "pharmacist_profile", "active_profile").order_by("-date_joined")
        role = request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(email__icontains=search)
        return Response(UserListSerializer(qs[:200], many=True).data)


class AuditLogListView(APIView):
    """Admin: view system audit logs."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        from .audit import AuditLog
        limit = min(int(request.query_params.get("limit", 50)), 200)
        offset = int(request.query_params.get("offset", 0))
        qs = AuditLog.objects.select_related("user")
        severity = request.query_params.get("severity")
        event_type = request.query_params.get("event_type")
        if severity:
            qs = qs.filter(severity=severity)
        if event_type:
            qs = qs.filter(event_type=event_type)
        data = [
            {
                "id": log.id,
                "event_type": log.event_type,
                "event_label": log.get_event_type_display(),
                "action": log.action,
                "user": log.user.email if log.user else None,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "ip_address": log.ip_address,
                "severity": log.severity,
                "details": log.details,
                "created_at": log.created_at.isoformat(),
            }
            for log in qs[offset:offset + limit]
        ]
        if request.query_params.get("paged"):
            return Response({"count": qs.count(), "results": data})
        return Response(data)
