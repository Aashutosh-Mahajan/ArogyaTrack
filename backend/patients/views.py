from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import HealthCard, HealthCardService, Profile, PatientProfile
from .serializers import (
    EmergencyContactSerializer,
    HealthCardSerializer,
    PatientProfileSerializer,
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


class PatientProfileView(APIView):
    """Get or update the patient-level profile data (consents, documents, etc.)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            patient_profile = PatientProfile.objects.get(user=user)
            return Response(PatientProfileSerializer(patient_profile).data)
        except PatientProfile.DoesNotExist:
            return Response({
                "detail": "Patient profile not found. This may be a doctor or admin account."
            }, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request):
        user = request.user
        try:
            patient_profile = PatientProfile.objects.get(user=user)
        except PatientProfile.DoesNotExist:
            return Response({
                "detail": "Patient profile not found."
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = PatientProfileSerializer(
            patient_profile, 
            data=request.data, 
            partial=True, 
            context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        patient_profile = serializer.save()
        return Response(PatientProfileSerializer(patient_profile).data)


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

    def get(self, request, profile_id):
        profile = get_object_or_404(Profile, id=profile_id, user=request.user)
        contacts = profile.emergency_contacts.all()
        return Response(EmergencyContactSerializer(contacts, many=True).data)

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

        unique_patient_id = profile.patient_id or "N/A"

        qr_code_url = None
        if card and card.qr_code_path:
            # Convert absolute file path to relative media URL
            import os
            media_root = str(settings.MEDIA_ROOT)  # Convert Path object to string
            try:
                # Try to compute relative path
                rel_path = os.path.relpath(card.qr_code_path, media_root)
            except ValueError:
                # Handle cross-drive paths on Windows (e.g., C: vs D:)
                # Extract relative path by removing MEDIA_ROOT prefix if present
                if card.qr_code_path.startswith(media_root):
                    rel_path = card.qr_code_path[len(media_root):].lstrip(os.sep)
                else:
                    # Fallback: use the basename
                    rel_path = os.path.basename(card.qr_code_path)
            
            media_url = settings.MEDIA_URL + rel_path.replace("\\", "/")
            qr_code_url = request.build_absolute_uri(media_url)
        
        profile_photo_url = None
        if profile.profile_photo:
            profile_photo_url = request.build_absolute_uri(profile.profile_photo.url)

        return Response({
            "unique_patient_id": unique_patient_id,
            "name": profile.name,
            "date_of_birth": str(profile.date_of_birth) if profile.date_of_birth else None,
            "age": profile.age,
            "blood_group": profile.blood_group,
            "district": profile.district or "",
            "gender": profile.gender,
            "qr_code_url": qr_code_url,
            "profile_photo_url": profile_photo_url,
        })


class MyCardPhotoUploadView(APIView):
    """Upload profile photo for the patient card."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile, _ = _get_or_create_card(request.user)
        if not profile:
            return Response(
                {"detail": "No profile found. Please complete your profile first."},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        photo = request.FILES.get('photo')
        if not photo:
            return Response(
                {"detail": "No photo file provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Validate file type
        allowed_extensions = ['jpg', 'jpeg', 'png']
        file_ext = photo.name.split('.')[-1].lower()
        if file_ext not in allowed_extensions:
            return Response(
                {"detail": f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Validate file size (max 5MB)
        max_size = 5 * 1024 * 1024  # 5MB in bytes
        if photo.size > max_size:
            return Response(
                {"detail": "File too large. Maximum size is 5MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Save the photo
        profile.profile_photo = photo
        profile.save()
        
        profile_photo_url = request.build_absolute_uri(profile.profile_photo.url)
        
        return Response({
            "detail": "Profile photo uploaded successfully.",
            "profile_photo_url": profile_photo_url,
        }, status=status.HTTP_200_OK)


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

        unique_patient_id = profile.patient_id or "N/A"

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

            # Profile photo in header (if available)
            if profile.profile_photo:
                try:
                    from reportlab.lib.utils import ImageReader
                    photo_img = ImageReader(profile.profile_photo.path)
                    # Draw photo in top-right corner of header
                    c.drawImage(photo_img, width - 35 * mm, height - 35 * mm, 25 * mm, 25 * mm, mask='auto', preserveAspectRatio=True)
                except Exception:
                    pass  # Skip if photo can't be loaded

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


class ScanPatientQRView(APIView):
    """
    Verify a scanned QR code token and return patient information.
    Only accessible by doctors and admins.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Check authorization - only doctors and admins can scan
        if request.user.role not in ["doctor", "admin"]:
            return Response(
                {"detail": "Only doctors and administrators can scan patient QR codes."},
                status=status.HTTP_403_FORBIDDEN,
            )

        token = request.data.get("token")
        patient_id_input = request.data.get("patient_id")

        if not token and not patient_id_input:
            return Response(
                {"detail": "QR token or Patient ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = None
        try:
            if patient_id_input:
                # Lookup by the generated HS-YYYY-XXXXXX format
                profile = Profile.objects.select_related("user", "health_card").get(patient_id=patient_id_input)
            else:
                # Decode the JWT token
                import jwt
                from django.conf import settings

                payload = jwt.decode(
                    token, settings.SIMPLE_JWT.get("SIGNING_KEY"), algorithms=[settings.SIMPLE_JWT.get("ALGORITHM", "HS256")]
                )

                patient_id = payload.get("patient_id")
                if not patient_id:
                    return Response(
                        {"detail": "Invalid QR code format."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Get the profile and health card
                profile = Profile.objects.select_related("user", "health_card").get(id=patient_id)

            card = profile.health_card

            # Check if card is still active
            if card and not card.is_active():
                return Response(
                    {"detail": "This health card has expired or been revoked."},
                    status=status.HTTP_410_GONE,
                )

            # Build patient information response
            unique_patient_id = profile.patient_id or "N/A"

            profile_photo_url = None
            if profile.profile_photo:
                profile_photo_url = request.build_absolute_uri(profile.profile_photo.url)

            # Get medical history
            from medical.models import MedicalRecord, PatientVisitRecord
            from medical.serializers import MedicalHistorySerializer, PatientVisitRecordSerializer
            from prescriptions.models import Prescription
            
            # Get medical records (old model)
            medical_records = profile.medical_records.prefetch_related('diagnoses').order_by('-created_at')[:10]
            
            # Get visit records (new model for consultation history)
            visit_records = PatientVisitRecord.objects.filter(
                patient=profile.user
            ).order_by('-visit_date')[:10]
            
            # Get allergies
            allergies = profile.allergies.all()
            
            # Get chronic conditions
            chronic_conditions = profile.chronic_conditions.filter(is_active=True)
            
            # Get prescriptions
            prescriptions = Prescription.objects.filter(patient=profile).order_by('-created_at')[:10]
            
            # Serialize medical data
            from medical.serializers import AllergySerializer, ChronicConditionSerializer
            from prescriptions.serializers import PrescriptionSerializer
            
            medical_records_data = MedicalHistorySerializer(medical_records, many=True).data
            visit_records_data = PatientVisitRecordSerializer(visit_records, many=True, context={'request': request}).data
            allergies_data = AllergySerializer(allergies, many=True).data
            chronic_conditions_data = ChronicConditionSerializer(chronic_conditions, many=True).data
            prescriptions_data = PrescriptionSerializer(prescriptions, many=True).data

            return Response({
                "success": True,
                "patient": {
                    "id": str(profile.id),
                    "unique_patient_id": unique_patient_id,
                    "name": profile.name,
                    "age": profile.age,
                    "gender": profile.gender,
                    "blood_group": profile.blood_group,
                    "date_of_birth": str(profile.date_of_birth) if profile.date_of_birth else None,
                    "phone": profile.phone or None,
                    "emergency_contact": profile.emergency_contact_number or None,
                    "address": profile.address or None,
                    "district": profile.district or None,
                    "state": profile.state or None,
                    "pincode": profile.pincode or None,
                    "profile_photo_url": profile_photo_url,
                },
                "card_info": {
                    "issued_at": card.created_at.isoformat(),
                    "expires_at": card.expires_at.isoformat(),
                },
                "medical_records": medical_records_data,
                "visit_records": visit_records_data,
                "allergies": allergies_data,
                "chronic_conditions": chronic_conditions_data,
                "prescriptions": prescriptions_data,
            })

        except jwt.ExpiredSignatureError:
            return Response(
                {"detail": "This QR code has expired."},
                status=status.HTTP_410_GONE,
            )
        except jwt.InvalidTokenError:
            return Response(
                {"detail": "Invalid QR code."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Profile.DoesNotExist:
            return Response(
                {"detail": "Patient not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return Response(
                {"detail": f"Error processing QR code: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
