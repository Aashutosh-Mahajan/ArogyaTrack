"""
Management command to create admin user
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import User


class Command(BaseCommand):
    help = "Create an admin user with predefined credentials"

    def handle(self, *args, **options):
        email = "admin@gmail.com"
        password = "admin123"
        
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
