"""
medical/management/commands/populate_medical_records.py
─────────────────────────────────────────────────────
Django management command to create realistic dummy medical records
"""
import random
from datetime import datetime, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from medical.models import PatientVisitRecord


class Command(BaseCommand):
    help = "Populate dummy medical records for testing (March 2025 - February 2026)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            help="Email of the patient user (if not provided, uses first user)",
        )
        parser.add_argument(
            "--records",
            type=int,
            default=15,
            help="Number of records to create (default: 15)",
        )

    def handle(self, *args, **options):
        # Get user model
        User = settings.AUTH_USER_MODEL.split(".")
        from django.apps import apps

        UserModel = apps.get_model(User[0], User[1])

        # Get or create patient user
        email = options.get("email")
        if email:
            try:
                patient = UserModel.objects.get(email=email)
            except UserModel.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"User with email '{email}' not found"))
                return
        else:
            patient = UserModel.objects.filter(is_superuser=False).first()
            if not patient:
                self.stdout.write(self.style.ERROR("No users found. Please create a user first."))
                return

        self.stdout.write(f"Creating medical records for: {patient.email}")

        # Define realistic medical data
        departments = [
            "Cardiology",
            "General Medicine",
            "Orthopedics",
            "Neurology",
            "Dermatology",
        ]

        medical_scenarios = [
            {
                "department": "General Medicine",
                "doctor": "Dr. Rajesh Kumar",
                "diagnosis": "Viral Fever",
                "tests": "- Complete Blood Count (CBC)\n- Blood Sugar Test\n- Chest X-Ray",
                "prescription": "- Paracetamol 500mg (3 times daily)\n- Vitamin C supplements\n- Rest and adequate hydration\n- Review after 3 days",
            },
            {
                "department": "Cardiology",
                "doctor": "Dr. Priya Sharma",
                "diagnosis": "Mild Hypertension",
                "tests": "- Blood Pressure Monitoring\n- ECG (Electrocardiogram)\n- Lipid Profile",
                "prescription": "- Amlodipine 5mg (1 tablet daily)\n- Low salt diet\n- Regular exercise (30 min daily)\n- Follow-up in 1 month",
            },
            {
                "department": "Orthopedics",
                "doctor": "Dr. Amit Verma",
                "diagnosis": "Lower Back Pain (Lumbar Strain)",
                "tests": "- X-Ray Lumbar Spine\n- Physical Examination",
                "prescription": "- Ibuprofen 400mg (twice daily)\n- Hot compress therapy\n- Physiotherapy sessions (10 days)\n- Avoid heavy lifting",
            },
            {
                "department": "Neurology",
                "doctor": "Dr. Sneha Reddy",
                "diagnosis": "Migraine with Aura",
                "tests": "- MRI Brain (if persistent)\n- Blood Pressure Check\n- Neurological Examination",
                "prescription": "- Sumatriptan 50mg (as needed)\n- Avoid triggers (stress, lack of sleep)\n- Maintain sleep schedule\n- Follow-up in 2 weeks",
            },
            {
                "department": "Dermatology",
                "doctor": "Dr. Kavita Mehta",
                "diagnosis": "Allergic Dermatitis",
                "tests": "- Skin Patch Test\n- Allergy Blood Test",
                "prescription": "- Hydrocortisone Cream 1% (apply twice daily)\n- Antihistamine tablets (once daily)\n- Avoid known allergens\n- Moisturize regularly",
            },
            {
                "department": "Cardiology",
                "doctor": "Dr. Priya Sharma",
                "diagnosis": "Routine ECG Follow-up",
                "tests": "- ECG (Electrocardiogram)\n- Blood Pressure Check",
                "prescription": "- Continue current medications\n- Maintain healthy lifestyle\n- Next follow-up in 3 months",
            },
            {
                "department": "General Medicine",
                "doctor": "Dr. Suresh Patel",
                "diagnosis": "Type 2 Diabetes - Follow-up",
                "tests": "- Fasting Blood Sugar\n- HbA1c Test\n- Kidney Function Test",
                "prescription": "- Metformin 500mg (twice daily)\n- Diet control (low carb)\n- Regular exercise\n- Blood sugar monitoring\n- Review in 6 weeks",
            },
            {
                "department": "General Medicine",
                "doctor": "Dr. Anjali Singh",
                "diagnosis": "Seasonal Allergic Rhinitis",
                "tests": "- Nasal Examination\n- Allergy Panel (if needed)",
                "prescription": "- Cetirizine 10mg (once daily)\n- Nasal Saline Spray\n- Avoid dust and pollen\n- Steam inhalation",
            },
            {
                "department": "Orthopedics",
                "doctor": "Dr. Amit Verma",
                "diagnosis": "Knee Pain (Osteoarthritis - Early Stage)",
                "tests": "- X-Ray Knee Joint\n- Physical Examination",
                "prescription": "- Glucosamine supplements\n- Knee exercises\n- Weight management\n- Avoid prolonged standing\n- Follow-up in 2 months",
            },
            {
                "department": "Neurology",
                "doctor": "Dr. Sneha Reddy",
                "diagnosis": "Tension Headache",
                "tests": "- Blood Pressure Monitoring\n- Neurological Examination",
                "prescription": "- Paracetamol 500mg (as needed)\n- Stress management techniques\n- Adequate sleep (7-8 hours)\n- Regular breaks from screen time",
            },
            {
                "department": "General Medicine",
                "doctor": "Dr. Rajesh Kumar",
                "diagnosis": "Routine Health Check-up",
                "tests": "- Complete Blood Count\n- Liver Function Test\n- Kidney Function Test\n- Lipid Profile\n- Blood Sugar",
                "prescription": "- All reports normal\n- Continue healthy lifestyle\n- Exercise regularly\n- Balanced diet\n- Next check-up in 6 months",
            },
            {
                "department": "Cardiology",
                "doctor": "Dr. Priya Sharma",
                "diagnosis": "Hypertension Follow-up (Well Controlled)",
                "tests": "- Blood Pressure Check\n- ECG\n- Kidney Function Test",
                "prescription": "- Continue Amlodipine 5mg\n- Blood pressure well controlled\n- Maintain low salt diet\n- Regular exercise\n- Follow-up in 3 months",
            },
            {
                "department": "Dermatology",
                "doctor": "Dr. Kavita Mehta",
                "diagnosis": "Acne Vulgaris (Moderate)",
                "tests": "- Skin Examination",
                "prescription": "- Benzoyl Peroxide Gel 2.5%\n- Clindamycin Solution\n- Avoid oily foods\n- Keep face clean\n- Follow-up in 4 weeks",
            },
            {
                "department": "General Medicine",
                "doctor": "Dr. Suresh Patel",
                "diagnosis": "Gastroesophageal Reflux Disease (GERD)",
                "tests": "- Physical Examination\n- Endoscopy (if symptoms persist)",
                "prescription": "- Omeprazole 20mg (before breakfast)\n- Avoid spicy and oily foods\n- Small frequent meals\n- Elevate head while sleeping\n- Review in 2 weeks",
            },
            {
                "department": "General Medicine",
                "doctor": "Dr. Anjali Singh",
                "diagnosis": "Common Cold with Sore Throat",
                "tests": "- Throat Examination\n- Temperature Check",
                "prescription": "- Paracetamol 500mg (as needed)\n- Warm salt water gargles\n- Vitamin C tablets\n- Adequate rest and fluids\n- Review if fever persists",
            },
        ]

        # Generate records from March 2025 to February 2026
        start_date = datetime(2025, 3, 1)
        end_date = datetime(2026, 2, 28)
        total_days = (end_date - start_date).days

        num_records = options.get("records", 15)
        records_created = 0

        # Delete existing records for this patient
        existing_count = PatientVisitRecord.objects.filter(patient=patient).count()
        if existing_count > 0:
            PatientVisitRecord.objects.filter(patient=patient).delete()
            self.stdout.write(f"Deleted {existing_count} existing records")

        for _ in range(num_records):
            # Random date within the range
            random_days = random.randint(0, total_days)
            visit_date = start_date + timedelta(days=random_days)

            # Random time (9 AM to 6 PM)
            hour = random.randint(9, 18)
            minute = random.choice([0, 15, 30, 45])
            visit_date = visit_date.replace(hour=hour, minute=minute, second=0, microsecond=0)

            # Make timezone aware
            visit_date = timezone.make_aware(visit_date)

            # Select random scenario
            scenario = random.choice(medical_scenarios)

            # Create record
            PatientVisitRecord.objects.create(
                patient=patient,
                doctor_name=scenario["doctor"],
                department=scenario["department"],
                diagnosis=scenario["diagnosis"],
                tests_performed=scenario["tests"],
                prescription=scenario["prescription"],
                visit_date=visit_date,
            )
            records_created += 1

        self.stdout.write(
            self.style.SUCCESS(f"Successfully created {records_created} medical records for {patient.email}")
        )
        self.stdout.write(f"Date range: March 2025 - February 2026")
        self.stdout.write(f"Access at: http://localhost:8000/medical/records/")
