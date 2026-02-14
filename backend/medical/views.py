from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from datetime import timedelta

from accounts.permissions import IsApprovedDoctor, IsDoctorOrAdmin, IsDoctorVerified
from patients.models import HealthCard, Profile

from .models import Allergy, ChronicCondition, HealthCardValidator, MedicalRecord, PatientVisitRecord, DoctorPatientAccess
from .serializers import (
    AllergySerializer,
    ChronicConditionSerializer,
    MedicalHistorySerializer,
    MedicalRecordSerializer,
    PatientVisitRecordSerializer,
)


class DoctorScanHealthCardView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsApprovedDoctor]

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
    permission_classes = [permissions.IsAuthenticated, IsDoctorOrAdmin]

    def post(self, request):
        serializer = MedicalRecordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        record = serializer.save()
        return Response(MedicalRecordSerializer(record).data, status=status.HTTP_201_CREATED)


class AllergyCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDoctorOrAdmin]

    def post(self, request, profile_id):
        profile = get_object_or_404(Profile, id=profile_id)
        serializer = AllergySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        allergy = serializer.save(profile=profile)
        return Response(AllergySerializer(allergy).data, status=status.HTTP_201_CREATED)


class ChronicConditionCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDoctorOrAdmin]

    def post(self, request, profile_id):
        profile = get_object_or_404(Profile, id=profile_id)
        serializer = ChronicConditionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        condition = serializer.save(profile=profile)
        return Response(ChronicConditionSerializer(condition).data, status=status.HTTP_201_CREATED)


class PatientHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDoctorOrAdmin]

    def get(self, request, profile_id):
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


class PatientOwnRecordsView(APIView):
    """Patient can view their own medical records."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profiles = request.user.profiles.all()
        if not profiles.exists():
            return Response({"count": 0, "results": []})
        records = MedicalRecord.objects.filter(patient__in=profiles).prefetch_related("diagnoses").order_by("-created_at")
        limit = int(request.query_params.get("limit", 20))
        offset = int(request.query_params.get("offset", 0))
        total = records.count()
        records = records[offset : offset + limit]
        return Response({"count": total, "results": MedicalHistorySerializer(records, many=True).data})


class PatientOwnAllergiesView(APIView):
    """Patient can view their own allergies."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profiles = request.user.profiles.all()
        allergies = Allergy.objects.filter(profile__in=profiles).order_by("-created_at")
        return Response(AllergySerializer(allergies, many=True).data)


class PatientOwnConditionsView(APIView):
    """Patient can view their own chronic conditions."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profiles = request.user.profiles.all()
        conditions = ChronicCondition.objects.filter(profile__in=profiles, is_active=True).order_by("-created_at")
        return Response(ChronicConditionSerializer(conditions, many=True).data)


class PatientVisitRecordsView(APIView):
    """
    Patient can view their own visit records (Consultation History).
    GET: List all visit records for authenticated patient with search/filter
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Get all visit records for the authenticated user
        records = PatientVisitRecord.objects.filter(patient=request.user).prefetch_related('report_attachments')
        
        # Search functionality
        search_query = request.query_params.get("search", "").strip()
        if search_query:
            from django.db.models import Q
            records = records.filter(
                Q(diagnosis__icontains=search_query) |
                Q(doctor_name__icontains=search_query) |
                Q(department__icontains=search_query) |
                Q(tests_performed__icontains=search_query)
            )
        
        # Filter by year
        year = request.query_params.get("year")
        if year:
            records = records.filter(visit_date__year=year)
        
        # Filter by department
        department = request.query_params.get("department")
        if department:
            records = records.filter(department=department)
        
        # Filter by doctor
        doctor = request.query_params.get("doctor")
        if doctor:
            records = records.filter(doctor_name__icontains=doctor)
        
        # Order by newest first (already in model Meta, but explicit here)
        records = records.order_by("-visit_date")
        
        # Pagination
        limit = int(request.query_params.get("limit", 20))
        offset = int(request.query_params.get("offset", 0))
        total = records.count()
        records = records[offset : offset + limit]
        
        return Response({
            "count": total,
            "results": PatientVisitRecordSerializer(records, many=True, context={'request': request}).data
        })


class PatientVisitRecordDetailView(APIView):
    """
    Get details of a specific visit record.
    Only the patient who owns the record can access it.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, record_id):
        record = get_object_or_404(
            PatientVisitRecord.objects.prefetch_related('report_attachments'), 
            id=record_id, 
            patient=request.user
        )
        return Response(PatientVisitRecordSerializer(record, context={'request': request}).data)


class MyPatientsListView(APIView):
    """
    Doctor's "My Patients" dashboard.
    Lists all patients the doctor has active access to.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Check authorization - only doctors and admins can access
        if request.user.role not in ['doctor', 'admin']:
            return Response(
                {"detail": "Only doctors and administrators can access patient lists."},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # Get all active patient accesses for this doctor
        active_accesses = DoctorPatientAccess.objects.filter(
            doctor=request.user,
            expires_at__gt=timezone.now()
        ).select_related('patient').order_by('-granted_at')

        patients = []
        for access in active_accesses:
            profile = access.patient
            short_id = str(profile.id).split("-")[-1].upper()[:6]
            created_year = profile.created_at.year if hasattr(profile, 'created_at') and profile.created_at else 2026
            unique_patient_id = f"HS-{created_year}-{short_id}"
            
            # Get recent visit records count
            visit_count = PatientVisitRecord.objects.filter(patient=profile.user).count()
            
            # Get last visit date
            last_visit = PatientVisitRecord.objects.filter(
                patient=profile.user
            ).order_by('-visit_date').first()
            
            patients.append({
                "patient_id": str(profile.id),
                "unique_patient_id": unique_patient_id,
                "name": profile.name,
                "age": profile.age,
                "gender": profile.gender,
                "blood_group": profile.blood_group,
                "district": profile.district,
                "access_granted_at": access.granted_at.isoformat(),
                "access_expires_at": access.expires_at.isoformat(),
                "access_method": access.access_method,
                "visit_count": visit_count,
                "last_visit_date": last_visit.visit_date.isoformat() if last_visit else None,
            })

        return Response({
            "count": len(patients),
            "results": patients
        })


class AddPatientToMyListView(APIView):
    """
    Add a patient to doctor's "My Patients" list.
    Grants extended access (365 days) for ongoing care.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Check authorization - only doctors and admins can add patients
        if request.user.role not in ['doctor', 'admin']:
            return Response(
                {"detail": "Only doctors and administrators can add patients to their list."},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        patient_id = request.data.get('patient_id')
        if not patient_id:
            return Response(
                {"detail": "patient_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        profile = get_object_or_404(Profile, id=patient_id)

        # Check if already has access
        existing_access = DoctorPatientAccess.objects.filter(
            doctor=request.user,
            patient=profile,
            expires_at__gt=timezone.now()
        ).first()

        if existing_access:
            # Extend access
            existing_access.expires_at = timezone.now() + timedelta(days=365)
            existing_access.access_method = "added_to_list"
            existing_access.save()
            
            return Response({
                "message": "Patient access extended",
                "expires_at": existing_access.expires_at.isoformat()
            })
        else:
            # Grant new extended access
            access = HealthCardValidator.grant_access(request.user, profile, hours=365*24)
            access.access_method = "added_to_list"
            access.save()
            
            # Log the action
            from accounts.audit import AuditService
            AuditService.log_event(
                event_type="patient_record_accessed",
                action="Doctor added patient to my patients list",
                user=request.user,
                resource_type="Profile",
                resource_id=str(profile.id),
                details={"patient_name": profile.name, "access_method": "added_to_list"},
            )
            
            return Response({
                "message": "Patient added to your list",
                "patient_name": profile.name,
                "expires_at": access.expires_at.isoformat()
            }, status=status.HTTP_201_CREATED)


class CreateVisitRecordView(APIView):
    """
    Create a new visit/consultation record for a patient.
    Requires doctor to have access to the patient.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, patient_id):
        # Check authorization - only doctors and admins can create visit records
        if request.user.role not in ['doctor', 'admin']:
            return Response(
                {"detail": "Only doctors and administrators can create visit records."},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        profile = get_object_or_404(Profile, id=patient_id)

        # Check if doctor has access
        if not HealthCardValidator.has_access(request.user, profile):
            return Response(
                {"detail": "You do not have access to this patient. Please add them to your patients list first."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get doctor's name
        doctor_name = request.user.email  # Default to email
        if hasattr(request.user, 'doctor_profile'):
            doctor_profile = request.user.doctor_profile
            doctor_name = f"Dr. {doctor_profile.first_name} {doctor_profile.last_name}".strip()
            if doctor_name == "Dr.":  # If both names are empty
                doctor_name = request.user.email

        # Get doctor's specialization if available
        department = "General Medicine"
        if hasattr(request.user, 'doctor_profile'):
            department = request.user.doctor_profile.specialization or department

        # Get form data
        diagnosis = request.data.get('diagnosis', '').strip()
        if not diagnosis:
            return Response(
                {"detail": "Diagnosis is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        tests_performed = request.data.get('tests_performed', '').strip()
        prescription = request.data.get('prescription', '').strip()
        doctor_notes = request.data.get('doctor_notes', '').strip()
        visit_date_str = request.data.get('visit_date')
        
        # Parse visit date
        if visit_date_str:
            from datetime import datetime
            try:
                # Try to parse ISO format
                visit_date = datetime.fromisoformat(visit_date_str.replace('Z', '+00:00'))
                # Make it timezone aware if it's naive
                if timezone.is_naive(visit_date):
                    visit_date = timezone.make_aware(visit_date)
            except:
                visit_date = timezone.now()
        else:
            visit_date = timezone.now()
        
        # Create visit record
        visit_record = PatientVisitRecord.objects.create(
            patient=profile.user,
            doctor_name=doctor_name,
            department=department,
            diagnosis=diagnosis,
            tests_performed=tests_performed,
            prescription=prescription,
            doctor_notes=doctor_notes,
            visit_date=visit_date
        )

        # Log the action
        from accounts.audit import AuditService
        AuditService.log_event(
            event_type="patient_record_accessed",
            action="Doctor created visit record",
            user=request.user,
            resource_type="PatientVisitRecord",
            resource_id=str(visit_record.id),
            details={
                "patient_name": profile.name,
                "diagnosis": visit_record.diagnosis
            },
        )

        return Response(
            PatientVisitRecordSerializer(visit_record, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )
