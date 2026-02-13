from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsAdmin
from .serializers import (
    SendOTPSerializer,
    VerifyOTPSerializer,
    DoctorRegistrationSerializer,
    PatientRegistrationSerializer,
    PasswordLoginSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    EmailVerificationSerializer,
    DoctorProfileSerializer,
    DoctorApprovalSerializer,
    UserListSerializer,
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
        return Response(tokens, status=status.HTTP_200_OK)


class DoctorRegistrationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = DoctorRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Registration successful. Please check your email for OTP verification."},
            status=status.HTTP_201_CREATED
        )


class PatientRegistrationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PatientRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Registration successful. Please check your email for OTP verification."},
            status=status.HTTP_201_CREATED
        )


class PasswordLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tokens = serializer.save()
        return Response(tokens, status=status.HTTP_200_OK)


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


# ─── Admin views ─────────────────────────────────────────────────────


class PendingDoctorsView(APIView):
    """List doctors awaiting admin approval."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        from .models import DoctorProfile
        qs = DoctorProfile.objects.filter(
            approval_status=DoctorProfile.ApprovalStatus.PENDING,
        ).select_related("user")
        return Response(DoctorProfileSerializer(qs, many=True).data)


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
        return Response(DoctorProfileSerializer(profile).data)


class AdminUserListView(APIView):
    """Admin: list all users with optional role filter."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        qs = User.objects.all()
        role = request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        return Response(UserListSerializer(qs[:200], many=True).data)


class AuditLogListView(APIView):
    """Admin: view system audit logs."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        from .audit import AuditLog
        limit = min(int(request.query_params.get("limit", 50)), 200)
        offset = int(request.query_params.get("offset", 0))
        qs = AuditLog.objects.all()[offset:offset + limit]
        data = [
            {
                "id": log.id,
                "event_type": log.event_type,
                "action": log.action,
                "user": log.user.email if log.user else None,
                "severity": log.severity,
                "details": log.details,
                "created_at": log.created_at.isoformat(),
            }
            for log in qs
        ]
        return Response(data)
