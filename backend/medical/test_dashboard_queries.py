from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import User
from medical.models import ChronicCondition, DoctorPatientAccess, HealthMetric, LabTestResult
from medical.views import DoctorDashboardSummaryView, HighRiskPatientsView
from patients.models import Profile


class DoctorDashboardQueryTests(TestCase):
    def setUp(self):
        self.doctor = User.objects.create_user(email='dashboard-doc@example.test', role='doctor')
        self.now = timezone.now()
        self.profiles = []
        for i in range(8):
            user = User.objects.create_user(email=f'dashboard-patient-{i}@example.test', role='patient')
            profile = Profile.objects.create(user=user, name=f'Test Patient {i}', age=35,
                gender='male', blood_group='O+')
            self.profiles.append(profile)
            DoctorPatientAccess.objects.create(doctor=self.doctor, patient=profile,
                expires_at=self.now + timedelta(days=1))
            ChronicCondition.objects.create(profile=profile, icd_10_code='I10', disease_name='Hypertension')
        # Repeated scans must not multiply patients or risk counts.
        DoctorPatientAccess.objects.create(doctor=self.doctor, patient=self.profiles[0],
            expires_at=self.now + timedelta(days=2))
        hidden_user = User.objects.create_user(email='hidden-patient@example.test', role='patient')
        hidden = Profile.objects.create(user=hidden_user, name='Hidden Patient', age=30,
            gender='female', blood_group='B+')
        DoctorPatientAccess.objects.create(doctor=self.doctor, patient=hidden,
            expires_at=self.now - timedelta(days=1))
        ChronicCondition.objects.create(profile=hidden, icd_10_code='E11', disease_name='Diabetes')
        profile = self.profiles[0]
        # Latest readings, not the older normal readings, determine risk.
        for offset, bp, sugar in [(2, 120, 95), (1, 160, 220)]:
            HealthMetric.objects.create(patient=profile.user, profile=profile, metric_type='blood_pressure',
                value=bp, secondary_value=90, unit='mmHg', recorded_at=self.now - timedelta(days=offset))
            HealthMetric.objects.create(patient=profile.user, profile=profile, metric_type='sugar',
                value=sugar, unit='mg/dL', recorded_at=self.now - timedelta(days=offset))
        for value in (50, 150, 170, 90):
            LabTestResult.objects.create(patient=profile.user, profile=profile, test_name='Glucose',
                value=value, unit='mg/dL', normal_min=70, normal_max=100, tested_at=self.now)

    def request(self):
        request = APIRequestFactory().get('/')
        force_authenticate(request, user=self.doctor)
        return request

    def test_high_risk_batches_reads_and_preserves_latest_values(self):
        with self.assertNumQueries(2):
            response = HighRiskPatientsView.as_view()(self.request())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 8)
        patient = next(p for p in response.data['results'] if p['patient_id'] == str(self.profiles[0].pk))
        self.assertEqual(patient['latest_bp_value'], 160)
        self.assertEqual(patient['latest_sugar'], 220)
        self.assertEqual(patient['abnormal_labs'], 3)
        self.assertEqual(patient['risk_level'], 'critical')

    def test_summary_deduplicates_access_and_excludes_expired_access(self):
        with self.assertNumQueries(6):
            response = DoctorDashboardSummaryView.as_view()(self.request())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_patients'], 8)
        self.assertEqual(response.data['high_risk_count'], 8)
        self.assertEqual(response.data['pending_labs'], 3)
