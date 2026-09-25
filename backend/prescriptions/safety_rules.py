"""
Deterministic prescription safety checks.

Used whenever the AI safety agent is not configured or fails, and on the
server before a prescription is saved. It works only from data in the
database — the patient's recorded allergies, the medicine catalogue's
allergen tags and standard doses, the DrugInteraction table, the patient's
other active prescriptions and the selected pharmacy's stock — so every
finding it reports can be traced to a stored fact.

The report shape matches the AI agent's schema (see agent_service.py), with
`engine: "rules"` so the UI can say which checker produced it.
"""
import re
from itertools import combinations

from django.db.models import Q

from medical.models import Allergy
from patients.models import Profile
from pharmacy.models import PharmacyInventory

from .models import DrugInteraction, Medicine, Prescription, PrescriptionMedicine

# Allergy groups: a recorded allergy to any term in a group matches medicines
# carrying any tag/class in the group. Cross-reactive groups only warn.
ALLERGY_GROUPS = {
    "penicillin": {"penicillin", "amoxicillin", "ampicillin", "beta-lactam", "penicillin antibiotics"},
    "nsaid": {"nsaid", "nsaids", "ibuprofen", "diclofenac", "aspirin", "salicylate", "naproxen"},
    "sulfonamide": {"sulfa", "sulfa drugs", "sulfonamide", "sulfonamides", "sulphonamide"},
    "macrolide": {"macrolide", "azithromycin", "clarithromycin", "erythromycin"},
    "cephalosporin": {"cephalosporin", "cefixime", "ceftriaxone", "cefuroxime"},
    "fluoroquinolone": {"fluoroquinolone", "ciprofloxacin", "levofloxacin"},
    "tetracycline": {"tetracycline", "doxycycline"},
    "ace inhibitor": {"ace inhibitor", "enalapril", "ramipril", "lisinopril"},
    "opioid": {"opioid", "tramadol", "codeine", "morphine"},
    # Non-antibiotic sulfonamides (diuretics): low cross-reactivity with sulfa antibiotics.
    "sulfonamide diuretic": {"thiazide", "hydrochlorothiazide", "furosemide", "loop diuretic"},
}
CROSS_REACTIVE = {
    # A penicillin allergy carries a small risk with cephalosporins.
    "penicillin": {"cephalosporin"},
    "sulfonamide": {"sulfonamide diuretic"},
}

SEVERITY_RANK = {"minor": 1, "moderate": 2, "major": 3, "contraindicated": 4}

FREQUENCY_PER_DAY = [
    (r"\b(qid|4x|four times)\b", 4),
    (r"\b(tds|tid|3x|thrice|three times)\b", 3),
    (r"\b(bd|bid|2x|twice)\b", 2),
    (r"every\s*6\s*h", 4),
    (r"every\s*8\s*h", 3),
    (r"every\s*12\s*h", 2),
    (r"\b(od|once|1x|daily|at night|bedtime)\b", 1),
]


def _norm(text):
    return (text or "").strip().lower()


def _groups_for(terms):
    found = set()
    for term in terms:
        t = _norm(term)
        for group, members in ALLERGY_GROUPS.items():
            if t == group or t in members or any(m in t for m in members if len(m) > 4):
                found.add(group)
    return found


def _medicine_terms(med):
    return [med.name, med.generic_name, med.drug_class, *(med.allergens or [])]


def _doses_per_day(frequency):
    f = _norm(frequency)
    for pattern, n in FREQUENCY_PER_DAY:
        if re.search(pattern, f):
            return n
    m = re.search(r"(\d+)\s*(?:x|times)", f)
    return int(m.group(1)) if m else None


def _amounts(text):
    """Numbers with units from strings like '500mg TDS', '5–20 mg', '100 mcg'."""
    out = []
    for value, unit in re.findall(r"(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|iu|ml)\b", _norm(text)):
        v = float(value)
        u = {"µg": "mcg"}.get(unit, unit)
        if u == "g":
            v, u = v * 1000, "mg"
        out.append((v, u))
    # ranges like "5–20 mg": the lower number carries the unit implicitly
    for low, high, unit in re.findall(r"(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*(mg|mcg|iu)\b", _norm(text)):
        out.append((float(low), unit))
    return out


def _dose_check(med, dosage, frequency, age):
    """Compare the prescribed dose with the catalogue's standard dosing."""
    std = med.standard_dosages or {}
    given = _amounts(dosage)
    if not given:
        return "unverified", "Dose could not be read automatically; review manually."
    per_dose, unit = given[0]

    daily_max = None
    if "max" in std:
        m = _amounts(std["max"])
        if m and m[0][1] == unit:
            daily_max = max(v for v, u in m if u == unit)
    per_day = _doses_per_day(frequency)
    if daily_max and per_day and per_dose * per_day > daily_max:
        return "too_high", f"{per_dose:g} {unit} × {per_day}/day = {per_dose * per_day:g} {unit}/day exceeds the {daily_max:g} {unit}/day maximum."

    key = "child" if age is not None and age < 12 and "child" in std else "adult"
    ref = [v for v, u in _amounts(std.get(key, "")) if u == unit]
    if not ref:
        return "unverified", "No comparable standard dose on record; review manually."
    lo, hi = min(ref), max(ref)
    if per_dose > hi * 1.001:
        return "too_high", f"{per_dose:g} {unit} per dose is above the usual {key} dose ({std.get(key)})."
    if per_dose < lo * 0.5:
        return "too_low", f"{per_dose:g} {unit} per dose is well below the usual {key} dose ({std.get(key)})."
    return "appropriate", f"Within the usual {key} dosing ({std.get(key)})."


def run_rule_checks(patient_id, medicines_input, pharmacy_id=None):
    profile = Profile.objects.get(id=patient_id)
    age = profile.calculate_age() if profile.date_of_birth else profile.age

    ids = [str(m["medicine_id"]) for m in medicines_input]
    meds = {str(m.id): m for m in Medicine.objects.filter(id__in=ids)}
    allergies = list(Allergy.objects.filter(profile=profile))

    # Other medicines the patient is currently on
    active = (
        PrescriptionMedicine.objects.filter(
            prescription__patient=profile,
            prescription__status__in=[Prescription.Status.PENDING, Prescription.Status.PARTIALLY_DISPENSED],
        )
        .exclude(dispense_status=PrescriptionMedicine.DispenseStatus.UNAVAILABLE)
        .select_related("medicine")
    )
    current = {str(pm.medicine_id): pm.medicine for pm in active}

    stock = {}
    if pharmacy_id:
        stock = {
            str(inv.medicine_id): inv.quantity_in_stock
            for inv in PharmacyInventory.objects.filter(pharmacy_id=pharmacy_id, medicine_id__in=ids)
        }

    blocked = False
    warnings = 0
    med_reports = []

    for item in medicines_input:
        med = meds.get(str(item["medicine_id"]))
        if med is None:
            continue
        rec = []

        # Allergies
        med_groups = _groups_for(_medicine_terms(med))
        conflict, detail = False, ""
        for a in allergies:
            a_groups = _groups_for([a.allergen])
            direct = a_groups & med_groups or _norm(a.allergen) in {_norm(t) for t in _medicine_terms(med)}
            cross = {g for ag in a_groups for g in CROSS_REACTIVE.get(ag, set())} & med_groups
            if direct:
                conflict, blocked = True, True
                detail = f"Patient is allergic to {a.allergen} ({a.reaction_type}); {med.name} is in the same class."
                rec.append("Do not prescribe; choose an agent from a different class.")
                break
            if cross:
                conflict = True
                warnings += 1
                detail = f"Patient is allergic to {a.allergen}; {med.name} ({med.drug_class.lower()}) has a small cross-reactivity risk."
                rec.append("Use only if benefit outweighs risk, and monitor for reactions.")

        # Duplicate therapy
        for cur in current.values():
            if cur.generic_name and _norm(cur.generic_name) == _norm(med.generic_name) and str(cur.id) != str(med.id):
                warnings += 1
                rec.append(f"Patient already has an active prescription for {cur.name}.")
            elif str(cur.id) == str(med.id):
                warnings += 1
                rec.append("This medicine is already on an active prescription.")

        # Dose
        dose_status, dose_detail = _dose_check(med, item.get("dosage", ""), item.get("frequency", ""), age)
        if dose_status in ("too_high", "too_low"):
            warnings += 1
            rec.append("Adjust the dose." if dose_status == "too_high" else "Confirm the dose is intended.")

        # Stock
        if pharmacy_id:
            qty = stock.get(str(med.id), 0)
            if qty <= 0:
                stock_status, stock_detail = "out_of_stock", "Not in stock at the selected pharmacy."
                warnings += 1
            elif qty < int(item.get("quantity") or 10):
                stock_status, stock_detail = "low_stock", f"Only {qty} units at the selected pharmacy."
                warnings += 1
            else:
                stock_status, stock_detail = "in_stock", f"{qty} units available."
        else:
            stock_status, stock_detail = "unknown", "No pharmacy selected."

        med_reports.append({
            "medicine_name": med.name,
            "allergy_conflict": conflict,
            "allergy_detail": detail,
            "dosage_status": dose_status,
            "dosage_detail": dose_detail,
            "stock_status": stock_status,
            "stock_detail": stock_detail,
            "recommendation": " ".join(dict.fromkeys(rec)) or "No issues found.",
        })

    # Interactions: new × new and new × currently prescribed
    pool = {**current, **meds}
    pairs = set()
    for a, b in combinations(meds.keys(), 2):
        pairs.add(frozenset((a, b)))
    for a in meds:
        for b in current:
            if a != b:
                pairs.add(frozenset((a, b)))
    interactions = []
    if pairs:
        all_ids = list(pool.keys())
        found = DrugInteraction.objects.filter(
            Q(medicine_a_id__in=all_ids) & Q(medicine_b_id__in=all_ids)
        ).select_related("medicine_a", "medicine_b")
        for ix in found:
            if frozenset((str(ix.medicine_a_id), str(ix.medicine_b_id))) not in pairs:
                continue
            interactions.append({
                "medicine_a": ix.medicine_a.name,
                "medicine_b": ix.medicine_b.name,
                "severity": ix.severity,
                "detail": ix.description,
            })
            if ix.severity == "contraindicated":
                blocked = True
            elif SEVERITY_RANK.get(ix.severity, 0) >= 2:
                warnings += 1
    interactions.sort(key=lambda i: -SEVERITY_RANK.get(i["severity"], 0))

    overall = "blocked" if blocked else "warning" if warnings else "safe"
    if overall == "safe":
        summary = "No allergy conflicts, interactions, dosing or stock problems found in the recorded data."
    else:
        parts = []
        n_allergy = sum(1 for m in med_reports if m["allergy_conflict"])
        if n_allergy:
            parts.append(f"{n_allergy} allergy concern{'s' if n_allergy > 1 else ''}")
        if interactions:
            parts.append(f"{len(interactions)} interaction{'s' if len(interactions) > 1 else ''}")
        n_dose = sum(1 for m in med_reports if m["dosage_status"] in ("too_high", "too_low"))
        if n_dose:
            parts.append(f"{n_dose} dosing issue{'s' if n_dose > 1 else ''}")
        n_stock = sum(1 for m in med_reports if m["stock_status"] in ("low_stock", "out_of_stock"))
        if n_stock:
            parts.append(f"{n_stock} stock issue{'s' if n_stock > 1 else ''}")
        summary = ("Blocked: " if blocked else "Review needed: ") + (", ".join(parts) or "see details") + "."

    return {
        "overall_status": overall,
        "medicines": med_reports,
        "drug_interactions": interactions,
        "alternatives": [],
        "summary": summary,
        "engine": "rules",
    }
