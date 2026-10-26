"""Regression coverage for refreshing an already populated demo database."""
import io
import random
from datetime import date, timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.db.models import Max

from accounts.models import User
from patients.models import Profile
from medical.models import HealthMetric, PatientVisitRecord, ChronicCondition, Allergy
from prescriptions.models import Prescription
from adherence.models import DoseSchedule
from pharmacy.models import Invoice
from dashboard.models import DashboardAlert, DownloadLog
from dashboard.management.commands.seed_year_demo import Command
from surveillance.management.commands.seed_demo_data import Command as DemoCommand


@override_settings(DEBUG=True)
class DemoRefreshTests(TestCase):
    @patch('dashboard.management.commands.seed_year_demo.HealthCardService.create_health_card')
    @patch('dashboard.management.commands.seed_year_demo.PrescriptionService.generate_qr_code')
    def test_refresh_appends_recent_dates_and_same_day_rerun_is_idempotent(self, *_):
        setup = DemoCommand(stdout=io.StringIO())
        setup._seed_users()
        for user in User.objects.filter(role='patient'):
            Profile.objects.create(user=user, name='Demo Patient ' + str(user.pk),
                relationship='self', age=35, gender='male', blood_group='B+')
        outsider = User.objects.create_user(email='existing@example.test', role='patient')
        outsider_profile = Profile.objects.create(user=outsider, name='Existing Patient',
            age=40, gender='female', blood_group='O+')

        command = Command(stdout=io.StringIO())
        command.today = date(2026, 10, 8)
        command.days = 30
        command.start = command.today - timedelta(days=29)
        command.rng = random.Random(42)
        command.clinical()
        original_ids = set(PatientVisitRecord.objects.values_list('pk', flat=True))
        original_conditions = ChronicCondition.objects.count()
        original_allergies = Allergy.objects.count()

        command.today = date(2026, 10, 26)
        command.start = command.today - timedelta(days=29)
        command.clinical()
        command.today_pharmacy()
        self.assertTrue(original_ids.issubset(set(PatientVisitRecord.objects.values_list('pk', flat=True))))
        self.assertGreater(PatientVisitRecord.objects.count(), len(original_ids))
        self.assertEqual(PatientVisitRecord.objects.aggregate(last=Max('visit_date'))['last'].date(), command.today)
        self.assertEqual(HealthMetric.objects.aggregate(last=Max('recorded_at'))['last'].date(), command.today)
        self.assertEqual(ChronicCondition.objects.count(), original_conditions)
        self.assertEqual(Allergy.objects.count(), original_allergies)
        self.assertFalse(PatientVisitRecord.objects.filter(profile=outsider_profile).exists())
        self.assertGreater(Invoice.objects.filter(created_at__date=command.today).count(), 0)

        models = [Profile, PatientVisitRecord, HealthMetric, Prescription, DoseSchedule,
            Invoice, DashboardAlert, DownloadLog, ChronicCondition, Allergy]
        before = [model.objects.count() for model in models]
        command.clinical()
        command.today_pharmacy()
        self.assertEqual([model.objects.count() for model in models], before)

        # A next-day refresh must also stay within the available date range.
        command.today += timedelta(days=1)
        command.clinical()
        self.assertEqual(PatientVisitRecord.objects.filter(visit_date__date=command.today).count(), 30)
