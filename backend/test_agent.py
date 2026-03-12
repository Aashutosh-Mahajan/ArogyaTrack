"""
Test script for the AI Prescription Safety Agent.
Run from backend dir:
    python test_agent.py
"""
import os, sys, django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

# Allow DRF test client's 'testserver' host
from django.conf import settings as _settings
if "testserver" not in _settings.ALLOWED_HOSTS and "*" not in _settings.ALLOWED_HOSTS:
    _settings.ALLOWED_HOSTS.append("testserver")

import json
from datetime import date, timedelta
from uuid import uuid4

from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, DoctorProfile
from patients.models import Profile
from prescriptions.models import Medicine, Prescription, PrescriptionMedicine, DrugInteraction
from medical.models import Allergy, ChronicCondition, HealthMetric, LabTestResult, DoctorPatientAccess
from pharmacy.models import Pharmacy, PharmacyInventory

SEPARATOR = "=" * 60


def cprint(label, data):
    print(f"\n{SEPARATOR}")
    print(f"  {label}")
    print(SEPARATOR)
    if isinstance(data, (dict, list)):
        print(json.dumps(data, indent=2, default=str))
    else:
        print(data)


# ─── 1. Create test data ──────────────────────────────────────────

print("\n>>> Setting up test data...\n")

# Doctor user
doctor, _ = User.objects.get_or_create(
    email="test_agent_doctor@hospital.com",
    defaults={"role": "doctor", "verification_status": "verified"},
)
doctor.set_password("testpass123")
doctor.save()

# Approve doctor
doc_profile, _ = DoctorProfile.objects.get_or_create(
    user=doctor,
    defaults={
        "first_name": "Dr. Test",
        "last_name": "Agent",
        "specialization": "General Medicine",
        "medical_license": "MR-TEST-001",
        "approval_status": "approved",
    },
)
if doc_profile.approval_status != "approved":
    doc_profile.approval_status = "approved"
    doc_profile.save()

# Patient profile
patient, _ = Profile.objects.get_or_create(
    user=doctor,  # reuse for simplicity
    name="Rahul Sharma",
    relationship="self",
    defaults={
        "age": 45,
        "gender": "male",
        "blood_group": "B+",
        "date_of_birth": date(1981, 3, 15),
        "district": "Lucknow",
        "region": "Uttar Pradesh",
        "state": "Uttar Pradesh",
    },
)
print(f"  Patient: {patient.name} (ID: {patient.id})")

# Grant doctor access to patient
DoctorPatientAccess.objects.get_or_create(
    doctor=doctor,
    patient=patient,
    defaults={"expires_at": timezone.now() + timedelta(hours=24)},
)

# Allergies
Allergy.objects.get_or_create(
    profile=patient,
    allergen="Penicillin",
    defaults={"reaction_type": "Anaphylaxis", "severity": 3},
)
Allergy.objects.get_or_create(
    profile=patient,
    allergen="Sulfonamide",
    defaults={"reaction_type": "Rash", "severity": 2},
)

# Chronic conditions
ChronicCondition.objects.get_or_create(
    profile=patient,
    icd_10_code="E11",
    defaults={"disease_name": "Type 2 Diabetes Mellitus", "is_active": True},
)
ChronicCondition.objects.get_or_create(
    profile=patient,
    icd_10_code="I10",
    defaults={"disease_name": "Essential Hypertension", "is_active": True},
)

# Vitals
HealthMetric.objects.get_or_create(
    patient=doctor,
    metric_type="weight",
    recorded_at=timezone.now(),
    defaults={"value": 78.5, "unit": "kg"},
)
HealthMetric.objects.get_or_create(
    patient=doctor,
    metric_type="blood_pressure",
    recorded_at=timezone.now(),
    defaults={"value": 145, "secondary_value": 92, "unit": "mmHg"},
)

# Medicines
med_amoxi, _ = Medicine.objects.get_or_create(
    name="Amoxicillin 500mg",
    defaults={
        "generic_name": "Amoxicillin",
        "drug_class": "Penicillin Antibiotics",
        "therapeutic_category": "Antibiotic",
        "standard_dosages": {"adult": "500mg TDS", "child": "250mg TDS"},
        "allergens": ["Penicillin"],
        "is_active": True,
    },
)

med_metformin, _ = Medicine.objects.get_or_create(
    name="Metformin 500mg",
    defaults={
        "generic_name": "Metformin",
        "drug_class": "Biguanides",
        "therapeutic_category": "Antidiabetic",
        "standard_dosages": {"adult": "500mg BD", "max": "2000mg/day"},
        "allergens": [],
        "is_active": True,
    },
)

med_atenolol, _ = Medicine.objects.get_or_create(
    name="Atenolol 50mg",
    defaults={
        "generic_name": "Atenolol",
        "drug_class": "Beta-blockers",
        "therapeutic_category": "Antihypertensive",
        "standard_dosages": {"adult": "50mg OD", "max": "100mg/day"},
        "allergens": [],
        "is_active": True,
    },
)

med_ibuprofen, _ = Medicine.objects.get_or_create(
    name="Ibuprofen 400mg",
    defaults={
        "generic_name": "Ibuprofen",
        "drug_class": "NSAIDs",
        "therapeutic_category": "Anti-inflammatory",
        "standard_dosages": {"adult": "400mg TDS", "max": "1200mg/day"},
        "allergens": [],
        "is_active": True,
    },
)

# Drug interaction: Metformin + Ibuprofen (moderate)
DrugInteraction.objects.get_or_create(
    medicine_a=med_metformin,
    medicine_b=med_ibuprofen,
    defaults={
        "severity": "moderate",
        "description": "NSAIDs can reduce renal blood flow and impair metformin clearance, increasing risk of lactic acidosis.",
    },
)

# Pharmacy in Lucknow with stock
pharmacy, _ = Pharmacy.objects.get_or_create(
    license_number="PH-LKO-001",
    defaults={
        "name": "City Pharmacy Lucknow",
        "address": "Hazratganj, Lucknow",
        "district": "Lucknow",
        "phone": "9876543210",
        "email": "pharmacy@test.com",
        "owner": doctor,
    },
)
if not pharmacy.district:
    pharmacy.district = "Lucknow"
    pharmacy.save()

# Stock: Metformin in stock, Atenolol low, Amoxicillin none, Ibuprofen in stock
for med, qty in [
    (med_metformin, 500),
    (med_atenolol, 5),
    (med_ibuprofen, 200),
]:
    PharmacyInventory.objects.update_or_create(
        pharmacy=pharmacy,
        medicine=med,
        defaults={"quantity_in_stock": qty, "low_stock_threshold": 10},
    )

# Existing active prescription (Metformin already being taken)
existing_rx, _ = Prescription.objects.get_or_create(
    patient=patient,
    doctor=doctor,
    status="pending",
    defaults={"qr_code_path": "", "security_hash": "test"},
)
PrescriptionMedicine.objects.get_or_create(
    prescription=existing_rx,
    medicine=med_metformin,
    defaults={"dosage": "500mg", "frequency": "twice daily", "duration_days": 90, "quantity": 180},
)

print("  Test data created successfully!")


# ─── 2. Test agent_context.py ─────────────────────────────────────

print("\n\n>>> TEST: agent_context.gather_agent_context()")

from prescriptions.agent_context import gather_agent_context

medicines_input = [
    {"medicine_id": str(med_amoxi.id), "dosage": "500mg", "frequency": "3 times daily", "duration_days": 7},
    {"medicine_id": str(med_metformin.id), "dosage": "1000mg", "frequency": "twice daily", "duration_days": 30},
    {"medicine_id": str(med_atenolol.id), "dosage": "50mg", "frequency": "once daily", "duration_days": 30},
    {"medicine_id": str(med_ibuprofen.id), "dosage": "400mg", "frequency": "3 times daily", "duration_days": 5},
]

context = gather_agent_context(str(patient.id), medicines_input, pharmacy_id=str(pharmacy.id))

cprint("Patient Info", context["patient"])
cprint("Allergies", context["allergies"])
cprint("Chronic Conditions", context["chronic_conditions"])
cprint("Latest Vitals", context["latest_vitals"])
cprint("Prescribed Medicines", context["prescribed_medicines"])
cprint("Existing Prescriptions", context["existing_prescriptions"])
cprint("Pharmacy Stock", context["pharmacy_stock"])


# ─── 3. Test agent_service.py (offline/fallback) ──────────────────

print("\n\n>>> TEST: agent_service.run_safety_agent() — fallback mode")

from prescriptions.agent_service import run_safety_agent

report = run_safety_agent(context)
cprint("Agent Report (fallback — no real API key)", report)


# ─── 4. Test API endpoint via APIClient ───────────────────────────

print("\n\n>>> TEST: POST /api/prescriptions/validate/ via DRF test client")

client = APIClient()
token = RefreshToken.for_user(doctor)
client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

payload = {
    "patient_id": str(patient.id),
    "pharmacy_id": str(pharmacy.id),
    "medicines": [
        {"medicine_id": str(med_amoxi.id), "dosage": "500mg", "frequency": "3 times daily", "duration_days": 7},
        {"medicine_id": str(med_metformin.id), "dosage": "1000mg", "frequency": "twice daily", "duration_days": 30},
        {"medicine_id": str(med_atenolol.id), "dosage": "50mg", "frequency": "once daily", "duration_days": 30},
        {"medicine_id": str(med_ibuprofen.id), "dosage": "400mg", "frequency": "3 times daily", "duration_days": 5},
    ],
}

response = client.post("/api/prescriptions/validate/", payload, format="json")
cprint(f"Response Status: {response.status_code}", response.json())


# ─── 5. Test pharmacy stock update endpoint ───────────────────────

print("\n\n>>> TEST: POST /api/pharmacy/update-stock/")

inv_item = PharmacyInventory.objects.filter(pharmacy=pharmacy, medicine=med_atenolol).first()
if inv_item:
    stock_payload = {
        "inventory_id": str(inv_item.id),
        "quantity_received": 100,
    }
    response2 = client.post("/api/pharmacy/update-stock/", stock_payload, format="json")
    cprint(f"Stock Update Status: {response2.status_code}", response2.json())
    inv_item.refresh_from_db()
    print(f"\n  Atenolol stock after update: {inv_item.quantity_in_stock} (was 5, added 100)")


# ─── 6. Verify audit log was created ─────────────────────────────

print("\n\n>>> TEST: Audit log entries")

from accounts.audit import AuditLog

logs = AuditLog.objects.filter(event_type="prescription_validated").order_by("-created_at")[:3]
for log in logs:
    cprint(f"Audit: {log.event_type} at {log.created_at}", log.details)


# ─── 7. Test validation with missing data (error case) ───────────

print("\n\n>>> TEST: POST /api/prescriptions/validate/ — validation errors")

bad_payload = {"patient_id": str(uuid4()), "medicines": []}
response3 = client.post("/api/prescriptions/validate/", bad_payload, format="json")
cprint(f"Bad Request Status: {response3.status_code}", response3.json())


# ─── 8. Test without auth ────────────────────────────────────────

print("\n\n>>> TEST: POST /api/prescriptions/validate/ — no auth")

noauth_client = APIClient()
response4 = noauth_client.post("/api/prescriptions/validate/", payload, format="json")
cprint(f"No Auth Status: {response4.status_code}", response4.json())


# ─── Cleanup notice ──────────────────────────────────────────────

print(f"\n\n{SEPARATOR}")
print("  ALL TESTS COMPLETED")
print(SEPARATOR)
print("  Test data remains in DB for manual frontend testing.")
print(f"  Doctor email: test_agent_doctor@hospital.com")
print(f"  Patient ID: {patient.id}")
print(f"  Patient Name: {patient.name}")
print(f"  Medicines: Amoxicillin, Metformin, Atenolol, Ibuprofen")
print(SEPARATOR)
