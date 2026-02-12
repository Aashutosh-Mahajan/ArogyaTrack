from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Profile
from .serializers import (
    EmergencyContactSerializer,
    HealthCardSerializer,
    ProfileSerializer,
    RevokeHealthCardSerializer,
    SwitchProfileSerializer,
)


class ActiveProfileView(APIView):
    """Get or update the current user's active profile."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = None
        if user.active_profile_id:
            profile = user.profiles.filter(id=user.active_profile_id).first()
        if not profile:
            profile = user.profiles.first()
        if not profile:
            return Response({"detail": "No profile found. Please create a profile first."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProfileSerializer(profile).data)

    def patch(self, request):
        user = request.user
        profile = None
        if user.active_profile_id:
            profile = user.profiles.filter(id=user.active_profile_id).first()
        if not profile:
            profile = user.profiles.first()
        if not profile:
            return Response({"detail": "No profile found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProfileSerializer(profile, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(ProfileSerializer(profile).data)


class CreateProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ProfileSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(ProfileSerializer(profile).data, status=status.HTTP_201_CREATED)


class MyProfilesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = request.user.profiles.all()
        data = ProfileSerializer(qs, many=True).data
        return Response({"active_profile_id": request.user.active_profile_id, "profiles": data})


class SwitchProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        serializer = SwitchProfileSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response({"active_profile_id": str(profile.id)}, status=status.HTTP_200_OK)


class EmergencyContactCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, profile_id):
        profile = get_object_or_404(Profile, id=profile_id, user=request.user)
        serializer = EmergencyContactSerializer(data=request.data, context={"profile": profile})
        serializer.is_valid(raise_exception=True)
        contact = serializer.save()
        return Response(EmergencyContactSerializer(contact).data, status=status.HTTP_201_CREATED)


class HealthCardDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, profile_id):
        profile = get_object_or_404(Profile, id=profile_id, user=request.user)
        if not hasattr(profile, "health_card"):
            raise Http404("Health card not found")
        card = profile.health_card
        if card.revoked_at is not None:
            return Response({"detail": "Health card revoked"}, status=status.HTTP_410_GONE)
        data = HealthCardSerializer(card).data
        return Response({"token": data["token"], "qr_code_path": data["qr_code_path"], "expires_at": data["expires_at"]})


class HealthCardImageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, profile_id):
        profile = get_object_or_404(Profile, id=profile_id, user=request.user)
        if not hasattr(profile, "health_card"):
            raise Http404("Health card not found")
        card = profile.health_card
        path = card.qr_code_path
        try:
            return FileResponse(open(path, "rb"), content_type="image/png")
        except FileNotFoundError as exc:  # pragma: no cover
            raise Http404("QR code not found") from exc


class RevokeHealthCardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, profile_id):
        profile = get_object_or_404(Profile, id=profile_id, user=request.user)
        serializer = RevokeHealthCardSerializer(data={}, context={"profile": profile})
        serializer.is_valid(raise_exception=True)
        card = serializer.save()
        return Response({"revoked_at": card.revoked_at}, status=status.HTTP_200_OK)
