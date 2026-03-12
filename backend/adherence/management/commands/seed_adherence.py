"""
Seed realistic adherence data for the patient ananya.iyer@email.com.
Creates trackers with proper dose schedules, marking some as taken and some
as missed to produce professional-looking adherence tracking.
"""

import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from patients.models import Profile
from prescriptions.models import Prescription, PrescriptionMedicine
from adherence.models import AdherenceTracker, DoseSchedule


class Command(BaseCommand):
    help = "Seed realistic adherence tracking data for Ananya"

    def handle(self, *args, **options):
        try:
            user = User.objects.get(email="ananya.iyer@email.com")
        except User.DoesNotExist:
            self.stderr.write("User ananya.iyer@email.com not found")
            return

        profile = Profile.objects.filter(user=user).first()
        if not profile:
            self.stderr.write("No patient profile found")
            return

        # ── Clean existing adherence data ──
        DoseSchedule.objects.filter(tracker__patient=profile).delete()
        AdherenceTracker.objects.filter(patient=profile).delete()
        self.stdout.write("Cleared existing adherence data.")

        # ── Mark medicines as dispensed for fully_dispensed prescriptions ──
        fully = Prescription.objects.filter(
            patient=profile, status="fully_dispensed"
        ).order_by("-created_at")

        for rx in fully:
            rx.medicines.update(dispense_status="dispensed")

        self.stdout.write(
            f"Marked medicines dispensed for {fully.count()} prescriptions."
        )

        if fully.count() < 1:
            self.stderr.write("No fully_dispensed prescriptions to create trackers.")
            return

        now = timezone.now()

        # ═══════════════════════════════════════════════════════════
        # ACTIVE TRACKER  –  most recent fully_dispensed Rx
        # Last ~40 days so there is history + upcoming doses
        # ═══════════════════════════════════════════════════════════
        active_rx = fully[0]
        active_start = now - timedelta(days=40)
        active_end = active_start + timedelta(
            days=max(pm.duration_days for pm in active_rx.medicines.all())
        )

        active_tracker = AdherenceTracker.objects.create(
            prescription=active_rx,
            patient=profile,
            start_date=active_start,
            end_date=active_end,
            expected_doses=0,
            actual_doses=0,
            is_active=True,
        )

        active_expected, active_taken = self._generate_doses(
            tracker=active_tracker,
            prescription=active_rx,
            start=active_start,
            now=now,
            miss_rate=0.12,  # ~88 % adherence
        )
        active_tracker.expected_doses = active_expected
        active_tracker.actual_doses = active_taken
        active_tracker.save()

        self.stdout.write(
            f"Active tracker: {active_taken}/{active_expected} doses "
            f"({active_tracker.adherence_percentage:.1f}%)"
        )

        # ═══════════════════════════════════════════════════════════
        # PAST TRACKER  –  second fully_dispensed Rx (completed)
        # ═══════════════════════════════════════════════════════════
        if fully.count() >= 2:
            past_rx = fully[1]
            max_dur = max(pm.duration_days for pm in past_rx.medicines.all())
            past_start = active_start - timedelta(days=max_dur + 5)
            past_end = past_start + timedelta(days=max_dur)

            past_tracker = AdherenceTracker.objects.create(
                prescription=past_rx,
                patient=profile,
                start_date=past_start,
                end_date=past_end,
                expected_doses=0,
                actual_doses=0,
                is_active=False,
            )

            past_expected, past_taken = self._generate_doses(
                tracker=past_tracker,
                prescription=past_rx,
                start=past_start,
                now=past_end,  # fully completed
                miss_rate=0.18,  # ~82 % adherence
            )
            past_tracker.expected_doses = past_expected
            past_tracker.actual_doses = past_taken
            past_tracker.save()

            self.stdout.write(
                f"Past tracker:   {past_taken}/{past_expected} doses "
                f"({past_tracker.adherence_percentage:.1f}%)"
            )

        self.stdout.write(self.style.SUCCESS("Adherence data seeded successfully."))

    # ── helpers ──────────────────────────────────────────────────

    def _generate_doses(self, tracker, prescription, start, now, miss_rate):
        """
        Generate DoseSchedule rows for every medicine in *prescription*.
        Doses before *now* get randomly taken/missed (with miss_rate).
        Doses after *now* stay untaken (upcoming).
        Returns (total_due, total_taken) — only past-due doses counted.
        """
        total_due = 0
        total_taken = 0
        bulk = []

        random.seed(42)  # reproducible

        for pm in prescription.medicines.all():
            doses_per_day = self._parse_freq(pm.frequency)
            hour_gap = 24 // max(doses_per_day, 1)

            # Base hours for each daily dose (e.g. 8AM, 8PM for 2x daily)
            base_hours = [8 + i * hour_gap for i in range(doses_per_day)]

            for day_offset in range(pm.duration_days):
                for h in base_hours:
                    sched = start.replace(
                        hour=h, minute=0, second=0, microsecond=0
                    ) + timedelta(days=day_offset)

                    is_past = sched < now
                    taken = False
                    taken_at = None

                    if is_past:
                        total_due += 1
                        rate = miss_rate
                        if h >= 20:
                            rate = miss_rate * 1.8
                        if random.random() > rate:
                            taken = True
                            jitter = random.randint(-30, 30)
                            taken_at = sched + timedelta(minutes=jitter)
                            total_taken += 1

                    bulk.append(DoseSchedule(
                        tracker=tracker,
                        medicine=pm.medicine,
                        prescription_medicine=pm,
                        scheduled_time=sched,
                        is_taken=taken,
                        taken_at=taken_at,
                    ))

        DoseSchedule.objects.bulk_create(bulk, batch_size=500)
        return total_due, total_taken

    @staticmethod
    def _parse_freq(freq: str) -> int:
        f = freq.lower().strip()
        if "twice" in f or "2x" in f or "bid" in f or "2 times" in f:
            return 2
        if "thrice" in f or "3x" in f or "tid" in f or "3 times" in f:
            return 3
        if "every 8" in f or "q8h" in f:
            return 3
        if "every 6" in f or "q6h" in f:
            return 4
        # once daily / once at bedtime / default
        return 1
