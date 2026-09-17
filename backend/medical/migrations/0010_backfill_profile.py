"""
Backfill the new `profile` FK on PatientVisitRecord, LabTestResult, and
HealthMetric for rows created before that field existed.

Resolution rule (matches the convention already used in dashboard/views.py
for "the logged-in patient's own dashboard"): prefer the user's "self"
profile; if none exists (e.g. the user only ever created a profile for a
family member and never one for themselves), fall back to their earliest
created profile so the row still gets *some* scoping rather than staying
NULL indefinitely.
"""
from django.db import migrations


def _resolve_profile_cache(Profile):
    cache = {}

    def resolve(user_id):
        if user_id in cache:
            return cache[user_id]
        profile = (
            Profile.objects.filter(user_id=user_id, relationship="self").first()
            or Profile.objects.filter(user_id=user_id).order_by("created_at").first()
        )
        cache[user_id] = profile
        return profile

    return resolve


def backfill(apps, schema_editor):
    Profile = apps.get_model("patients", "Profile")
    PatientVisitRecord = apps.get_model("medical", "PatientVisitRecord")
    LabTestResult = apps.get_model("medical", "LabTestResult")
    HealthMetric = apps.get_model("medical", "HealthMetric")

    resolve = _resolve_profile_cache(Profile)

    for model in (PatientVisitRecord, LabTestResult, HealthMetric):
        rows = model.objects.filter(profile__isnull=True).only("id", "patient_id")
        for row in rows:
            profile = resolve(row.patient_id)
            if profile is not None:
                model.objects.filter(pk=row.pk).update(profile=profile)


def noop_reverse(apps, schema_editor):
    # Reversible as a no-op: dropping the profile FK values is handled by
    # reversing the schema migration this depends on, not by this migration.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("medical", "0009_healthmetric_profile_labtestresult_profile_and_more"),
        ("patients", "0007_remove_profile_emergency_contact_number_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
