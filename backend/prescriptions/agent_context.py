"""
prescriptions/agent_context.py
───────────────────────────────────────────────────────
Assembles the full context object needed by the AI prescription safety agent.
Gathers patient info, allergies, conditions, labs, vitals, prescribed medicines,
existing prescriptions, and pharmacy stock levels.
"""
import logging
from datetime import date

from medical.models import Allergy, ChronicCondition, HealthMetric, LabTestResult
from patients.models import Profile
from pharmacy.models import PharmacyInventory
from prescriptions.models import Medicine, Prescription, PrescriptionMedicine

logger = logging.getLogger(__name__)


def gather_agent_context(patient_id: str, medicines_input: list[dict], pharmacy_id: str | None = None) -> dict:
    """
    Build the complete context dict the agent needs.

    Args:
        patient_id: UUID of the patient Profile.
        medicines_input: list of dicts, each with:
            - medicine_id (str/UUID)
            - dosage (str)
            - frequency (str)
            - duration_days (int, optional)
        pharmacy_id: optional UUID of the target Pharmacy.

    Returns:
        A single dict with keys: patient, allergies, chronic_conditions,
        latest_vitals, lab_results, prescribed_medicines, existing_prescriptions,
        pharmacy_stock.
    """
    profile = Profile.objects.get(id=patient_id)

    return {
        "patient": _patient_info(profile),
        "allergies": _allergies(profile),
        "chronic_conditions": _chronic_conditions(profile),
        "latest_vitals": _latest_vitals(profile),
        "lab_results": _lab_results(profile),
        "prescribed_medicines": _prescribed_medicines(medicines_input),
        "existing_prescriptions": _existing_prescriptions(profile),
        "pharmacy_stock": _pharmacy_stock(pharmacy_id, medicines_input),
    }


# ── helpers ──────────────────────────────────────────────────────────


def _patient_info(profile: Profile) -> dict:
    age = profile.calculate_age() if profile.date_of_birth else profile.age
    return {
        "name": profile.name,
        "age": age,
        "gender": profile.gender,
        "blood_group": profile.blood_group,
        "region": profile.region,
        "district": profile.district,
    }


def _allergies(profile: Profile) -> list[dict]:
    qs = Allergy.objects.filter(profile=profile)
    results = []
    for a in qs:
        results.append({
            "allergen": a.allergen,
            "reaction_type": a.reaction_type,
            "severity": a.severity,
        })
    return results


def _chronic_conditions(profile: Profile) -> list[dict]:
    qs = ChronicCondition.objects.filter(profile=profile, is_active=True)
    return [
        {
            "icd_10_code": c.icd_10_code,
            "disease_name": c.disease_name,
        }
        for c in qs
    ]


def _latest_vitals(profile: Profile) -> dict:
    """Most recent weight metric for the patient."""
    user = profile.user
    vitals = {}
    weight = HealthMetric.objects.filter(patient=user, metric_type="weight").first()
    if weight:
        vitals["weight_kg"] = weight.value
    bp = HealthMetric.objects.filter(patient=user, metric_type="blood_pressure").first()
    if bp:
        vitals["blood_pressure"] = {
            "systolic": bp.value,
            "diastolic": bp.secondary_value,
            "unit": bp.unit,
        }
    sugar = HealthMetric.objects.filter(patient=user, metric_type="sugar").first()
    if sugar:
        vitals["blood_sugar"] = {"value": sugar.value, "unit": sugar.unit}
    return vitals


def _lab_results(profile: Profile) -> dict:
    """
    Most recent creatinine (kidney) and ALT (liver) if available.
    Returns a dict with test_name -> {value, unit, normal_min, normal_max, status}.
    """
    user = profile.user
    results = {}
    for test_name in ["creatinine", "alt", "sgpt", "alanine aminotransferase"]:
        lab = LabTestResult.objects.filter(
            patient=user, test_name__icontains=test_name
        ).first()
        if lab:
            key = "creatinine" if "creat" in test_name.lower() else "alt"
            results[key] = {
                "value": lab.value,
                "unit": lab.unit,
                "normal_min": lab.normal_min,
                "normal_max": lab.normal_max,
                "status": lab.status,
                "tested_at": lab.tested_at.isoformat(),
            }
    return results


def _prescribed_medicines(medicines_input: list[dict]) -> list[dict]:
    """Enrich the doctor's prescription input with drug-database info."""
    result = []
    for item in medicines_input:
        try:
            med = Medicine.objects.get(id=item["medicine_id"], is_active=True)
        except Medicine.DoesNotExist:
            continue
        result.append({
            "medicine_id": str(med.id),
            "medicine_name": med.name,
            "generic_name": med.generic_name,
            "drug_class": med.drug_class,
            "therapeutic_category": med.therapeutic_category,
            "standard_dosages": med.standard_dosages,
            "allergens": med.allergens,
            "prescribed_dosage": item.get("dosage", ""),
            "prescribed_frequency": item.get("frequency", ""),
            "prescribed_duration_days": item.get("duration_days"),
        })
    return result


def _existing_prescriptions(profile: Profile) -> list[dict]:
    """
    All active (pending / partially dispensed) prescriptions for interactions.
    """
    active_statuses = [Prescription.Status.PENDING, Prescription.Status.PARTIALLY_DISPENSED]
    prescriptions = (
        Prescription.objects.filter(patient=profile, status__in=active_statuses)
        .prefetch_related("medicines__medicine")
        .order_by("-created_at")[:20]
    )
    result = []
    for rx in prescriptions:
        meds = []
        for pm in rx.medicines.all():
            meds.append({
                "medicine_name": pm.medicine.name,
                "generic_name": pm.medicine.generic_name,
                "drug_class": pm.medicine.drug_class,
                "dosage": pm.dosage,
                "frequency": pm.frequency,
            })
        result.append({
            "prescription_id": str(rx.id),
            "created_at": rx.created_at.isoformat(),
            "medicines": meds,
        })
    return result


def _pharmacy_stock(pharmacy_id: str | None, medicines_input: list[dict]) -> list[dict]:
    """
    Get stock levels for the selected pharmacy.
    """
    medicine_ids = [item["medicine_id"] for item in medicines_input]

    if not pharmacy_id:
        # No pharmacy selected — return unknown stock for all medicines
        result = []
        for mid in medicine_ids:
            try:
                med = Medicine.objects.get(id=mid)
                name = med.name
            except Medicine.DoesNotExist:
                name = str(mid)
            result.append({
                "medicine_id": str(mid),
                "medicine_name": name,
                "stock_at_pharmacy": None,
                "pharmacy_selected": False,
            })
        return result

    from pharmacy.models import Pharmacy
    try:
        pharmacy = Pharmacy.objects.get(id=pharmacy_id, is_active=True)
        pharmacy_name = pharmacy.name
    except Pharmacy.DoesNotExist:
        pharmacy_name = "Unknown"

    stock_qs = PharmacyInventory.objects.filter(
        pharmacy_id=pharmacy_id,
        medicine_id__in=medicine_ids,
    ).select_related("medicine")

    stock_map = {str(s.medicine_id): s for s in stock_qs}
    result = []
    for mid in medicine_ids:
        inv = stock_map.get(str(mid))
        if inv:
            result.append({
                "medicine_id": str(mid),
                "medicine_name": inv.medicine.name,
                "stock_at_pharmacy": inv.quantity_in_stock,
                "pharmacy_name": pharmacy_name,
                "pharmacy_selected": True,
            })
        else:
            try:
                med = Medicine.objects.get(id=mid)
                name = med.name
            except Medicine.DoesNotExist:
                name = str(mid)
            result.append({
                "medicine_id": str(mid),
                "medicine_name": name,
                "stock_at_pharmacy": 0,
                "pharmacy_name": pharmacy_name,
                "pharmacy_selected": True,
            })
    return result
