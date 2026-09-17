"""
Backfill the new `profile` FK on DashboardAlert for rows created before that
field existed. Same resolution rule as medical/migrations/0010_backfill_profile.py.
"""
from django.db import migrations


def backfill(apps, schema_editor):
    Profile = apps.get_model("patients", "Profile")
    DashboardAlert = apps.get_model("dashboard", "DashboardAlert")

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

    rows = DashboardAlert.objects.filter(profile__isnull=True).only("id", "patient_id")
    for row in rows:
        profile = resolve(row.patient_id)
        if profile is not None:
            DashboardAlert.objects.filter(pk=row.pk).update(profile=profile)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("dashboard", "0004_dashboardalert_profile_and_more"),
        ("patients", "0007_remove_profile_emergency_contact_number_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
