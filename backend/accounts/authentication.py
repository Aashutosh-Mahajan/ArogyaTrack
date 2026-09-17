"""
Cookie-aware JWT authentication.

Bearer-token clients (the Flutter mobile app, API scripts, etc.) send an
Authorization header and authenticate exactly as plain JWTAuthentication
always has — nothing changes for them.

Browser clients send no Authorization header. When that's the case, this
falls back to reading the access token from the httpOnly cookie set at
login (see accounts.cookies). Because browsers attach cookies to requests
automatically — unlike a custom Authorization header, which they never
attach cross-site — that fallback path is vulnerable to CSRF unless checked
explicitly, so we enforce Django's CSRF check only on the cookie path.
"""
from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        self.enforce_csrf(request)
        return self.get_user(validated_token), validated_token

    def enforce_csrf(self, request):
        def dummy_get_response(request):
            return None

        check = CSRFCheck(dummy_get_response)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
