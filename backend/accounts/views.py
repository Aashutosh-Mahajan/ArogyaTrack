from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    SendOTPSerializer,
    VerifyOTPSerializer,
    DoctorRegistrationSerializer,
    PatientRegistrationSerializer,
    PasswordLoginSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    EmailVerificationSerializer,
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
