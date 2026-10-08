"""Isolated test database. Never uses the developer's configured cloud database."""
import os
os.environ.setdefault("DEBUG","True")
os.environ.setdefault("SECRET_KEY","local-tests-only")
os.environ["DATABASE_URL"]="sqlite:///:memory:"
from .settings import *  # noqa: F403,F401,E402
DATABASES={"default":{"ENGINE":"django.db.backends.sqlite3","NAME":":memory:"}}
PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
CELERY_TASK_ALWAYS_EAGER=True
CELERY_TASK_EAGER_PROPAGATES=True
CELERY_BROKER_URL='memory://'
CELERY_RESULT_BACKEND='cache+memory://'
CACHES={"default":{"BACKEND":"django.core.cache.backends.locmem.LocMemCache"}}
# Third-party migrations resolve native Windows paths unsupported by the sandbox.
# Their tables are synchronized in the isolated test database instead.
MIGRATION_MODULES={"token_blacklist":None}
