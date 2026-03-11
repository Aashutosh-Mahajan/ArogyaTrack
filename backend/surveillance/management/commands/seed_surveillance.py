"""
Management command to seed surveillance data WITHOUT external CSV files.
Generates realistic synthetic data for all dashboard widgets.
"""
import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from surveillance.models import (
    Region, SurveillanceData, Cluster, ClusterRegion,
    Forecast, Anomaly, RiskScore, EnvironmentalData,
    Alert,
)

# ── Indian regions with real coordinates ────────────────────────────
REGIONS_DATA = [
    # Maharashtra
    {'name': 'Andheri West', 'district': 'Mumbai Suburban', 'state': 'Maharashtra', 'lat': 19.1357, 'lon': 72.8262, 'pop': 650000, 'hosp': 12, 'san': 6.5},
    {'name': 'Borivali', 'district': 'Mumbai Suburban', 'state': 'Maharashtra', 'lat': 19.2304, 'lon': 72.8569, 'pop': 800000, 'hosp': 8, 'san': 5.8},
    {'name': 'Thane', 'district': 'Thane', 'state': 'Maharashtra', 'lat': 19.2183, 'lon': 72.9781, 'pop': 1841488, 'hosp': 15, 'san': 5.5},
    {'name': 'Pune City', 'district': 'Pune', 'state': 'Maharashtra', 'lat': 18.5204, 'lon': 73.8567, 'pop': 3124458, 'hosp': 20, 'san': 7.0},
    {'name': 'Nagpur', 'district': 'Nagpur', 'state': 'Maharashtra', 'lat': 21.1458, 'lon': 79.0882, 'pop': 2405421, 'hosp': 18, 'san': 5.2},
    {'name': 'Nashik', 'district': 'Nashik', 'state': 'Maharashtra', 'lat': 19.9975, 'lon': 73.7898, 'pop': 1486053, 'hosp': 10, 'san': 5.0},
    # Karnataka
    {'name': 'Koramangala', 'district': 'Bangalore Urban', 'state': 'Karnataka', 'lat': 12.9352, 'lon': 77.6245, 'pop': 180000, 'hosp': 6, 'san': 7.2},
    {'name': 'Whitefield', 'district': 'Bangalore Urban', 'state': 'Karnataka', 'lat': 12.9698, 'lon': 77.7500, 'pop': 250000, 'hosp': 5, 'san': 6.8},
    {'name': 'Mysore', 'district': 'Mysore', 'state': 'Karnataka', 'lat': 12.2958, 'lon': 76.6394, 'pop': 920550, 'hosp': 10, 'san': 6.0},
    {'name': 'Hubli', 'district': 'Dharwad', 'state': 'Karnataka', 'lat': 15.3647, 'lon': 75.1240, 'pop': 943857, 'hosp': 8, 'san': 5.3},
    # Delhi
    {'name': 'Dwarka', 'district': 'South West Delhi', 'state': 'Delhi', 'lat': 28.5921, 'lon': 77.0460, 'pop': 700000, 'hosp': 7, 'san': 6.0},
    {'name': 'Rohini', 'district': 'North West Delhi', 'state': 'Delhi', 'lat': 28.7495, 'lon': 77.0736, 'pop': 1500000, 'hosp': 12, 'san': 5.5},
    {'name': 'Saket', 'district': 'South Delhi', 'state': 'Delhi', 'lat': 28.5244, 'lon': 77.2066, 'pop': 300000, 'hosp': 5, 'san': 7.0},
    {'name': 'Karol Bagh', 'district': 'Central Delhi', 'state': 'Delhi', 'lat': 28.6519, 'lon': 77.1909, 'pop': 400000, 'hosp': 6, 'san': 5.0},
    # Tamil Nadu
    {'name': 'T Nagar', 'district': 'Chennai', 'state': 'Tamil Nadu', 'lat': 13.0418, 'lon': 80.2341, 'pop': 400000, 'hosp': 8, 'san': 6.5},
    {'name': 'Velachery', 'district': 'Chennai', 'state': 'Tamil Nadu', 'lat': 12.9759, 'lon': 80.2209, 'pop': 350000, 'hosp': 5, 'san': 6.0},
    {'name': 'Coimbatore', 'district': 'Coimbatore', 'state': 'Tamil Nadu', 'lat': 11.0168, 'lon': 76.9558, 'pop': 1061447, 'hosp': 14, 'san': 6.8},
    {'name': 'Madurai', 'district': 'Madurai', 'state': 'Tamil Nadu', 'lat': 9.9252, 'lon': 78.1198, 'pop': 1017865, 'hosp': 11, 'san': 5.5},
    # West Bengal
    {'name': 'Salt Lake City', 'district': 'North 24 Parganas', 'state': 'West Bengal', 'lat': 22.5843, 'lon': 88.4175, 'pop': 280000, 'hosp': 4, 'san': 6.0},
    {'name': 'Howrah', 'district': 'Howrah', 'state': 'West Bengal', 'lat': 22.5958, 'lon': 88.2636, 'pop': 1077075, 'hosp': 9, 'san': 4.8},
    # Gujarat
    {'name': 'Ahmedabad', 'district': 'Ahmedabad', 'state': 'Gujarat', 'lat': 23.0225, 'lon': 72.5714, 'pop': 5577940, 'hosp': 25, 'san': 6.2},
    {'name': 'Surat', 'district': 'Surat', 'state': 'Gujarat', 'lat': 21.1702, 'lon': 72.8311, 'pop': 4467797, 'hosp': 20, 'san': 6.0},
    # Rajasthan
    {'name': 'Jaipur', 'district': 'Jaipur', 'state': 'Rajasthan', 'lat': 26.9124, 'lon': 75.7873, 'pop': 3046163, 'hosp': 18, 'san': 5.5},
    {'name': 'Jodhpur', 'district': 'Jodhpur', 'state': 'Rajasthan', 'lat': 26.2389, 'lon': 73.0243, 'pop': 1033918, 'hosp': 8, 'san': 4.5},
    # Uttar Pradesh
    {'name': 'Lucknow', 'district': 'Lucknow', 'state': 'Uttar Pradesh', 'lat': 26.8467, 'lon': 80.9462, 'pop': 2817105, 'hosp': 16, 'san': 5.0},
    {'name': 'Noida', 'district': 'Gautam Buddha Nagar', 'state': 'Uttar Pradesh', 'lat': 28.5355, 'lon': 77.3910, 'pop': 637272, 'hosp': 8, 'san': 6.5},
    {'name': 'Varanasi', 'district': 'Varanasi', 'state': 'Uttar Pradesh', 'lat': 25.3176, 'lon': 82.9739, 'pop': 1201815, 'hosp': 10, 'san': 4.2},
    # Telangana
    {'name': 'Hyderabad', 'district': 'Hyderabad', 'state': 'Telangana', 'lat': 17.3850, 'lon': 78.4867, 'pop': 6809970, 'hosp': 30, 'san': 6.8},
    {'name': 'Secunderabad', 'district': 'Hyderabad', 'state': 'Telangana', 'lat': 17.4399, 'lon': 78.4983, 'pop': 520000, 'hosp': 7, 'san': 6.3},
    # Kerala
    {'name': 'Kochi', 'district': 'Ernakulam', 'state': 'Kerala', 'lat': 9.9312, 'lon': 76.2673, 'pop': 677381, 'hosp': 12, 'san': 7.5},
    {'name': 'Thiruvananthapuram', 'district': 'Thiruvananthapuram', 'state': 'Kerala', 'lat': 8.5241, 'lon': 76.9366, 'pop': 957730, 'hosp': 14, 'san': 7.8},
    # Other
    {'name': 'Bhopal', 'district': 'Bhopal', 'state': 'Madhya Pradesh', 'lat': 23.2599, 'lon': 77.4126, 'pop': 1798218, 'hosp': 12, 'san': 5.2},
    {'name': 'Patna', 'district': 'Patna', 'state': 'Bihar', 'lat': 25.6093, 'lon': 85.1376, 'pop': 1684222, 'hosp': 10, 'san': 4.0},
    {'name': 'Chandigarh', 'district': 'Chandigarh', 'state': 'Chandigarh', 'lat': 30.7333, 'lon': 76.7794, 'pop': 1055450, 'hosp': 10, 'san': 7.5},
    {'name': 'Guwahati', 'district': 'Kamrup Metropolitan', 'state': 'Assam', 'lat': 26.1445, 'lon': 91.7362, 'pop': 968000, 'hosp': 8, 'san': 5.0},
]

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


class Command(BaseCommand):
    help = 'Seed surveillance data (standalone, no CSV needed)'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing data first')
        parser.add_argument('--days', type=int, default=30, help='Days of history (default 30)')
        parser.add_argument('--run-ml', action='store_true', help='Run actual ML pipeline after seeding (uses saved models)')

    def handle(self, *args, **options):
        clear = options['clear']
        days = options['days']
        today = timezone.now().date()

        self.stdout.write(self.style.WARNING(
            f'\nSeeding surveillance data (standalone)\n'
            f'  Days: {days}  |  Regions: {len(REGIONS_DATA)}\n'
            f'  Date range: {today - timedelta(days=days)} → {today}\n'
        ))

        with transaction.atomic():
            if clear:
                self.stdout.write('Clearing existing data...')
                Alert.objects.all().delete()
                Forecast.objects.all().delete()
                Anomaly.objects.all().delete()
                RiskScore.objects.all().delete()
                ClusterRegion.objects.all().delete()
                Cluster.objects.all().delete()
                EnvironmentalData.objects.all().delete()
                SurveillanceData.objects.all().delete()
                Region.objects.all().delete()
                self.stdout.write(self.style.SUCCESS('  Cleared.'))

            regions = self._seed_regions()
            self._seed_surveillance(regions, today, days)
            self._seed_environmental(regions, today, days)
            self._seed_risk_scores(regions, today)
            self._seed_anomalies(regions, today)
            self._seed_clusters(regions, today)
            self._seed_alerts(regions)
            self._seed_forecasts(regions, today)

        self.stdout.write(self.style.SUCCESS('\nAll surveillance data seeded successfully!\n'))

        if options.get('run_ml'):
            self._run_ml_pipeline()

    def _run_ml_pipeline(self):
        """Run the actual ML pipeline services on the seeded data."""
        from surveillance.services import (
            ClusteringService, ForecastingService,
            AnomalyDetectionService, RiskScoringService, AlertService,
        )
        self.stdout.write('\n--- Running ML Pipeline on seeded data ---')
        today = timezone.now().date()
        diseases_to_run = [code for code, _ in DISEASES[:5]]  # Top 5 diseases

        for disease_code in diseases_to_run:
            disease_name = dict(DISEASES).get(disease_code, disease_code)
            self.stdout.write(f'\n  Processing {disease_name} ({disease_code})...')

            # 1. Clustering (DBSCAN)
            try:
                clusters = ClusteringService.detect_clusters(disease_code)
                self.stdout.write(f'    DBSCAN: {len(clusters)} clusters detected')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'    DBSCAN failed: {e}'))

            # 2. Forecasting, Anomaly Detection, Risk Scoring (per region)
            regions = Region.objects.filter(
                surveillance_data__disease_code=disease_code,
                surveillance_data__date__gte=today - timedelta(days=7),
            ).distinct()[:10]  # Limit for speed

            fc_count, anom_count, risk_count = 0, 0, 0
            for region in regions:
                # Forecasting (7, 14, 30 day horizons)
                for horizon in [7, 14, 30]:
                    try:
                        forecasts = ForecastingService.generate_forecast(region, disease_code, horizon)
                        fc_count += len(forecasts)
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f'    Forecast ({horizon}d) failed for {region.name}: {e}'))

                # Anomaly Detection
                try:
                    anomaly = AnomalyDetectionService.detect_anomalies(region, disease_code)
                    if anomaly:
                        anom_count += 1
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'    Anomaly detection failed for {region.name}: {e}'))

                # Risk Scoring
                try:
                    RiskScoringService.calculate_risk_score(region, disease_code)
                    risk_count += 1
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'    Risk scoring failed for {region.name}: {e}'))

            self.stdout.write(f'    Forecasts: {fc_count} | Anomalies: {anom_count} | Risk scores: {risk_count}')

            # 3. Alert Evaluation
            try:
                alerts = AlertService.evaluate_alerts(disease_code)
                self.stdout.write(f'    Alerts generated: {len(alerts)}')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'    Alert evaluation failed: {e}'))

        self.stdout.write(self.style.SUCCESS('\n--- ML Pipeline complete ---\n'))

    def _seed_regions(self):
        self.stdout.write('Seeding regions...')
        regions = []
        for rd in REGIONS_DATA:
            r, _ = Region.objects.get_or_create(
                name=rd['name'],
                defaults={
                    'district': rd['district'],
                    'state': rd['state'],
                    'country': 'India',
                    'latitude': rd['lat'],
                    'longitude': rd['lon'],
                    'population': rd['pop'],
                    'hospital_count': rd['hosp'],
                    'sanitation_index': rd['san'],
                },
            )
            regions.append(r)
        self.stdout.write(self.style.SUCCESS(f'  {len(regions)} regions'))
        return regions

    def _seed_surveillance(self, regions, today, days):
        self.stdout.write('Seeding surveillance data...')
        batch = []
        start = today - timedelta(days=days)

        for region in regions:
            # Each region gets data for a random subset of diseases across days
            region_diseases = random.sample(DISEASES, random.randint(5, 10))
            for day_offset in range(days + 1):
                date = start + timedelta(days=day_offset)
                # 60% chance of having data for a given day (realistic gaps)
                for code, name in region_diseases:
                    if random.random() < 0.6:
                        cases = random.randint(5, 250)
                        severity = round(random.uniform(1.0, 4.0), 2)
                        pop = region.population or 1
                        batch.append(SurveillanceData(
                            date=date, region=region,
                            disease_code=code, disease_name=name,
                            case_count=cases,
                            average_severity=severity,
                            cases_per_100k=round((cases / pop) * 100_000, 2),
                        ))
                        if len(batch) >= 1000:
                            SurveillanceData.objects.bulk_create(batch, ignore_conflicts=True)
                            batch = []

        if batch:
            SurveillanceData.objects.bulk_create(batch, ignore_conflicts=True)
        total = SurveillanceData.objects.count()
        self.stdout.write(self.style.SUCCESS(f'  {total} surveillance records'))

    def _seed_environmental(self, regions, today, days):
        self.stdout.write('Seeding environmental data...')
        batch = []
        env_days = min(days, 14)
        start = today - timedelta(days=env_days)

        for region in regions:
            base_temp = random.uniform(22, 38)
            base_hum = random.uniform(40, 85)
            for day_offset in range(env_days + 1):
                date = start + timedelta(days=day_offset)
                batch.append(EnvironmentalData(
                    region=region, date=date,
                    temperature=round(base_temp + random.uniform(-3, 3), 1),
                    humidity=round(base_hum + random.uniform(-10, 10), 1),
                    rainfall=round(max(0, random.gauss(15, 20)), 1),
                    aqi=random.randint(30, 300),
                    pm25=round(random.uniform(10, 150), 1),
                    pm10=round(random.uniform(20, 250), 1),
                    water_quality_index=round(random.uniform(3.0, 9.0), 1),
                ))
                if len(batch) >= 500:
                    EnvironmentalData.objects.bulk_create(batch, ignore_conflicts=True)
                    batch = []

        if batch:
            EnvironmentalData.objects.bulk_create(batch, ignore_conflicts=True)
        self.stdout.write(self.style.SUCCESS(f'  {EnvironmentalData.objects.count()} environmental records'))

    def _seed_risk_scores(self, regions, today):
        self.stdout.write('Seeding risk scores...')
        batch = []
        for region in regions:
            for code, name in random.sample(DISEASES, random.randint(3, 6)):
                level = random.choices([0, 1, 2, 3], weights=[35, 30, 22, 13])[0]
                prob = {0: random.uniform(0.05, 0.28),
                        1: random.uniform(0.30, 0.58),
                        2: random.uniform(0.60, 0.83),
                        3: random.uniform(0.85, 0.98)}[level]
                batch.append(RiskScore(
                    region=region, disease_code=code, disease_name=name,
                    calculation_date=today,
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
        self.stdout.write(self.style.SUCCESS(f'  {len(batch)} risk scores'))

    def _seed_anomalies(self, regions, today):
        self.stdout.write('Seeding anomalies...')
        batch = []
        for _ in range(random.randint(12, 25)):
            region = random.choice(regions)
            code, name = random.choice(DISEASES)
            actual = random.randint(80, 500)
            expected = random.randint(20, 120)
            deviation = round(((actual - expected) / expected) * 100, 1)
            batch.append(Anomaly(
                region=region, disease_code=code, disease_name=name,
                detection_date=today - timedelta(days=random.randint(0, 6)),
                anomaly_score=round(random.uniform(0.5, 1.0), 3),
                actual_cases=actual, expected_cases=expected,
                deviation_percentage=deviation,
                description=f'Unusual spike of {name} detected in {region.name}',
                is_resolved=False,
            ))
        Anomaly.objects.bulk_create(batch)
        self.stdout.write(self.style.SUCCESS(f'  {len(batch)} anomalies'))

    def _seed_clusters(self, regions, today):
        self.stdout.write('Seeding clusters...')
        severities = ['low', 'medium', 'high', 'critical']
        count = 0
        for code, name in random.sample(DISEASES[:10], 6):
            for _ in range(random.randint(1, 3)):
                center = random.choice(regions)
                cluster_regions = random.sample(regions, min(random.randint(3, 7), len(regions)))
                total = sum(random.randint(40, 350) for _ in cluster_regions)
                pop = sum(r.population for r in cluster_regions)
                c = Cluster.objects.create(
                    disease_code=code, disease_name=name,
                    detection_date=today - timedelta(days=random.randint(0, 14)),
                    centroid_lat=center.latitude, centroid_lon=center.longitude,
                    radius_km=round(random.uniform(3, 35), 1),
                    total_cases=total, total_population=pop,
                    severity=random.choice(severities),
                    growth_rate=round(random.uniform(0.3, 5.0), 2),
                    is_active=True,
                )
                for r in cluster_regions:
                    ClusterRegion.objects.create(
                        cluster=c, region=r,
                        case_count=random.randint(40, 350),
                    )
                count += 1
        self.stdout.write(self.style.SUCCESS(f'  {count} clusters'))

    def _seed_alerts(self, regions):
        self.stdout.write('Seeding alerts...')
        alert_types = ['outbreak', 'cluster', 'forecast', 'anomaly', 'environmental']
        severities = ['low', 'medium', 'high', 'critical']
        count = 0
        for _ in range(random.randint(8, 15)):
            code, name = random.choice(DISEASES)
            sev = random.choices(severities, weights=[12, 28, 38, 22])[0]
            atype = random.choice(alert_types)
            affected = random.sample(regions, min(random.randint(2, 6), len(regions)))
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
        self.stdout.write(self.style.SUCCESS(f'  {count} alerts'))

    def _seed_forecasts(self, regions, today):
        self.stdout.write('Seeding forecasts for 7 / 14 / 30 day horizons...')
        batch = []
        HORIZONS = [
            (7,  0.90),   # (horizon_days, base_confidence)
            (14, 0.82),
            (30, 0.70),
        ]
        for code, name in DISEASES[:8]:
            for region in random.sample(regions, min(15, len(regions))):
                base = random.randint(30, 250)
                for horizon_days, base_conf in HORIZONS:
                    for d in range(1, horizon_days + 1):
                        # Predictions get noisier as d grows
                        noise = d * random.uniform(0.5, 2.0)
                        trend = d * random.uniform(-0.3, 1.2)
                        predicted = max(1, base + trend + random.gauss(0, noise))
                        # Confidence interval widens for longer horizons
                        margin = max(5, predicted * random.uniform(0.08, 0.25) * (1 + d / horizon_days))
                        confidence = round(max(0.50, base_conf - d * 0.005 + random.uniform(-0.03, 0.03)), 2)
                        batch.append(Forecast(
                            region=region, disease_code=code, disease_name=name,
                            forecast_date=today,
                            prediction_date=today + timedelta(days=d),
                            horizon_days=horizon_days,
                            predicted_cases=round(predicted, 1),
                            lower_bound=round(max(0, predicted - margin), 1),
                            upper_bound=round(predicted + margin, 1),
                            confidence=confidence,
                        ))
                    if len(batch) >= 2000:
                        Forecast.objects.bulk_create(batch)
                        batch = []
        if batch:
            Forecast.objects.bulk_create(batch)
        total = Forecast.objects.count()
        self.stdout.write(self.style.SUCCESS(f'  {total} forecast records (7/14/30 day horizons)'))
