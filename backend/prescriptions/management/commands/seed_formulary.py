"""
Seed a working formulary: common outpatient medicines by strength, plus
well-established drug–drug interactions keyed by generic name.

Idempotent — medicines are matched by name and interactions by the pair of
medicines, so it is safe to re-run. Interactions are applied to every
medicine sharing the generic name (e.g. both "Amlodipine 5 mg" and
"Amlodipine 10 mg"), including medicines added by other seed commands.
"""
from itertools import product

from django.core.management.base import BaseCommand
from django.db.models import Q

from prescriptions.models import DrugInteraction, Medicine

# name, generic, class, category, standard dosages, allergen tags
FORMULARY = [
    ("Paracetamol 500 mg", "Paracetamol", "Analgesic / Antipyretic", "Pain & fever", {"adult": "500–1000 mg every 6 h", "max": "4000mg/day", "child": "15 mg/kg every 6 h"}, ["Paracetamol"]),
    ("Paracetamol 650 mg", "Paracetamol", "Analgesic / Antipyretic", "Pain & fever", {"adult": "650 mg every 6–8 h", "max": "4000mg/day"}, ["Paracetamol"]),
    ("Ibuprofen 400mg", "Ibuprofen", "NSAIDs", "Pain & inflammation", {"adult": "400mg TDS", "max": "1200mg/day"}, ["NSAID"]),
    ("Diclofenac 50 mg", "Diclofenac", "NSAIDs", "Pain & inflammation", {"adult": "50 mg 2–3 times daily", "max": "150mg/day"}, ["NSAID"]),
    ("Aspirin 75 mg", "Aspirin", "Antiplatelet (salicylate)", "Cardiovascular", {"adult": "75–150 mg once daily"}, ["Aspirin", "NSAID", "Salicylate"]),
    ("Amoxicillin 500mg", "Amoxicillin", "Penicillin Antibiotics", "Infection", {"adult": "500mg TDS", "child": "250mg TDS"}, ["Penicillin"]),
    ("Amoxicillin + Clavulanate 625 mg", "Amoxicillin/Clavulanate", "Penicillin Antibiotics", "Infection", {"adult": "625 mg twice or thrice daily"}, ["Penicillin"]),
    ("Azithromycin 500 mg", "Azithromycin", "Macrolide Antibiotics", "Infection", {"adult": "500 mg once daily for 3 days"}, ["Macrolide"]),
    ("Clarithromycin 500 mg", "Clarithromycin", "Macrolide Antibiotics", "Infection", {"adult": "500 mg twice daily"}, ["Macrolide"]),
    ("Cefixime 200 mg", "Cefixime", "Cephalosporin Antibiotics", "Infection", {"adult": "200 mg twice daily"}, ["Cephalosporin"]),
    ("Ciprofloxacin 500 mg", "Ciprofloxacin", "Fluoroquinolone Antibiotics", "Infection", {"adult": "500 mg twice daily", "max": "1500mg/day"}, ["Fluoroquinolone"]),
    ("Doxycycline 100 mg", "Doxycycline", "Tetracycline Antibiotics", "Infection", {"adult": "100 mg twice daily"}, ["Tetracycline"]),
    ("Metronidazole 400 mg", "Metronidazole", "Nitroimidazole", "Infection", {"adult": "400 mg three times daily"}, ["Metronidazole"]),
    ("Metformin 500mg", "Metformin", "Biguanide", "Diabetes", {"adult": "500mg BD with meals", "max": "2000mg/day"}, []),
    ("Glimepiride 2 mg", "Glimepiride", "Sulfonylurea", "Diabetes", {"adult": "1–4 mg once daily", "max": "8mg/day"}, ["Sulfonylurea"]),
    ("Telmisartan 40 mg", "Telmisartan", "Angiotensin Receptor Blocker", "Hypertension", {"adult": "40–80 mg once daily"}, []),
    ("Losartan 50 mg", "Losartan", "Angiotensin Receptor Blocker", "Hypertension", {"adult": "50–100 mg once daily"}, []),
    ("Enalapril 5 mg", "Enalapril", "ACE Inhibitor", "Hypertension", {"adult": "5–20 mg once or twice daily", "max": "40mg/day"}, ["ACE inhibitor"]),
    ("Ramipril 5 mg", "Ramipril", "ACE Inhibitor", "Hypertension", {"adult": "2.5–10 mg once daily"}, ["ACE inhibitor"]),
    ("Hydrochlorothiazide 12.5 mg", "Hydrochlorothiazide", "Thiazide Diuretic", "Hypertension", {"adult": "12.5–25 mg once daily"}, []),
    ("Furosemide 40 mg", "Furosemide", "Loop Diuretic", "Oedema", {"adult": "20–80 mg once daily"}, []),
    ("Spironolactone 25 mg", "Spironolactone", "Potassium-sparing Diuretic", "Heart failure", {"adult": "25–50 mg once daily"}, []),
    ("Metoprolol 50 mg", "Metoprolol", "Beta-blockers", "Cardiovascular", {"adult": "50–100 mg twice daily"}, []),
    ("Rosuvastatin 10 mg", "Rosuvastatin", "Statin", "Cholesterol", {"adult": "5–20 mg once daily", "max": "40mg/day"}, []),
    ("Simvastatin 20 mg", "Simvastatin", "Statin", "Cholesterol", {"adult": "20–40 mg at night"}, []),
    ("Clopidogrel 75 mg", "Clopidogrel", "Antiplatelet", "Cardiovascular", {"adult": "75 mg once daily"}, []),
    ("Warfarin 5 mg", "Warfarin", "Anticoagulant", "Cardiovascular", {"adult": "2–10 mg daily, adjusted to INR"}, []),
    ("Isosorbide Mononitrate 20 mg", "Isosorbide Mononitrate", "Nitrate", "Angina", {"adult": "20 mg twice daily"}, []),
    ("Sildenafil 50 mg", "Sildenafil", "PDE5 Inhibitor", "Urology", {"adult": "50 mg as needed, max once daily"}, []),
    ("Pantoprazole 40 mg", "Pantoprazole", "Proton Pump Inhibitor", "Gastro-intestinal", {"adult": "40 mg once daily before breakfast"}, []),
    ("Omeprazole 20 mg", "Omeprazole", "Proton Pump Inhibitor", "Gastro-intestinal", {"adult": "20–40 mg once daily"}, []),
    ("Ondansetron 4 mg", "Ondansetron", "5-HT3 Antagonist", "Nausea", {"adult": "4–8 mg every 8 h"}, []),
    ("Cetirizine 10 mg", "Cetirizine", "Antihistamine", "Allergy", {"adult": "10 mg once daily", "child": "5 mg once daily"}, []),
    ("Montelukast 10 mg", "Montelukast", "Leukotriene Antagonist", "Asthma", {"adult": "10 mg once daily at night"}, []),
    ("Salbutamol Inhaler 100 mcg", "Salbutamol", "Short-acting Beta Agonist", "Asthma", {"adult": "100–200 mcg as needed"}, []),
    ("Levothyroxine 50 mcg", "Levothyroxine", "Thyroid Hormone", "Thyroid", {"adult": "25–200 mcg once daily on an empty stomach"}, []),
    ("Sertraline 50 mg", "Sertraline", "SSRI", "Mental health", {"adult": "50–200 mg once daily"}, ["SSRI"]),
    ("Tramadol 50 mg", "Tramadol", "Opioid Analgesic", "Pain", {"adult": "50–100 mg every 4–6 h", "max": "400mg/day"}, ["Opioid"]),
    ("Prednisolone 10 mg", "Prednisolone", "Corticosteroid", "Inflammation", {"adult": "5–60 mg daily"}, []),
    ("Artemether + Lumefantrine 80/480 mg", "Artemether/Lumefantrine", "Antimalarial", "Malaria", {"adult": "1 tablet twice daily for 3 days"}, []),
    ("Oral Rehydration Salts", "Oral Rehydration Salts", "Electrolyte Replacement", "Dehydration", {"adult": "1 sachet in 1 L water, sip after each loose stool"}, []),
    ("Ferrous Sulphate + Folic Acid", "Ferrous Sulphate/Folic Acid", "Haematinic", "Anaemia", {"adult": "1 tablet once daily"}, []),
    ("Vitamin D3 60000 IU", "Cholecalciferol", "Vitamin", "Supplement", {"adult": "60000 IU once weekly"}, []),
]

# (generic A, generic B, severity, description) — established interactions only.
INTERACTIONS = [
    ("Warfarin", "Aspirin", "major", "Additive bleeding risk. Avoid unless specifically indicated; monitor INR and bleeding."),
    ("Warfarin", "Ibuprofen", "major", "NSAIDs raise bleeding and GI haemorrhage risk with warfarin. Prefer paracetamol."),
    ("Warfarin", "Diclofenac", "major", "NSAIDs raise bleeding and GI haemorrhage risk with warfarin. Prefer paracetamol."),
    ("Warfarin", "Clarithromycin", "major", "Clarithromycin inhibits warfarin metabolism and can sharply raise INR."),
    ("Warfarin", "Metronidazole", "major", "Metronidazole potentiates warfarin; INR can rise markedly. Reduce dose and monitor."),
    ("Warfarin", "Ciprofloxacin", "moderate", "May increase INR. Monitor INR during and after the course."),
    ("Simvastatin", "Clarithromycin", "contraindicated", "Strong CYP3A4 inhibition raises simvastatin levels with a high risk of myopathy and rhabdomyolysis."),
    ("Sildenafil", "Isosorbide Mononitrate", "contraindicated", "Combined vasodilation can cause severe, life-threatening hypotension."),
    ("Enalapril", "Spironolactone", "major", "Risk of hyperkalaemia. Monitor serum potassium and renal function."),
    ("Ramipril", "Spironolactone", "major", "Risk of hyperkalaemia. Monitor serum potassium and renal function."),
    ("Telmisartan", "Spironolactone", "major", "Risk of hyperkalaemia. Monitor serum potassium and renal function."),
    ("Losartan", "Spironolactone", "major", "Risk of hyperkalaemia. Monitor serum potassium and renal function."),
    ("Enalapril", "Telmisartan", "major", "Dual RAAS blockade increases hyperkalaemia, hypotension and renal impairment risk."),
    ("Ramipril", "Losartan", "major", "Dual RAAS blockade increases hyperkalaemia, hypotension and renal impairment risk."),
    ("Sertraline", "Tramadol", "major", "Risk of serotonin syndrome and lowered seizure threshold."),
    ("Clopidogrel", "Omeprazole", "moderate", "Omeprazole reduces clopidogrel activation (CYP2C19). Prefer pantoprazole."),
    ("Clopidogrel", "Aspirin", "moderate", "Increased bleeding risk; appropriate only when dual antiplatelet therapy is intended."),
    ("Aspirin", "Ibuprofen", "moderate", "Ibuprofen can blunt aspirin's antiplatelet effect and adds GI bleeding risk."),
    ("Aspirin", "Diclofenac", "moderate", "Additive GI bleeding risk."),
    ("Enalapril", "Ibuprofen", "moderate", "NSAIDs reduce the antihypertensive effect and can impair renal function."),
    ("Ramipril", "Diclofenac", "moderate", "NSAIDs reduce the antihypertensive effect and can impair renal function."),
    ("Metformin", "Ibuprofen", "moderate", "NSAIDs can reduce renal blood flow and impair metformin clearance, increasing risk of lactic acidosis."),
    ("Ciprofloxacin", "Prednisolone", "moderate", "Corticosteroids increase the risk of fluoroquinolone-associated tendon rupture."),
    ("Azithromycin", "Ondansetron", "moderate", "Both prolong the QT interval. Consider an ECG in at-risk patients."),
    ("Furosemide", "Prednisolone", "moderate", "Additive potassium loss. Monitor electrolytes."),
    ("Glimepiride", "Clarithromycin", "moderate", "Clarithromycin can raise sulfonylurea levels and cause hypoglycaemia."),
    ("Levothyroxine", "Omeprazole", "minor", "Reduced gastric acid can lower levothyroxine absorption. Monitor TSH."),
    ("Levothyroxine", "Pantoprazole", "minor", "Reduced gastric acid can lower levothyroxine absorption. Monitor TSH."),
]


class Command(BaseCommand):
    help = "Seed the medicine formulary and established drug interactions (idempotent)"

    def handle(self, *args, **options):
        created = 0
        for name, generic, drug_class, category, dosages, allergens in FORMULARY:
            _, was_created = Medicine.objects.get_or_create(
                name=name,
                defaults={
                    "generic_name": generic,
                    "drug_class": drug_class,
                    "therapeutic_category": category,
                    "standard_dosages": dosages,
                    "allergens": allergens,
                    "is_active": True,
                },
            )
            created += int(was_created)

        linked = 0
        for generic_a, generic_b, severity, description in INTERACTIONS:
            meds_a = Medicine.objects.filter(Q(generic_name__iexact=generic_a) | Q(name__istartswith=generic_a))
            meds_b = Medicine.objects.filter(Q(generic_name__iexact=generic_b) | Q(name__istartswith=generic_b))
            for a, b in product(meds_a, meds_b):
                if a.id == b.id:
                    continue
                exists = DrugInteraction.objects.filter(
                    Q(medicine_a=a, medicine_b=b) | Q(medicine_a=b, medicine_b=a)
                ).exists()
                if not exists:
                    DrugInteraction.objects.create(medicine_a=a, medicine_b=b, severity=severity, description=description)
                    linked += 1

        self.stdout.write(self.style.SUCCESS(
            f"Formulary: {created} medicines added ({Medicine.objects.count()} total); "
            f"{linked} interactions added ({DrugInteraction.objects.count()} total)."
        ))
