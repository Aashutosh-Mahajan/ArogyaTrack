from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from patients.models import HealthCard, Profile

from .models import Allergy, ChronicCondition, HealthCardValidator, MedicalRecord
from .serializers import (
    AllergySerializer,
    ChronicConditionSerializer,
    MedicalHistorySerializer,
    MedicalRecordSerializer,
)


def require_doctor(user):
    return user.role in (user.Role.DOCTOR, user.Role.ADMIN)


class DoctorScanHealthCardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        token = request.data.get("token")
        if not token:
            return Response({"detail": "token required"}, status=status.HTTP_400_BAD_REQUEST)
        payload = HealthCardValidator.decode_token(token)
        if not payload:
            return Response({"detail": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)
        profile_id = payload.get("patient_id")
        profile = get_object_or_404(Profile, id=profile_id)
        card = getattr(profile, "health_card", None)
        if card is None or card.revoked_at is not None:
            return Response({"detail": "Health card revoked or missing"}, status=status.HTTP_410_GONE)
        if not HealthCardValidator.validate_card(profile, token):
            return Response({"detail": "Health card invalid or expired"}, status=status.HTTP_401_UNAUTHORIZED)

        # Grant 24-hour access
        access = HealthCardValidator.grant_access(request.user, profile, hours=24)

        # Log the access
        from accounts.audit import AuditService

        AuditService.log_event(
            event_type="patient_record_accessed",
            action="Doctor scanned patient health card",
            user=request.user,
            resource_type="Profile",
            resource_id=str(profile.id),
            details={"patient_name": profile.name, "access_method": "qr_scan"},
        )

        return Response(
            {
                "patient_id": str(profile.id),
                "name": profile.name,
                "blood_group": profile.blood_group,
                "age": profile.age,
                "gender": profile.gender,
                "access_expires_at": access.expires_at.isoformat(),
            },
            status=status.HTTP_200_OK,
        )


class CreateMedicalRecordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not require_doctor(request.user):
            return Response({"detail": "Doctor role required"}, status=status.HTTP_403_FORBIDDEN)
        serializer = MedicalRecordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        record = serializer.save()
        return Response(MedicalRecordSerializer(record).data, status=status.HTTP_201_CREATED)


class AllergyCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, profile_id):
        if not require_doctor(request.user):
            return Response({"detail": "Doctor role required"}, status=status.HTTP_403_FORBIDDEN)
        profile = get_object_or_404(Profile, id=profile_id)
        serializer = AllergySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        allergy = serializer.save(profile=profile)
        return Response(AllergySerializer(allergy).data, status=status.HTTP_201_CREATED)


class ChronicConditionCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, profile_id):
        if not require_doctor(request.user):
            return Response({"detail": "Doctor role required"}, status=status.HTTP_403_FORBIDDEN)
        profile = get_object_or_404(Profile, id=profile_id)
        serializer = ChronicConditionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        condition = serializer.save(profile=profile)
        return Response(ChronicConditionSerializer(condition).data, status=status.HTTP_201_CREATED)


class PatientHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, profile_id):
        if not require_doctor(request.user):
            return Response({"detail": "Doctor role required"}, status=status.HTTP_403_FORBIDDEN)
        profile = get_object_or_404(Profile, id=profile_id)

        # Check if doctor has access
        if not HealthCardValidator.has_access(request.user, profile):
            return Response({"detail": "You do not have access to this patient's records"}, status=status.HTTP_403_FORBIDDEN)

        records = profile.medical_records.prefetch_related("diagnoses").order_by("-created_at")
        allergies = profile.allergies.all()
        chronic_conditions = profile.chronic_conditions.filter(is_active=True)

        return Response(
            {
                "patient_id": str(profile.id),
                "patient_name": profile.name,
                "allergies": AllergySerializer(allergies, many=True).data,
                "chronic_conditions": ChronicConditionSerializer(chronic_conditions, many=True).data,
                "medical_records": MedicalHistorySerializer(records, many=True).data,
            }
        )
