import json

from django.core.cache import cache
from django.http import JsonResponse
from rest_framework import status


class RateLimitMiddleware:
    """
    Rate limiting middleware for OTP requests and verification attempts.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Check rate limits for specific endpoints
        if request.path == "/api/auth/send-otp/" and request.method == "POST":
            email = self._get_payload_value(request, "email")
            if email and not self.check_otp_request_limit(email):
                return JsonResponse(
                    {
                        "error": "RATE_LIMIT_EXCEEDED",
                        "detail": "Too many OTP requests. Please try again in 1 hour.",
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        if request.path == "/api/auth/verify-otp/" and request.method == "POST":
            email = self._get_payload_value(request, "email")
            if email and not self.check_otp_verify_limit(email):
                return JsonResponse(
                    {
                        "error": "RATE_LIMIT_EXCEEDED",
                        "detail": "Too many OTP verification attempts. Please request a new OTP.",
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        response = self.get_response(request)
        return response

    def _get_payload_value(self, request, key: str):
        """Safely extract a value from form or JSON payload without consuming the stream."""
        if key in request.POST:
            return request.POST.get(key)

        content_type = request.META.get("CONTENT_TYPE", "")
        if "application/json" in content_type:
            try:
                body_data = json.loads(request.body.decode("utf-8") or "{}")
                return body_data.get(key)
            except Exception:
                return None
        return None

    def check_otp_request_limit(self, email: str, max_requests: int = 5, window_seconds: int = 3600) -> bool:
        """
        Check if email has exceeded OTP request limit.
        Returns True if within limit, False if exceeded.
        """
        cache_key = f"otp_requests:{email}"
        current_count = cache.get(cache_key, 0)

        if current_count >= max_requests:
            return False

        cache.set(cache_key, current_count + 1, window_seconds)
        return True

    def check_otp_verify_limit(self, email: str, max_attempts: int = 3, window_seconds: int = 900) -> bool:
        """Limit OTP verification attempts per email within the window."""
        cache_key = f"otp_verify:{email}"
        current_count = cache.get(cache_key, 0)

        if current_count >= max_attempts:
            return False

        cache.set(cache_key, current_count + 1, window_seconds)
        return True
