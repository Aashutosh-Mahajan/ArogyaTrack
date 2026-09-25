from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from patients.models import Profile
from prescriptions.models import Medicine, Prescription, PrescriptionMedicine

from .models import DispensingRecord, Invoice, Pharmacy, PharmacyInventory

User = get_user_model()


def auth(user):
    return {"HTTP_AUTHORIZATION": f"Bearer {RefreshToken.for_user(user).access_token}"}


class BillingTests(APITestCase):
    def setUp(self):
        self.pharmacist = User.objects.create_user(email="ph@example.com", role=User.Role.PHARMACIST)
        self.pharmacy = Pharmacy.objects.create(
            name="Test Pharmacy", license_number="PH-T-1", address="1 Road", phone="9999999999",
            email="ph@example.com", owner=self.pharmacist,
        )
        doctor = User.objects.create_user(email="doc@example.com", role=User.Role.DOCTOR)
        patient_user = User.objects.create_user(email="pat@example.com")
        self.profile = Profile.objects.create(user=patient_user, name="Pat", age=30, gender="female", blood_group="O+", relationship="self")
        self.med_a = Medicine.objects.create(name="Paracetamol 500 mg", generic_name="Paracetamol", drug_class="Analgesic", therapeutic_category="Pain")
        self.med_b = Medicine.objects.create(name="Cetirizine 10 mg", generic_name="Cetirizine", drug_class="Antihistamine", therapeutic_category="Allergy")
        today = timezone.localdate()
        # Earlier-expiring batch is cheaper and is used first.
        PharmacyInventory.objects.create(pharmacy=self.pharmacy, medicine=self.med_a, batch_number="A1",
                                         quantity_in_stock=5, unit_price=Decimal("1.00"), expiry_date=today + timedelta(days=30))
        PharmacyInventory.objects.create(pharmacy=self.pharmacy, medicine=self.med_a, batch_number="A2",
                                         quantity_in_stock=50, unit_price=Decimal("1.50"), expiry_date=today + timedelta(days=300))
        PharmacyInventory.objects.create(pharmacy=self.pharmacy, medicine=self.med_b, batch_number="B1",
                                         quantity_in_stock=20, unit_price=None, expiry_date=today + timedelta(days=200))
        self.rx = Prescription.objects.create(patient=self.profile, doctor=doctor, qr_code_path="x", security_hash="h")
        self.pm_a = PrescriptionMedicine.objects.create(prescription=self.rx, medicine=self.med_a, dosage="500 mg", frequency="Three times daily", duration_days=3, quantity=9)
        self.pm_b = PrescriptionMedicine.objects.create(prescription=self.rx, medicine=self.med_b, dosage="10 mg", frequency="At bedtime", duration_days=5, quantity=5)

    def dispense(self, pm, qty):
        return self.client.post(reverse("dispense-medicine"), {"prescription_medicine_id": str(pm.id), "status": "dispensed", "quantity_dispensed": qty}, format="json", **auth(self.pharmacist))

    def test_dispensed_item_is_priced_from_batches_used(self):
        resp = self.dispense(self.pm_a, 9)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        # 5 units at 1.00 from A1, then 4 at 1.50 from A2.
        self.assertEqual(Decimal(resp.data["amount"]), Decimal("11.00"))
        self.assertEqual(Decimal(resp.data["unit_price"]), Decimal("1.22"))

    def test_unpriced_stock_records_no_amount(self):
        resp = self.dispense(self.pm_b, 5)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(resp.data["amount"])

    def test_invoice_bills_unbilled_items_once(self):
        self.dispense(self.pm_a, 9)
        self.dispense(self.pm_b, 5)
        url = reverse("invoices")
        body = {"prescription_id": str(self.rx.id), "discount": "1.00", "payment_method": "upi"}
        resp = self.client.post(url, body, format="json", **auth(self.pharmacist))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(resp.data["subtotal"]), Decimal("11.00"))
        self.assertEqual(Decimal(resp.data["total"]), Decimal("10.00"))
        self.assertEqual(len(resp.data["items"]), 2)
        self.assertTrue(resp.data["invoice_number"].startswith("INV-"))
        # 5% GST is contained in the ₹10.00 paid: ₹9.52 taxable + ₹0.48 tax, split CGST/SGST.
        self.assertEqual(Decimal(resp.data["taxable_value"]), Decimal("9.52"))
        self.assertEqual(Decimal(resp.data["cgst"]) + Decimal(resp.data["sgst"]), Decimal("0.48"))
        self.assertEqual(sum(Decimal(i["taxable_value"]) + Decimal(i["tax_amount"]) for i in resp.data["items"]), Decimal("10.00"))
        self.assertEqual(DispensingRecord.objects.filter(invoice__isnull=True).count(), 0)

        again = self.client.post(url, body, format="json", **auth(self.pharmacist))
        self.assertEqual(again.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Invoice.objects.count(), 1)

    def test_discount_cannot_exceed_bill(self):
        self.dispense(self.pm_a, 9)
        resp = self.client.post(reverse("invoices"), {"prescription_id": str(self.rx.id), "discount": "50"}, format="json", **auth(self.pharmacist))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Invoice.objects.count(), 0)

    def test_other_pharmacists_cannot_see_invoice(self):
        self.dispense(self.pm_a, 9)
        inv = self.client.post(reverse("invoices"), {"prescription_id": str(self.rx.id)}, format="json", **auth(self.pharmacist)).data
        other = User.objects.create_user(email="ph2@example.com", role=User.Role.PHARMACIST)
        Pharmacy.objects.create(name="Other", license_number="PH-T-2", address="2 Road", phone="8888888888", email="ph2@example.com", owner=other)
        resp = self.client.get(reverse("invoice-detail", args=[inv["id"]]), **auth(other))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
