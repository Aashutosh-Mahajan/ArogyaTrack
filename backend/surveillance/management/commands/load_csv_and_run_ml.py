"""
Management command to load CSV data into the database and run the ML pipeline.
==============================================================================
Loads data from ml_models/india_surveillance_extreme_quality/ CSVs into Django
models, then optionally runs all 4 ML models to populate results for the dashboard.

Designed to work with Neon cloud PostgreSQL (handles connection pooling limits,
idle timeouts, and compute auto-scaling pauses).

Usage:
    python manage.py load_csv_and_run_ml --clear           # Clear and reload all data
    python manage.py load_csv_and_run_ml --days 90         # Load last 90 days only
    python manage.py load_csv_and_run_ml --run-ml          # Also run ML pipeline
    python manage.py load_csv_and_run_ml --clear --run-ml  # Full reset + ML
"""
import csv
import random
import time
from datetime import timedelta
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone

from surveillance.models import (
    Region, SurveillanceData, Cluster, ClusterRegion,
    Forecast, Anomaly, RiskScore, EnvironmentalData,
    Alert, Notification,
)

# ---------------------------------------------------------------------------
#  Neon-safe helpers
# ---------------------------------------------------------------------------
BATCH_SIZE = 50          # Small batches to avoid Neon connection-pool saturation
BATCH_SLEEP = 0.3        # Seconds between batches (let Neon breathe)
MAX_RETRIES = 3          # Retries per batch on connection errors


def _fresh_connection():
    """Close stale connection and open a fresh one (Neon-safe)."""
    try:
        connection.close()
    except Exception:
        pass
    connection.ensure_connection()


def _bulk_create_safe(model, batch, stdout, ignore_conflicts=True):
    """
    bulk_create with retry logic for Neon cloud.
    Only reconnects on failure (not on first attempt) to reduce connection churn.
    """
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if attempt > 1:
                _fresh_connection()
            model.objects.bulk_create(batch, ignore_conflicts=ignore_conflicts)
            return True
        except Exception as e:
            if attempt < MAX_RETRIES:
                wait = attempt * 3
                stdout.write(f'    ⚠ Batch failed (attempt {attempt}): {e} — retrying in {wait}s…')
                time.sleep(wait)
            else:
                stdout.write(f'    ✗ Batch failed after {MAX_RETRIES} attempts: {e}')
                return False
    return False


def _delete_safe(model, stdout, label=None):
    """Delete all rows of *model* in small chunks to avoid Neon timeouts."""
    tag = label or model.__name__
    try:
        _fresh_connection()
        total = model.objects.count()
        if total == 0:
            return
        # Delete in slices of 500 PKs
        while True:
            _fresh_connection()
            pks = list(model.objects.values_list('pk', flat=True)[:500])
            if not pks:
                break
            model.objects.filter(pk__in=pks).delete()
            time.sleep(0.2)
        stdout.write(f'    Cleared {tag} ({total} rows)')
    except Exception as e:
        stdout.write(f'    ⚠ Error clearing {tag}: {e}')

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
    help = 'Load CSV data into database and optionally run ML pipeline for dashboard results'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear', action='store_true',
            help='Clear all existing surveillance data before loading',
        )
        parser.add_argument(
            '--days', type=int, default=90,
            help='Number of recent days to load (default: 90). CSV data is remapped to recent dates.',
        )
        parser.add_argument(
            '--run-ml', action='store_true',
            help='Run the ML pipeline after loading data (clustering, forecasting, anomaly detection, risk scoring, alerts)',
        )
        parser.add_argument(
            '--csv-dir', type=str, default=None,
            help='Path to CSV directory. Default: ml_models/india_surveillance_extreme_quality/',
        )
        parser.add_argument(
            '--generate', action='store_true',
            help='Generate CSV files first using generate_csv_data.py before loading',
        )

    def handle(self, *args, **options):
        clear_data = options['clear']
        days = options['days']
        run_ml = options['run_ml']
        self.today = timezone.now().date()

        # Locate CSV directory
        if options['csv_dir']:
            csv_dir = Path(options['csv_dir'])
        else:
            csv_dir = Path(__file__).resolve().parent.parent.parent.parent.parent / 'ml_models' / 'india_surveillance_extreme_quality'

        # Generate CSVs if requested
        if options['generate']:
            self._generate_csvs(csv_dir)

        if not csv_dir.exists():
            self.stdout.write(self.style.ERROR(
                f'\nCSV directory not found: {csv_dir}\n'
                f'Run with --generate to create CSV files first, or use:\n'
                f'  cd ml_models && python generate_csv_data.py\n'
            ))
            return

        # Validate required files
        required_files = ['regions.csv', 'disease_surveillance_historical.csv', 'environmental_data.csv']
        missing = [f for f in required_files if not (csv_dir / f).exists()]
        if missing:
            self.stdout.write(self.style.ERROR(f'\nMissing CSV files: {", ".join(missing)}'))
            return

        self.stdout.write(self.style.WARNING(
            f'\n{"="*60}\n'
            f' LOAD CSV DATA → DATABASE → ML PIPELINE\n'
            f'{"="*60}\n'
            f'  CSV directory : {csv_dir}\n'
            f'  Days to load  : {days}\n'
            f'  Clear existing: {clear_data}\n'
            f'  Run ML pipeline: {run_ml}\n'
            f'  Date range    : {self.today - timedelta(days=days)} → {self.today}\n'
            f'{"="*60}\n'
        ))

        if clear_data:
            self._clear_data()

        regions = self._load_regions(csv_dir)
        self._load_surveillance(csv_dir, regions, days)
        self._load_environmental(csv_dir, regions, days)

        if run_ml:
            self._run_ml_pipeline(regions)
        else:
            # Seed synthetic ML results so dashboard has data to show
            self._seed_ml_results(regions)

        self.stdout.write(self.style.SUCCESS(
            f'\n{"="*60}\n'
            f' ALL DATA LOADED SUCCESSFULLY!\n'
            f'  Regions            : {Region.objects.count()}\n'
            f'  Surveillance records: {SurveillanceData.objects.count()}\n'
            f'  Environmental records: {EnvironmentalData.objects.count()}\n'
            f'  Risk scores        : {RiskScore.objects.count()}\n'
            f'  Anomalies          : {Anomaly.objects.count()}\n'
            f'  Clusters           : {Cluster.objects.count()}\n'
            f'  Forecasts          : {Forecast.objects.count()}\n'
            f'  Alerts             : {Alert.objects.count()}\n'
            f'{"="*60}\n'
        ))

    def _generate_csvs(self, csv_dir):
        """Generate CSV files using the generate_csv_data.py script."""
        self.stdout.write('Generating CSV files...')
        import subprocess
        import sys
        gen_script = Path(__file__).resolve().parent.parent.parent.parent.parent / 'ml_models' / 'generate_csv_data.py'
        if not gen_script.exists():
            self.stdout.write(self.style.ERROR(f'Generator script not found: {gen_script}'))
            return
        result = subprocess.run(
            [sys.executable, str(gen_script), '--output', str(csv_dir)],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            self.stdout.write(self.style.ERROR(f'CSV generation failed:\n{result.stderr}'))
            return
        self.stdout.write(self.style.SUCCESS(result.stdout))

    def _clear_data(self):
        """Clear all surveillance-related data (Neon-safe chunked deletes)."""
        self.stdout.write('Clearing existing data...')
        for Model in [Notification, Alert, Forecast, Anomaly, RiskScore,
                       ClusterRegion, Cluster, EnvironmentalData,
                       SurveillanceData, Region]:
            _delete_safe(Model, self.stdout)
        self.stdout.write(self.style.SUCCESS('  Cleared all surveillance data.'))

    def _load_regions(self, csv_dir):
        """Load regions from CSV into the database."""
        self.stdout.write('Loading regions from CSV...')
        regions = []
        region_map = {}
        with open(csv_dir / 'regions.csv', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                _fresh_connection()
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
                region_map[int(row['region_id'])] = r
        self.region_map = region_map
        self.stdout.write(self.style.SUCCESS(f'  {len(regions)} regions loaded.'))
        return regions

    def _load_surveillance(self, csv_dir, regions, days):
        """Load surveillance data from CSV, remapping dates to recent period."""
        self.stdout.write(f'Loading surveillance data ({days} days)...')

        start_date = self.today - timedelta(days=days)

        # Read CSV rows for mapped regions — cap at 5000 for Neon safety
        MAX_RECORDS = 5000
        pool = []
        with open(csv_dir / 'disease_surveillance_historical.csv', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                rid = int(row['region_id'])
                if rid in self.region_map:
                    pool.append(row)
                if len(pool) >= MAX_RECORDS:
                    break

        if not pool:
            self.stdout.write(self.style.WARNING('  No matching surveillance data found in CSV.'))
            return

        # Remap dates: spread pool rows across [start_date → today]
        batch, count = [], 0
        for idx, row in enumerate(pool):
            day_offset = idx % (days + 1)
            date = start_date + timedelta(days=day_offset)
            region = self.region_map[int(row['region_id'])]
            cases = int(row['case_count'])
            pop = region.population or 1

            batch.append(SurveillanceData(
                date=date,
                region=region,
                disease_code=row['disease_code'],
                disease_name=row['disease_name'],
                case_count=cases,
                average_severity=float(row['severity_avg']),
                cases_per_100k=round((cases / pop) * 100_000, 2),
            ))
            count += 1

            if len(batch) >= BATCH_SIZE:
                _bulk_create_safe(SurveillanceData, batch, self.stdout)
                batch = []
                if count % 500 == 0:
                    self.stdout.write(f'    … {count} / {len(pool)} surveillance records')
                time.sleep(BATCH_SLEEP)

        if batch:
            _bulk_create_safe(SurveillanceData, batch, self.stdout)

        self.stdout.write(self.style.SUCCESS(f'  {count} surveillance records loaded.'))

    def _load_environmental(self, csv_dir, regions, days):
        """Load environmental data from CSV, remapping dates to recent period."""
        self.stdout.write('Loading environmental data...')

        env_days = min(days, 60)  # Environmental data for last 60 days max
        start_date = self.today - timedelta(days=env_days)

        MAX_ENV = 2000
        pool = []
        with open(csv_dir / 'environmental_data.csv', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                rid = int(row['region_id'])
                if rid in self.region_map:
                    pool.append(row)
                if len(pool) >= MAX_ENV:
                    break

        batch, count = [], 0
        for idx, row in enumerate(pool):
            day_offset = idx % (env_days + 1)
            date = start_date + timedelta(days=day_offset)
            region = self.region_map[int(row['region_id'])]

            batch.append(EnvironmentalData(
                region=region,
                date=date,
                temperature=float(row['temperature_celsius']),
                humidity=float(row['humidity_percent']),
                rainfall=float(row['rainfall_mm']),
                aqi=int(float(row['aqi'])),
                pm25=float(row['pm25']),
                pm10=float(row['pm10']),
                water_quality_index=float(row['water_quality_index']),
            ))
            count += 1

            if len(batch) >= BATCH_SIZE:
                _bulk_create_safe(EnvironmentalData, batch, self.stdout)
                batch = []
                time.sleep(BATCH_SLEEP)

        if batch:
            _bulk_create_safe(EnvironmentalData, batch, self.stdout)

        self.stdout.write(self.style.SUCCESS(f'  {count} environmental records loaded.'))

    def _run_ml_pipeline(self, regions):
        """Run the actual ML models on loaded data to populate results."""
        self.stdout.write(self.style.WARNING('\n--- Running ML Pipeline ---'))

        from surveillance.services import (
            ClusteringService, ForecastingService,
            AnomalyDetectionService, RiskScoringService, AlertService,
        )

        today = self.today
        diseases_to_run = [code for code, _ in DISEASES[:10]]

        for disease_code in diseases_to_run:
            disease_name = dict(DISEASES).get(disease_code, disease_code)
            self.stdout.write(f'\n  Processing {disease_name} ({disease_code})...')

            # 1. DBSCAN Clustering
            try:
                clusters = ClusteringService.detect_clusters(disease_code)
                self.stdout.write(f'    DBSCAN: {len(clusters)} clusters detected')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'    DBSCAN: {e}'))

            # 2. Per-region: Forecasting, Anomaly Detection, Risk Scoring
            active_regions = Region.objects.filter(
                surveillance_data__disease_code=disease_code,
                surveillance_data__date__gte=today - timedelta(days=14),
            ).distinct()[:15]

            fc_count, anom_count, risk_count = 0, 0, 0
            for region in active_regions:
                _fresh_connection()
                # Forecasts
                for horizon in [7, 14, 30]:
                    try:
                        forecasts = ForecastingService.generate_forecast(region, disease_code, horizon)
                        fc_count += len(forecasts)
                    except Exception:
                        pass

                # Anomaly Detection
                try:
                    anomaly = AnomalyDetectionService.detect_anomalies(region, disease_code)
                    if anomaly:
                        anom_count += 1
                except Exception:
                    pass

                # Risk Scoring
                try:
                    RiskScoringService.calculate_risk_score(region, disease_code)
                    risk_count += 1
                except Exception:
                    pass

            self.stdout.write(
                f'    Forecasts: {fc_count} | Anomalies: {anom_count} | Risk scores: {risk_count}'
            )

            # 3. Alert Evaluation
            try:
                alerts = AlertService.evaluate_alerts(disease_code)
                self.stdout.write(f'    Alerts: {len(alerts)}')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'    Alerts: {e}'))

        self.stdout.write(self.style.SUCCESS('\n--- ML Pipeline complete ---'))

    def _seed_ml_results(self, regions):
        """
        Seed realistic ML output results when --run-ml is not used.
        This populates RiskScores, Anomalies, Clusters, Forecasts, and Alerts
        so the dashboard displays meaningful data.
        """
        self.stdout.write(self.style.WARNING('\n--- Seeding ML Results (synthetic) ---'))
        today = self.today

        self._seed_risk_scores(regions, today)
        self._seed_anomalies(regions, today)
        self._seed_clusters(regions, today)
        self._seed_forecasts(regions, today)
        self._seed_alerts(regions, today)

        self.stdout.write(self.style.SUCCESS('--- ML Results seeded ---'))

    def _seed_risk_scores(self, regions, today):
        """Generate risk scores for all regions across multiple diseases."""
        self.stdout.write('  Seeding risk scores...')
        batch = []
        for region in regions:
            for code, name in random.sample(DISEASES, min(random.randint(4, 8), len(DISEASES))):
                level = random.choices([0, 1, 2, 3], weights=[30, 30, 25, 15])[0]
                prob = {
                    0: round(random.uniform(0.03, 0.28), 3),
                    1: round(random.uniform(0.30, 0.58), 3),
                    2: round(random.uniform(0.60, 0.83), 3),
                    3: round(random.uniform(0.85, 0.98), 3),
                }[level]
                batch.append(RiskScore(
                    region=region, disease_code=code, disease_name=name,
                    calculation_date=today,
                    risk_level=level,
                    risk_probability=prob,
                    contributing_factors={
                        'case_trend': round(random.uniform(-0.5, 0.8), 3),
                        'population_density': round(random.uniform(0.1, 0.95), 3),
                        'sanitation_index': round(random.uniform(-0.4, 0.4), 3),
                        'environmental': round(random.uniform(0.0, 0.6), 3),
                        'seasonal_factor': round(random.uniform(-0.2, 0.7), 3),
                    },
                ))
        for i in range(0, len(batch), BATCH_SIZE):
            _bulk_create_safe(RiskScore, batch[i:i + BATCH_SIZE], self.stdout)
            time.sleep(BATCH_SLEEP)
        high = sum(1 for r in batch if r.risk_level >= 2)
        self.stdout.write(self.style.SUCCESS(
            f'    {len(batch)} risk scores ({high} high/critical)'
        ))

    def _seed_anomalies(self, regions, today):
        """Generate anomaly detections across regions."""
        self.stdout.write('  Seeding anomalies...')
        batch = []
        for _ in range(random.randint(15, 30)):
            region = random.choice(regions)
            code, name = random.choice(DISEASES)
            actual = random.randint(60, 500)
            expected = random.randint(15, 120)
            deviation = round(((actual - expected) / max(expected, 1)) * 100, 1)
            batch.append(Anomaly(
                region=region, disease_code=code, disease_name=name,
                detection_date=today - timedelta(days=random.randint(0, 7)),
                anomaly_score=round(random.uniform(0.45, 0.98), 3),
                actual_cases=actual,
                expected_cases=expected,
                deviation_percentage=deviation,
                description=(
                    f'Unusual spike of {name} in {region.name}: '
                    f'{actual} cases vs expected {expected} '
                    f'({deviation}% deviation)'
                ),
                is_resolved=random.random() < 0.2,
            ))
        _bulk_create_safe(Anomaly, batch, self.stdout)
        self.stdout.write(self.style.SUCCESS(f'    {len(batch)} anomalies'))

    def _seed_clusters(self, regions, today):
        """Generate disease clusters with region associations."""
        self.stdout.write('  Seeding clusters...')
        severities = ['low', 'medium', 'high', 'critical']
        count = 0
        for code, name in random.sample(DISEASES[:10], min(7, len(DISEASES))):
            for _ in range(random.randint(1, 3)):
                center = random.choice(regions)
                cluster_regions = random.sample(
                    regions, min(random.randint(2, 6), len(regions))
                )
                total_cases = sum(random.randint(30, 350) for _ in cluster_regions)
                total_pop = sum(r.population for r in cluster_regions)

                try:
                    cluster = Cluster.objects.create(
                        disease_code=code, disease_name=name,
                        detection_date=today - timedelta(days=random.randint(0, 14)),
                        centroid_lat=center.latitude,
                        centroid_lon=center.longitude,
                        radius_km=round(random.uniform(2.5, 35.0), 1),
                        total_cases=total_cases,
                        total_population=total_pop,
                        severity=random.choices(
                            severities, weights=[20, 35, 30, 15]
                        )[0],
                        growth_rate=round(random.uniform(0.2, 4.5), 2),
                        is_active=True,
                    )
                    for r in cluster_regions:
                        ClusterRegion.objects.create(
                            cluster=cluster, region=r,
                            case_count=random.randint(30, 350),
                        )
                    count += 1
                except Exception:
                    _fresh_connection()
                    continue
                time.sleep(0.15)
        self.stdout.write(self.style.SUCCESS(f'    {count} clusters'))

    def _seed_forecasts(self, regions, today):
        """Generate forecast predictions for the next 7/14/30 days."""
        self.stdout.write('  Seeding forecasts...')
        batch = []
        # Keep volume low: 5 diseases × 6 regions × 3 horizons with sampled days
        for code, name in DISEASES[:5]:
            for region in random.sample(regions, min(6, len(regions))):
                base = random.randint(20, 250)
                for horizon in [7, 14, 30]:
                    # Sample subset of days to reduce total records
                    day_range = list(range(1, horizon + 1))
                    sample_days = day_range if horizon <= 7 else random.sample(day_range, min(7, len(day_range)))
                    for d in sorted(sample_days):
                        trend = random.uniform(-0.02, 0.04) * d
                        predicted = max(1, int(base * (1 + trend) + random.gauss(0, base * 0.15)))
                        margin = max(5, int(predicted * random.uniform(0.10, 0.25)))
                        batch.append(Forecast(
                            region=region, disease_code=code, disease_name=name,
                            forecast_date=today,
                            prediction_date=today + timedelta(days=d),
                            horizon_days=horizon,
                            predicted_cases=predicted,
                            lower_bound=max(0, predicted - margin),
                            upper_bound=predicted + margin,
                            confidence=round(random.uniform(0.65, 0.96), 2),
                        ))
        # Use _bulk_create_safe for all batches (Neon-safe)
        for i in range(0, len(batch), BATCH_SIZE):
            _bulk_create_safe(Forecast, batch[i:i + BATCH_SIZE], self.stdout, ignore_conflicts=False)
            time.sleep(BATCH_SLEEP)
        self.stdout.write(self.style.SUCCESS(f'    {len(batch)} forecast records'))

    def _seed_alerts(self, regions, today):
        """Generate multi-model alerts."""
        self.stdout.write('  Seeding alerts...')
        alert_types = ['outbreak', 'cluster', 'forecast', 'anomaly', 'environmental']
        severities = ['low', 'medium', 'high', 'critical']
        count = 0

        for _ in range(random.randint(10, 20)):
            code, name = random.choice(DISEASES)
            sev = random.choices(severities, weights=[15, 30, 35, 20])[0]
            atype = random.choice(alert_types)
            affected = random.sample(regions, min(random.randint(1, 6), len(regions)))

            try:
                alert = Alert.objects.create(
                alert_type=atype,
                disease_code=code,
                disease_name=name,
                severity=sev,
                status='active',
                confidence=round(random.uniform(0.55, 0.99), 2),
                title=f'{sev.title()} {atype.replace("_", " ").title()} Alert: {name}',
                description=(
                    f'A {sev} {atype.replace("_", " ")} alert has been generated for {name} '
                    f'({code}) affecting {len(affected)} region(s). '
                    f'ML models indicate {"immediate action required" if sev in ("high", "critical") else "monitoring recommended"}.'
                ),
                predicted_impact=(
                    f'Estimated {random.randint(50, 3000)} additional cases '
                    f'over the next {random.choice([7, 14, 30])} days'
                ),
                contributing_factors={
                    'case_surge': round(random.uniform(1.2, 5.5), 2),
                    'cluster_growth': round(random.uniform(0.3, 3.5), 2),
                    'environmental_risk': round(random.uniform(0.05, 0.95), 2),
                    'forecast_trend': round(random.uniform(-0.5, 2.5), 2),
                },
                recommended_actions=(
                    'Deploy additional surveillance teams in affected regions. '
                    'Increase testing capacity. '
                    'Coordinate with local health centres for resource allocation. '
                    'Issue public health advisory.'
                ),
                escalation_level=random.randint(1, 3),
            )
                alert.affected_regions.set(affected)
                count += 1
            except Exception:
                _fresh_connection()
                continue
            time.sleep(0.15)

        self.stdout.write(self.style.SUCCESS(f'    {count} active alerts'))
