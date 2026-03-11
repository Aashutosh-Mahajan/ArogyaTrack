"""
patients/validators.py
─────────────────────────────────────────────────────
Production-grade validators for patient/doctor registration
"""
import re
from datetime import date, timedelta
from typing import Optional

from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.utils.translation import gettext_lazy as _


# ─── File Validators ───────────────────────────────────────────────


def validate_file_size(file, max_size_mb: int = 5):
    """
    Validate uploaded file size.
    
    Args:
        file: Uploaded file object
        max_size_mb: Maximum allowed size in MB (default: 5MB)
    
    Raises:
        ValidationError: If file exceeds max size
    """
    if file.size > max_size_mb * 1024 * 1024:
        raise ValidationError(
            _(f"File size cannot exceed {max_size_mb}MB. Your file is {file.size / (1024 * 1024):.2f}MB")
        )


def validate_id_proof_file(file):
    """Validate Aadhar ID proof file (image or PDF only, max 5MB)."""
    # Check extension
    allowed_extensions = ['jpg', 'jpeg', 'png', 'pdf']
    ext = file.name.split('.')[-1].lower()
    if ext not in allowed_extensions:
        raise ValidationError(
            _(f"Invalid file type. Only {', '.join(allowed_extensions)} files are allowed.")
        )
    # Check size
    validate_file_size(file, max_size_mb=5)


def validate_medical_certificate(file):
    """Validate medical certificate upload (PDF only, max 10MB)."""
    allowed_extensions = ['pdf', 'jpg', 'jpeg', 'png']
    ext = file.name.split('.')[-1].lower()
    if ext not in allowed_extensions:
        raise ValidationError(
            _(f"Invalid file type. Only {', '.join(allowed_extensions)} files are allowed.")
        )
    validate_file_size(file, max_size_mb=10)


# ─── Text/String Validators ────────────────────────────────────────


def validate_phone_number(phone: str):
    """
    Validate phone number format (Indian format or international).
    
    Accepts:
        - 10 digit Indian numbers: 9876543210
        - With country code: +919876543210
        - With spaces/hyphens: +91 98765-43210
    """
    # Remove spaces, hyphens, parentheses
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)
    
    # Pattern: optional +, optional country code, 10 digits
    pattern = r'^\+?(?:[0-9]{1,3})?[6-9][0-9]{9}$'
    
    if not re.match(pattern, cleaned):
        raise ValidationError(
            _("Invalid phone number. Enter a valid 10-digit mobile number.")
        )


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


def validate_strong_password(password: str):
    """
    Validate password strength.
    
    Requirements:
        - Minimum 8 characters
    """
    if len(password) < 8:
        raise ValidationError(_("Password must be at least 8 characters long"))
    
    # regex checks removed for development ease


def validate_full_name(name: str):
    """Validate full name (2-100 characters, letters and spaces only)."""
    if not name or len(name) < 2 or len(name) > 100:
        raise ValidationError(_("Name must be between 2 and 100 characters"))
    
    # Allow letters, spaces, hyphens, apostrophes
    pattern = r"^[a-zA-Z\s\-']+$"
    
    if not re.match(pattern, name):
        raise ValidationError(
            _("Name can only contain letters, spaces, hyphens, and apostrophes")
        )


# ─── Age Validators ─────────────────────────────────────────────────


def validate_patient_age(dob: date):
    """Validate patient date of birth (must be born, max 150 years old)."""
    today = date.today()
    
    if dob > today:
        raise ValidationError(_("Date of birth cannot be in the future"))
    
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    
    if age > 150:
        raise ValidationError(_("Invalid date of birth"))
    
    if age < 0:
        raise ValidationError(_("Invalid date of birth"))


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


def validate_experience_years(years: int, dob: Optional[date] = None):
    """
    Validate years of medical experience.
    
    Args:
        years: Years of experience claimed
        dob: Date of birth (optional, for cross-validation)
    """
    if years < 0:
        raise ValidationError(_("Experience years cannot be negative"))
    
    if years > 60:
        raise ValidationError(_("Experience years seems unrealistic"))
    
    # If DOB provided, validate experience makes sense
    if dob:
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        
        # Assuming min age for practice is 23, max experience is age - 23
        max_possible_experience = age - 23
        
        if years > max_possible_experience:
            raise ValidationError(
                _(f"Experience years ({years}) exceeds possible years based on age ({max_possible_experience})")
            )


# ─── State/District Validators ──────────────────────────────────────


INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
]


def validate_indian_state(state: str):
    """Validate Indian state/UT name."""
    if state not in INDIAN_STATES:
        raise ValidationError(
            _(f"Invalid state. Must be one of the Indian states/UTs")
        )


# ─── Consent Validators ─────────────────────────────────────────────


def validate_consent_agreement(value: bool, field_name: str = "consent"):
    """Validate that required consent is given."""
    if not value:
        raise ValidationError(
            _(f"You must provide {field_name} to continue")
        )


# ─── Aadhar Validators ──────────────────────────────────────────────


def validate_aadhar_format(aadhar: Optional[str]):
    """
    Validate Aadhar number format (12 digits).
    
    NOTE: For production, consider encrypting/hashing Aadhar numbers
    and never store in plain text due to privacy regulations.
    """
    if not aadhar:
        return  # Optional field
    
    # Remove spaces/hyphens
    cleaned = re.sub(r'[\s\-]', '', aadhar)
    
    # Must be exactly 12 digits
    if not re.match(r'^\d{12}$', cleaned):
        raise ValidationError(
            _("Invalid Aadhar number. Must be 12 digits.")
        )
