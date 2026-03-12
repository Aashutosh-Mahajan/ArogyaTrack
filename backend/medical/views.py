import os

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils import timezone
from django.db.models import Q, F
from datetime import timedelta
import re

from accounts.permissions import IsApprovedDoctor, IsDoctorOrAdmin, IsDoctorVerified
from patients.models import HealthCard, Profile

from .models import Allergy, ChronicCondition, HealthCardValidator, HealthMetric, LabTestResult, MedicalRecord, PatientVisitRecord, DoctorPatientAccess, VisitReportAttachment
from .serializers import (
    AllergySerializer,
    ChronicConditionSerializer,
    MedicalHistorySerializer,
    MedicalRecordSerializer,
    PatientVisitRecordSerializer,
)

# Allowed MIME types and max file size for report uploads
ALLOWED_REPORT_TYPES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
}
MAX_REPORT_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


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

    def get(self, request, profile_id):
        profile = get_object_or_404(Profile, id=profile_id)
        allergies = profile.allergies.all().order_by("-created_at")
        return Response(AllergySerializer(allergies, many=True).data)

    def post(self, request, profile_id):
        profile = get_object_or_404(Profile, id=profile_id)
        serializer = AllergySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        allergy = serializer.save(profile=profile, added_by=request.user)
        return Response(AllergySerializer(allergy).data, status=status.HTTP_201_CREATED)


class AllergyDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDoctorOrAdmin]

    def delete(self, request, profile_id, allergy_id):
        profile = get_object_or_404(Profile, id=profile_id)
        allergy = get_object_or_404(Allergy, id=allergy_id, profile=profile)
        allergy.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChronicConditionCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDoctorOrAdmin]

    def get(self, request, profile_id):
        profile = get_object_or_404(Profile, id=profile_id)
        conditions = profile.chronic_conditions.filter(is_active=True).order_by("-created_at")
        return Response(ChronicConditionSerializer(conditions, many=True).data)

    def post(self, request, profile_id):
        profile = get_object_or_404(Profile, id=profile_id)
        serializer = ChronicConditionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        condition = serializer.save(profile=profile, added_by=request.user)
        return Response(ChronicConditionSerializer(condition).data, status=status.HTTP_201_CREATED)


class ChronicConditionDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDoctorOrAdmin]

    def delete(self, request, profile_id, condition_id):
        profile = get_object_or_404(Profile, id=profile_id)
        condition = get_object_or_404(ChronicCondition, id=condition_id, profile=profile)
        condition.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PatientHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDoctorOrAdmin]

    def get(self, request, profile_id):
        profile = get_object_or_404(Profile, id=profile_id)

        # Check if doctor has access
        if not HealthCardValidator.has_access(request.user, profile):
            return Response({"detail": "You do not have access to this patient's records"}, status=status.HTTP_403_FORBIDDEN)

        records = profile.medical_records.prefetch_related("diagnoses").order_by("-created_at")
        allergies = profile.allergies.select_related("added_by").all()
        chronic_conditions = profile.chronic_conditions.select_related("added_by").filter(is_active=True)

        # Also include visit records (consultation history)
        visit_records = PatientVisitRecord.objects.filter(
            patient=profile.user
        ).prefetch_related('report_attachments').order_by("-visit_date")

        return Response(
            {
                "patient_id": str(profile.id),
                "patient_name": profile.name,
                "allergies": AllergySerializer(allergies, many=True).data,
                "chronic_conditions": ChronicConditionSerializer(chronic_conditions, many=True).data,
                "medical_records": MedicalHistorySerializer(records, many=True).data,
                "visit_records": PatientVisitRecordSerializer(visit_records, many=True, context={'request': request}).data,
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
        allergies = Allergy.objects.filter(profile__in=profiles).select_related("added_by").order_by("-created_at")
        return Response(AllergySerializer(allergies, many=True).data)


class PatientOwnConditionsView(APIView):
    """Patient can view their own chronic conditions."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profiles = request.user.profiles.all()
        conditions = ChronicCondition.objects.filter(profile__in=profiles, is_active=True).select_related("added_by").order_by("-created_at")
        return Response(ChronicConditionSerializer(conditions, many=True).data)


class PatientVisitRecordsView(APIView):
    """
    View visit records (Consultation History).
    - Patients see their own records.
    - Doctors/admins can pass ?patient_id=<uuid> to view a specific patient's records
      (requires active DoctorPatientAccess).
    GET: List visit records with search/filter
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        patient_id = request.query_params.get("patient_id")

        if patient_id and request.user.role in ('doctor', 'admin'):
            # Doctor/admin querying a specific patient's records
            profile = get_object_or_404(Profile, id=patient_id)
            if not HealthCardValidator.has_access(request.user, profile):
                return Response(
                    {"detail": "You do not have access to this patient's records."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            records = PatientVisitRecord.objects.filter(patient=profile.user).prefetch_related('report_attachments')
        else:
            # Patient viewing own records
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
    Patients can view their own records; doctors/admins can view records of patients they have access to.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, record_id):
        record = get_object_or_404(
            PatientVisitRecord.objects.prefetch_related('report_attachments'),
            id=record_id,
        )
        # Patients can only see their own records
        if request.user.role in ('doctor', 'admin'):
            profile = Profile.objects.filter(user=record.patient).first()
            if profile and not HealthCardValidator.has_access(request.user, profile):
                return Response(
                    {"detail": "You do not have access to this patient's records."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif record.patient != request.user:
            return Response(
                {"detail": "You do not have access to this record."},
                status=status.HTTP_403_FORBIDDEN,
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
            unique_patient_id = profile.patient_id or "N/A"
            
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


class HighRiskPatientsView(APIView):
    """
    Lists a doctor's patients flagged as high-risk based on chronic
    conditions, abnormal vitals, or recent elevated lab results.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role not in ['doctor', 'admin']:
            return Response(
                {"detail": "Only doctors and administrators can access high-risk patient data."},
                status=status.HTTP_403_FORBIDDEN,
            )

        active_accesses = DoctorPatientAccess.objects.filter(
            doctor=request.user,
            expires_at__gt=timezone.now(),
        ).select_related('patient')

        high_risk_patients = []
        for access in active_accesses:
            profile = access.patient
            user = profile.user

            risk_factors = []
            risk_level = 'low'
            primary_condition = None

            # 1. Chronic conditions (FK is profile, field is disease_name)
            conditions = ChronicCondition.objects.filter(profile=profile)
            if conditions.exists():
                risk_factors.extend([c.disease_name for c in conditions if c.disease_name])
                primary_condition = conditions.first().disease_name if conditions.first() else None
                risk_level = 'medium'

            # 2. Latest BP from HealthMetric
            latest_bp_metric = HealthMetric.objects.filter(
                patient=user, metric_type='blood_pressure'
            ).order_by('-recorded_at').first()
            latest_bp = None
            latest_bp_value = None
            if latest_bp_metric:
                systolic = latest_bp_metric.value
                diastolic = latest_bp_metric.secondary_value or 0
                latest_bp = f"{int(systolic)}/{int(diastolic)}"
                latest_bp_value = int(systolic)
                if systolic >= 140:
                    risk_factors.append(f'High BP ({latest_bp})')
                    risk_level = 'high'

            # 3. Latest blood sugar from HealthMetric
            latest_sugar_metric = HealthMetric.objects.filter(
                patient=user, metric_type='sugar'
            ).order_by('-recorded_at').first()
            latest_sugar = None
            if latest_sugar_metric:
                latest_sugar = int(latest_sugar_metric.value)
                if latest_sugar > 200:
                    risk_factors.append(f'High Sugar ({latest_sugar} mg/dL)')
                    risk_level = 'high'

            # 4. Most recent visit
            latest_visit = PatientVisitRecord.objects.filter(
                patient=user
            ).order_by('-visit_date').first()

            # 5. Check abnormal lab results (last 90 days)
            recent_labs = LabTestResult.objects.filter(
                patient=user,
                tested_at__gte=timezone.now() - timedelta(days=90),
            )
            abnormal_count = 0
            for lab in recent_labs:
                if lab.value is not None and lab.normal_max is not None and lab.value > lab.normal_max:
                    abnormal_count += 1
                elif lab.value is not None and lab.normal_min is not None and lab.value < lab.normal_min:
                    abnormal_count += 1
            if abnormal_count >= 3:
                risk_factors.append(f'{abnormal_count} abnormal labs (90 d)')
                risk_level = 'high'
            elif abnormal_count >= 1:
                risk_factors.append(f'{abnormal_count} abnormal lab(s)')
                if risk_level == 'low':
                    risk_level = 'medium'

            # 6. Promote to critical if ≥ 3 risk factors
            if len(risk_factors) >= 3:
                risk_level = 'critical'

            # Skip patients with no risk factors
            if not risk_factors:
                continue

            unique_patient_id = profile.patient_id or "N/A"

            # Assign a numeric risk_score for sorting (critical=4, high=3, medium=2, low=1)
            risk_score_num = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}.get(risk_level, 0)

            high_risk_patients.append({
                "patient_id": str(profile.id),
                "unique_patient_id": unique_patient_id,
                "name": profile.name,
                "age": profile.age,
                "gender": profile.gender,
                "blood_group": profile.blood_group,
                "district": profile.district,
                "condition": primary_condition or (risk_factors[0] if risk_factors else "Unknown"),
                "risk_level": risk_level,
                "risk_score": risk_score_num,
                "risk_factors": risk_factors,
                "last_visit_date": latest_visit.visit_date.isoformat() if latest_visit else None,
                "latest_bp": latest_bp,
                "latest_bp_value": latest_bp_value,
                "latest_sugar": latest_sugar,
                "conditions_count": conditions.count(),
                "abnormal_labs": abnormal_count,
            })

        # Sort by risk severity descending
        high_risk_patients.sort(key=lambda p: p.get('risk_score', 0), reverse=True)

        return Response({
            "count": len(high_risk_patients),
            "results": high_risk_patients,
        })


class DoctorDashboardSummaryView(APIView):
    """
    GET /api/doctors/dashboard-summary/
    Returns KPI snapshot for the doctor dashboard.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role not in ['doctor', 'admin']:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()

        # Total assigned (active-access) patients
        active_accesses = DoctorPatientAccess.objects.filter(
            doctor=request.user,
            expires_at__gt=now,
        ).select_related('patient')
        total_patients = active_accesses.count()

        # High-risk count (patients with chronic conditions or abnormal labs)
        high_risk_count = 0
        pending_labs = 0
        recent_updates = 0
        patient_users = []

        for acc in active_accesses:
            profile = acc.patient
            user = profile.user
            patient_users.append(user)

            has_risk = False
            conditions = ChronicCondition.objects.filter(profile=profile)
            if conditions.exists():
                has_risk = True

            # Check abnormal labs in last 90 days
            abnormal = LabTestResult.objects.filter(
                patient=user,
                tested_at__gte=now - timedelta(days=90),
            ).filter(
                Q(value__gt=F('normal_max')) | Q(value__lt=F('normal_min'))
            ).count()
            if abnormal > 0:
                has_risk = True

            if has_risk:
                high_risk_count += 1

        # Pending lab reviews — abnormal labs in last 30 days across all doctor's patients
        if patient_users:
            pending_labs = LabTestResult.objects.filter(
                patient__in=patient_users,
                tested_at__gte=now - timedelta(days=30),
            ).filter(
                Q(value__gt=F('normal_max')) | Q(value__lt=F('normal_min'))
            ).count()

        # Recent updates — visit records + lab results created in last 7 days
        if patient_users:
            recent_visits = PatientVisitRecord.objects.filter(
                patient__in=patient_users,
                created_at__gte=now - timedelta(days=7),
            ).count()
            recent_labs_count = LabTestResult.objects.filter(
                patient__in=patient_users,
                created_at__gte=now - timedelta(days=7),
            ).count()
            recent_updates = recent_visits + recent_labs_count

        return Response({
            "total_patients": total_patients,
            "high_risk_count": high_risk_count,
            "pending_labs": pending_labs,
            "recent_updates": recent_updates,
        })


class DoctorRecentActivityView(APIView):
    """
    GET /api/doctors/recent-activity/
    Returns timeline of recent clinical events for the doctor's patients.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role not in ['doctor', 'admin']:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()
        active_accesses = DoctorPatientAccess.objects.filter(
            doctor=request.user,
            expires_at__gt=now,
        ).select_related('patient')

        patient_users = [acc.patient.user for acc in active_accesses]
        patient_profile_map = {acc.patient.user_id: acc.patient.name for acc in active_accesses}

        activities = []

        if not patient_users:
            return Response({"count": 0, "results": []})

        # 1. Abnormal lab results (last 30 days)
        abnormal_labs = LabTestResult.objects.filter(
            patient__in=patient_users,
            tested_at__gte=now - timedelta(days=30),
        ).order_by('-tested_at')[:20]

        for lab in abnormal_labs:
            lab_status = lab.status  # 'high', 'low', or 'normal'
            if lab_status == 'normal':
                continue
            patient_name = patient_profile_map.get(lab.patient_id, 'Unknown')
            activities.append({
                "type": "abnormal_lab",
                "icon": "lab",
                "title": f"Abnormal {lab.test_name} detected",
                "description": f"{patient_name} — {lab.value} {lab.unit} ({lab_status.upper()})",
                "timestamp": lab.tested_at.isoformat(),
                "severity": "high" if lab_status == "high" else "medium",
            })

        # 2. Recent visit records (last 14 days)
        recent_visits = PatientVisitRecord.objects.filter(
            patient__in=patient_users,
            created_at__gte=now - timedelta(days=14),
        ).order_by('-created_at')[:15]

        for visit in recent_visits:
            patient_name = patient_profile_map.get(visit.patient_id, 'Unknown')
            # Determine if it mentions follow-up or critical
            diag_lower = (visit.diagnosis or '').lower()
            notes_lower = (visit.doctor_notes or '').lower()
            if 'critical' in diag_lower or 'critical' in notes_lower:
                act_type = "critical_visit"
                title = "Critical visit recorded"
                severity = "critical"
            elif 'follow' in diag_lower or 'follow' in notes_lower:
                act_type = "follow_up"
                title = "Follow-up required"
                severity = "medium"
            else:
                act_type = "new_record"
                title = "New record added"
                severity = "low"

            activities.append({
                "type": act_type,
                "icon": "record",
                "title": title,
                "description": f"{patient_name} — {visit.diagnosis[:80]}",
                "timestamp": visit.created_at.isoformat(),
                "severity": severity,
            })

        # Sort all by timestamp descending, limit to 20
        activities.sort(key=lambda a: a['timestamp'], reverse=True)
        activities = activities[:20]

        return Response({
            "count": len(activities),
            "results": activities,
        })


class CreateVisitRecordView(APIView):
    """
    Create a new visit/consultation record for a patient.
    Requires doctor to have access to the patient.
    Accepts multipart/form-data with optional report file uploads.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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

        # ── Validate uploaded report files (before creating record) ──
        report_files = request.FILES.getlist('reports')
        if report_files:
            for f in report_files:
                if f.content_type not in ALLOWED_REPORT_TYPES:
                    return Response(
                        {"detail": f"Invalid file type: {f.name}. Only PDF, JPG, and PNG files are allowed."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if f.size > MAX_REPORT_FILE_SIZE:
                    return Response(
                        {"detail": f"File too large: {f.name}. Maximum size is 10 MB."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

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

        # ── Save report attachments ──
        for f in report_files:
            VisitReportAttachment.objects.create(
                visit_record=visit_record,
                file=f,
                file_name=f.name,
                file_type=ALLOWED_REPORT_TYPES.get(f.content_type, ''),
                uploaded_by=request.user,
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
                "diagnosis": visit_record.diagnosis,
                "reports_count": len(report_files),
            },
        )

        return Response(
            PatientVisitRecordSerializer(visit_record, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


class SecureReportDownloadView(APIView):
    """
    GET /api/doctors/reports/<attachment_id>/download/

    Securely serve a report attachment file with role-based access control.
    
    Access Rules:
    - Doctors: Can download reports they uploaded
    - Patients: Can download reports linked to their own visit records
    - Admins: Can download any report
    - Unauthenticated users: Get 401 Unauthorized
    - Authenticated but unauthorized users: Get 403 Forbidden
    
    Required Headers:
        Authorization: Bearer <access_token>
    
    Query Parameters:
        disposition: 'inline' (default) or 'attachment'
    
    Returns:
        200: File with appropriate Content-Type and Content-Disposition
        401: Unauthenticated (missing/invalid token)
        403: Forbidden (authenticated but no access rights)
        404: File not found
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, attachment_id):
        # Fetch the attachment or return 404
        attachment = get_object_or_404(VisitReportAttachment, id=attachment_id)
        visit_record = attachment.visit_record
        user = request.user

        # ══════════════════════════════════════════════════════════
        # ROLE-BASED ACCESS CONTROL
        # ══════════════════════════════════════════════════════════
        
        has_access = False
        
        # Rule 1: Admin has access to all reports
        if user.role == 'admin':
            has_access = True
        
        # Rule 2: Patient can download reports from their own visit records
        elif user.role == 'patient':
            if visit_record.patient == user:
                has_access = True
        
        # Rule 3: Doctor can download reports they uploaded
        elif user.role == 'doctor':
            if attachment.uploaded_by == user:
                has_access = True
            # Alternative: Doctor can also download if they created the visit record
            # This allows doctors to access reports from consultations they performed
            elif hasattr(user, 'doctor_profile'):
                # Check if this doctor created the visit record
                doctor_name = f"Dr. {user.doctor_profile.first_name} {user.doctor_profile.last_name}".strip()
                if visit_record.doctor_name == doctor_name:
                    has_access = True
        
        # Deny access if none of the rules matched
        if not has_access:
            return Response(
                {
                    "detail": "You do not have permission to access this file.",
                    "error": "FORBIDDEN",
                    "message": "Access denied. You can only download reports you uploaded (doctors) or reports from your own medical records (patients)."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # ══════════════════════════════════════════════════════════
        # FILE VALIDATION & SERVING
        # ══════════════════════════════════════════════════════════
        
        # Verify file exists on disk
        if not attachment.file:
            return Response(
                {
                    "detail": "File not found.",
                    "error": "FILE_NOT_FOUND",
                    "message": "The requested file reference does not exist."
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        
        if not os.path.isfile(attachment.file.path):
            return Response(
                {
                    "detail": "File not found.",
                    "error": "FILE_NOT_FOUND",
                    "message": "The requested file could not be found on the server."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Determine content type from file extension
        ext = os.path.splitext(attachment.file_name)[1].lower()
        content_type_map = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }
        content_type = content_type_map.get(ext, 'application/octet-stream')

        # Set Content-Disposition header (inline for viewing, attachment for downloading)
        disposition = request.query_params.get('disposition', 'inline')
        if disposition == 'attachment':
            content_disposition = f'attachment; filename="{attachment.file_name}"'
        else:
            content_disposition = f'inline; filename="{attachment.file_name}"'

        # Serve the file securely using FileResponse
        try:
            response = FileResponse(
                open(attachment.file.path, 'rb'),
                content_type=content_type,
            )
            response['Content-Disposition'] = content_disposition
            response['X-Content-Type-Options'] = 'nosniff'  # Security header
            return response
        except IOError:
            return Response(
                {
                    "detail": "File not found.",
                    "error": "FILE_READ_ERROR",
                    "message": "Unable to read the requested file."
                },
                status=status.HTTP_404_NOT_FOUND,
            )
