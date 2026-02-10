from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("patients", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MedicalRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("symptoms", models.TextField(blank=True)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "doctor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="doctor_records",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "patient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="medical_records",
                        to="patients.profile",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="ChronicCondition",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("icd_10_code", models.CharField(max_length=10)),
                ("disease_name", models.CharField(blank=True, max_length=255)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="chronic_conditions",
                        to="patients.profile",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Allergy",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("allergen", models.CharField(max_length=255)),
                ("reaction_type", models.CharField(max_length=120)),
                ("severity", models.PositiveSmallIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="allergies",
                        to="patients.profile",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Diagnosis",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("icd_10_code", models.CharField(max_length=10)),
                ("disease_name", models.CharField(max_length=255)),
                ("severity", models.PositiveSmallIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "record",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="diagnoses",
                        to="medical.medicalrecord",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
