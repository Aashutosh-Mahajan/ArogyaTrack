from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class OTPFlowTests(APITestCase):
    def test_send_and_verify_otp_flow(self):
        email = "user@example.com"
        send_resp = self.client.post(reverse("send-otp"), {"email": email})
        self.assertEqual(send_resp.status_code, status.HTTP_200_OK)
        user = User.objects.get(email=email)
        otp = user.otps.first()
        # Use raw code by bypassing hash for test simplicity
        code = "000000"
        otp.code_hash = otp.hash_code(code)
        otp.save(update_fields=["code_hash"])

        verify_resp = self.client.post(reverse("verify-otp"), {"email": email, "otp": code})
        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", verify_resp.data)
        self.assertIn("refresh", verify_resp.data)

    def test_invalid_otp(self):
        email = "user2@example.com"
        self.client.post(reverse("send-otp"), {"email": email})
        resp = self.client.post(reverse("verify-otp"), {"email": email, "otp": "123123"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("otp", resp.data)
