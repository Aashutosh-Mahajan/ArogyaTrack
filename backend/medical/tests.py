from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from datetime import timedelta

from patients.models import HealthCard, Profile

User = get_user_model()


def auth_headers(user):
    token = RefreshToken.for_user(user)
    return {"HTTP_AUTHORIZATION": f"Bearer {token.access_token}"}


class MedicalFlowTests(APITestCase):
    def setUp(self):
        self.doctor = User.objects.create_user(email="doc@example.com", role=User.Role.DOCTOR)
        self.patient_user = User.objects.create_user(email="pat@example.com")
        self.profile = Profile.objects.create(
            user=self.patient_user,
            name="Pat",
            age=28,
            gender="female",
            blood_group="O+",
            relationship="self",
        )
        HealthCard.objects.create(
            profile=self.profile,
            token="dummy",
            qr_code_path="/tmp/x",
            expires_at=timezone.now() + timedelta(days=365),
        )

    def test_create_medical_record(self):
        payload = {
            "patient": str(self.profile.id),
            "symptoms": "cough",
            "notes": "rest",
            "diagnoses": [{"icd_10_code": "A01", "disease_name": "Test", "severity": 2}],
        }
        resp = self.client.post(reverse("create-medical-record"), payload, **auth_headers(self.doctor))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(resp.data["diagnoses"]), 1)

    def test_history_requires_doctor(self):
        resp = self.client.get(reverse("patient-history", args=[self.profile.id]), **auth_headers(self.patient_user))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
