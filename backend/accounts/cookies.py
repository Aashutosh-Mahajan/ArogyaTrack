"""
Helpers for the httpOnly auth cookies used by the web frontend.

Mobile clients never see these — they continue to read access/refresh
tokens from the JSON response body and store them via flutter_secure_storage,
exactly as before. These cookies are an additional, web-only transport so the
browser never holds a JS-readable copy of either token (closing the
localStorage XSS-theft exposure) — see CookieJWTAuthentication for the read
side and its CSRF enforcement.
"""
from django.conf import settings


def set_auth_cookies(response, access: str, refresh: str) -> None:
    common = dict(
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path="/",
    )
    response.set_cookie(
        settings.AUTH_COOKIE_ACCESS,
        access,
        max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        **common,
    )
    response.set_cookie(
        settings.AUTH_COOKIE_REFRESH,
        refresh,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        **common,
    )


def set_access_cookie(response, access: str) -> None:
    response.set_cookie(
        settings.AUTH_COOKIE_ACCESS,
        access,
        max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path="/",
    )


def clear_auth_cookies(response) -> None:
    response.delete_cookie(settings.AUTH_COOKIE_ACCESS, path="/")
    response.delete_cookie(settings.AUTH_COOKIE_REFRESH, path="/")
