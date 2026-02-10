from django.core.management.base import BaseCommand

from prescriptions.models import DrugInteraction, Medicine


class Command(BaseCommand):
    help = "Seed medicine database with common medicines and drug interactions"

    def handle(self, *args, **options):
        self.stdout.write("Seeding medicine database...")

        # Common medicines
        medicines_data = [
            {
                "name": "Paracetamol",
                "generic_name": "Acetaminophen",
                "drug_class": "Analgesic",
                "therapeutic_category": "Pain Relief",
                "standard_dosages": {"adult": "500mg", "child": "250mg"},
                "allergens": ["acetaminophen"],
            },
            {
                "name": "Ibuprofen",
                "generic_name": "Ibuprofen",
                "drug_class": "NSAID",
                "therapeutic_category": "Pain Relief",
                "standard_dosages": {"adult": "400mg", "child": "200mg"},
                "allergens": ["ibuprofen", "nsaid"],
            },
            {
                "name": "Amoxicillin",
                "generic_name": "Amoxicillin",
                "drug_class": "Antibiotic",
                "therapeutic_category": "Infection",
                "standard_dosages": {"adult": "500mg", "child": "250mg"},
                "allergens": ["penicillin", "amoxicillin"],
            },
            {
                "name": "Azithromycin",
                "generic_name": "Azithromycin",
                "drug_class": "Antibiotic",
                "therapeutic_category": "Infection",
                "standard_dosages": {"adult": "500mg", "child": "250mg"},
                "allergens": ["azithromycin", "macrolide"],
            },
            {
                "name": "Metformin",
                "generic_name": "Metformin",
                "drug_class": "Antidiabetic",
                "therapeutic_category": "Diabetes",
                "standard_dosages": {"adult": "500mg"},
                "allergens": ["metformin"],
            },
            {
                "name": "Amlodipine",
                "generic_name": "Amlodipine",
                "drug_class": "Calcium Channel Blocker",
                "therapeutic_category": "Hypertension",
                "standard_dosages": {"adult": "5mg"},
                "allergens": ["amlodipine"],
            },
            {
                "name": "Atorvastatin",
                "generic_name": "Atorvastatin",
                "drug_class": "Statin",
                "therapeutic_category": "Cholesterol",
                "standard_dosages": {"adult": "10mg"},
                "allergens": ["atorvastatin", "statin"],
            },
            {
                "name": "Omeprazole",
                "generic_name": "Omeprazole",
                "drug_class": "Proton Pump Inhibitor",
                "therapeutic_category": "Gastric",
                "standard_dosages": {"adult": "20mg"},
                "allergens": ["omeprazole", "ppi"],
            },
            {
                "name": "Cetirizine",
                "generic_name": "Cetirizine",
                "drug_class": "Antihistamine",
                "therapeutic_category": "Allergy",
                "standard_dosages": {"adult": "10mg", "child": "5mg"},
                "allergens": ["cetirizine"],
            },
            {
                "name": "Salbutamol",
                "generic_name": "Albuterol",
                "drug_class": "Bronchodilator",
                "therapeutic_category": "Asthma",
                "standard_dosages": {"adult": "100mcg", "child": "100mcg"},
                "allergens": ["salbutamol"],
            },
            {
                "name": "Warfarin",
                "generic_name": "Warfarin",
                "drug_class": "Anticoagulant",
                "therapeutic_category": "Blood Thinner",
                "standard_dosages": {"adult": "5mg"},
                "allergens": ["warfarin"],
            },
            {
                "name": "Aspirin",
                "generic_name": "Acetylsalicylic Acid",
                "drug_class": "NSAID",
                "therapeutic_category": "Pain Relief",
                "standard_dosages": {"adult": "75mg"},
                "allergens": ["aspirin", "nsaid"],
            },
        ]

        created_medicines = {}
        for med_data in medicines_data:
            medicine, created = Medicine.objects.get_or_create(
                name=med_data["name"], generic_name=med_data["generic_name"], defaults=med_data
            )
            created_medicines[med_data["name"]] = medicine
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created medicine: {medicine.name}"))
            else:
                self.stdout.write(f"Medicine already exists: {medicine.name}")

        # Drug interactions
        interactions_data = [
            {
                "medicine_a": "Warfarin",
                "medicine_b": "Aspirin",
                "severity": "major",
                "description": "Increased risk of bleeding. Monitor INR closely.",
            },
            {
                "medicine_a": "Warfarin",
                "medicine_b": "Ibuprofen",
                "severity": "major",
                "description": "Increased risk of bleeding. Avoid combination if possible.",
            },
            {
                "medicine_a": "Metformin",
                "medicine_b": "Ibuprofen",
                "severity": "moderate",
                "description": "May increase risk of lactic acidosis. Monitor kidney function.",
            },
            {
                "medicine_a": "Amlodipine",
                "medicine_b": "Atorvastatin",
                "severity": "minor",
                "description": "May increase statin levels. Monitor for muscle pain.",
            },
            {
                "medicine_a": "Omeprazole",
                "medicine_b": "Metformin",
                "severity": "minor",
                "description": "May affect metformin absorption. Monitor blood sugar.",
            },
            {
                "medicine_a": "Aspirin",
                "medicine_b": "Ibuprofen",
                "severity": "moderate",
                "description": "Increased risk of GI bleeding. Use with caution.",
            },
        ]

        for interaction_data in interactions_data:
            med_a = created_medicines.get(interaction_data["medicine_a"])
            med_b = created_medicines.get(interaction_data["medicine_b"])

            if med_a and med_b:
                interaction, created = DrugInteraction.objects.get_or_create(
                    medicine_a=med_a,
                    medicine_b=med_b,
                    defaults={"severity": interaction_data["severity"], "description": interaction_data["description"]},
                )
                if created:
                    self.stdout.write(
                        self.style.SUCCESS(f"Created interaction: {med_a.name} + {med_b.name} ({interaction.severity})")
                    )

        self.stdout.write(self.style.SUCCESS("\n✅ Medicine database seeded successfully!"))
        self.stdout.write(f"Total medicines: {Medicine.objects.count()}")
        self.stdout.write(f"Total interactions: {DrugInteraction.objects.count()}")
