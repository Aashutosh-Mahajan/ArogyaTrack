"""
accounts/validators.py
─────────────────────────────────────────────────────
Production-grade validators for doctor registration
"""
import re
from datetime import date
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


def validate_medical_certificate(file):
    """Validate medical certificate upload (PDF/Image only, max 10MB)."""
    allowed_extensions = ['pdf', 'jpg', 'jpeg', 'png']
    ext = file.name.split('.')[-1].lower()
    if ext not in allowed_extensions:
        raise ValidationError(
            _(f"Invalid file type. Only {', '.join(allowed_extensions)} files are allowed.")
        )
    
    # Check size
    if file.size > 10 * 1024 * 1024:  # 10MB
        raise ValidationError(
            _(f"File size cannot exceed 10MB. Your file is {file.size / (1024 * 1024):.2f}MB")
        )


def validate_doctor_age(dob: date):
    """Validate doctor date of birth (minimum 23 years, maximum 80 years)."""
    today = date.today()
    
    if dob > today:
        raise ValidationError(_("Date of birth cannot be in the future"))
    
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    
    if age < 23:
        raise ValidationError(
            _("Doctor must be at least 23 years old (minimum age for medical practice)")
        )
    
    if age > 80:
        raise ValidationError(_("Invalid date of birth"))


def validate_medical_registration(reg_number: str):
    """
    Validate medical registration number format.
    
    Must be alphanumeric, 6-20 characters.
    """
    if not reg_number:
        raise ValidationError(_("Medical registration number is required"))
    
    # Allow alphanumeric with optional hyphens/slashes
    pattern = r'^[A-Z0-9\-\/]{6,20}$'
    
    if not re.match(pattern, reg_number.upper().strip()):
        raise ValidationError(
            _("Invalid registration number. Must be 6-20 alphanumeric characters.")
        )
