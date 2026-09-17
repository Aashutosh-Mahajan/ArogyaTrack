#!/bin/sh
set -e

# Celery workers/beat run this same image with a different CMD — only the
# web process needs migrate/collectstatic on startup.
if [ "$1" = "gunicorn" ]; then
    python manage.py migrate --noinput
    python manage.py collectstatic --noinput
fi

exec "$@"
