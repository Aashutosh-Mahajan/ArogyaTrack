"""
Management command to create admin user
"""
import os
import secrets

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from accounts.models import User


class Command(BaseCommand):
    help = "Create an admin user. Reads credentials from ADMIN_EMAIL/ADMIN_PASSWORD env vars."

    def handle(self, *args, **options):
        email = os.getenv("ADMIN_EMAIL")
        password = os.getenv("ADMIN_PASSWORD")
        if not email:
            raise CommandError("Set ADMIN_EMAIL before running this command.")
        if not password:
            password = secrets.token_urlsafe(16)
            self.stdout.write(self.style.WARNING(
                "ADMIN_PASSWORD not set — generated a random password (shown below, save it now)."
            ))

        try:
            with transaction.atomic():
                # Check if admin user already exists
                if User.objects.filter(email=email).exists():
                    user = User.objects.get(email=email)
                    # Update existing user to admin
                    user.role = User.Role.ADMIN
                    user.is_staff = True
                    user.is_superuser = True
                    user.is_active = True
                    user.verification_status = User.VerificationStatus.VERIFIED
                    user.set_password(password)
                    user.save()
                    self.stdout.write(
                        self.style.SUCCESS(f"✓ Updated existing user '{email}' to admin with full permissions")
                    )
                else:
                    # Create new admin user
                    user = User.objects.create_superuser(
                        email=email,
                        password=password,
                        role=User.Role.ADMIN,
                        is_active=True,
                    )
                    self.stdout.write(
                        self.style.SUCCESS(f"✓ Created admin user '{email}' with full permissions")
                    )
                
                self.stdout.write(self.style.SUCCESS(f"Email: {email}"))
                self.stdout.write(self.style.SUCCESS(f"Password: {password}"))
                self.stdout.write(self.style.SUCCESS(f"Role: {user.get_role_display()}"))
                self.stdout.write(self.style.SUCCESS(f"Verification Status: {user.get_verification_status_display()}"))
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Error creating admin user: {str(e)}")
            )
            raise
