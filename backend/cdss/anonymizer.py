"""
cdss/anonymizer.py
─────────────────────────────────────────────────────
Strips all PII from patient data before it is sent to OpenAI.
Only clinical values survive — never names, IDs, phone, address, DOB.
"""

from django.utils import timezone


def _age_bracket(age: int) -> str:
    """Convert exact age to a 10-year bracket."""
    if age <= 10:
        return "0-10 years"
    if age <= 20:
        return "11-20 years"
    if age <= 30:
        return "21-30 years"
    if age <= 40:
        return "31-40 years"
    if age <= 50:
        return "41-50 years"
    if age <= 60:
        return "51-60 years"
    if age <= 70:
        return "61-70 years"
    if age <= 80:
        return "71-80 years"
    return "80+ years"


def _relative_time(dt) -> str:
    """Convert a datetime to a human-readable relative string."""
    if dt is None:
        return "unknown"
    now = timezone.now()
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    delta = now - dt
    seconds = int(delta.total_seconds())
    if seconds < 0:
        return "just now"
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    days = hours // 24
    if days < 7:
        return f"{days} day{'s' if days != 1 else ''} ago"
    weeks = days // 7
    if weeks < 5:
        return f"{weeks} week{'s' if weeks != 1 else ''} ago"
    months = days // 30
    if months < 12:
        return f"{months} month{'s' if months != 1 else ''} ago"
    years = days // 365
    return f"{years} year{'s' if years != 1 else ''} ago"


def _severity_label(severity: int) -> str:
    """Convert numeric severity (1-5+) to a descriptive label."""
    if severity <= 2:
        return "Mild"
    if severity <= 4:
        return "Moderate"
    return "Severe"


def anonymize_patient_data(
    patient,
    records,
    allergies,
    chronic,
    active_meds,
    db_interactions,
    vitals,
    labs,
    current_symptoms: str = "",
):
    """
    Takes raw database objects and returns a dict with ZERO PII.

    Safe fields passed as-is: gender, blood_group, ICD-10 codes, disease names,
    medicine names, dosage, frequency, lab values, vital values, allergen names.

    Removed entirely: name, patient_id, phone, address, district, state, pincode,
    date_of_birth, aadhar, doctor name/id, all foreign-key UUIDs.

    Transformed: age → bracket, dates → relative time, severity → label.
    """

    # ── Patient profile (only clinical demographics) ──
    patient_profile = {
        "age_bracket": _age_bracket(patient.age) if patient.age else "unknown",
        "gender": patient.gender or "unknown",
        "blood_group": patient.blood_group or "unknown",
    }

    # ── Chronic conditions (disease name + ICD-10 only) ──
    chronic_list = []
    for c in chronic:
        chronic_list.append({
            "disease_name": c.disease_name,
            "icd_10_code": c.icd_10_code,
        })

    # ── Allergies (allergen, reaction, severity label) ──
    allergy_list = []
    for a in allergies:
        allergy_list.append({
            "allergen": a.allergen,
            "reaction_type": a.reaction_type,
            "severity": _severity_label(a.severity),
        })

    # ── Past diagnoses from medical records ──
    past_diagnoses = []
    for record in records:
        for dx in record.diagnoses.all():
            past_diagnoses.append({
                "icd_10_code": dx.icd_10_code,
                "disease_name": dx.disease_name,
                "severity": _severity_label(dx.severity),
                "when": _relative_time(dx.created_at),
            })

    # ── Current medications (medicine info only, no IDs) ──
    medication_list = []
    for pm in active_meds:
        medication_list.append({
            "medicine_name": pm.medicine.name,
            "generic_name": pm.medicine.generic_name,
            "dosage": pm.dosage,
            "frequency": pm.frequency,
        })

    # ── Drug interactions (drug pair + severity + description, no IDs) ──
    interaction_list = []
    for di in db_interactions:
        interaction_list.append({
            "drug_a": di.medicine_a.name,
            "drug_b": di.medicine_b.name,
            "severity": di.severity,
            "description": di.description,
        })

    # ── Recent vitals (metric name, value, unit, relative date) ──
    vitals_list = []
    for v in vitals:
        entry = {
            "metric": v.get_metric_type_display(),
            "value": v.value,
            "unit": v.unit,
            "when": _relative_time(v.recorded_at),
        }
        if v.secondary_value is not None:
            entry["secondary_value"] = v.secondary_value
        vitals_list.append(entry)

    # ── Recent labs (test name, value, unit, abnormal flag, relative date) ──
    labs_list = []
    for lab in labs:
        labs_list.append({
            "test_name": lab.test_name,
            "value": lab.value,
            "unit": lab.unit,
            "is_abnormal": lab.status != "normal",
            "when": _relative_time(lab.tested_at),
        })

    return {
        "patient_profile": patient_profile,
        "chronic_conditions": chronic_list,
        "allergies": allergy_list,
        "past_diagnoses": past_diagnoses,
        "current_medications": medication_list,
        "drug_interactions": interaction_list,
        "recent_vitals": vitals_list,
        "recent_labs": labs_list,
        "current_symptoms": current_symptoms,
    }
