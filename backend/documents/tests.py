from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import DoctorProfile
from medical.models import DoctorPatientAccess, LabTestResult, PatientVisitRecord
from patients.models import Profile
from pharmacy.models import DispensingRecord, Invoice, Pharmacy
from prescriptions.models import Medicine, Prescription, PrescriptionMedicine

from .pdfs import amount_in_words

User = get_user_model()


def auth(user):
    return {"HTTP_AUTHORIZATION": f"Bearer {RefreshToken.for_user(user).access_token}"}


class DocumentPDFTests(APITestCase):
    def setUp(self):
        self.patient = User.objects.create_user(email="pat@example.com")
        self.profile = Profile.objects.create(user=self.patient, name="Karan Sharma", age=27, gender="male", blood_group="B-", relationship="self")
        self.other = User.objects.create_user(email="other@example.com")
        Profile.objects.create(user=self.other, name="Other", age=40, gender="female", blood_group="O+", relationship="self")
        self.doctor = User.objects.create_user(email="doc@example.com", role=User.Role.DOCTOR)
        DoctorProfile.objects.create(user=self.doctor, first_name="Meera", last_name="Rao", medical_license="L-1",
                                     specialization="General Medicine", approval_status=DoctorProfile.ApprovalStatus.APPROVED)
        now = timezone.now()
        self.visit = PatientVisitRecord.objects.create(
            patient=self.patient, profile=self.profile, doctor_name="Meera Rao", department="General Medicine",
            diagnosis="Allergic rhinitis", tests_performed="CBC", prescription="Cetirizine 10 mg", visit_date=now,
        )
        self.lab = LabTestResult.objects.create(patient=self.patient, profile=self.profile, test_name="HbA1c", value=6.1, unit="%",
                                                normal_min=4, normal_max=5.7, tested_at=now)
        med = Medicine.objects.create(name="Cetirizine 10 mg", generic_name="Cetirizine", drug_class="Antihistamine", therapeutic_category="Allergy")
        self.rx = Prescription.objects.create(patient=self.profile, doctor=self.doctor, qr_code_path="", security_hash="abc")
        pm = PrescriptionMedicine.objects.create(prescription=self.rx, medicine=med, dosage="10 mg", frequency="At bedtime", duration_days=5, quantity=5)
        self.pharmacist = User.objects.create_user(email="ph@example.com", role=User.Role.PHARMACIST)
        pharmacy = Pharmacy.objects.create(name="Sanjeevani", license_number="PH-1", address="1 Road", phone="9999999999",
                                           email="ph@example.com", owner=self.pharmacist, gstin="29ABCDE1234F1Z5")
        self.invoice = Invoice.objects.create(
            invoice_number="INV-TEST-1", pharmacy=pharmacy, pharmacist=self.pharmacist, prescription=self.rx, patient=self.profile,
            subtotal=Decimal("4.50"), total=Decimal("4.50"), taxable_value=Decimal("4.29"), cgst=Decimal("0.11"), sgst=Decimal("0.10"),
        )
        DispensingRecord.objects.create(prescription=self.rx, prescription_medicine=pm, pharmacy=pharmacy, pharmacist=self.pharmacist,
                                        status="dispensed", quantity_dispensed=5, unit_price=Decimal("0.90"), amount=Decimal("4.50"),
                                        invoice=self.invoice, gst_rate=Decimal("5"), taxable_value=Decimal("4.29"), tax_amount=Decimal("0.21"))

    def assertPdf(self, resp):
        self.assertEqual(resp.status_code, 200, getattr(resp, "data", resp.content[:200]))
        self.assertEqual(resp["Content-Type"], "application/pdf")
        self.assertTrue(resp.content.startswith(b"%PDF"))

    def test_patient_gets_every_document_as_pdf(self):
        h = auth(self.patient)
        self.assertPdf(self.client.get(reverse("pdf-visit-record", args=[self.visit.id]), **h))
        self.assertPdf(self.client.get(reverse("pdf-lab-result", args=[self.lab.id]), **h))
        self.assertPdf(self.client.get(reverse("pdf-lab-results"), **h))
        self.assertPdf(self.client.get(reverse("pdf-prescription", args=[self.rx.id]) + "?language=hi", **h))
        self.assertPdf(self.client.get(reverse("pdf-invoice", args=[self.invoice.id]), **h))
        self.assertPdf(self.client.get(reverse("my-card-pdf"), **h))

    def test_other_patients_are_refused(self):
        h = auth(self.other)
        for url in (reverse("pdf-visit-record", args=[self.visit.id]), reverse("pdf-lab-result", args=[self.lab.id]),
                    reverse("pdf-prescription", args=[self.rx.id]), reverse("pdf-invoice", args=[self.invoice.id])):
            self.assertEqual(self.client.get(url, **h).status_code, 403, url)

    def test_doctor_needs_current_access_for_visit_records(self):
        url = reverse("pdf-visit-record", args=[self.visit.id])
        self.assertEqual(self.client.get(url, **auth(self.doctor)).status_code, 403)
        DoctorPatientAccess.objects.create(doctor=self.doctor, patient=self.profile, expires_at=timezone.now() + timedelta(hours=1))
        self.assertPdf(self.client.get(url, **auth(self.doctor)))

    def test_prescribing_doctor_and_issuing_pharmacist(self):
        self.assertPdf(self.client.get(reverse("pdf-prescription", args=[self.rx.id]), **auth(self.doctor)))
        self.assertPdf(self.client.get(reverse("pdf-invoice", args=[self.invoice.id]), **auth(self.pharmacist)))

    def test_patient_invoice_list(self):
        resp = self.client.get(reverse("dashboard-invoices"), **auth(self.patient))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual([i["invoice_number"] for i in resp.data], ["INV-TEST-1"])
        self.assertEqual(self.client.get(reverse("dashboard-invoices"), **auth(self.other)).data, [])

    def test_amount_in_words(self):
        self.assertEqual(amount_in_words(Decimal("14.00")), "Rupees Fourteen Only")
        self.assertEqual(amount_in_words(Decimal("1234567.50")),
                         "Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Fifty Paise Only")
