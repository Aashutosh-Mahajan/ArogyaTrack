"""
dashboard/views.py
──────────────────────────────────────────────────────
Patient Dashboard Summary – single endpoint that aggregates all
health snapshot data so the frontend can render the Welcome &
Health Snapshot section with one API call.

Risk-score rules
  +2  any abnormal lab result (keyword match in visit records)
  +2  BP > 140 (parsed from visit records)
  +2  sugar > 150 (parsed from visit records)
  +1  missed medicines > 3 days
"""

import re
from datetime import timedelta
from io import BytesIO
from zipfile import ZipFile

from django.conf import settings
from django.db import models
from django.db.models import Avg, Q, Sum
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from rest_framework import status as drf_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Session, User
from adherence.models import AdherenceTracker, DoseSchedule
from medical.models import HealthMetric, LabTestResult, PatientVisitRecord, VisitReportAttachment
from patients.models import HealthCard, Profile
from prescriptions.models import Prescription
from surveillance.models import Alert

from .models import DashboardAlert, DownloadLog
from .serializers import (
    DashboardAlertSerializer,
    DashboardKPISerializer,
    DashboardSummarySerializer,
    HealthTrendsResponseSerializer,
    LabTestSerializer,
    RecentRecordSerializer,
)


# ── helpers ──────────────────────────────────────────────────────

_BP_RE = re.compile(
    r"(?:bp|blood\s*pressure)[:\s]*(\d{2,3})\s*/\s*(\d{2,3})",
    re.IGNORECASE,
)
_SUGAR_RE = re.compile(
    r"(?:sugar|glucose|fbs|rbs|ppbs|hba1c)[:\s]*(\d{2,4}(?:\.\d+)?)",
    re.IGNORECASE,
)
_ABNORMAL_KEYWORDS = [
    "abnormal",
    "elevated",
    "critical",
    "high",
    "positive",
    "out of range",
    "irregular",
]


def _extract_max_bp_systolic(text: str) -> int | None:
    """Return the highest systolic BP value found in free text, or None."""
    matches = _BP_RE.findall(text)
    if not matches:
        return None
    return max(int(m[0]) for m in matches)


def _extract_max_sugar(text: str) -> float | None:
    """Return the highest sugar / glucose value found in free text, or None."""
    matches = _SUGAR_RE.findall(text)
    if not matches:
        return None
    return max(float(m) for m in matches)


def _has_abnormal_lab(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in _ABNORMAL_KEYWORDS)


def _calculate_risk(visit_records, missed_days: int) -> tuple[int, str]:
    """Return (score, level) tuple."""
    score = 0

    # Scan all recent visit records
    for vr in visit_records:
        combined = f"{vr.tests_performed} {vr.diagnosis} {vr.doctor_notes}"

        if _has_abnormal_lab(combined):
            score += 2

        bp = _extract_max_bp_systolic(combined)
        if bp is not None and bp > 140:
            score += 2

        sugar = _extract_max_sugar(combined)
        if sugar is not None and sugar > 150:
            score += 2

    if missed_days > 3:
        score += 1

    # Map to level
    if score >= 5:
        level = "High"
    elif score >= 3:
        level = "Medium"
    else:
        level = "Low"

    return score, level


# ── view ─────────────────────────────────────────────────────────

class DashboardSummaryView(APIView):
    """
    GET /api/dashboard/summary/

    Returns the logged-in patient's health snapshot data.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # ── Profile ──────────────────────────────────────────────
        profile = Profile.objects.filter(
            user=user, relationship="self"
        ).first()

        patient_name = profile.name if profile else user.email

        # ── Health card (ID) ─────────────────────────────────────
        health_id = None
        if profile:
            hc = HealthCard.objects.filter(
                profile=profile, revoked_at__isnull=True
            ).first()
            if hc:
                health_id = str(profile.id)

        # ── Blood group ──────────────────────────────────────────
        blood_group = profile.blood_group if profile else None

        # ── Alerts ───────────────────────────────────────────────
        total_alerts = 0
        if profile and profile.region:
            total_alerts = Alert.objects.filter(
                status="active",
                affected_regions__name__iexact=profile.region,
            ).distinct().count()

        # ── Adherence ────────────────────────────────────────────
        adherence_pct = 0.0
        if profile:
            trackers = AdherenceTracker.objects.filter(
                patient=profile, is_active=True
            )
            if trackers.exists():
                total_expected = sum(t.expected_doses for t in trackers)
                total_actual = sum(t.actual_doses for t in trackers)
                if total_expected > 0:
                    adherence_pct = round(
                        (total_actual / total_expected) * 100, 1
                    )

        # ── Missed-medicine days (last 30 days) ──────────────────
        missed_days = 0
        if profile:
            thirty_days_ago = timezone.now() - timedelta(days=30)
            missed_doses = (
                DoseSchedule.objects.filter(
                    tracker__patient=profile,
                    scheduled_time__gte=thirty_days_ago,
                    is_taken=False,
                    scheduled_time__lt=timezone.now(),
                )
                .values("scheduled_time__date")
                .distinct()
            )
            missed_days = missed_doses.count()

        # ── Recent visit records (last 90 days for risk calc) ────
        ninety_days_ago = timezone.now() - timedelta(days=90)
        visit_records = PatientVisitRecord.objects.filter(
            patient=user,
            visit_date__gte=ninety_days_ago,
        )

        # ── Risk score ───────────────────────────────────────────
        risk_score, risk_level = _calculate_risk(visit_records, missed_days)

        # ── Serialise & respond ──────────────────────────────────
        data = {
            "patient_name": patient_name,
            "last_login": user.last_login,
            "total_alerts": total_alerts,
            "adherence_percentage": adherence_pct,
            "calculated_risk_score": risk_score,
            "calculated_risk_level": risk_level,
            "health_id": health_id,
            "blood_group": blood_group,
        }

        serializer = DashboardSummarySerializer(data)
        return Response(serializer.data)


# ── helpers for KPI trends ───────────────────────────────────────

def _make_trend(current: int, previous: int) -> dict:
    """Build a trend dict comparing two period counts."""
    change = current - previous
    if change > 0:
        direction = "up"
    elif change < 0:
        direction = "down"
    else:
        direction = "flat"
    return {
        "current": current,
        "previous": previous,
        "change": change,
        "direction": direction,
    }


class DashboardKPIView(APIView):
    """
    GET /api/dashboard/kpis/

    Returns KPI summary cards for the logged-in patient:
    - total_medical_records
    - active_prescriptions
    - pending_lab_reports
    - adherence_percentage
    - alerts_count
    - total_downloads
    - monthly_trends (current 30d vs previous 30d)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        sixty_days_ago = now - timedelta(days=60)

        profile = Profile.objects.filter(
            user=user, relationship="self"
        ).first()

        # ── Total medical records ────────────────────────────────
        all_records = PatientVisitRecord.objects.filter(patient=user)
        total_medical_records = all_records.count()

        records_current = all_records.filter(
            visit_date__gte=thirty_days_ago
        ).count()
        records_previous = all_records.filter(
            visit_date__gte=sixty_days_ago,
            visit_date__lt=thirty_days_ago,
        ).count()

        # ── Active prescriptions ─────────────────────────────────
        active_prescriptions = 0
        prescriptions_current = 0
        prescriptions_previous = 0
        if profile:
            active_rx = Prescription.objects.filter(
                patient=profile
            ).exclude(status=Prescription.Status.FULLY_DISPENSED)
            active_prescriptions = active_rx.count()

            prescriptions_current = Prescription.objects.filter(
                patient=profile,
                created_at__gte=thirty_days_ago,
            ).count()
            prescriptions_previous = Prescription.objects.filter(
                patient=profile,
                created_at__gte=sixty_days_ago,
                created_at__lt=thirty_days_ago,
            ).count()

        # ── Pending lab reports ──────────────────────────────────
        # Visit records that have tests listed but no report attachments
        pending_lab_reports = 0
        labs_current = 0
        labs_previous = 0

        records_with_tests = all_records.exclude(
            tests_performed=""
        ).exclude(tests_performed__isnull=True)

        for vr in records_with_tests:
            has_attachment = VisitReportAttachment.objects.filter(
                visit_record=vr,
                file_type__icontains="lab",
            ).exists()
            if not has_attachment:
                pending_lab_reports += 1
                if vr.visit_date >= thirty_days_ago:
                    labs_current += 1
                elif vr.visit_date >= sixty_days_ago:
                    labs_previous += 1

        # ── Adherence percentage ─────────────────────────────────
        adherence_pct = 0.0
        adherence_current = 0
        adherence_previous = 0
        if profile:
            trackers = AdherenceTracker.objects.filter(
                patient=profile, is_active=True
            )
            if trackers.exists():
                total_expected = sum(t.expected_doses for t in trackers)
                total_actual = sum(t.actual_doses for t in trackers)
                if total_expected > 0:
                    adherence_pct = round(
                        (total_actual / total_expected) * 100, 1
                    )

            # Doses taken in current vs previous window
            adherence_current = DoseSchedule.objects.filter(
                tracker__patient=profile,
                scheduled_time__gte=thirty_days_ago,
                is_taken=True,
            ).count()
            adherence_previous = DoseSchedule.objects.filter(
                tracker__patient=profile,
                scheduled_time__gte=sixty_days_ago,
                scheduled_time__lt=thirty_days_ago,
                is_taken=True,
            ).count()

        # ── Alerts count ─────────────────────────────────────────
        alerts_count = 0
        alerts_current = 0
        alerts_previous = 0
        if profile and profile.region:
            region_alerts = Alert.objects.filter(
                affected_regions__name__iexact=profile.region,
            ).distinct()
            alerts_count = region_alerts.filter(status="active").count()
            alerts_current = region_alerts.filter(
                generated_at__gte=thirty_days_ago,
            ).count()
            alerts_previous = region_alerts.filter(
                generated_at__gte=sixty_days_ago,
                generated_at__lt=thirty_days_ago,
            ).count()

        # ── Total downloads (report attachments) ─────────────────
        all_attachments = VisitReportAttachment.objects.filter(
            visit_record__patient=user,
        )
        total_downloads = all_attachments.count()
        downloads_current = all_attachments.filter(
            uploaded_at__gte=thirty_days_ago,
        ).count()
        downloads_previous = all_attachments.filter(
            uploaded_at__gte=sixty_days_ago,
            uploaded_at__lt=thirty_days_ago,
        ).count()

        # ── Build response ───────────────────────────────────────
        data = {
            "total_medical_records": total_medical_records,
            "active_prescriptions": active_prescriptions,
            "pending_lab_reports": pending_lab_reports,
            "adherence_percentage": adherence_pct,
            "alerts_count": alerts_count,
            "total_downloads": total_downloads,
            "monthly_trends": {
                "medical_records": _make_trend(records_current, records_previous),
                "prescriptions": _make_trend(prescriptions_current, prescriptions_previous),
                "lab_reports": _make_trend(labs_current, labs_previous),
                "adherence": _make_trend(adherence_current, adherence_previous),
                "alerts": _make_trend(alerts_current, alerts_previous),
                "downloads": _make_trend(downloads_current, downloads_previous),
            },
            "last_updated": now,
        }

        serializer = DashboardKPISerializer(data)
        return Response(serializer.data)


# ── status detection keywords ────────────────────────────────────

_CRITICAL_KEYWORDS = [
    "critical", "emergency", "urgent", "severe", "icu",
    "life-threatening", "unstable",
]
_FOLLOWUP_KEYWORDS = [
    "follow-up", "follow up", "followup", "review", "reassess",
    "come back", "revisit", "recheck", "monitor",
]


def _detect_status(diagnosis: str, doctor_notes: str) -> str:
    """Derive a record status from free-text clinical fields."""
    combined = f"{diagnosis} {doctor_notes}".lower()
    if any(kw in combined for kw in _CRITICAL_KEYWORDS):
        return "critical"
    if any(kw in combined for kw in _FOLLOWUP_KEYWORDS):
        return "follow_up"
    return "completed"


class RecentRecordsView(APIView):
    """
    GET /api/dashboard/recent-records/

    Returns the logged-in patient's visit records ordered newest-first
    with derived status, attachment info, and prescription count.
    Accepts optional ?limit= query param (default 10).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        limit = int(request.query_params.get("limit", 10))

        records = (
            PatientVisitRecord.objects.filter(patient=user)
            .prefetch_related("report_attachments")
            .order_by("-visit_date")[:limit]
        )

        result = []
        for rec in records:
            attachments = rec.report_attachments.all()
            att_list = [
                {
                    "id": att.id,
                    "file_name": att.file_name,
                    "file_type": att.file_type,
                    "file_url": request.build_absolute_uri(
                        f'/api/doctors/reports/{att.id}/download/'
                    ) if att.file else "",
                    "uploaded_by_name": (
                        (lambda u: (
                            f"Dr. {u.doctor_profile.first_name} {u.doctor_profile.last_name}".strip()
                            if hasattr(u, 'doctor_profile') and f"Dr. {u.doctor_profile.first_name} {u.doctor_profile.last_name}".strip() != "Dr."
                            else u.email
                        ))(att.uploaded_by) if att.uploaded_by else None
                    ),
                    "uploaded_at": att.uploaded_at,
                }
                for att in attachments
            ]

            # Count prescriptions linked via text (one blob per visit)
            rx_text = (rec.prescription or "").strip()
            rx_count = 0
            if rx_text:
                # Simple heuristic: count lines/items separated by newlines
                rx_count = len([
                    line for line in rx_text.splitlines() if line.strip()
                ])
                rx_count = max(rx_count, 1)

            # Truncated diagnosis for the card
            diag = rec.diagnosis or ""
            summary = diag[:200] + ("…" if len(diag) > 200 else "")

            result.append(
                {
                    "id": rec.id,
                    "visit_date": rec.visit_date,
                    "visit_time": rec.visit_date.strftime("%I:%M %p")
                    if rec.visit_date
                    else "",
                    "doctor_name": rec.doctor_name,
                    "department": rec.department,
                    "tests_performed": rec.tests_performed or "",
                    "diagnosis_summary": summary,
                    "prescription_text": rx_text,
                    "doctor_notes": rec.doctor_notes or "",
                    "prescriptions_count": rx_count,
                    "status": _detect_status(
                        rec.diagnosis or "", rec.doctor_notes or ""
                    ),
                    "attachments": att_list,
                    "created_at": rec.created_at,
                }
            )

        serializer = RecentRecordSerializer(result, many=True)
        return Response(serializer.data)


# ── Lab Monitoring ───────────────────────────────────────────────


class LabMonitoringView(APIView):
    """
    GET /api/dashboard/lab-monitoring/

    Returns the logged-in patient's latest lab test results with:
    - Numeric value vs. normal range
    - Status: high / low / normal
    - Trend arrow by comparing with the previous result for the same test
    - Report download URL (if a file is attached)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Grab *all* results for this patient, newest first.
        all_results = (
            LabTestResult.objects.filter(patient=user)
            .order_by("test_name", "-tested_at")
        )

        # Group by test_name → keep latest + previous
        seen: dict[str, list] = {}
        for r in all_results:
            bucket = seen.setdefault(r.test_name, [])
            if len(bucket) < 2:
                bucket.append(r)

        output = []
        for test_name, records in seen.items():
            latest = records[0]
            previous = records[1] if len(records) > 1 else None

            # Determine trend
            trend = None
            previous_value = None
            if previous is not None:
                previous_value = previous.value
                if latest.value > previous.value:
                    trend = "up"
                elif latest.value < previous.value:
                    trend = "down"
                # equal → no trend arrow

            # Report URL
            report_url = None
            if latest.report_file:
                report_url = request.build_absolute_uri(latest.report_file.url)

            output.append({
                "id": latest.id,
                "test_name": latest.test_name,
                "value": latest.value,
                "unit": latest.unit,
                "normal_min": latest.normal_min,
                "normal_max": latest.normal_max,
                "status": latest.status,  # property on model
                "trend": trend,
                "previous_value": previous_value,
                "report_url": report_url,
                "tested_at": latest.tested_at,
            })

        # Sort by tested_at descending so most recent tests come first
        output.sort(key=lambda x: x["tested_at"], reverse=True)

        serializer = LabTestSerializer(output, many=True)
        return Response(serializer.data)


# ── Health Trends ────────────────────────────────────────────────

_METRIC_LABELS = {
    "blood_pressure": ("Blood Pressure", "mmHg"),
    "sugar": ("Blood Sugar", "mg/dL"),
    "weight": ("Weight", "kg"),
    "bmi": ("BMI", "kg/m²"),
}


class HealthTrendsView(APIView):
    """
    GET /api/dashboard/health-trends/?months=6

    Returns time-series data for blood_pressure, sugar, weight, and BMI
    grouped by date (one point per day, averaged if multiple readings).
    Accepts optional ?months= query param (default 6, max 12).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from collections import defaultdict

        user = request.user
        months = min(int(request.query_params.get("months", 6)), 12)
        cutoff = timezone.now() - timedelta(days=months * 30)

        metrics_qs = (
            HealthMetric.objects.filter(
                patient=user,
                recorded_at__gte=cutoff,
            )
            .order_by("metric_type", "recorded_at")
        )

        # group by (metric_type, date) → average per day
        grouped: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
        grouped_secondary: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))

        for m in metrics_qs:
            day = m.recorded_at.date().isoformat()
            grouped[m.metric_type][day].append(m.value)
            if m.secondary_value is not None:
                grouped_secondary[m.metric_type][day].append(m.secondary_value)

        trends = []
        for metric_type, (label, unit) in _METRIC_LABELS.items():
            day_map = grouped.get(metric_type, {})
            sec_map = grouped_secondary.get(metric_type, {})
            data_points = []
            for day in sorted(day_map.keys()):
                vals = day_map[day]
                avg_val = round(sum(vals) / len(vals), 1)
                sec_vals = sec_map.get(day)
                avg_sec = None
                if sec_vals:
                    avg_sec = round(sum(sec_vals) / len(sec_vals), 1)
                data_points.append({
                    "date": day,
                    "value": avg_val,
                    "secondary_value": avg_sec,
                })

            trends.append({
                "metric": metric_type,
                "label": label,
                "unit": unit,
                "data": data_points,
            })

        payload = {
            "period_months": months,
            "trends": trends,
        }

        serializer = HealthTrendsResponseSerializer(payload)
        return Response(serializer.data)


# ── Alerts & Risk Monitoring ─────────────────────────────────────


def _generate_alerts_for_patient(user, profile):
    """
    Evaluate health conditions and create new DashboardAlert records
    when thresholds are breached.  Avoids duplicate alerts by checking
    whether an un-dismissed alert of the same type already exists.
    """
    now = timezone.now()
    thirty_days_ago = now - timedelta(days=30)
    ninety_days_ago = now - timedelta(days=90)

    existing_types = set(
        DashboardAlert.objects.filter(
            patient=user,
            is_dismissed=False,
        ).values_list("alert_type", flat=True)
    )

    new_alerts: list[DashboardAlert] = []

    # ── 1.  Abnormal lab results ≥ 2 ────────────────────────────
    if "abnormal_labs" not in existing_types:
        abnormal_count = LabTestResult.objects.filter(
            patient=user,
            tested_at__gte=thirty_days_ago,
        ).exclude(
            value__gte=models.F("normal_min"),
            value__lte=models.F("normal_max"),
        ).count()

        if abnormal_count >= 2:
            severity = "critical" if abnormal_count >= 5 else (
                "high" if abnormal_count >= 3 else "medium"
            )
            new_alerts.append(DashboardAlert(
                patient=user,
                alert_type="abnormal_labs",
                severity=severity,
                title="Multiple Abnormal Lab Results",
                message=(
                    f"{abnormal_count} lab test(s) returned abnormal values "
                    f"in the last 30 days.  Please consult your doctor for "
                    f"further evaluation."
                ),
            ))

    # ── 2.  Medication adherence < 70% ──────────────────────────
    if "low_adherence" not in existing_types and profile:
        trackers = AdherenceTracker.objects.filter(
            patient=profile, is_active=True,
        )
        if trackers.exists():
            total_expected = sum(t.expected_doses for t in trackers)
            total_actual = sum(t.actual_doses for t in trackers)
            if total_expected > 0:
                adherence_pct = (total_actual / total_expected) * 100
                if adherence_pct < 70:
                    severity = "critical" if adherence_pct < 40 else (
                        "high" if adherence_pct < 55 else "medium"
                    )
                    new_alerts.append(DashboardAlert(
                        patient=user,
                        alert_type="low_adherence",
                        severity=severity,
                        title="Low Medication Adherence",
                        message=(
                            f"Your medication adherence is at "
                            f"{round(adherence_pct, 1)}%, which is below the "
                            f"recommended 70%.  Consistently taking your "
                            f"medicines is crucial for effective treatment."
                        ),
                    ))

    # ── 3.  Risk score ≥ 4 ──────────────────────────────────────
    if "high_risk" not in existing_types:
        visit_records = PatientVisitRecord.objects.filter(
            patient=user,
            visit_date__gte=ninety_days_ago,
        )
        missed_days = 0
        if profile:
            missed_doses = (
                DoseSchedule.objects.filter(
                    tracker__patient=profile,
                    scheduled_time__gte=thirty_days_ago,
                    is_taken=False,
                    scheduled_time__lt=now,
                )
                .values("scheduled_time__date")
                .distinct()
            )
            missed_days = missed_doses.count()

        risk_score, risk_level = _calculate_risk(visit_records, missed_days)

        if risk_score >= 4:
            severity = "critical" if risk_score >= 7 else (
                "high" if risk_score >= 5 else "medium"
            )
            new_alerts.append(DashboardAlert(
                patient=user,
                alert_type="high_risk",
                severity=severity,
                title="Elevated Health Risk Score",
                message=(
                    f"Your health risk score is {risk_score} ({risk_level}).  "
                    f"This is based on recent lab results, vital readings, "
                    f"and medication adherence.  Please schedule a check-up."
                ),
            ))

    if new_alerts:
        DashboardAlert.objects.bulk_create(new_alerts)


class DashboardAlertsView(APIView):
    """
    GET  /api/dashboard/alerts/
    Returns all un-dismissed alerts for the logged-in patient.
    Triggers alert generation on each request to stay up-to-date.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = Profile.objects.filter(
            user=user, relationship="self",
        ).first()

        # Auto-generate any newly applicable alerts
        _generate_alerts_for_patient(user, profile)

        alerts = DashboardAlert.objects.filter(
            patient=user,
            is_dismissed=False,
        ).order_by("-created_at")

        serializer = DashboardAlertSerializer(alerts, many=True)
        return Response(serializer.data)


class AlertDetailView(APIView):
    """
    PATCH /api/dashboard/alerts/<uuid>/
    Body: { "is_read": true } and/or { "is_dismissed": true }
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, alert_id):
        try:
            alert = DashboardAlert.objects.get(
                id=alert_id,
                patient=request.user,
            )
        except DashboardAlert.DoesNotExist:
            return Response({"detail": "Alert not found."}, status=404)

        if request.data.get("is_read"):
            alert.mark_read()
        if request.data.get("is_dismissed"):
            alert.dismiss()

        serializer = DashboardAlertSerializer(alert)
        return Response(serializer.data)


# ═══════════════════════════════════════════════════════════════════
# SECURITY SETTINGS
# ═══════════════════════════════════════════════════════════════════

def _get_client_ip(request):
    """Extract the client IP address from the request."""
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "0.0.0.0")


def _parse_user_agent(ua: str) -> str:
    """Derive a human-readable device string from User-Agent."""
    ua_lower = ua.lower()

    # Browser
    if "edg" in ua_lower:
        browser = "Edge"
    elif "chrome" in ua_lower:
        browser = "Chrome"
    elif "firefox" in ua_lower:
        browser = "Firefox"
    elif "safari" in ua_lower:
        browser = "Safari"
    else:
        browser = "Unknown Browser"

    # OS
    if "windows" in ua_lower:
        os_name = "Windows"
    elif "mac" in ua_lower:
        os_name = "macOS"
    elif "linux" in ua_lower:
        os_name = "Linux"
    elif "android" in ua_lower:
        os_name = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        os_name = "iOS"
    else:
        os_name = "Unknown OS"

    return f"{browser} on {os_name}"


class SecuritySettingsView(APIView):
    """
    GET /api/dashboard/security/
    Returns security overview for the logged-in user.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Active sessions from accounts.Session
        active_sessions_qs = Session.objects.filter(
            user=user,
            expires_at__gt=timezone.now(),
        ).order_by("-created_at")[:10]

        sessions_data = []
        for sess in active_sessions_qs:
            device_info = sess.device_info or {}
            device = device_info.get("device") or _parse_user_agent(sess.user_agent or "")
            ip = device_info.get("ip_address") or "Unknown"
            sessions_data.append({
                "id": sess.id,
                "device": device,
                "ip_address": ip,
                "last_active": sess.created_at.isoformat(),
            })

        return Response({
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "password_last_changed": (
                user.password_last_changed.isoformat()
                if user.password_last_changed
                else None
            ),
            "is_2fa_enabled": user.is_2fa_enabled,
            "active_sessions": sessions_data,
        })


class ChangePasswordView(APIView):
    """
    POST /api/dashboard/change-password/
    Body: { "old_password": "...", "new_password": "...", "confirm_password": "..." }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get("old_password", "")
        new_password = request.data.get("new_password", "")
        confirm_password = request.data.get("confirm_password", "")

        if not old_password or not new_password or not confirm_password:
            return Response(
                {"detail": "All password fields are required."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_password:
            return Response(
                {"detail": "New passwords do not match."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        if not user.check_password(old_password):
            return Response(
                {"detail": "Current password is incorrect."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.password_last_changed = timezone.now()
        user.save(update_fields=["password", "password_last_changed"])

        return Response({"detail": "Password changed successfully."})


class Toggle2FAView(APIView):
    """
    POST /api/dashboard/toggle-2fa/
    Placeholder endpoint — toggles the is_2fa_enabled flag.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user.is_2fa_enabled = not user.is_2fa_enabled
        user.save(update_fields=["is_2fa_enabled"])
        return Response({
            "detail": "2FA setting updated.",
            "is_2fa_enabled": user.is_2fa_enabled,
        })


# ═══════════════════════════════════════════════════════════════════
# DOWNLOAD CENTER
# ═══════════════════════════════════════════════════════════════════

class DownloadListView(APIView):
    """
    GET /api/dashboard/downloads/
    Returns all downloadable files belonging to the logged-in user.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        items = []

        # 1) Visit Report Attachments
        attachments = VisitReportAttachment.objects.filter(
            visit_record__patient=user,
        ).select_related("visit_record")

        for att in attachments:
            items.append({
                "id": att.id,
                "type": "visit_attachment",
                "type_label": att.file_type or "Visit Attachment",
                "title": att.file_name,
                "visit_info": f"{att.visit_record.doctor_name} – {att.visit_record.department}",
                "created_at": att.uploaded_at.isoformat(),
                "file_url": att.file.url if att.file else None,
            })

        # 2) Lab Report files
        lab_reports = LabTestResult.objects.filter(
            patient=user,
        ).exclude(report_file="")

        for lab in lab_reports:
            items.append({
                "id": lab.id,
                "type": "lab_report",
                "type_label": "Lab Report",
                "title": f"{lab.test_name} – {lab.tested_at:%d %b %Y}",
                "visit_info": f"{lab.value} {lab.unit}",
                "created_at": lab.tested_at.isoformat(),
                "file_url": lab.report_file.url if lab.report_file else None,
            })

        # Sort by date descending
        items.sort(key=lambda x: x["created_at"], reverse=True)

        return Response(items)


class DownloadFileView(APIView):
    """
    GET /api/dashboard/download/<int:file_id>/?type=visit_attachment|lab_report
    Validates ownership, logs the download, and serves the file.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, file_id):
        user = request.user
        file_type = request.query_params.get("type", "visit_attachment")
        ip = _get_client_ip(request)

        if file_type == "lab_report":
            try:
                record = LabTestResult.objects.get(id=file_id, patient=user)
            except LabTestResult.DoesNotExist:
                return Response({"detail": "File not found."}, status=404)

            if not record.report_file:
                return Response({"detail": "No file attached."}, status=404)

            file_field = record.report_file
            file_name = f"{record.test_name}_{record.tested_at:%Y%m%d}.pdf"
            log_type = DownloadLog.FileType.LAB_REPORT
        else:
            try:
                record = VisitReportAttachment.objects.select_related(
                    "visit_record"
                ).get(id=file_id, visit_record__patient=user)
            except VisitReportAttachment.DoesNotExist:
                return Response({"detail": "File not found."}, status=404)

            if not record.file:
                return Response({"detail": "No file attached."}, status=404)

            file_field = record.file
            file_name = record.file_name or f"attachment_{file_id}"
            log_type = DownloadLog.FileType.VISIT_ATTACHMENT

        # Prevent path traversal
        file_name = file_name.replace("..", "").replace("/", "_").replace("\\", "_")

        # Log
        DownloadLog.objects.create(
            user=user,
            file_type=log_type,
            file_id=file_id,
            file_name=file_name,
            ip_address=ip,
        )

        response = FileResponse(file_field.open("rb"), as_attachment=True, filename=file_name)
        return response


class DownloadAllView(APIView):
    """
    GET /api/dashboard/download-all/
    Generates a ZIP of all the user's downloadable files and streams it.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        ip = _get_client_ip(request)

        buf = BytesIO()
        file_count = 0

        with ZipFile(buf, "w") as zf:
            # Visit attachments
            attachments = VisitReportAttachment.objects.filter(
                visit_record__patient=user,
            ).select_related("visit_record")

            for att in attachments:
                if att.file:
                    try:
                        safe_name = (att.file_name or f"attachment_{att.id}").replace("..", "").replace("/", "_")
                        zf.writestr(
                            f"visit_reports/{safe_name}",
                            att.file.read(),
                        )
                        file_count += 1
                    except Exception:
                        pass  # skip unreadable files

            # Lab reports
            labs = LabTestResult.objects.filter(
                patient=user
            ).exclude(report_file="")

            for lab in labs:
                if lab.report_file:
                    try:
                        safe_name = f"{lab.test_name}_{lab.tested_at:%Y%m%d}.pdf".replace("/", "_")
                        zf.writestr(
                            f"lab_reports/{safe_name}",
                            lab.report_file.read(),
                        )
                        file_count += 1
                    except Exception:
                        pass

        if file_count == 0:
            return Response(
                {"detail": "No files available for download."},
                status=drf_status.HTTP_404_NOT_FOUND,
            )

        # Log bulk download
        DownloadLog.objects.create(
            user=user,
            file_type=DownloadLog.FileType.BULK,
            file_name=f"all_records_{timezone.now():%Y%m%d_%H%M}.zip",
            ip_address=ip,
        )

        buf.seek(0)
        response = HttpResponse(buf.read(), content_type="application/zip")
        response["Content-Disposition"] = (
            f'attachment; filename="health_records_{timezone.now():%Y%m%d}.zip"'
        )
        return response
