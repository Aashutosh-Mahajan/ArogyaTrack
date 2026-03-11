"""
Management command to generate ML-based alerts.

Calls AlertService.evaluate_alerts() for each disease code present in
SurveillanceData.  Handles Neon cloud PostgreSQL connection reliability
by closing/reopening the connection between disease evaluations.

Optionally injects forecast spikes and widens anomaly coverage so that
the multi-model fusion logic (forecast + cluster + anomaly → critical)
can produce higher-severity alerts, not just low/risk-only ones.
"""

import time
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone

from surveillance.models import (
    Alert, Anomaly, Cluster, ClusterRegion, Forecast,
    Region, RiskScore, SurveillanceData,
)
from surveillance.services import AlertService


class Command(BaseCommand):
    help = "Generate alerts from ML model outputs (AlertService)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--enrich",
            action="store_true",
            help="Enrich existing forecasts/anomalies/clusters so higher-severity "
                 "alerts (medium/high/critical) can be produced.",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all existing alerts before generating new ones.",
        )

    def handle(self, *args, **options):
        today = timezone.now().date()
        self.today = today

        if options["clear"]:
            self._safe_db(lambda: Alert.objects.all().delete())
            self.stdout.write(self.style.WARNING("Cleared existing alerts."))

        enriched_codes = []
        if options["enrich"]:
            enriched_codes = self._enrich_ml_data(today)

        # Only evaluate enriched disease codes (for high/critical) + a few
        # extra for low-severity variety.  This keeps total alerts ≈ 10-15.
        all_codes = list(
            self._safe_db(
                lambda: list(
                    SurveillanceData.objects.values_list("disease_code", flat=True)
                    .distinct()
                )
            )
            or []
        )
        extra = [c for c in all_codes if c not in enriched_codes]
        codes_to_eval = enriched_codes + random.sample(extra, min(2, len(extra)))
        self.stdout.write(f"Evaluating {len(codes_to_eval)} disease codes …")

        MAX_ALERTS = 15
        total = 0
        for code in codes_to_eval:
            if total >= MAX_ALERTS:
                break
            for attempt in range(3):
                try:
                    connection.close()
                    time.sleep(0.5)
                    alerts = AlertService.evaluate_alerts(code, date=today)
                    n = len(alerts)
                    if n:
                        self.stdout.write(f"  {code}: {n} alerts")
                    total += n
                    # If we exceeded the cap, delete the surplus
                    if total > MAX_ALERTS:
                        surplus = Alert.objects.filter(
                            disease_code=code, status="active"
                        ).order_by("-generated_at")[: total - MAX_ALERTS]
                        ids = [a.id for a in surplus]
                        if ids:
                            Alert.objects.filter(id__in=ids).delete()
                            total = MAX_ALERTS
                    break
                except Exception as exc:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  {code} attempt {attempt + 1}: {type(exc).__name__}"
                        )
                    )
                    connection.close()
                    time.sleep(3 * (attempt + 1))
            time.sleep(0.5)

        connection.close()
        time.sleep(1)
        count = self._safe_db(lambda: Alert.objects.count()) or "?"
        self.stdout.write(self.style.SUCCESS(f"\nDone — {total} new alerts (DB total: {count})"))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _safe_db(self, fn):
        """Run *fn* with up to 3 retries when Neon drops."""
        for attempt in range(3):
            try:
                if attempt:
                    connection.close()
                    time.sleep(2 * attempt)
                return fn()
            except Exception:
                connection.close()
                time.sleep(3 * (attempt + 1))
        return None

    # ------------------------------------------------------------------
    # Enrich seeded ML data so AlertService fires high/critical alerts
    # ------------------------------------------------------------------

    def _enrich_ml_data(self, today):
        """
        Ensure that for some region+disease combos the AlertService's
        multi-model conditions are met:
          • forecast spike  (predicted > 1.5 × lower_bound)
          • active cluster within 3 days
          • anomaly on *today*
          • risk_level ≥ 2
        Returns the list of enriched disease codes.
        """
        self.stdout.write(self.style.WARNING("Enriching ML data for higher-severity alerts …"))

        regions = list(self._safe_db(lambda: list(Region.objects.all())) or [])
        if not regions:
            self.stdout.write(self.style.ERROR("No regions found."))
            return []

        # Pick diseases that have surveillance data in the last 7 days
        recent_codes = list(
            self._safe_db(
                lambda: list(
                    SurveillanceData.objects.filter(
                        date__gte=today - timedelta(days=7)
                    )
                    .values_list("disease_code", "disease_name")
                    .distinct()
                )
            )
            or []
        )
        if not recent_codes:
            self.stdout.write(self.style.ERROR("No recent surveillance data."))
            return []

        # Pick 3 (disease, region) combos for enrichment — keeps alerts ≈ 10-15
        combos = []
        for code, name in random.sample(recent_codes, min(3, len(recent_codes))):
            r = random.choice(regions)
            combos.append((code, name, r))

        enriched = 0
        enriched_codes = []
        for code, name, region in combos:
            try:
                self._inject_forecast_spike(code, name, region, today)
                self._inject_anomaly(code, name, region, today)
                self._inject_cluster(code, name, region, regions, today)
                self._ensure_risk_score(code, name, region, today)
                enriched += 1
                if code not in enriched_codes:
                    enriched_codes.append(code)
            except Exception as exc:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Enrich {code}@{region.name}: {type(exc).__name__}: {exc}"
                    )
                )
                connection.close()
                time.sleep(2)
            time.sleep(0.3)

        self.stdout.write(self.style.SUCCESS(f"  Enriched {enriched} combos."))
        return enriched_codes

    def _inject_forecast_spike(self, code, name, region, today):
        """Create forecasts where predicted_cases > 1.5 × lower_bound."""
        connection.close()
        time.sleep(0.3)
        for d in range(1, 8):
            base = random.randint(80, 400)
            # Spike: lower_bound is much lower than predicted
            lower = max(1, int(base * random.uniform(0.25, 0.55)))
            upper = int(base * random.uniform(1.4, 2.0))
            Forecast.objects.update_or_create(
                region=region,
                disease_code=code,
                forecast_date=today,
                prediction_date=today + timedelta(days=d),
                horizon_days=7,
                defaults=dict(
                    disease_name=name,
                    predicted_cases=base,
                    lower_bound=lower,
                    upper_bound=upper,
                    confidence=round(random.uniform(0.70, 0.95), 2),
                ),
            )

    def _inject_anomaly(self, code, name, region, today):
        """Ensure an unresolved anomaly exists on today for this combo."""
        connection.close()
        time.sleep(0.3)
        actual = random.randint(100, 600)
        expected = random.randint(20, 80)
        Anomaly.objects.update_or_create(
            region=region,
            disease_code=code,
            detection_date=today,
            defaults=dict(
                disease_name=name,
                anomaly_score=round(random.uniform(0.7, 0.99), 3),
                actual_cases=actual,
                expected_cases=expected,
                deviation_percentage=round((actual - expected) / max(expected, 1) * 100, 1),
                description=(
                    f"Unusual spike of {name} in {region.name}: "
                    f"{actual} cases vs expected {expected}"
                ),
                is_resolved=False,
            ),
        )

    def _inject_cluster(self, code, name, region, all_regions, today):
        """Ensure an active cluster exists within 3 days for this disease/region."""
        connection.close()
        time.sleep(0.3)

        # Check if there's already an active cluster covering this region+disease
        existing = Cluster.objects.filter(
            disease_code=code,
            is_active=True,
            detection_date__gte=today - timedelta(days=3),
            regions__region=region,
        ).exists()
        if existing:
            return

        cluster_regions = random.sample(all_regions, min(3, len(all_regions)))
        if region not in cluster_regions:
            cluster_regions[0] = region

        cluster = Cluster.objects.create(
            disease_code=code,
            disease_name=name,
            detection_date=today - timedelta(days=random.randint(0, 2)),
            centroid_lat=region.latitude,
            centroid_lon=region.longitude,
            radius_km=round(random.uniform(5, 25), 1),
            total_cases=sum(random.randint(50, 300) for _ in cluster_regions),
            total_population=sum(r.population for r in cluster_regions),
            severity=random.choice(["high", "critical"]),
            growth_rate=round(random.uniform(1.5, 4.0), 2),
            is_active=True,
        )
        for r in cluster_regions:
            ClusterRegion.objects.create(
                cluster=cluster,
                region=r,
                case_count=random.randint(50, 300),
            )

    def _ensure_risk_score(self, code, name, region, today):
        """Ensure a high risk score exists for this combo."""
        connection.close()
        time.sleep(0.3)
        RiskScore.objects.update_or_create(
            region=region,
            disease_code=code,
            calculation_date=today,
            defaults=dict(
                disease_name=name,
                risk_level=random.randint(2, 3),
                risk_probability=round(random.uniform(0.70, 0.98), 3),
                contributing_factors={
                    "case_trend": round(random.uniform(2.0, 5.0), 2),
                    "cluster_proximity": round(random.uniform(0.6, 0.95), 2),
                    "environmental_risk": round(random.uniform(0.5, 0.9), 2),
                },
            ),
        )
