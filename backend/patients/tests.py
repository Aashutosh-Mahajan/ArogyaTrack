from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Profile

User = get_user_model()


def auth_headers(user):
    token = RefreshToken.for_user(user)
    return {"HTTP_AUTHORIZATION": f"Bearer {token.access_token}"}


class ProfileFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="patient@example.com")

    def test_create_profile_and_health_card(self):
        payload = {
            "name": "John Doe",
            "age": 30,
            "gender": "male",
            "blood_group": "O+",
            "relationship": "self",
            "region": "Mumbai",
        }
        resp = self.client.post(reverse("create-profile"), payload, **auth_headers(self.user))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        profile_id = resp.data["id"]
        profile = Profile.objects.get(id=profile_id)
        self.assertTrue(hasattr(profile, "health_card"))

        card_resp = self.client.get(reverse("health-card", args=[profile_id]), **auth_headers(self.user))
        self.assertEqual(card_resp.status_code, status.HTTP_200_OK)
        self.assertIn("token", card_resp.data)
        self.assertIn("qr_code_path", card_resp.data)

    def test_switch_profile(self):
        profile1 = Profile.objects.create(user=self.user, name="A", age=20, gender="male", blood_group="O+", relationship="self")
        profile2 = Profile.objects.create(user=self.user, name="B", age=22, gender="female", blood_group="A+", relationship="spouse")
        resp = self.client.put(reverse("switch-profile"), {"profile_id": str(profile2.id)}, **auth_headers(self.user))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.active_profile_id, profile2.id)
