"""
dashboard/management/commands/seed_dashboard.py
────────────────────────────────────────────────────────────────
Idempotent seeder that populates realistic healthcare data for the
patient "Aditya Patra" spanning March 2024 → Feb 2026.

Usage:
    python manage.py seed_dashboard
    python manage.py seed_dashboard --reset   # wipe existing seed data first
"""
import hashlib
import hmac
import random
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from adherence.models import AdherenceTracker, DoseSchedule
from dashboard.models import DashboardAlert, DownloadLog
from medical.models import HealthMetric, LabTestResult, PatientVisitRecord, VisitReportAttachment
from patients.models import HealthCard, PatientProfile, Profile
from prescriptions.models import Medicine, Prescription, PrescriptionMedicine

# ── Deterministic seed for reproducibility ───────────────────────
random.seed(42)

PATIENT_EMAIL = "aditya@health.test"
PATIENT_PASSWORD = "Test@1234"

# ── Timezone-aware datetime helper ───────────────────────────────


def _dt(year, month, day, hour=10, minute=0):
    """Return a timezone-aware datetime."""
    return timezone.make_aware(datetime(year, month, day, hour, minute))


def _random_time():
    """Return a random consulting-hour (h, m) tuple."""
    hours = [9, 10, 11, 14, 15, 16]
    mins = [0, 15, 30, 45]
    return random.choice(hours), random.choice(mins)


class Command(BaseCommand):
    help = "Seed realistic dashboard data for patient Aditya Patra (Mar 2024 → Feb 2026)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete all existing seed data before re-seeding.",
        )

    # ═════════════════════════════════════════════════════════════
    #  ENTRY POINT
    # ═════════════════════════════════════════════════════════════

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("\n━━━ Dashboard Data Seeder ━━━\n"))

        user, profile = self._ensure_patient(options["reset"])
        doctor_user = self._ensure_doctor()
        visits = self._seed_medical_records(user)
        self._seed_lab_results(user, visits)
        self._seed_health_metrics(user)
        medicines = self._seed_medicines()
        prescriptions = self._seed_prescriptions(profile, doctor_user, medicines)
        self._seed_adherence(profile, prescriptions, medicines)
        self._seed_alerts(user)
        self._seed_download_logs(user)

        self._print_summary(user, profile)

    # ═════════════════════════════════════════════════════════════
    #  0.  PATIENT & DOCTOR USERS
    # ═════════════════════════════════════════════════════════════

    def _ensure_patient(self, reset: bool):
        user, created = User.objects.get_or_create(
            email=PATIENT_EMAIL,
            defaults={
                "role": User.Role.PATIENT,
                "verification_status": User.VerificationStatus.VERIFIED,
                "is_active": True,
                "last_login": _dt(2026, 2, 14, 8, 12),
                "password_last_changed": _dt(2025, 11, 1, 10, 0),
            },
        )
        if created:
            user.set_password(PATIENT_PASSWORD)
            user.save()

        if reset:
            self.stdout.write("  Purging existing seed data …")
            # Delete in dependency order: children first
            DoseSchedule.objects.filter(tracker__patient__user=user).delete()
            AdherenceTracker.objects.filter(patient__user=user).delete()
            Prescription.objects.filter(patient__user=user).delete()
            PatientVisitRecord.objects.filter(patient=user).delete()
            LabTestResult.objects.filter(patient=user).delete()
            HealthMetric.objects.filter(patient=user).delete()
            DashboardAlert.objects.filter(patient=user).delete()
            DownloadLog.objects.filter(user=user).delete()

        profile, _ = Profile.objects.get_or_create(
            user=user,
            name="Aditya Patra",
            relationship="self",
            defaults={
                "age": 24,
                "gender": "male",
                "blood_group": "B+",
                "date_of_birth": date(2001, 7, 15),
                "phone": "+91-9876500000",
                "region": "Bhubaneswar",
                "district": "Khordha",
                "state": "Odisha",
                "country": "India",
                "pincode": "751001",
                "address": "Plot 42, Saheed Nagar",
            },
        )

        # Make sure active_profile is set
        if user.active_profile != profile:
            user.active_profile = profile
            user.save(update_fields=["active_profile"])

        # Ensure PatientProfile (consent/docs) exists
        PatientProfile.objects.get_or_create(
            user=user,
            defaults={
                "terms_accepted": True,
                "terms_accepted_at": _dt(2024, 3, 1, 10, 0),
                "consent_store_data": True,
                "consent_store_data_at": _dt(2024, 3, 1, 10, 0),
                "consent_doctor_access": True,
                "consent_doctor_access_at": _dt(2024, 3, 1, 10, 0),
                "data_sharing_enabled": True,
                "last_consent_update": _dt(2024, 3, 1, 10, 0),
            },
        )

        self.stdout.write(self.style.SUCCESS(f"  ✔ Patient: {user.email}  (profile {profile.id})"))
        return user, profile

    def _ensure_doctor(self):
        doc, created = User.objects.get_or_create(
            email="dr.sharma@health.test",
            defaults={
                "role": User.Role.DOCTOR,
                "verification_status": User.VerificationStatus.VERIFIED,
                "is_active": True,
            },
        )
        if created:
            doc.set_password("Doctor@1234")
            doc.save()
        return doc


    # ═════════════════════════════════════════════════════════════
    #  1.  MEDICAL VISIT RECORDS  (12 visits, ~every 2 months)
    # ═════════════════════════════════════════════════════════════

    VISIT_PLAN = [
        # (year, month, day, doctor, dept, diagnosis, tests, prescription, notes, status_hint)
        (2024, 3, 5, "Dr. Sharma", "Cardiology",
         "Elevated BP 140/90. Borderline hypertension. Lifestyle modification advised.",
         "BP monitoring, ECG – normal sinus rhythm",
         "Amlodipine 5 mg OD", "Follow up in 2 months. Monitor salt intake.",
         "follow_up"),
        (2024, 5, 8, "Dr. Mehta", "Endocrinology",
         "FBS 135 mg/dL – borderline. BP 136/88 stable on medication.",
         "FBS, HbA1c 5.9%, Lipid profile",
         "Continue Amlodipine 5 mg. Metformin 500 mg BD started.",
         "Diet counselling given. Recheck in 2 months.", "follow_up"),
        (2024, 7, 10, "Dr. Sharma", "Cardiology",
         "Mild hypertension persists. BP 142/92. ECG normal.",
         "BP monitoring, ECG, Renal function – normal",
         "Amlodipine increased to 10 mg OD.",
         "Poor salt compliance noted. Strict diet advised.", "follow_up"),
        (2024, 9, 12, "Dr. Mehta", "Endocrinology",
         "FBS 155 mg/dL elevated. HbA1c 6.2%. BP 144/90.",
         "FBS, HbA1c, Lipid panel – LDL 142",
         "Metformin 500 mg BD continued. Atorvastatin 10 mg HS started.",
         "Sugar slightly high despite medication. Exercise strongly recommended.",
         "follow_up"),
        (2024, 11, 14, "Dr. Sharma", "Cardiology",
         "Hypertension uncontrolled – BP 160/100. Headaches reported. Sugar 165 mg/dL critical.",
         "BP monitoring, ECG – LVH borderline, FBS, CBC",
         "Amlodipine 10 mg + Telmisartan 40 mg OD. Metformin 1000 mg.",
         "Urgent follow up in 4 weeks. Lifestyle changes non-negotiable.",
         "critical"),
        (2025, 1, 9, "Dr. Rao", "General Medicine",
         "Improving – BP 148/92, Sugar 145 mg/dL. Patient reports better compliance.",
         "BP, FBS, HbA1c 6.1%, LFT – normal",
         "Continue current regimen.",
         "Good progress. Continue medications. Recheck 2 months.", "follow_up"),
        (2025, 3, 13, "Dr. Sharma", "Cardiology",
         "BP 145/90 trending down. Weight reduced 2 kg. Sugar 148.",
         "BP monitoring, ECG – normal, FBS",
         "Same medications continued.",
         "Positive trend. Keep exercising.", "follow_up"),
        (2025, 5, 15, "Dr. Mehta", "Endocrinology",
         "FBS 140 mg/dL. HbA1c 6.0%. Lipids improved – LDL 128.",
         "FBS, HbA1c, Lipid panel, Kidney function – normal",
         "Metformin reduced to 500 mg BD. Atorvastatin continued.",
         "Significant improvement. Patient motivated.", "completed"),
        (2025, 7, 17, "Dr. Rao", "General Medicine",
         "General checkup. BP 140/88. Sugar 135. Weight 80 kg.",
         "CBC, FBS, Urine routine – NAD",
         "Continue current medications.",
         "Stable. Semi-annual follow up recommended.", "completed"),
        (2025, 9, 18, "Dr. Sharma", "Cardiology",
         "BP 138/86. Sugar 130 mg/dL. Good control achieved.",
         "BP monitoring, ECG – normal, Lipid panel – LDL 118",
         "Amlodipine reduced to 5 mg. Telmisartan 40 mg continued.",
         "Medication step-down initiated. Monitor closely.", "follow_up"),
        (2025, 11, 20, "Dr. Mehta", "Endocrinology",
         "HbA1c 5.8%. Sugar 126 mg/dL. Excellent progress.",
         "FBS, HbA1c, Lipid profile, TFT – normal",
         "Metformin 500 mg OD (step-down). Atorvastatin 10 mg continued.",
         "Near-normal metabolic profile. Keep lifestyle changes.", "completed"),
        (2026, 1, 22, "Dr. Rao", "General Medicine",
         "Annual review. BP 134/84. Sugar 128. BMI 25.2. Vitals stable.",
         "CBC, FBS, LFT, RFT, Lipid panel, Urine routine, ECG",
         "Continue Amlodipine 5 mg, Telmisartan 40 mg, Metformin 500 mg OD, Atorvastatin 10 mg.",
         "Satisfactory control. Next review in 3 months.", "completed"),
    ]

    def _seed_medical_records(self, user):
        if PatientVisitRecord.objects.filter(patient=user).exists():
            self.stdout.write("  ⏭ Medical records already exist – skipping.")
            return list(PatientVisitRecord.objects.filter(patient=user).order_by("visit_date"))

        visits = []
        for row in self.VISIT_PLAN:
            yr, mo, dy, doctor, dept, diag, tests, rx, notes, _ = row
            h, m = _random_time()
            v = PatientVisitRecord.objects.create(
                patient=user,
                doctor_name=doctor,
                department=dept,
                diagnosis=diag,
                tests_performed=tests,
                prescription=rx,
                doctor_notes=notes,
                visit_date=_dt(yr, mo, dy, h, m),
            )
            visits.append(v)
        self.stdout.write(self.style.SUCCESS(f"  ✔ Created {len(visits)} medical visit records"))
        return visits

    # ═════════════════════════════════════════════════════════════
    #  2.  LAB TEST RESULTS  (structured numeric data)
    # ═════════════════════════════════════════════════════════════

    LAB_DATA = [
        # (year, month, day, test_name, value, unit, normal_min, normal_max)
        # Blood Sugar (FBS): normal 70–130; Systolic BP: normal 90–139
        # HbA1c: normal 4.0–5.7; LDL: normal 0–130
        (2024, 3, 5, "Blood Sugar (FBS)", 135, "mg/dL", 70, 130),
        (2024, 3, 5, "Blood Pressure (Systolic)", 140, "mmHg", 90, 139),
        (2024, 5, 8, "Blood Sugar (FBS)", 135, "mg/dL", 70, 130),
        (2024, 5, 8, "HbA1c", 5.9, "%", 4.0, 5.7),
        (2024, 5, 8, "LDL Cholesterol", 138, "mg/dL", 0, 130),
        (2024, 7, 10, "Blood Pressure (Systolic)", 142, "mmHg", 90, 139),
        (2024, 9, 12, "Blood Sugar (FBS)", 155, "mg/dL", 70, 130),
        (2024, 9, 12, "HbA1c", 6.2, "%", 4.0, 5.7),
        (2024, 9, 12, "LDL Cholesterol", 142, "mg/dL", 0, 130),
        (2024, 11, 14, "Blood Sugar (FBS)", 165, "mg/dL", 70, 130),
        (2024, 11, 14, "Blood Pressure (Systolic)", 160, "mmHg", 90, 139),
        (2025, 1, 9, "Blood Sugar (FBS)", 145, "mg/dL", 70, 130),
        (2025, 1, 9, "HbA1c", 6.1, "%", 4.0, 5.7),
        (2025, 3, 13, "Blood Sugar (FBS)", 148, "mg/dL", 70, 130),
        (2025, 3, 13, "Blood Pressure (Systolic)", 145, "mmHg", 90, 139),
        (2025, 5, 15, "Blood Sugar (FBS)", 140, "mg/dL", 70, 130),
        (2025, 5, 15, "HbA1c", 6.0, "%", 4.0, 5.7),
        (2025, 5, 15, "LDL Cholesterol", 128, "mg/dL", 0, 130),
        (2025, 7, 17, "Blood Sugar (FBS)", 128, "mg/dL", 70, 130),
        (2025, 9, 18, "Blood Sugar (FBS)", 122, "mg/dL", 70, 130),
        (2025, 9, 18, "Blood Pressure (Systolic)", 136, "mmHg", 90, 139),
        (2025, 9, 18, "LDL Cholesterol", 118, "mg/dL", 0, 130),
        (2025, 11, 20, "Blood Sugar (FBS)", 118, "mg/dL", 70, 130),
        (2025, 11, 20, "HbA1c", 5.6, "%", 4.0, 5.7),
        (2026, 1, 22, "Blood Sugar (FBS)", 125, "mg/dL", 70, 130),
        (2026, 1, 22, "Blood Pressure (Systolic)", 134, "mmHg", 90, 139),
        (2026, 1, 22, "LDL Cholesterol", 112, "mg/dL", 0, 130),
    ]

    def _seed_lab_results(self, user, visits):
        if LabTestResult.objects.filter(patient=user).exists():
            self.stdout.write("  ⏭ Lab results already exist – skipping.")
            return

        # Build visit lookup by (year, month)
        visit_map = {}
        for v in visits:
            key = (v.visit_date.year, v.visit_date.month)
            visit_map[key] = v

        count = 0
        for yr, mo, dy, name, val, unit, nmin, nmax in self.LAB_DATA:
            h, m = _random_time()
            visit = visit_map.get((yr, mo))
            LabTestResult.objects.create(
                patient=user,
                visit_record=visit,
                test_name=name,
                value=val,
                unit=unit,
                normal_min=nmin,
                normal_max=nmax,
                tested_at=_dt(yr, mo, dy, h, m),
            )
            count += 1
        self.stdout.write(self.style.SUCCESS(f"  ✔ Created {count} lab test results"))

    # ═════════════════════════════════════════════════════════════
    #  3.  HEALTH METRICS  (monthly vitals for trends)
    # ═════════════════════════════════════════════════════════════

    VITALS = [
        # (year, month, systolic, diastolic, sugar, weight, bmi)
        (2024, 3, 140, 90, 135, 82.0, 27.1),
        (2024, 4, 138, 88, 133, 82.2, 27.2),
        (2024, 5, 136, 88, 135, 82.5, 27.3),
        (2024, 6, 140, 90, 140, 83.0, 27.4),
        (2024, 7, 142, 92, 145, 83.5, 27.6),
        (2024, 8, 144, 92, 150, 84.0, 27.8),
        (2024, 9, 148, 94, 155, 84.5, 27.9),
        (2024, 10, 154, 96, 160, 85.0, 28.1),
        (2024, 11, 160, 100, 165, 85.0, 28.1),
        (2024, 12, 155, 96, 158, 84.5, 27.9),
        (2025, 1, 148, 92, 145, 83.5, 27.6),
        (2025, 2, 146, 90, 142, 83.0, 27.4),
        (2025, 3, 145, 90, 148, 82.5, 27.3),
        (2025, 4, 143, 88, 144, 82.0, 27.1),
        (2025, 5, 140, 88, 140, 81.5, 26.9),
        (2025, 6, 139, 86, 137, 81.0, 26.8),
        (2025, 7, 140, 88, 135, 80.0, 26.4),
        (2025, 8, 138, 86, 132, 79.5, 26.3),
        (2025, 9, 138, 86, 130, 78.0, 25.8),
        (2025, 10, 136, 84, 128, 78.0, 25.8),
        (2025, 11, 134, 84, 126, 77.5, 25.6),
        (2025, 12, 134, 82, 125, 77.0, 25.5),
        (2026, 1, 134, 84, 128, 77.5, 25.6),
        (2026, 2, 133, 82, 126, 77.0, 25.5),
    ]

    def _seed_health_metrics(self, user):
        if HealthMetric.objects.filter(patient=user).exists():
            self.stdout.write("  ⏭ Health metrics already exist – skipping.")
            return

        count = 0
        for yr, mo, sys, dia, sugar, weight, bmi in self.VITALS:
            day = random.randint(1, 15)
            ts = _dt(yr, mo, day, 9, 0)

            # Blood pressure
            HealthMetric.objects.create(
                patient=user,
                metric_type=HealthMetric.MetricType.BLOOD_PRESSURE,
                value=sys,
                secondary_value=dia,
                unit="mmHg",
                recorded_at=ts,
                notes=f"Routine BP check – {yr}/{mo:02d}",
            )
            # Blood sugar
            HealthMetric.objects.create(
                patient=user,
                metric_type=HealthMetric.MetricType.SUGAR,
                value=sugar,
                unit="mg/dL",
                recorded_at=ts + timedelta(minutes=15),
                notes=f"FBS – {yr}/{mo:02d}",
            )
            # Weight
            HealthMetric.objects.create(
                patient=user,
                metric_type=HealthMetric.MetricType.WEIGHT,
                value=weight,
                unit="kg",
                recorded_at=ts + timedelta(minutes=30),
            )
            # BMI
            HealthMetric.objects.create(
                patient=user,
                metric_type=HealthMetric.MetricType.BMI,
                value=bmi,
                unit="kg/m²",
                recorded_at=ts + timedelta(minutes=35),
            )
            count += 4

        self.stdout.write(self.style.SUCCESS(f"  ✔ Created {count} health metric entries"))

    # ═════════════════════════════════════════════════════════════
    #  4.  MEDICINES  (reusable catalogue)
    # ═════════════════════════════════════════════════════════════

    MEDICINE_DEFS = [
        ("Amlodipine 5 mg", "Amlodipine", "Calcium Channel Blocker", "Antihypertensive",
         {"adult": "5mg once daily"}),
        ("Amlodipine 10 mg", "Amlodipine", "Calcium Channel Blocker", "Antihypertensive",
         {"adult": "10mg once daily"}),
        ("Metformin 500 mg", "Metformin", "Biguanide", "Antidiabetic",
         {"adult": "500mg twice daily"}),
        ("Metformin 1000 mg", "Metformin", "Biguanide", "Antidiabetic",
         {"adult": "1000mg once daily"}),
        ("Atorvastatin 10 mg", "Atorvastatin", "Statin", "Lipid-lowering",
         {"adult": "10mg at bedtime"}),
        ("Telmisartan 40 mg", "Telmisartan", "ARB", "Antihypertensive",
         {"adult": "40mg once daily"}),
    ]

    def _seed_medicines(self):
        meds = {}
        for name, generic, drug_cls, cat, dosages in self.MEDICINE_DEFS:
            med, _ = Medicine.objects.get_or_create(
                name=name,
                defaults={
                    "generic_name": generic,
                    "drug_class": drug_cls,
                    "therapeutic_category": cat,
                    "standard_dosages": dosages,
                    "is_active": True,
                },
            )
            meds[name] = med
        self.stdout.write(self.style.SUCCESS(f"  ✔ Ensured {len(meds)} medicines in catalogue"))
        return meds

    # ═════════════════════════════════════════════════════════════
    #  5.  PRESCRIPTIONS
    # ═════════════════════════════════════════════════════════════

    def _make_rx(self, profile, doctor, med_list, start, end, status):
        rx_id = uuid.uuid4()
        sec_hash = hmac.new(
            settings.SECRET_KEY.encode(), str(rx_id).encode(), hashlib.sha256
        ).hexdigest()
        rx = Prescription.objects.create(
            id=rx_id,
            patient=profile,
            doctor=doctor,
            qr_code_path=f"qr_codes/rx/{rx_id}.png",
            security_hash=sec_hash,
            status=status,
        )
        for med, dosage, freq, dur in med_list:
            PrescriptionMedicine.objects.create(
                prescription=rx,
                medicine=med,
                dosage=dosage,
                frequency=freq,
                duration_days=dur,
                quantity=dur,
            )
        return rx

    def _seed_prescriptions(self, profile, doctor, meds):
        if Prescription.objects.filter(patient=profile).exists():
            self.stdout.write("  ⏭ Prescriptions already exist – skipping.")
            return list(Prescription.objects.filter(patient=profile).order_by("created_at"))

        rxs = []

        # Rx 1 – Mar 2024: Amlodipine 5 mg (60 days)
        rxs.append(self._make_rx(
            profile, doctor,
            [(meds["Amlodipine 5 mg"], "5 mg", "Once daily", 60)],
            _dt(2024, 3, 5), _dt(2024, 5, 4),
            Prescription.Status.FULLY_DISPENSED,
        ))

        # Rx 2 – May 2024: Amlodipine 5 mg + Metformin 500 mg (60 days)
        rxs.append(self._make_rx(
            profile, doctor,
            [
                (meds["Amlodipine 5 mg"], "5 mg", "Once daily", 60),
                (meds["Metformin 500 mg"], "500 mg", "Twice daily", 60),
            ],
            _dt(2024, 5, 8), _dt(2024, 7, 7),
            Prescription.Status.FULLY_DISPENSED,
        ))

        # Rx 3 – Jul 2024: Amlodipine stepped up to 10 mg (60 days)
        rxs.append(self._make_rx(
            profile, doctor,
            [
                (meds["Amlodipine 10 mg"], "10 mg", "Once daily", 60),
                (meds["Metformin 500 mg"], "500 mg", "Twice daily", 60),
            ],
            _dt(2024, 7, 10), _dt(2024, 9, 8),
            Prescription.Status.FULLY_DISPENSED,
        ))

        # Rx 4 – Sep 2024: + Atorvastatin (90 days)
        rxs.append(self._make_rx(
            profile, doctor,
            [
                (meds["Amlodipine 10 mg"], "10 mg", "Once daily", 90),
                (meds["Metformin 500 mg"], "500 mg", "Twice daily", 90),
                (meds["Atorvastatin 10 mg"], "10 mg", "Once at bedtime", 90),
            ],
            _dt(2024, 9, 12), _dt(2024, 12, 10),
            Prescription.Status.FULLY_DISPENSED,
        ))

        # Rx 5 – Nov 2024: CRITICAL – regimen change (90 days)
        rxs.append(self._make_rx(
            profile, doctor,
            [
                (meds["Amlodipine 10 mg"], "10 mg", "Once daily", 90),
                (meds["Telmisartan 40 mg"], "40 mg", "Once daily", 90),
                (meds["Metformin 1000 mg"], "1000 mg", "Once daily", 90),
                (meds["Atorvastatin 10 mg"], "10 mg", "Once at bedtime", 90),
            ],
            _dt(2024, 11, 14), _dt(2025, 2, 12),
            Prescription.Status.FULLY_DISPENSED,
        ))

        # Rx 6 – Mar 2025: same regimen continued (90 days)
        rxs.append(self._make_rx(
            profile, doctor,
            [
                (meds["Amlodipine 10 mg"], "10 mg", "Once daily", 90),
                (meds["Telmisartan 40 mg"], "40 mg", "Once daily", 90),
                (meds["Metformin 500 mg"], "500 mg", "Twice daily", 90),
                (meds["Atorvastatin 10 mg"], "10 mg", "Once at bedtime", 90),
            ],
            _dt(2025, 3, 13), _dt(2025, 6, 11),
            Prescription.Status.FULLY_DISPENSED,
        ))

        # Rx 7 – Sep 2025: step-down – Amlodipine back to 5 mg (120 days, ACTIVE)
        rxs.append(self._make_rx(
            profile, doctor,
            [
                (meds["Amlodipine 5 mg"], "5 mg", "Once daily", 120),
                (meds["Telmisartan 40 mg"], "40 mg", "Once daily", 120),
                (meds["Metformin 500 mg"], "500 mg", "Once daily", 120),
                (meds["Atorvastatin 10 mg"], "10 mg", "Once at bedtime", 120),
            ],
            _dt(2025, 9, 18), _dt(2026, 1, 16),
            Prescription.Status.PENDING,
        ))

        # Rx 8 – Jan 2026: current active prescription (90 days)
        rxs.append(self._make_rx(
            profile, doctor,
            [
                (meds["Amlodipine 5 mg"], "5 mg", "Once daily", 90),
                (meds["Telmisartan 40 mg"], "40 mg", "Once daily", 90),
                (meds["Metformin 500 mg"], "500 mg", "Once daily", 90),
                (meds["Atorvastatin 10 mg"], "10 mg", "Once at bedtime", 90),
            ],
            _dt(2026, 1, 22), _dt(2026, 4, 22),
            Prescription.Status.PENDING,
        ))

        self.stdout.write(self.style.SUCCESS(f"  ✔ Created {len(rxs)} prescriptions"))
        return rxs

    # ═════════════════════════════════════════════════════════════
    #  6.  MEDICATION ADHERENCE  (last 6 months)
    # ═════════════════════════════════════════════════════════════

    # Monthly target adherence %  (Aug 2025 → Feb 2026, 7 months)
    ADHERENCE_PLAN = [
        (2025, 8, 88),
        (2025, 9, 85),
        (2025, 10, 78),
        (2025, 11, 60),
        (2025, 12, 72),
        (2026, 1, 90),
        (2026, 2, 88),
    ]

    def _seed_adherence(self, profile, prescriptions, meds):
        if AdherenceTracker.objects.filter(patient=profile).exists():
            self.stdout.write("  ⏭ Adherence data already exist – skipping.")
            return

        import calendar

        # AdherenceTracker is OneToOne with Prescription – one tracker per Rx.
        # Rx 7 covers Sep 2025 → Jan 2026, Rx 8 covers Jan 2026 → Apr 2026.
        active_rxs = [rx for rx in prescriptions if rx.status == Prescription.Status.PENDING]
        if not active_rxs:
            active_rxs = prescriptions[-2:]

        # Map each month to the prescription it falls under
        rx7, rx8 = (active_rxs[0], active_rxs[1]) if len(active_rxs) >= 2 else (active_rxs[0], active_rxs[0])

        month_to_rx = {}
        for yr, mo, pct in self.ADHERENCE_PLAN:
            if (yr, mo) <= (2026, 1):
                month_to_rx.setdefault(rx7, []).append((yr, mo, pct))
            else:
                month_to_rx.setdefault(rx8, []).append((yr, mo, pct))

        total_trackers = 0
        total_doses = 0

        for rx, months in month_to_rx.items():
            rx_meds = list(rx.medicines.select_related("medicine"))
            if not rx_meds:
                continue

            # Determine overall start/end from the months assigned
            first_yr, first_mo, _ = months[0]
            last_yr, last_mo, _ = months[-1]
            now = timezone.now()
            last_day = calendar.monthrange(last_yr, last_mo)[1]
            if last_yr == now.year and last_mo == now.month:
                last_day = min(last_day, now.day)

            start = _dt(first_yr, first_mo, 1, 8, 0)
            end = _dt(last_yr, last_mo, last_day, 23, 59)

            expected = 0
            actual = 0
            dose_objects = []

            for yr, mo, target_pct in months:
                days_in_month = calendar.monthrange(yr, mo)[1]
                if yr == now.year and mo == now.month:
                    days_in_month = min(days_in_month, now.day)

                for pm in rx_meds:
                    for day in range(1, days_in_month + 1):
                        sched_time = _dt(yr, mo, day, 8, 0) + timedelta(
                            hours=random.randint(0, 2),
                            minutes=random.randint(0, 59),
                        )
                        taken = random.random() * 100 < target_pct
                        dose_objects.append({
                            "medicine": pm.medicine,
                            "pm": pm,
                            "sched": sched_time,
                            "taken": taken,
                        })
                        expected += 1
                        if taken:
                            actual += 1

            tracker = AdherenceTracker.objects.create(
                prescription=rx,
                patient=profile,
                start_date=start,
                end_date=end,
                expected_doses=expected,
                actual_doses=actual,
                is_active=(rx == rx8 or len(active_rxs) == 1),
            )
            total_trackers += 1

            # Bulk-create all dose schedules at once for performance
            bulk = [
                DoseSchedule(
                    tracker=tracker,
                    medicine=d["medicine"],
                    prescription_medicine=d["pm"],
                    scheduled_time=d["sched"],
                    is_taken=d["taken"],
                    taken_at=d["sched"] + timedelta(minutes=random.randint(5, 60)) if d["taken"] else None,
                )
                for d in dose_objects
            ]
            DoseSchedule.objects.bulk_create(bulk, batch_size=200)
            total_doses += len(bulk)

        self.stdout.write(self.style.SUCCESS(
            f"  ✔ Created {total_trackers} adherence trackers with {total_doses} dose schedules"
        ))

    # ═════════════════════════════════════════════════════════════
    #  7.  DASHBOARD ALERTS
    # ═════════════════════════════════════════════════════════════

    def _seed_alerts(self, user):
        if DashboardAlert.objects.filter(patient=user).exists():
            self.stdout.write("  ⏭ Alerts already exist – skipping.")
            return

        alerts_data = [
            {
                "alert_type": DashboardAlert.AlertType.ABNORMAL_LABS,
                "severity": DashboardAlert.Severity.HIGH,
                "title": "Multiple Abnormal Lab Results",
                "message": "You have 4 abnormal lab results in the last 30 days including elevated Blood Sugar (128 mg/dL) and Blood Pressure (134 mmHg). Please consult your doctor.",
                "is_read": True,
                "is_dismissed": False,
            },
            {
                "alert_type": DashboardAlert.AlertType.LOW_ADHERENCE,
                "severity": DashboardAlert.Severity.MEDIUM,
                "title": "Low Medication Adherence Detected",
                "message": "Your medication adherence dropped to 60% in November 2025. Consistent medication intake is crucial for managing hypertension and diabetes.",
                "is_read": False,
                "is_dismissed": False,
            },
            {
                "alert_type": DashboardAlert.AlertType.HIGH_RISK,
                "severity": DashboardAlert.Severity.HIGH,
                "title": "Elevated Health Risk Score",
                "message": "Your current risk score is 4 (Medium). Contributing factors: abnormal lab values and missed medication doses. Schedule a follow-up with your cardiologist.",
                "is_read": False,
                "is_dismissed": False,
            },
            {
                "alert_type": DashboardAlert.AlertType.ABNORMAL_LABS,
                "severity": DashboardAlert.Severity.CRITICAL,
                "title": "Critical: Uncontrolled Blood Pressure",
                "message": "Blood Pressure reached 160/100 mmHg in November 2024. Your medications were adjusted accordingly. Continue monitoring.",
                "is_read": True,
                "is_dismissed": True,
            },
        ]

        for a in alerts_data:
            DashboardAlert.objects.create(patient=user, **a)

        self.stdout.write(self.style.SUCCESS(f"  ✔ Created {len(alerts_data)} dashboard alerts"))

    # ═════════════════════════════════════════════════════════════
    #  8.  DOWNLOAD LOGS
    # ═════════════════════════════════════════════════════════════

    def _seed_download_logs(self, user):
        if DownloadLog.objects.filter(user=user).exists():
            self.stdout.write("  ⏭ Download logs already exist – skipping.")
            return

        logs = [
            (DownloadLog.FileType.LAB_REPORT, "Blood_Sugar_20240305.pdf", "192.168.1.10"),
            (DownloadLog.FileType.VISIT_ATTACHMENT, "ECG_Report_Jul2024.pdf", "192.168.1.10"),
            (DownloadLog.FileType.LAB_REPORT, "HbA1c_Report_Sep2024.pdf", "10.0.0.5"),
            (DownloadLog.FileType.VISIT_ATTACHMENT, "Lipid_Panel_Nov2024.pdf", "192.168.1.10"),
            (DownloadLog.FileType.LAB_REPORT, "Annual_FBS_Jan2026.pdf", "192.168.1.10"),
            (DownloadLog.FileType.BULK, "health_records_20260210.zip", "192.168.1.10"),
        ]

        for ft, fn, ip in logs:
            DownloadLog.objects.create(user=user, file_type=ft, file_name=fn, ip_address=ip)

        self.stdout.write(self.style.SUCCESS(f"  ✔ Created {len(logs)} download log entries"))

    # ═════════════════════════════════════════════════════════════
    #  SUMMARY
    # ═════════════════════════════════════════════════════════════

    def _print_summary(self, user, profile):
        self.stdout.write(self.style.MIGRATE_HEADING("\n━━━ Seed Summary ━━━"))

        visits = PatientVisitRecord.objects.filter(patient=user).count()
        labs = LabTestResult.objects.filter(patient=user).count()
        abnormal_labs = sum(
            1 for lt in LabTestResult.objects.filter(patient=user)
            if lt.value < lt.normal_min or lt.value > lt.normal_max
        )
        metrics = HealthMetric.objects.filter(patient=user).count()
        rxs = Prescription.objects.filter(patient=profile).count()
        active_rx = Prescription.objects.filter(patient=profile, status=Prescription.Status.PENDING).count()
        trackers = AdherenceTracker.objects.filter(patient=profile).count()
        active_trackers = AdherenceTracker.objects.filter(patient=profile, is_active=True)
        if active_trackers.exists():
            total_exp = sum(t.expected_doses for t in active_trackers)
            total_act = sum(t.actual_doses for t in active_trackers)
            adh_pct = round((total_act / total_exp) * 100, 1) if total_exp > 0 else 0
        else:
            adh_pct = 0
        alerts = DashboardAlert.objects.filter(patient=user).count()
        unread_alerts = DashboardAlert.objects.filter(patient=user, is_read=False).count()
        downloads = DownloadLog.objects.filter(user=user).count()

        self.stdout.write(f"  Medical visit records : {visits}")
        self.stdout.write(f"  Lab test results      : {labs}  ({abnormal_labs} abnormal)")
        self.stdout.write(f"  Health metrics        : {metrics}")
        self.stdout.write(f"  Prescriptions         : {rxs}  ({active_rx} active)")
        self.stdout.write(f"  Adherence trackers    : {trackers}")
        self.stdout.write(f"  Current adherence %   : {adh_pct}%")
        self.stdout.write(f"  Dashboard alerts      : {alerts}  ({unread_alerts} unread)")
        self.stdout.write(f"  Download logs         : {downloads}")
        self.stdout.write(self.style.SUCCESS("\n  ✅ Seeding complete!\n"))
        self.stdout.write(f"  Login: {PATIENT_EMAIL} / {PATIENT_PASSWORD}\n")
