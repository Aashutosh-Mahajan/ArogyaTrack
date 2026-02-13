from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import HealthCard, HealthCardService, Profile
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


# ─── My Card endpoints (auto-resolve profile) ──────────────────────


def _get_or_create_card(user):
    """Get active profile and ensure a health card exists, creating one if needed."""
    profile = None
    if user.active_profile_id:
        profile = user.profiles.filter(id=user.active_profile_id).first()
    if not profile:
        profile = user.profiles.first()
    if not profile:
        return None, None

    # Auto-generate health card if it doesn't exist
    try:
        card = profile.health_card
        if card.revoked_at is not None:
            card.delete()
            raise HealthCard.DoesNotExist
    except HealthCard.DoesNotExist:
        card = HealthCardService.create_health_card(
            profile=profile,
            media_root=str(settings.MEDIA_ROOT)
        )

    return profile, card


class MyCardView(APIView):
    """Return the logged-in patient's card data. Auto-generates if missing."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, card = _get_or_create_card(request.user)
        if not profile:
            return Response(
                {"detail": "No profile found. Please complete your profile first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        short_id = str(profile.id).split("-")[-1].upper()[:6]
        created_year = profile.created_at.year if hasattr(profile, 'created_at') and profile.created_at else 2026
        unique_patient_id = f"HS-{created_year}-{short_id}"

        qr_code_url = None
        if card and card.qr_code_path:
            qr_code_url = request.build_absolute_uri("/api/patients/my-card/qr-image/")

        return Response({
            "unique_patient_id": unique_patient_id,
            "name": profile.name,
            "date_of_birth": str(profile.date_of_birth) if profile.date_of_birth else None,
            "age": profile.age,
            "blood_group": profile.blood_group,
            "district": profile.district or "",
            "gender": profile.gender,
            "qr_code_url": qr_code_url,
        })


class MyCardQRImageView(APIView):
    """Return the QR code image for the logged-in patient."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, card = _get_or_create_card(request.user)
        if not profile or not card:
            return Response({"detail": "No health card found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            return FileResponse(open(card.qr_code_path, "rb"), content_type="image/png")
        except FileNotFoundError:
            card.delete()
            card = HealthCardService.create_health_card(profile=profile, media_root=str(settings.MEDIA_ROOT))
            return FileResponse(open(card.qr_code_path, "rb"), content_type="image/png")


class MyCardPDFView(APIView):
    """Generate and return a PDF of the patient card."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, card = _get_or_create_card(request.user)
        if not profile or not card:
            return Response({"detail": "No health card found."}, status=status.HTTP_404_NOT_FOUND)

        short_id = str(profile.id).split("-")[-1].upper()[:6]
        created_year = profile.created_at.year if hasattr(profile, 'created_at') and profile.created_at else 2026
        unique_patient_id = f"HS-{created_year}-{short_id}"

        try:
            from io import BytesIO
            from reportlab.lib.pagesizes import A6
            from reportlab.lib.units import mm
            from reportlab.pdfgen import canvas as pdf_canvas
            from reportlab.lib.colors import HexColor

            buffer = BytesIO()
            width, height = A6
            c = pdf_canvas.Canvas(buffer, pagesize=A6)

            # Blue header
            c.setFillColor(HexColor("#1e40af"))
            c.rect(0, height - 40 * mm, width, 40 * mm, fill=True, stroke=False)
            c.setFillColor(HexColor("#ffffff"))
            c.setFont("Helvetica", 7)
            c.drawString(10 * mm, height - 10 * mm, "Health Surveillance System")
            c.setFont("Helvetica-Bold", 14)
            c.drawString(10 * mm, height - 18 * mm, profile.name)
            c.setFont("Helvetica", 8)
            c.drawString(10 * mm, height - 24 * mm, "Digital Patient Card")

            # Body
            y = height - 50 * mm
            fields = [
                ("Patient ID", unique_patient_id),
                ("Blood Group", profile.blood_group),
                ("Date of Birth", str(profile.date_of_birth) if profile.date_of_birth else "N/A"),
                ("Gender", profile.gender.title()),
                ("District", profile.district or "N/A"),
            ]
            for label, value in fields:
                c.setFont("Helvetica", 7)
                c.setFillColor(HexColor("#6b7280"))
                c.drawString(10 * mm, y, label)
                c.setFont("Helvetica-Bold", 9)
                c.setFillColor(HexColor("#111827"))
                c.drawString(10 * mm, y - 4 * mm, value)
                y -= 12 * mm

            # QR code image
            try:
                from reportlab.lib.utils import ImageReader
                qr_img = ImageReader(card.qr_code_path)
                c.drawImage(qr_img, width - 38 * mm, height - 80 * mm, 28 * mm, 28 * mm)
            except Exception:
                pass

            c.save()
            buffer.seek(0)

            from django.http import HttpResponse
            response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="patient_card_{unique_patient_id}.pdf"'
            return response

        except ImportError:
            return Response(
                {"detail": "PDF generation requires reportlab. Install: pip install reportlab"},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )
