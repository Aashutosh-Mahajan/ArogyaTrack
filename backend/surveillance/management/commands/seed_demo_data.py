"""
Management command to seed demo data from ML models dataset
────────────────────────────────────────────────────────────
IMPORTANT: This loads a SUBSET of data for demo purposes only.
Not the entire dataset - just enough to showcase the admin dashboard.

Seeds recent-dated data so all dashboard widgets display properly:
  - SurveillanceData    (last 30 days, spread from CSV)
  - Alerts              (active)
  - Anomalies           (unresolved)
  - RiskScores          (today)
  - Forecasts           (next 7 days)
  - Clusters            (active)
  - EnvironmentalData   (last 14 days)
  - Users / Profiles / MedicalRecords / Diagnoses
"""
import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from surveillance.models import (
    Region, SurveillanceData, Cluster, ClusterRegion,
    Forecast, Anomaly, RiskScore, EnvironmentalData,
    Alert, Notification,
)
from patients.models import Profile
from medical.models import MedicalRecord, Diagnosis, ChronicCondition, Allergy

User = get_user_model()

# ── Disease catalogue (from ML dataset) ──────────────────────────
DISEASES = [
    ('A90',   'Dengue Fever'),
    ('U07.1', 'COVID-19'),
    ('A09',   'Gastroenteritis'),
    ('B05',   'Measles'),
    ('J18.9', 'Pneumonia'),
    ('J10.1', 'Influenza'),
    ('I10',   'Hypertension'),
    ('E11',   'Type 2 Diabetes'),
    ('J45.9', 'Asthma'),
    ('B50.0', 'Plasmodium Falciparum Malaria'),
    ('K29.7', 'Gastritis'),
    ('A00.9', 'Cholera'),
    ('A39.9', 'Meningococcal Infection'),
    ('B16',   'Hepatitis B'),
    ('A37.9', 'Whooping Cough'),
]

SYMPTOMS_MAP = {
    'Dengue Fever':           'High fever, severe headache, joint pain, rash',
    'COVID-19':               'Fever, dry cough, tiredness, loss of taste or smell',
    'Gastroenteritis':        'Diarrhea, vomiting, abdominal cramps',
    'Measles':                'Fever, cough, runny nose, red eyes, rash',
    'Pneumonia':              'Chest pain, cough with phlegm, fever, difficulty breathing',
    'Influenza':              'Fever, chills, muscle aches, cough, sore throat',
    'Hypertension':           'Headaches, shortness of breath, nosebleeds',
    'Type 2 Diabetes':        'Increased thirst, frequent urination, fatigue',
    'Asthma':                 'Shortness of breath, chest tightness, wheezing',
    'Plasmodium Falciparum Malaria': 'High fever, chills, sweating, headache, nausea',
    'Gastritis':              'Stomach pain, nausea, bloating, indigestion',
    'Cholera':                'Severe watery diarrhea, dehydration, vomiting',
    'Meningococcal Infection': 'Sudden high fever, stiff neck, severe headache, rash',
    'Hepatitis B':            'Fatigue, jaundice, abdominal pain, dark urine',
    'Whooping Cough':         'Severe coughing fits, whooping sound, vomiting after cough',
}


class Command(BaseCommand):
    help = 'Seed demo data from ML models dataset (LIMITED SUBSET for dashboard demo)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--regions', type=int, default=50,
            help='Number of regions to load (default: 50)',
        )
        parser.add_argument(
            '--days', type=int, default=30,
            help='Days of surveillance history to generate (default: 30)',
        )
        parser.add_argument(
            '--clear', action='store_true',
            help='Clear existing data before seeding',
        )

    def handle(self, *args, **options):
        regions_limit = options['regions']
        days = options['days']
        clear_data = options['clear']
        self.today = timezone.now().date()

        self.stdout.write(self.style.WARNING(
            f'\n📊 Seeding DEMO DATA (Limited Subset)\n'
            f'   Regions     : {regions_limit}\n'
            f'   Days of data: {days}\n'
            f'   Date range  : {self.today - timedelta(days=days)} → {self.today}\n'
            f'   Clear first : {clear_data}\n'
        ))

        ml_path = Path(__file__).resolve().parent.parent.parent.parent.parent / 'ml_models'
        dataset_path = ml_path / 'india_surveillance_extreme_quality'
        env_file = dataset_path / 'environmental_data.csv'

        if not dataset_path.exists():
            self.stdout.write(self.style.ERROR(f'❌ Dataset not found: {dataset_path}'))
            return

        try:
            with transaction.atomic():
                if clear_data:
                    self._clear()

                self._seed_users()
                regions = self._seed_regions(dataset_path, regions_limit)
                self._seed_surveillance(dataset_path, regions, days)
                self._seed_environmental(env_file, regions, days)
                self._seed_risk_scores(regions)
                self._seed_anomalies(regions)
                self._seed_clusters(regions)
                self._seed_alerts(regions)
                self._seed_forecasts(regions)
                self._seed_patients_and_medical()

            self.stdout.write(self.style.SUCCESS(
                '\n✅ Demo data seeded!  All dashboard widgets should now display data.\n'
            ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error: {e}'))
            raise

    # ── helpers ──────────────────────────────────────────────────────

    def _clear(self):
        self.stdout.write('🗑️  Clearing …')
        Notification.objects.all().delete()
        Alert.objects.all().delete()
        Forecast.objects.all().delete()
        Anomaly.objects.all().delete()
        RiskScore.objects.all().delete()
        ClusterRegion.objects.all().delete()
        Cluster.objects.all().delete()
        EnvironmentalData.objects.all().delete()
        Diagnosis.objects.all().delete()
        MedicalRecord.objects.all().delete()
        ChronicCondition.objects.all().delete()
        Allergy.objects.all().delete()
        Profile.objects.all().delete()
        SurveillanceData.objects.all().delete()
        Region.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        self.stdout.write(self.style.SUCCESS('   ✓ cleared'))

    # ── Users ────────────────────────────────────────────────────────

    def _seed_users(self):
        self.stdout.write('👥 Users …')
        if not User.objects.filter(email='admin@demo.com').exists():
            User.objects.create_user(
                email='admin@demo.com', password='demo123',
                role=User.Role.ADMIN, is_staff=True,
                verification_status=User.VerificationStatus.VERIFIED,
            )
        for i in range(1, 6):
            email = f'doctor{i}@demo.com'
            if not User.objects.filter(email=email).exists():
                User.objects.create_user(
                    email=email, password='demo123',
                    role=User.Role.DOCTOR,
                    verification_status=User.VerificationStatus.VERIFIED,
                )
        for i in range(1, 11):
            email = f'patient{i}@demo.com'
            if not User.objects.filter(email=email).exists():
                User.objects.create_user(
                    email=email, password='demo123',
                    role=User.Role.PATIENT,
                    verification_status=User.VerificationStatus.VERIFIED,
                )
        self.stdout.write(self.style.SUCCESS(
            f'   ✓ {User.objects.filter(is_superuser=False).count()} users'
        ))

    # ── Regions ──────────────────────────────────────────────────────

    def _seed_regions(self, dataset_path, limit):
        self.stdout.write(f'🗺️  Regions (limit {limit}) …')
        regions = []
        with open(dataset_path / 'regions.csv', encoding='utf-8') as f:
            for i, row in enumerate(csv.DictReader(f)):
                if i >= limit:
                    break
                r, _ = Region.objects.get_or_create(
                    name=row['region_name'],
                    defaults={
                        'district': row['city'],
                        'state': row['state'],
                        'country': 'India',
                        'latitude': float(row['latitude']),
                        'longitude': float(row['longitude']),
                        'population': int(row['population']),
                        'hospital_count': int(row['hospital_count']),
                        'sanitation_index': float(row['sanitation_index']),
                    },
                )
                regions.append(r)
        self.stdout.write(self.style.SUCCESS(f'   ✓ {len(regions)} regions'))
        return regions

    # ── Surveillance data (RECENT dates) ─────────────────────────────

    def _seed_surveillance(self, dataset_path, regions, days):
        """
        Re-maps historical CSV rows onto RECENT dates so that
        dashboard queries (today / last 7 days / last 30 days) find data.
        """
        self.stdout.write(f'📈 Surveillance ({days} days) …')
        region_map = {i + 1: r for i, r in enumerate(regions)}
        start = self.today - timedelta(days=days)

        # Read a pool of rows from the CSV (only for our region ids)
        pool = []
        with open(dataset_path / 'disease_surveillance_historical.csv', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                rid = int(row['region_id'])
                if rid in region_map:
                    pool.append(row)
                if len(pool) >= 5000:        # cap – enough for 30 days × 50 regions
                    break

        # Spread rows across [start … today]
        batch, count = [], 0
        for idx, row in enumerate(pool):
            day_offset = idx % (days + 1)
            date = start + timedelta(days=day_offset)
            region = region_map[int(row['region_id'])]
            cases = int(row['case_count'])
            pop = region.population or 1
            batch.append(SurveillanceData(
                date=date,
                region=region,
                disease_code=row['disease_code'],
                disease_name=row['disease_name'],
                case_count=cases,
                average_severity=float(row['severity_avg']),
                cases_per_100k=(cases / pop) * 100_000,
            ))
            count += 1
            if len(batch) >= 500:
                SurveillanceData.objects.bulk_create(batch, ignore_conflicts=True)
                batch = []
        if batch:
            SurveillanceData.objects.bulk_create(batch, ignore_conflicts=True)
        self.stdout.write(self.style.SUCCESS(f'   ✓ {count} surveillance records'))

    # ── Environmental data ───────────────────────────────────────────

    def _seed_environmental(self, env_file, regions, days):
        self.stdout.write('🌡️  Environmental …')
        region_map = {i + 1: r for i, r in enumerate(regions)}
        pool = []
        with open(env_file, encoding='utf-8') as f:
            for row in csv.DictReader(f):
                rid = int(row['region_id'])
                if rid in region_map:
                    pool.append(row)
                if len(pool) >= 2000:
                    break

        batch, count = [], 0
        env_days = min(days, 14)
        start = self.today - timedelta(days=env_days)
        for idx, row in enumerate(pool):
            day_offset = idx % (env_days + 1)
            date = start + timedelta(days=day_offset)
            region = region_map[int(row['region_id'])]
            batch.append(EnvironmentalData(
                region=region, date=date,
                temperature=float(row['temperature_celsius']),
                humidity=float(row['humidity_percent']),
                rainfall=float(row['rainfall_mm']),
                aqi=int(row['aqi']),
                pm25=float(row['pm25']),
                pm10=float(row['pm10']),
                water_quality_index=float(row['water_quality_index']),
            ))
            count += 1
            if len(batch) >= 500:
                EnvironmentalData.objects.bulk_create(batch, ignore_conflicts=True)
                batch = []
        if batch:
            EnvironmentalData.objects.bulk_create(batch, ignore_conflicts=True)
        self.stdout.write(self.style.SUCCESS(f'   ✓ {count} environmental records'))

    # ── Risk Scores (today) ──────────────────────────────────────────

    def _seed_risk_scores(self, regions):
        self.stdout.write('⚠️  Risk scores …')
        batch = []
        for region in regions:
            for code, name in random.sample(DISEASES, random.randint(2, 4)):
                level = random.choices([0, 1, 2, 3], weights=[40, 30, 20, 10])[0]
                prob = {0: random.uniform(0.05, 0.25),
                        1: random.uniform(0.25, 0.50),
                        2: random.uniform(0.50, 0.80),
                        3: random.uniform(0.80, 0.98)}[level]
                batch.append(RiskScore(
                    region=region, disease_code=code, disease_name=name,
                    calculation_date=self.today,
                    risk_level=level,
                    risk_probability=round(prob, 3),
                    contributing_factors={
                        'case_trend': round(random.uniform(-0.5, 0.5), 3),
                        'population_density': round(random.uniform(0.1, 0.9), 3),
                        'sanitation_index': round(random.uniform(-0.3, 0.3), 3),
                        'environmental': round(random.uniform(0.0, 0.4), 3),
                    },
                ))
        RiskScore.objects.bulk_create(batch, ignore_conflicts=True)
        high = sum(1 for r in batch if r.risk_level >= 2)
        self.stdout.write(self.style.SUCCESS(
            f'   ✓ {len(batch)} risk scores ({high} high/critical)'
        ))

    # ── Anomalies ────────────────────────────────────────────────────

    def _seed_anomalies(self, regions):
        self.stdout.write('🔍 Anomalies …')
        batch = []
        for _ in range(random.randint(8, 15)):
            region = random.choice(regions)
            code, name = random.choice(DISEASES)
            actual = random.randint(80, 400)
            expected = random.randint(20, 100)
            deviation = ((actual - expected) / expected) * 100
            batch.append(Anomaly(
                region=region, disease_code=code, disease_name=name,
                detection_date=self.today - timedelta(days=random.randint(0, 5)),
                anomaly_score=round(random.uniform(0.5, 1.0), 3),
                actual_cases=actual, expected_cases=expected,
                deviation_percentage=round(deviation, 1),
                description=f'Unusual spike of {name} detected in {region.name}',
                is_resolved=False,
            ))
        Anomaly.objects.bulk_create(batch)
        self.stdout.write(self.style.SUCCESS(f'   ✓ {len(batch)} anomalies'))

    # ── Clusters ─────────────────────────────────────────────────────

    def _seed_clusters(self, regions):
        self.stdout.write('🎯 Clusters …')
        severities = ['low', 'medium', 'high', 'critical']
        count = 0
        for code, name in random.sample(DISEASES[:8], 5):
            for _ in range(random.randint(1, 3)):
                center = random.choice(regions)
                cluster_regions = random.sample(regions, min(random.randint(3, 6), len(regions)))
                total = sum(random.randint(40, 300) for _ in cluster_regions)
                pop = sum(r.population for r in cluster_regions)
                c = Cluster.objects.create(
                    disease_code=code, disease_name=name,
                    detection_date=self.today - timedelta(days=random.randint(0, 14)),
                    centroid_lat=center.latitude, centroid_lon=center.longitude,
                    radius_km=round(random.uniform(3, 30), 1),
                    total_cases=total, total_population=pop,
                    severity=random.choice(severities),
                    growth_rate=round(random.uniform(0.3, 4.0), 2),
                    is_active=True,
                )
                for r in cluster_regions:
                    ClusterRegion.objects.create(
                        cluster=c, region=r,
                        case_count=random.randint(40, 300),
                    )
                count += 1
        self.stdout.write(self.style.SUCCESS(f'   ✓ {count} clusters'))

    # ── Alerts ───────────────────────────────────────────────────────

    def _seed_alerts(self, regions):
        self.stdout.write('🚨 Alerts …')
        alert_types = ['outbreak', 'cluster', 'forecast', 'anomaly', 'environmental']
        severities = ['low', 'medium', 'high', 'critical']
        count = 0
        for _ in range(random.randint(6, 12)):
            code, name = random.choice(DISEASES)
            sev = random.choices(severities, weights=[15, 30, 35, 20])[0]
            atype = random.choice(alert_types)
            affected = random.sample(regions, min(random.randint(2, 5), len(regions)))
            alert = Alert.objects.create(
                alert_type=atype, disease_code=code, disease_name=name,
                severity=sev, status='active',
                confidence=round(random.uniform(0.60, 0.99), 2),
                title=f'{sev.title()} {atype.title()} Alert: {name}',
                description=(
                    f'A {sev} {atype} alert has been generated for {name} '
                    f'({code}) affecting {len(affected)} regions. '
                    f'Immediate attention recommended.'
                ),
                predicted_impact=f'Estimated {random.randint(100, 2000)} additional cases over next 7 days',
                contributing_factors={
                    'case_surge': round(random.uniform(1.5, 5.0), 2),
                    'cluster_growth': round(random.uniform(0.5, 3.0), 2),
                    'environmental_risk': round(random.uniform(0.1, 0.9), 2),
                },
                recommended_actions=(
                    'Deploy additional surveillance teams. '
                    'Increase testing capacity in affected wards. '
                    'Coordinate with local health centres for resource allocation.'
                ),
                escalation_level=random.randint(1, 3),
            )
            alert.affected_regions.set(affected)
            count += 1
        self.stdout.write(self.style.SUCCESS(f'   ✓ {count} active alerts'))

    # ── Forecasts (next 7 days) ──────────────────────────────────────

    def _seed_forecasts(self, regions):
        self.stdout.write('📉 Forecasts …')
        batch = []
        for code, name in DISEASES[:5]:
            for region in random.sample(regions, min(10, len(regions))):
                base = random.randint(30, 200)
                for d in range(1, 8):
                    predicted = base + random.randint(-10, 30) + d * random.randint(0, 5)
                    margin = random.randint(8, 25)
                    batch.append(Forecast(
                        region=region, disease_code=code, disease_name=name,
                        forecast_date=self.today,
                        prediction_date=self.today + timedelta(days=d),
                        horizon_days=7,
                        predicted_cases=predicted,
                        lower_bound=max(0, predicted - margin),
                        upper_bound=predicted + margin,
                        confidence=round(random.uniform(0.70, 0.95), 2),
                    ))
        Forecast.objects.bulk_create(batch)
        self.stdout.write(self.style.SUCCESS(f'   ✓ {len(batch)} forecast records'))

    # ── Patients & Medical ───────────────────────────────────────────

    def _seed_patients_and_medical(self):
        self.stdout.write('🏥 Profiles & records …')
        patients = list(User.objects.filter(role=User.Role.PATIENT))
        doctors = list(User.objects.filter(role=User.Role.DOCTOR))
        first_names = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram',
                       'Anjali', 'Rohan', 'Neha', 'Karan', 'Divya']
        last_names = ['Kumar', 'Sharma', 'Patel', 'Singh', 'Reddy',
                      'Verma', 'Gupta', 'Mehta', 'Shah', 'Joshi']
        blood_groups = list(Profile.BloodGroup.values)
        genders = list(Profile.Gender.values)
        districts = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Ahmedabad',
                     'Kolkata', 'Hyderabad', 'Pune']
        states = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu',
                  'Gujarat', 'West Bengal', 'Telangana']

        profile_count, rec_count = 0, 0
        for patient in patients:
            name = f'{random.choice(first_names)} {random.choice(last_names)}'
            age = random.randint(18, 75)
            dist, st = random.choice(districts), random.choice(states)
            p = Profile.objects.create(
                user=patient, name=name, age=age,
                date_of_birth=self.today - timedelta(days=age * 365),
                gender=random.choice(genders),
                blood_group=random.choice(blood_groups),
                relationship=Profile.Relationship.SELF,
                phone=f'+91{random.randint(7000000000, 9999999999)}',
                district=dist, state=st, country='India',
                pincode=f'{random.randint(100000, 999999)}',
                address=f'{random.randint(1, 200)}, MG Road',
            )
            profile_count += 1

            if random.random() > 0.5:
                fam_age = random.randint(1, 80)
                Profile.objects.create(
                    user=patient,
                    name=f'{random.choice(first_names)} {name.split()[1]}',
                    age=fam_age,
                    date_of_birth=self.today - timedelta(days=fam_age * 365),
                    gender=random.choice(genders),
                    blood_group=random.choice(blood_groups),
                    relationship=random.choice([
                        Profile.Relationship.SPOUSE,
                        Profile.Relationship.CHILD,
                        Profile.Relationship.PARENT]),
                    phone=f'+91{random.randint(7000000000, 9999999999)}',
                    district=dist, state=st, country='India',
                    pincode=p.pincode, address=p.address,
                )
                profile_count += 1

        profiles = list(Profile.objects.all())
        allergy_pool = [
            ('Penicillin', 'Anaphylaxis', 4),
            ('Peanuts', 'Hives', 3),
            ('Dust', 'Respiratory distress', 2),
            ('Aspirin', 'Skin rash', 2),
        ]
        for prof in random.sample(profiles, min(10, len(profiles))):
            a, r, s = random.choice(allergy_pool)
            Allergy.objects.create(profile=prof, allergen=a, reaction_type=r, severity=s)

        for prof in profiles:
            for _ in range(random.randint(1, 4)):
                doctor = random.choice(doctors)
                dt = timezone.now() - timedelta(days=random.randint(1, 180))
                code, name = random.choice(DISEASES)
                sev = random.randint(1, 4)
                rec = MedicalRecord.objects.create(
                    patient=prof, doctor=doctor,
                    symptoms=SYMPTOMS_MAP.get(name, 'General symptoms'),
                    notes=f'Patient examined. Treatment prescribed for {name}.',
                    created_at=dt,
                )
                Diagnosis.objects.create(
                    record=rec, icd_10_code=code,
                    disease_name=name, severity=sev, created_at=dt,
                )
                rec_count += 1

                if name in ('Hypertension', 'Type 2 Diabetes', 'Asthma'):
                    if not ChronicCondition.objects.filter(profile=prof, icd_10_code=code).exists():
                        ChronicCondition.objects.create(
                            profile=prof, icd_10_code=code,
                            disease_name=name, is_active=True,
                        )

        self.stdout.write(self.style.SUCCESS(
            f'   ✓ {profile_count} profiles, {rec_count} medical records'
        ))
