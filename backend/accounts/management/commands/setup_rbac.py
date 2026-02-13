"""
Management command: python manage.py setup_rbac

Idempotently creates the three role Groups and assigns the correct
Django permissions to each.  Run once after migrations.
"""

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

# ── Permission codenames mapped to each role ────────────────────────
# Format:  app_label.codename
# Django auto-creates add/change/delete/view for every model.
# We reference those plus any custom ones defined on Meta.permissions.

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "Doctor": [
        # Medical
        "medical.add_medicalrecord",
        "medical.change_medicalrecord",
        "medical.view_medicalrecord",
        "medical.add_diagnosis",
        "medical.view_diagnosis",
        "medical.add_allergy",
        "medical.view_allergy",
        "medical.add_chroniccondition",
        "medical.view_chroniccondition",
        "medical.add_doctorpatientaccess",
        "medical.view_doctorpatientaccess",
        # Prescriptions
        "prescriptions.add_prescription",
        "prescriptions.view_prescription",
        "prescriptions.view_medicine",
        "prescriptions.view_druginteraction",
        "prescriptions.add_prescriptionmedicine",
        "prescriptions.view_prescriptionmedicine",
        # Patients (view only)
        "patients.view_profile",
        "patients.view_healthcard",
    ],
    "Patient": [
        # Own records (read-only)
        "medical.view_medicalrecord",
        "medical.view_diagnosis",
        "medical.view_allergy",
        "medical.view_chroniccondition",
        # Prescriptions (read-only)
        "prescriptions.view_prescription",
        "prescriptions.view_prescriptionmedicine",
        # Own profiles
        "patients.add_profile",
        "patients.change_profile",
        "patients.view_profile",
        "patients.view_healthcard",
        "patients.add_emergencycontact",
        "patients.change_emergencycontact",
        "patients.view_emergencycontact",
    ],
    "Admin": [
        # Full access to accounts
        "accounts.view_user",
        "accounts.change_user",
        "accounts.delete_user",
        "accounts.view_doctorprofile",
        "accounts.change_doctorprofile",
        "accounts.view_auditlog",
        # Full access to medical
        "medical.view_medicalrecord",
        "medical.view_diagnosis",
        "medical.view_allergy",
        "medical.view_chroniccondition",
        "medical.view_doctorpatientaccess",
        # Full access to prescriptions
        "prescriptions.view_prescription",
        "prescriptions.view_prescriptionmedicine",
        "prescriptions.view_medicine",
        "prescriptions.view_druginteraction",
        # Full access to patients
        "patients.view_profile",
        "patients.view_healthcard",
        # Surveillance
        "surveillance.view_region",
        "surveillance.view_surveillancedata",
        "surveillance.view_cluster",
        "surveillance.view_forecast",
        "surveillance.view_anomaly",
        "surveillance.view_riskscore",
        "surveillance.view_alert",
        "surveillance.view_notification",
    ],
}


class Command(BaseCommand):
    help = "Create RBAC groups (Doctor, Patient, Admin) and assign permissions."

    def handle(self, *args, **options):
        for role_name, perm_strings in ROLE_PERMISSIONS.items():
            group, created = Group.objects.get_or_create(name=role_name)
            verb = "Created" if created else "Updated"

            perms = []
            for perm_str in perm_strings:
                app_label, codename = perm_str.split(".")
                try:
                    perm = Permission.objects.get(
                        content_type__app_label=app_label,
                        codename=codename,
                    )
                    perms.append(perm)
                except Permission.DoesNotExist:
                    self.stderr.write(
                        self.style.WARNING(f"  ⚠  Permission not found: {perm_str}")
                    )

            group.permissions.set(perms)
            self.stdout.write(
                self.style.SUCCESS(
                    f"  {verb} group '{role_name}' with {len(perms)} permissions."
                )
            )

        self.stdout.write(self.style.SUCCESS("\nRBAC setup complete."))
