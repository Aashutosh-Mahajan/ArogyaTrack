import os
import warnings
from datetime import timedelta
from pathlib import Path
from typing import List

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env if present
load_dotenv(BASE_DIR / ".env")

DEBUG = os.getenv("DEBUG", "False").lower() == "true"

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-local-dev-only-do-not-use-in-production"
    else:
        raise ImproperlyConfigured("SECRET_KEY environment variable must be set when DEBUG=False.")

# Public address of the web app, used for links printed on documents
# (e.g. the prescription verification link on a PDF).
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

# Times printed on documents (PDFs, invoice numbers). Storage stays UTC.
DOCUMENT_TIME_ZONE = os.getenv("DOCUMENT_TIME_ZONE", "Asia/Kolkata")

# LLM for clinical decision support and the prescription safety agent.
# Any OpenAI-compatible provider works: set AI_BASE_URL to its endpoint and
# AI_MODEL to the model name. OPENAI_API_KEY is still read for older setups.
AI_API_KEY = os.getenv("AI_API_KEY", "") or os.getenv("OPENAI_API_KEY", "")
AI_BASE_URL = os.getenv("AI_BASE_URL", "").strip()
AI_MODEL = os.getenv("AI_MODEL", "").strip()

# Extra hosts (e.g. a developer's LAN IP for testing the mobile app) are opt-in
# via env, never hardcoded, so they don't silently ship to every environment.
_dev_extra_hosts = (
    [h.strip() for h in os.getenv("DEV_ALLOWED_HOSTS", "").split(",") if h.strip()] if DEBUG else []
)
ALLOWED_HOSTS: List[str] = [
    host.strip() for host in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if host.strip()
] + _dev_extra_hosts

# Applications
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "rest_framework_simplejwt.token_blacklist",
    "accounts",
    "patients",
    "medical",
    "prescriptions",
    "pharmacy",
    "adherence",
    "surveillance",
    "dashboard",
    "cdss",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "accounts.middleware.RateLimitMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Database
# Support both DATABASE_URL (Neon/Heroku style) and individual settings
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Parse DATABASE_URL if provided (e.g., from Neon)
    import dj_database_url
    # Reuse connections: opening a fresh TLS connection to a remote (Neon)
    # database on every request added seconds of latency and intermittent
    # "SSL error: unexpected eof" failures. Health checks drop stale ones.
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=int(os.getenv("DB_CONN_MAX_AGE", "60")),
            conn_health_checks=True,
        )
    }
else:
    if not DEBUG:
        raise ImproperlyConfigured(
            "DATABASE_URL (or DB_* variables) must be explicitly configured when DEBUG=False."
        )
    # Use individual environment variables (local dev only)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "health_surveillance"),
            "USER": os.getenv("DB_USER", "postgres"),
            "PASSWORD": os.getenv("DB_PASSWORD", "postgres"),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
            "OPTIONS": {
                # Enable SSL for Neon and other cloud databases
                "sslmode": os.getenv("DB_SSLMODE", "prefer"),
            },
        }
    }

# For Neon cloud specifically, ensure SSL is required
if "neon.tech" in DATABASES["default"].get("HOST", ""):
    DATABASES["default"].setdefault("OPTIONS", {})["sslmode"] = "require"
    if DEBUG:
        warnings.warn(
            "DEBUG=True while DATABASE_URL points at a cloud Neon database. "
            "This enables permissive CORS/CSRF settings against a shared database — "
            "set DEBUG=False for anything other than isolated local development.",
            RuntimeWarning,
        )

# Cache / Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Use local memory cache in development (no Redis needed)
# Redis is required outside DEBUG: LocMemCache is per-process, so rate limiting
# (accounts.middleware.RateLimitMiddleware) silently stops working across
# multiple worker processes without it.
USE_REDIS_CACHE = os.getenv("USE_REDIS_CACHE", "false").lower() == "true"
if not USE_REDIS_CACHE and not DEBUG:
    raise ImproperlyConfigured(
        "USE_REDIS_CACHE must be set to 'true' when DEBUG=False; the in-memory cache "
        "does not work correctly across multiple worker processes."
    )

if USE_REDIS_CACHE:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "unique-snowflake",
        }
    }

# Rate limiting backend (use cache instead of redis directly)
RATELIMIT_USE_CACHE = "default"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static and media files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# File upload security settings
FILE_UPLOAD_MAX_MEMORY_SIZE = 10485760  # 10MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 10485760  # 10MB
FILE_UPLOAD_PERMISSIONS = 0o644
FILE_UPLOAD_DIRECTORY_PERMISSIONS = 0o755

# Auth cookies (web clients only — mobile keeps using the Authorization header).
# See accounts/authentication.py and accounts/cookies.py.
AUTH_COOKIE_ACCESS = "access_token"
AUTH_COOKIE_REFRESH = "refresh_token"
AUTH_COOKIE_SECURE = not DEBUG
AUTH_COOKIE_SAMESITE = "Lax"

# Rest Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
    # DRF's test client defaults to multipart, which silently mangles nested
    # data (lists/dicts) instead of erroring — every real endpoint here is a
    # JSON API, so tests should exercise that by default too.
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

# JWT settings
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    if DEBUG:
        JWT_SECRET = SECRET_KEY
    else:
        raise ImproperlyConfigured("JWT_SECRET environment variable must be set when DEBUG=False.")

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),  # 60 minutes
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),    # 1 day
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": JWT_SECRET,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# Custom user model
AUTH_USER_MODEL = "accounts.User"

# ========================================================================
# CORS Configuration for Local Development
# ========================================================================
# For production, set CORS_ALLOWED_ORIGINS in environment variables
# For development, allowing common development ports

if DEBUG:
    # Development: Allow localhost on common ports + any dev LAN origins from env
    # (e.g. DEV_LAN_ORIGINS="http://192.168.1.5:8000" when testing the mobile app
    # against this machine) — never hardcoded, so a developer's IP doesn't ship
    # to every environment.
    _dev_lan_origins = [o.strip() for o in os.getenv("DEV_LAN_ORIGINS", "").split(",") if o.strip()]
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ] + _dev_lan_origins
    CORS_ALLOW_ALL_ORIGINS = True
else:
    # Production: Use environment variable
    CORS_ALLOWED_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]

# CSRF/session cookies must be Secure outside local (non-HTTPS) dev, and the
# CSRF cookie must stay JS-readable (default) so the web frontend's axios
# client can echo it back as the X-CSRFToken header on cookie-authenticated
# requests — see accounts/authentication.py.
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# CSRF trusted origins (must match CORS origins)
if DEBUG:
    CSRF_TRUSTED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ] + _dev_lan_origins
else:
    CSRF_TRUSTED_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",")
        if origin.strip()
    ]

# Email / SMTP
# Use console backend in development (prints OTP to terminal)
# Set EMAIL_BACKEND env var to use SMTP in production
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.example.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() == "true"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "False").lower() == "true"
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@health-surveillance.local")

# Celery
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
