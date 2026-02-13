"""
Backend Validation Script
========================
Run this script to validate all updates are working correctly.

Usage:
    python backend/validate_updates.py
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from patients.models import Profile, PatientProfile
from accounts.models import DoctorProfile
from medical.models import MedicalRecord, Diagnosis, Allergy, ChronicCondition
from prescriptions.models import Medicine, Prescription, PrescriptionMedicine
from adherence.models import AdherenceTracker, DoseSchedule
from pharmacy.models import Pharmacy, DispensingRecord
from surveillance.models import Region, SurveillanceData, Cluster

User = get_user_model()

def check_model_fields(model_class, required_fields):
    """Check if model has all required fields."""
    model_fields = [f.name for f in model_class._meta.get_fields()]
    missing = [f for f in required_fields if f not in model_fields]
    
    if missing:
        print(f"❌ {model_class.__name__} missing fields: {missing}")
        return False
    else:
        print(f"✅ {model_class.__name__} has all required fields")
        return True

def validate_models():
    """Validate all model updates."""
    print("\n🔍 Validating Model Updates...\n")
    
    results = []
    
    # User model
    results.append(check_model_fields(User, [
        'email', 'role', 'verification_status', 'active_profile', 'is_active'
    ]))
    
    # Profile model
    results.append(check_model_fields(Profile, [
        'name', 'age', 'gender', 'blood_group', 'relationship',
        'date_of_birth', 'phone', 'emergency_contact_number',
        'district', 'state', 'country', 'address', 'pincode'
    ]))
    
    # PatientProfile model
    results.append(check_model_fields(PatientProfile, [
        'user', 'aadhar_id_proof', 'terms_accepted', 'consent_store_data',
        'consent_doctor_access', 'data_sharing_enabled'
    ]))
    
    # DoctorProfile model
    results.append(check_model_fields(DoctorProfile, [
        'user', 'first_name', 'last_name', 'medical_license',
        'degree', 'specialization', 'experience_years',
        'license_certificate', 'degree_certificate', 'government_id',
        'approval_status', 'clinic_name', 'consultation_fee'
    ]))
    
    # MedicalRecord model
    results.append(check_model_fields(MedicalRecord, [
        'patient', 'doctor', 'symptoms', 'notes'
    ]))
    
    # Prescription model
    results.append(check_model_fields(Prescription, [
        'patient', 'doctor', 'qr_code_path', 'security_hash', 'status'
    ]))
    
    # Medicine model
    results.append(check_model_fields(Medicine, [
        'name', 'generic_name', 'drug_class', 'therapeutic_category',
        'standard_dosages', 'allergens'
    ]))
    
    # AdherenceTracker model
    results.append(check_model_fields(AdherenceTracker, [
        'prescription', 'patient', 'start_date', 'end_date',
        'expected_doses', 'actual_doses', 'is_active'
    ]))
    
    return all(results)

def validate_serializers():
    """Check if all serializers are importable."""
    print("\n🔍 Validating Serializers...\n")
    
    try:
        from accounts.serializers import (
            DoctorRegistrationSerializer,
            PatientRegistrationSerializer,
            DoctorProfileSerializer,
        )
        print("✅ Account serializers imported successfully")
        
        from patients.serializers import (
            ProfileSerializer,
            PatientProfileSerializer,
            HealthCardSerializer,
        )
        print("✅ Patient serializers imported successfully")
        
        from medical.serializers import (
            MedicalRecordSerializer,
            AllergySerializer,
            ChronicConditionSerializer,
        )
        print("✅ Medical serializers imported successfully")
        
        from prescriptions.serializers import (
            MedicineSerializer,
            PrescriptionSerializer,
            PrescriptionMedicineSerializer,
        )
        print("✅ Prescription serializers imported successfully")
        
        return True
    except ImportError as e:
        print(f"❌ Serializer import error: {e}")
        return False

def validate_views():
    """Check if all views are importable."""
    print("\n🔍 Validating Views...\n")
    
    try:
        from accounts.views import (
            DoctorRegistrationView,
            PatientRegistrationView,
            CurrentUserView,
            PendingDoctorsView,
            DoctorApprovalView,
        )
        print("✅ Account views imported successfully")
        
        from patients.views import (
            ActiveProfileView,
            PatientProfileView,
            MyCardView,
        )
        print("✅ Patient views imported successfully")
        
        return True
    except ImportError as e:
        print(f"❌ View import error: {e}")
        return False

def validate_urls():
    """Check if URL patterns are valid."""
    print("\n🔍 Validating URL Patterns...\n")
    
    try:
        from django.urls import get_resolver
        resolver = get_resolver()
        
        # Check key endpoints
        endpoints = [
            'auth/me/',
            'auth/register/patient/',
            'auth/register/doctor/',
            'patients/profile/',
            'patients/patient-profile/',
        ]
        
        for endpoint in endpoints:
            try:
                resolver.resolve(f'/api/{endpoint}')
                print(f"✅ Endpoint exists: /api/{endpoint}")
            except:
                print(f"❌ Endpoint missing: /api/{endpoint}")
        
        return True
    except Exception as e:
        print(f"❌ URL validation error: {e}")
        return False

def check_database_migrations():
    """Check if migrations are up to date."""
    print("\n🔍 Checking Database Migrations...\n")
    
    from django.core.management import call_command
    from io import StringIO
    
    try:
        # Check for unapplied migrations
        out = StringIO()
        call_command('showmigrations', '--plan', stdout=out)
        output = out.getvalue()
        
        if '[ ]' in output:
            print("⚠️  Unapplied migrations found. Run: python manage.py migrate")
            return False
        else:
            print("✅ All migrations applied")
            return True
    except Exception as e:
        print(f"❌ Migration check error: {e}")
        return False

def validate_validators():
    """Check if validators are working."""
    print("\n🔍 Validating Validators...\n")
    
    try:
        from patients.validators import (
            validate_phone_number,
            validate_patient_age,
            validate_full_name,
        )
        
        from accounts.validators import (
            validate_medical_certificate,
            validate_doctor_age,
            validate_medical_registration,
        )
        
        print("✅ All validators imported successfully")
        
        # Test phone validation
        try:
            validate_phone_number("+911234567890")
            print("✅ Phone number validation works")
        except Exception as e:
            print(f"❌ Phone validation error: {e}")
        
        return True
    except ImportError as e:
        print(f"❌ Validator import error: {e}")
        return False

def main():
    """Run all validations."""
    print("=" * 80)
    print("🚀 Backend Validation Script")
    print("=" * 80)
    
    results = {
        "Models": validate_models(),
        "Serializers": validate_serializers(),
        "Views": validate_views(),
        "URLs": validate_urls(),
        "Migrations": check_database_migrations(),
        "Validators": validate_validators(),
    }
    
    print("\n" + "=" * 80)
    print("📊 VALIDATION SUMMARY")
    print("=" * 80)
    
    for component, status in results.items():
        status_icon = "✅" if status else "❌"
        print(f"{status_icon} {component}: {'PASS' if status else 'FAIL'}")
    
    print("=" * 80)
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n🎉 All validations passed! System is ready.")
        return 0
    else:
        print("\n⚠️  Some validations failed. Please review the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
