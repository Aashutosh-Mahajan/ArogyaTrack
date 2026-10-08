"""Bounded, repeatable demo history for all four existing demo roles.

Creates no external notifications and never deletes existing records. Synthetic
observations retain provenance; ML results come from the active frozen bundle.
"""
import hashlib
import math
import random
import uuid
from datetime import datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

import numpy as np
import pandas as pd
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.db.models import F, Value
from django.db.models.functions import Round
from django.utils import timezone

from accounts.models import User
from adherence.models import AdherenceTracker, DoseSchedule
from dashboard.models import DashboardAlert, DownloadLog
from medical.models import (Allergy, ChronicCondition, Diagnosis, DoctorPatientAccess,
                            HealthMetric, LabTestResult, MedicalRecord, PatientVisitRecord)
from patients.models import HealthCard, HealthCardService, PatientProfile, Profile
from pharmacy.models import DispensingRecord, Invoice, Pharmacy, PharmacyInventory
from prescriptions.models import Medicine, Prescription, PrescriptionMedicine, PrescriptionService
from surveillance.ml.features import build_features, prepare_daily
from surveillance.ml.runtime import anomaly_predict, forecast_predict, risk_predict
from surveillance.models import (Alert, Anomaly, EnvironmentalData, Forecast, Region,
                                 RiskScore, SurveillanceData)
from surveillance.services import ClusteringService, _bundle, _inference_key


MARK = 'DEMO-YEAR-2026'
NAMESPACE = uuid.UUID('c4453fb5-59e0-41d1-a57a-e779cbf1707c')


def ident(value):
    return uuid.uuid5(NAMESPACE, value)


def stamp(day, hour=9):
    return timezone.make_aware(datetime.combine(day, time(hour)))


def insert(model, rows, **kwargs):
    """Bulk inserts bypass notification signals and preserve historical timestamps."""
    if not rows:
        return
    restore_dates = kwargs.pop('restore_dates', True)
    if not restore_dates:
        model.objects.bulk_create(rows, batch_size=1000, **kwargs)
        return
    auto = [f.name for f in model._meta.fields
            if getattr(f, 'auto_now_add', False) or getattr(f, 'auto_now', False)]
    desired = [{f: getattr(row, f) for f in auto if getattr(row, f) is not None} for row in rows]
    model.objects.bulk_create(rows, batch_size=1000, **kwargs)
    dated = []
    for row, values in zip(rows, desired):
        if row.pk and values:
            for field, value in values.items():
                setattr(row, field, value)
            dated.append(row)
    if dated:
        model.objects.bulk_update(dated, auto, batch_size=500)


class Command(BaseCommand):
    help = 'Load one year of connected demo history, enforcing a 500 MB database/media cap'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=365)
        parser.add_argument('--skip-ml', action='store_true')

    def size(self):
        if connection.vendor != 'postgresql':
            raise CommandError('This size guard currently requires PostgreSQL')
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_database_size(current_database())')
            database = cursor.fetchone()[0]
        media = sum(p.stat().st_size for p in Path(settings.MEDIA_ROOT).rglob('*') if p.is_file())
        total = database + media
        self.stdout.write(f'Storage: database={database:,} bytes; media={media:,}; total={total:,}', ending='\n')
        # Reserve 50 MB below the requested decimal 500 MB cap.
        if total > 450_000_000:
            raise CommandError('450 MB safety budget exceeded; refusing additional demo writes')
        return total

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('Demo seeding requires DEBUG=True')
        if not 30 <= options['days'] <= 365:
            raise CommandError('--days must be between 30 and 365')
        self.today = timezone.localdate()
        self.days = options['days']
        self.start = self.today - timedelta(days=self.days - 1)
        self.rng = random.Random(42)
        self.size()
        with transaction.atomic():
            self.clinical()
            self.today_pharmacy()
            self.repair_demo_links()
            self.size()
        with transaction.atomic():
            self.surveillance()
            self.size()
        if not options['skip_ml']:
            with transaction.atomic():
                self.ml()
                self.size()
        self.stdout.write(self.style.SUCCESS(f'Demo history ready: {self.start} through {self.today}'))

    def today_pharmacy(self):
        """Mix completed, partial and pending work in today's pharmacy widgets."""
        if Invoice.objects.filter(invoice_number__startswith=f'DYT-{self.today:%y%m%d}').exists():
            return
        pharmacist = User.objects.get(email='pharmacist1@demo.com')
        pharmacy = Pharmacy.objects.get(owner=pharmacist)
        prescriptions = list(Prescription.objects.filter(medical_record__notes__startswith=MARK,
            created_at__date=self.today).prefetch_related('medicines__medicine').order_by('pk'))
        lines_by_id = {line.pk: line for rx in prescriptions for line in rx.medicines.all()}
        dispenses = list(DispensingRecord.objects.filter(prescription__in=prescriptions,
            notes__startswith=MARK))
        by_rx = {}
        for row in dispenses:
            by_rx.setdefault(row.prescription_id, []).append(row)
        invoices, updated_rx, updated_lines, updated_dispenses = [], [], [], []
        for i, rx in enumerate(prescriptions):
            if i % 4 == 0:
                continue
            partial = i % 4 == 1
            rows = sorted(by_rx.get(rx.pk, []), key=lambda r: str(r.prescription_medicine_id))
            selected = rows[:1] if partial else rows
            if not selected:
                continue
            total = sum((Decimal(lines_by_id[r.prescription_medicine_id].quantity) * (r.unit_price or Decimal('2.50'))
                         for r in selected), Decimal('0'))
            taxable = (total / Decimal('1.05')).quantize(Decimal('.01'))
            half = ((total-taxable)/2).quantize(Decimal('.01'))
            invoice = Invoice(id=ident(f'today-invoice:{rx.pk}'),
                invoice_number=f'DYT-{self.today:%y%m%d}-{str(rx.pk)[:12]}', pharmacy=pharmacy,
                pharmacist=pharmacist, prescription=rx, patient=rx.patient, subtotal=total, total=total,
                taxable_value=taxable, cgst=half, sgst=total-taxable-half,
                payment_method=['upi', 'cash', 'card'][i % 3], created_at=stamp(self.today, 12))
            invoices.append(invoice)
            rx.status = 'partially_dispensed' if partial else 'fully_dispensed'
            updated_rx.append(rx)
            for row in selected:
                line = lines_by_id[row.prescription_medicine_id]
                line.dispense_status = 'dispensed'
                line.dispensed_at = stamp(self.today, 12)
                updated_lines.append(line)
                row.status = 'dispensed'
                row.dispensed_at = line.dispensed_at
                row.quantity_dispensed = line.quantity
                row.unit_price = row.unit_price or Decimal('2.50')
                row.amount = row.unit_price * line.quantity
                row.invoice = invoice
                updated_dispenses.append(row)
        insert(Invoice, invoices)
        Prescription.objects.bulk_update(updated_rx, ['status'], batch_size=500)
        PrescriptionMedicine.objects.bulk_update(updated_lines, ['dispense_status', 'dispensed_at'], batch_size=500)
        DispensingRecord.objects.bulk_update(updated_dispenses,
            ['status', 'dispensed_at', 'quantity_dispensed', 'unit_price', 'amount', 'invoice'], batch_size=500)
        self.stdout.write(f'Today: {len(invoices)} demo pharmacy invoices and {len(updated_dispenses)} dispensed lines')

    def repair_demo_links(self):
        """Keep demo tax lines and region links consistent on repeat runs."""
        taxable = Round(F('amount') / Value(Decimal('1.05')), 2)
        DispensingRecord.objects.filter(notes__startswith=MARK, invoice__isnull=False,
            amount__isnull=False).update(taxable_value=taxable,
                tax_amount=F('amount') - taxable, hsn_code='3004')
        demo_emails = [f'patient{i}@demo.com' for i in range(1, 11)]
        for i, email in enumerate(demo_emails):
            Profile.objects.filter(user__email=email).update(
                region='Koramangala' if i % 2 == 0 else 'Whitefield')

    def clinical(self):
        doctors = [User.objects.get(email=f'doctor{i}@demo.com') for i in range(1, 6)]
        pharmacist = User.objects.get(email='pharmacist1@demo.com')
        pharmacy = Pharmacy.objects.get(owner=pharmacist)
        meds = []
        catalogue = [('Metformin', '500 mg', 'Diabetes'), ('Amlodipine', '5 mg', 'Hypertension'),
                     ('Paracetamol', '500 mg', 'Analgesic'), ('Cetirizine', '10 mg', 'Allergy'),
                     ('Atorvastatin', '10 mg', 'Lipids'), ('Salbutamol', '100 mcg', 'Respiratory'),
                     ('Vitamin D3', '1000 IU', 'Supplement'), ('Pantoprazole', '40 mg', 'Gastrointestinal')]
        for generic, dose, category in catalogue:
            med = Medicine.objects.filter(generic_name__iexact=generic).first()
            if med is None:
                med = Medicine.objects.create(name=f'{generic} {dose}', generic_name=generic,
                    drug_class=category, therapeutic_category=category, standard_dosages={'adult': dose})
            meds.append(med)
        profiles = []
        names = ['Aarav Rao', 'Ananya Iyer', 'Rohan Mehta', 'Diya Sharma', 'Kabir Shah',
                 'Meera Nair', 'Arjun Reddy', 'Ishita Patel', 'Vikram Singh', 'Sara Khan']
        for i, name in enumerate(names, 1):
            user = User.objects.get(email=f'patient{i}@demo.com')
            primary = user.profiles.filter(relationship='self').first() or user.get_active_profile()
            if primary is None:
                raise CommandError(f'Missing demo profile: {user.email}')
            if primary.name.startswith('Demo Patient'):
                primary.name = name
                primary.save(update_fields=['name'])
            if user.active_profile_id != primary.pk:
                user.active_profile = primary
                user.save(update_fields=['active_profile'])
            profiles.append(primary)
            for relation, age in [('parent', 65 + i % 8), ('spouse', 30 + i)]:
                family, _ = Profile.objects.get_or_create(user=user, relationship=relation,
                    name=f'{name.split()[0]} {relation.title()} (Demo)', defaults={'age': age,
                    'gender': 'female' if relation == 'spouse' else 'male', 'blood_group': 'B+',
                    'district': 'Bengaluru', 'state': 'Karnataka', 'region': primary.region})
                profiles.append(family)
            PatientProfile.objects.get_or_create(user=user, defaults={'terms_accepted': True,
                'terms_accepted_at': timezone.now(), 'consent_store_data': True,
                'consent_store_data_at': timezone.now(), 'consent_doctor_access': True,
                'consent_doctor_access_at': timezone.now()})
        for profile in profiles:
            if not HealthCard.objects.filter(profile=profile).exists():
                HealthCardService.create_health_card(profile, str(settings.MEDIA_ROOT))
        accesses = []
        existing = set(DoctorPatientAccess.objects.filter(doctor__in=doctors, patient__in=profiles,
            expires_at__gt=timezone.now()).values_list('doctor_id', 'patient_id'))
        for doctor in doctors:
            for profile in profiles:
                if (doctor.pk, profile.pk) not in existing:
                    accesses.append(DoctorPatientAccess(doctor=doctor, patient=profile,
                        expires_at=timezone.now() + timedelta(days=365), access_method='demo_seed'))
        insert(DoctorPatientAccess, accesses)
        seeded = set(PatientVisitRecord.objects.filter(profile__in=profiles,
            doctor_notes__startswith=MARK).values_list('profile_id', flat=True))
        profiles = [p for p in profiles if p.pk not in seeded]
        if not profiles:
            self.stdout.write('Clinical year already seeded; preserving existing demo history.')
            return
        records, visits, diagnoses, labs, metrics, prescriptions, lines = [], [], [], [], [], [], []
        trackers, doses, invoices, dispensings, alerts, downloads, conditions, allergies = [], [], [], [], [], [], [], []
        for pi, profile in enumerate(profiles):
            doctor = doctors[pi % 5]
            offsets = sorted(set(range(0, self.days, 7 if profile.relationship == 'self' else 28)) | set(range(7)), reverse=True)
            condition = ('E11', 'Type 2 Diabetes') if pi % 2 else ('I10', 'Hypertension')
            conditions.append(ChronicCondition(profile=profile, icd_10_code=condition[0],
                disease_name=condition[1], added_by=doctor, created_at=stamp(self.start)))
            if pi % 4 == 0:
                allergies.append(Allergy(profile=profile, allergen='Pollen', reaction_type='Seasonal rhinitis',
                    severity=1, added_by=doctor, created_at=stamp(self.start)))
            for offset in range(0, self.days, 1 if profile.relationship == 'self' else 3):
                when = stamp(self.today - timedelta(days=offset), 7)
                wave = math.sin(offset / 18 + pi)
                for kind, value, secondary, unit in [
                    ('blood_pressure', 126 + pi % 7 + 13 * wave, 80 + 5 * wave, 'mmHg'),
                    ('sugar', 112 + pi % 8 + 35 * wave, None, 'mg/dL'),
                    ('weight', 66 + pi % 12 + 2 * wave, None, 'kg'),
                    ('bmi', 23 + pi % 5 + .6 * wave, None, 'kg/m²')]:
                    metrics.append(HealthMetric(patient=profile.user, profile=profile, metric_type=kind,
                        value=round(value, 1), secondary_value=secondary, unit=unit, recorded_at=when,
                        notes=f'{MARK}: simulated measurement', created_at=when))
            for vi, offset in enumerate(offsets):
                when = stamp(self.today - timedelta(days=offset), 9 + pi % 4)
                key = f'{profile.pk}:{when.date()}'
                rec = MedicalRecord(patient=profile, doctor=doctor, symptoms='Demo follow-up: fatigue and routine review',
                    notes=f'{MARK}: simulated clinical encounter; not a real patient record', created_at=when)
                records.append(rec)
                visit = PatientVisitRecord(patient=profile.user, profile=profile,
                    doctor_name=f'Dr. {doctor.doctor_profile.first_name} {doctor.doctor_profile.last_name}',
                    department=doctor.doctor_profile.specialization, diagnosis=condition[1],
                    tests_performed='CBC, fasting glucose, lipid panel; BP 138/86; sugar 142',
                    prescription='Demo medication plan; see linked digital prescription',
                    doctor_notes=f'{MARK}: simulated follow-up {vi + 1}; review trends and adherence',
                    visit_date=when, created_at=when)
                visits.append(visit)
                diagnoses.append((rec, condition, when))
                for name, value, unit, lo, hi in [('Fasting Blood Sugar', 100 + (vi * 7 + pi) % 85, 'mg/dL', 70, 100),
                    ('HbA1c', 5.2 + (vi + pi) % 9 / 5, '%', 4, 5.6),
                    ('Total Cholesterol', 160 + (vi * 11 + pi) % 90, 'mg/dL', 100, 200),
                    ('Hemoglobin', 11.5 + (vi + pi) % 8 / 2, 'g/dL', 12, 16),
                    ('Creatinine', .7 + (vi + pi) % 7 / 10, 'mg/dL', .6, 1.2),
                    ('Vitamin D', 18 + (vi + pi) % 28, 'ng/mL', 20, 50)]:
                    labs.append(LabTestResult(patient=profile.user, profile=profile, visit_record=visit,
                        test_name=name, value=value, unit=unit, normal_min=lo, normal_max=hi,
                        tested_at=when, created_at=when))
                status = 'pending' if offset == 0 else 'partially_dispensed' if offset in (1, 3) else 'fully_dispensed'
                rx = Prescription(id=ident('rx:' + key), patient=profile, doctor=doctor, medical_record=rec,
                    status=status, created_at=when, updated_at=when,
                    security_hash=PrescriptionService.generate_security_hash(str(ident('rx:' + key))), qr_code_path='')
                if offset <= 28:
                    path = Path(settings.MEDIA_ROOT) / 'demo_year' / 'prescriptions' / f'{rx.pk}.png'
                    PrescriptionService.generate_qr_code(str(rx.pk), rx.security_hash, str(path))
                    rx.qr_code_path = str(path)
                prescriptions.append(rx)
                rxlines = []
                for mi in range(2):
                    medindex = (pi % 2) if mi == 0 else 6
                    duration = 14 if profile.relationship == 'self' else 28
                    line = PrescriptionMedicine(id=ident(f'line:{key}:{mi}'), prescription=rx,
                        medicine=meds[medindex], dosage=catalogue[medindex][1], frequency='Once daily',
                        duration_days=duration, quantity=duration,
                        special_instructions=f'{MARK}: simulated prescription for demonstration',
                        dispense_status='pending' if status == 'pending' or (status == 'partially_dispensed' and mi == 1) else 'dispensed',
                        dispensed_at=when if status != 'pending' and not (status == 'partially_dispensed' and mi == 1) else None,
                        created_at=when)
                    lines.append(line)
                    rxlines.append(line)
                # Non-overlapping maintenance courses plus a current active course.
                maintenance = offset >= 7 and offset % (14 if profile.relationship == 'self' else 28) == 0
                if maintenance or offset == 2:
                    end = when + timedelta(days=duration)
                    tracker = AdherenceTracker(id=ident('tracker:' + key), prescription=rx, patient=profile,
                        start_date=when, end_date=end, is_active=end > timezone.now(), created_at=when, updated_at=when)
                    for line in rxlines:
                        for d in range(duration):
                            scheduled = when.replace(hour=8 + (0 if line == rxlines[0] else 1)) + timedelta(days=d)
                            past = scheduled <= timezone.now()
                            taken = past and self.rng.random() > .12
                            doses.append(DoseSchedule(id=ident(f'dose:{line.pk}:{d}'), tracker=tracker,
                                medicine=line.medicine, prescription_medicine=line, scheduled_time=scheduled,
                                is_taken=taken, taken_at=scheduled + timedelta(minutes=15) if taken else None,
                                reminder_sent=False, created_at=scheduled))
                            tracker.expected_doses += int(past)
                            tracker.actual_doses += int(taken)
                    trackers.append(tracker)
                dispensedlines = [line for line in rxlines if line.dispense_status == 'dispensed']
                invoice = None
                if dispensedlines and vi % 8 != 0:
                    total = Decimal(sum(line.quantity * (2 + n) for n, line in enumerate(dispensedlines)))
                    taxable = (total / Decimal('1.05')).quantize(Decimal('.01'))
                    taxhalf = ((total - taxable) / 2).quantize(Decimal('.01'))
                    invoice = Invoice(id=ident('invoice:' + key), invoice_number=f'DY-{hashlib.sha256(key.encode()).hexdigest()[:20]}',
                        pharmacy=pharmacy, pharmacist=pharmacist, prescription=rx, patient=profile,
                        subtotal=total, total=total, taxable_value=taxable, cgst=taxhalf,
                        sgst=total - taxable - taxhalf, payment_method=['upi', 'cash', 'card'][vi % 3], created_at=when)
                    invoices.append(invoice)
                for n, line in enumerate(rxlines):
                    dispensed = line.dispense_status == 'dispensed'
                    dispensings.append(DispensingRecord(id=ident(f'dispense:{line.pk}'), prescription=rx,
                        prescription_medicine=line, pharmacy=pharmacy, pharmacist=pharmacist,
                        status='dispensed' if dispensed else 'unavailable', quantity_dispensed=line.quantity if dispensed else 0,
                        notes=f'{MARK}: simulated pharmacy transaction', dispensed_at=when,
                        unit_price=Decimal(2 + n) if dispensed else None,
                        amount=Decimal(line.quantity * (2 + n)) if dispensed else None,
                        invoice=invoice if dispensed else None, hsn_code=line.medicine.hsn_code, gst_rate=5,
                        taxable_value=(Decimal(line.quantity * (2 + n)) / Decimal('1.05')).quantize(Decimal('.01')) if dispensed and invoice else None,
                        tax_amount=(Decimal(line.quantity * (2 + n)) - (Decimal(line.quantity * (2 + n)) / Decimal('1.05')).quantize(Decimal('.01'))) if dispensed and invoice else None))
            for ai in range(12):
                when = stamp(self.today - timedelta(days=ai * 28))
                alerts.append(DashboardAlert(id=ident(f'alert:{profile.pk}:{ai}'), patient=profile.user,
                    profile=profile, alert_type='abnormal_labs' if ai % 2 else 'low_adherence',
                    severity=['low', 'medium', 'high'][ai % 3], title=f'Demo: follow-up review {ai + 1}',
                    message=f'{MARK}: simulated reminder to review laboratory trends and medication history.',
                    is_read=ai > 2, is_dismissed=ai > 5, created_at=when))
            if profile.relationship == 'self':
                for di in range(24):
                    downloads.append(DownloadLog(user=profile.user, file_type='medical_record',
                        file_name=f'Demo visit summary {di + 1}', downloaded_at=stamp(self.today - timedelta(days=di * 14))))
        insert(MedicalRecord, records)
        insert(PatientVisitRecord, visits)
        insert(Diagnosis, [Diagnosis(record=rec, icd_10_code=code, disease_name=name,
            severity=1 + i % 3, created_at=when) for i, (rec, (code, name), when) in enumerate(diagnoses)])
        insert(LabTestResult, labs)
        insert(HealthMetric, metrics)
        insert(Prescription, prescriptions)
        insert(PrescriptionMedicine, lines)
        insert(AdherenceTracker, trackers)
        insert(DoseSchedule, doses)
        insert(Invoice, invoices)
        insert(DispensingRecord, dispensings)
        insert(DashboardAlert, alerts)
        insert(DownloadLog, downloads)
        insert(ChronicCondition, conditions)
        insert(Allergy, allergies)
        # Distinct batches demonstrate stock, reorder and expiry states.
        for i, med in enumerate(Medicine.objects.filter(is_active=True)[:80]):
            PharmacyInventory.objects.get_or_create(pharmacy=pharmacy, batch_number=f'{MARK}-{i:03}',
                defaults={'medicine': med, 'quantity_in_stock': 5 if i % 11 == 0 else 80 + i * 9,
                    'low_stock_threshold': 15, 'unit_price': Decimal('2.50') + i,
                    'expiry_date': self.today + timedelta(days=20 if i % 9 == 0 else 180 + i * 5)})
        self.stdout.write(f'Clinical: {len(profiles)} profiles, {len(visits)} visits, {len(labs)} labs, '
            f'{len(metrics)} metrics, {len(prescriptions)} prescriptions, {len(doses)} doses, {len(invoices)} invoices')

    def surveillance(self):
        source = Path(settings.BASE_DIR).parent / 'ml_models' / 'training_data_v6'
        if not source.exists():
            raise CommandError('Generate training_data_v6 before seeding regional demo history')
        regions = pd.read_csv(source / 'regions.csv')
        for row in regions.itertuples():
            Region.objects.get_or_create(name=row.region_name, defaults={'district': row.city,
                'state': row.state, 'latitude': row.latitude, 'longitude': row.longitude,
                'population': row.population, 'area_sq_km': row.area_sq_km,
                'hospital_count': row.hospital_count, 'sanitation_index': row.sanitation_index * 10})
        byname = {r.name: r for r in Region.objects.filter(name__in=regions.region_name.tolist())}
        ridmap = {row.region_id: byname[row.region_name] for row in regions.itertuples()}
        self.region_ids = [r.pk for r in byname.values()]
        cases = pd.read_csv(source / 'disease_surveillance_historical.csv', parse_dates=['date'])
        shift = pd.Timestamp(self.today) - cases.date.max()
        cases.date += shift
        cases = cases[cases.date >= pd.Timestamp(self.start)]
        existing = set()
        for offset in range(0, self.days, 28):
            first = self.start + timedelta(days=offset)
            last = min(self.today, first + timedelta(days=27))
            existing.update(SurveillanceData.objects.filter(region_id__in=self.region_ids,
                date__gte=first, date__lte=last).order_by().values_list('region_id', 'disease_code', 'date'))
        rows = []
        for row in cases.itertuples():
            region = ridmap[row.region_id]
            date = row.date.date()
            if (region.pk, row.disease_code, date) in existing:
                continue
            rows.append(SurveillanceData(id=ident(f'surveillance:{region.pk}:{row.disease_code}:{date}'),
                region=region, date=date, disease_code=row.disease_code, disease_name=row.disease_name,
                case_count=row.case_count, average_severity=row.severity_avg,
                cases_per_100k=row.case_count / region.population * 100000,
                observation_status='observed', provenance='synthetic_demo', created_at=stamp(date)))
        insert(SurveillanceData, rows, ignore_conflicts=True)
        env = pd.read_csv(source / 'environmental_data.csv', parse_dates=['date'])
        env.date += shift
        env = env[env.date >= pd.Timestamp(self.start)]
        existingenv = set(EnvironmentalData.objects.filter(region_id__in=self.region_ids,
            date__gte=self.start, date__lte=self.today).order_by().values_list('region_id', 'date'))
        environments = []
        for row in env.itertuples():
            region = ridmap[row.region_id]
            date = row.date.date()
            if (region.pk, date) not in existingenv:
                environments.append(EnvironmentalData(id=ident(f'environment:{region.pk}:{date}'),
                    region=region, date=date, temperature=row.temperature_celsius, humidity=row.humidity_percent,
                    rainfall=row.rainfall_mm, aqi=row.aqi, pm25=row.pm25, pm10=row.pm10,
                    water_quality_index=row.water_quality_index * 10, created_at=stamp(date)))
        insert(EnvironmentalData, environments, ignore_conflicts=True)
        self.stdout.write(f'Surveillance: added {len(rows)} daily observations and {len(environments)} environmental observations')

    def ml(self):
        self.stdout.write('ML: loading active bundle')
        bundle, manifest = _bundle()
        self.stdout.write('ML: reading database observations')
        regions = pd.DataFrame(list(Region.objects.filter(pk__in=self.region_ids).values(
            'id', 'population', 'area_sq_km', 'hospital_count', 'sanitation_index', 'latitude', 'longitude'))).rename(columns={'id': 'region_id'})
        # Bounded reads avoid a large joined default-ordering sort and a single
        # huge response through the cloud database connection pool.
        case_rows = []
        for offset in range(0, self.days, 28):
            first = self.start + timedelta(days=offset)
            last = min(self.today, first + timedelta(days=27))
            case_rows.extend(SurveillanceData.objects.filter(region_id__in=self.region_ids,
                date__gte=first, date__lte=last).order_by().values('region_id', 'date', 'disease_code',
                    'disease_name', 'case_count', 'average_severity', 'observation_status'))
            self.stdout.write(f'ML: read observations through {last}')
        cases = pd.DataFrame(case_rows).rename(columns={'average_severity': 'severity_avg'})
        cases.loc[cases.observation_status != 'observed', ['case_count', 'severity_avg']] = np.nan
        env = pd.DataFrame(list(EnvironmentalData.objects.filter(region_id__in=self.region_ids,
            date__gte=self.start, date__lte=self.today).order_by().values('region_id', 'date', 'temperature',
                'humidity', 'rainfall', 'aqi', 'water_quality_index'))).rename(columns={
                    'temperature': 'temperature_celsius', 'humidity': 'humidity_percent', 'rainfall': 'rainfall_mm'})
        self.stdout.write(f'ML: building causal features for {len(cases)} observations')
        frame, X = build_features(prepare_daily(cases, regions, env), bundle['disease_codes'])
        self.stdout.write('Running active models against database observations...', ending='\n')
        good = (frame.observed == 1) & (frame.observed_28 >= 21)
        # Monthly risk snapshots plus all recent days, sufficient for meaningful history.
        offset = (pd.Timestamp(self.today) - frame.date).dt.days
        selected = good & ((offset <= 30) | (offset % 28 == 0))
        rf = frame.loc[selected]
        probabilities = risk_predict(bundle, X.loc[selected])
        scores = anomaly_predict(bundle, X.loc[selected])
        riskrows, anomalyrows = [], []
        for row, p, a in zip(rf.itertuples(), probabilities, scores):
            date = row.date.date()
            riskrows.append(RiskScore(id=ident(f'risk:{row.region_id}:{row.disease_code}:{date}'),
                region_id=row.region_id, disease_code=row.disease_code, disease_name=row.disease_name,
                calculation_date=date, risk_level=3 if p >= .85 else 2 if p >= .6 else 1 if p >= .3 else 0,
                risk_probability=float(p), inference_status='ok', model_version=bundle['version'],
                provenance='synthetic_model', data_cutoff=date, contributing_factors={
                    'outbreak_threshold': bundle['risk_threshold'], 'outbreak_detected': bool(p >= bundle['risk_threshold']),
                    'observation_window': 'day_to_date' if date == self.today else 'complete_day',
                    'calibration_note': 'Synthetic demo; complete-day calibration; intraday values provisional'}, created_at=stamp(date)))
            baseline = max(0, row.cases_mean_28)
            if a >= bundle['anomaly_threshold'] and row.case_count > baseline:
                anomalyrows.append(Anomaly(id=ident(f'anomaly:{row.region_id}:{row.disease_code}:{date}'),
                    inference_key=_inference_key('anomaly', row.region_id, row.disease_code, date),
                    region_id=row.region_id, disease_code=row.disease_code, disease_name=row.disease_name,
                    detection_date=date, anomaly_score=float(a), actual_cases=int(row.case_count),
                    expected_cases=baseline, deviation_percentage=(row.case_count-baseline)/max(baseline, 1)*100,
                    description=f'Synthetic demo: cases {row.case_count} versus prior baseline {baseline:.1f}',
                    is_resolved=date < self.today - timedelta(days=7), model_version=bundle['version'],
                    provenance='synthetic_model', data_cutoff=date, created_at=stamp(date)))
        self.stdout.write(f'ML: saving {len(riskrows)} risk and {len(anomalyrows)} anomaly results')
        insert(RiskScore, riskrows, restore_dates=False, update_conflicts=True,
            unique_fields=['region', 'disease_code', 'calculation_date'],
            update_fields=['risk_probability', 'risk_level', 'inference_status', 'model_version',
                'provenance', 'data_cutoff', 'contributing_factors'])
        insert(Anomaly, anomalyrows, restore_dates=False, ignore_conflicts=True)
        originmask = good & (frame.date == pd.Timestamp(self.today - timedelta(days=1)))
        origins, features = frame.loc[originmask].reset_index(drop=True), X.loc[originmask].reset_index(drop=True)
        predictions = []
        # Forecast all supported dashboard horizons from complete-day observations.
        for horizon in (7, 14, 30, 60, 90):
            self.stdout.write(f'ML: predicting {horizon}-day horizon')
            repeated = pd.concat([features] * horizon, ignore_index=True)
            f = pd.concat([origins] * horizon, ignore_index=True)
            leads = np.repeat(np.arange(2, horizon + 2), len(origins))
            predicted = forecast_predict(bundle, f, repeated, leads)
            for row, lead, p in zip(f.itertuples(), leads, predicted):
                target = self.today + timedelta(days=int(lead)-1)
                key = next((str(h) for h in sorted(map(int, bundle['forecast_intervals'])) if h >= lead), '')
                q = bundle['forecast_intervals'].get(key, bundle['forecast_interval_fallback'])
                width = q * math.sqrt(p + 1)
                predictions.append(Forecast(id=ident(f'forecast:{row.region_id}:{row.disease_code}:{self.today}:{target}:{horizon}'),
                    inference_key=_inference_key('forecast', row.region_id, row.disease_code, self.today, target, horizon),
                    region_id=row.region_id, disease_code=row.disease_code, disease_name=row.disease_name,
                    forecast_date=self.today, prediction_date=target, horizon_days=horizon,
                    predicted_cases=float(p), lower_bound=float(max(0, p-width)), upper_bound=float(p+width),
                    confidence=.95, model_version=bundle['version'], data_cutoff=self.today-timedelta(days=1),
                    provenance='synthetic_model', created_at=timezone.now()))
        self.stdout.write(f'ML: saving {len(predictions)} forecast rows')
        insert(Forecast, predictions, restore_dates=False, ignore_conflicts=True)
        for code in bundle['disease_codes']:
            ClusteringService.detect_clusters(code)
        self.demo_alerts(rf, probabilities, bundle)
        self.stdout.write(f'ML: {len(riskrows)} risk snapshots, {len(anomalyrows)} anomalies, {len(predictions)} forecast rows')

    def demo_alerts(self, frame, probabilities, bundle):
        # Explicit manual demo alerts exercise the dashboard; no notifications are sent.
        current = frame.assign(probability=probabilities)
        current = current[(current.date == pd.Timestamp(self.today)) & (current.probability >= bundle['risk_threshold'])]
        current = current[~current.disease_code.isin(['I10', 'E11', 'J45.9', 'K29.7'])].sort_values('probability', ascending=False).head(12)
        for row in current.itertuples():
            alert, _ = Alert.objects.get_or_create(id=ident(f'regional-alert:{row.region_id}:{row.disease_code}:{self.today}'),
                defaults={'alert_type': 'outbreak', 'disease_code': row.disease_code, 'disease_name': row.disease_name,
                    'severity': 'high' if row.probability >= .6 else 'medium', 'status': 'active', 'confidence': None,
                    'title': f'Demo: {row.disease_name} surveillance review',
                    'description': 'Simulated demonstration event. Not a verified public-health outbreak.',
                    'contributing_factors': {'demo': True, 'model_version': bundle['version'], 'risk_probability': float(row.probability)},
                    'recommended_actions': 'Demo workflow: review observations and reporting completeness.'})
            alert.affected_regions.add(row.region_id)
        # A labelled scenario for each patient's home region also demonstrates
        # regional alerts without claiming an infectious outbreak occurred.
        for name in ('Koramangala', 'Whitefield'):
            region = Region.objects.filter(name=name).first()
            if region is None:
                continue
            alert, _ = Alert.objects.get_or_create(id=ident(f'local-demo-alert:{name}:{self.today}'),
                defaults={'alert_type': 'environmental', 'disease_code': 'A09',
                    'disease_name': 'Gastroenteritis', 'severity': 'low', 'status': 'active',
                    'confidence': None, 'title': f'Demo: environmental monitoring in {name}',
                    'description': 'Manual synthetic scenario for dashboard demonstration; no verified public-health event.',
                    'contributing_factors': {'demo': True, 'scenario': 'environmental_review'},
                    'recommended_actions': 'Demo workflow: inspect environmental trends and reporting coverage.'})
            alert.affected_regions.add(region)
