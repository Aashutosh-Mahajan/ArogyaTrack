"""Celery application configuration."""

import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("health_surveillance")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


# Celery Beat Schedule
app.conf.beat_schedule = {
    # Master daily pipeline - runs at 2 AM every day
    'master-daily-pipeline': {
        'task': 'surveillance.tasks.master_daily_pipeline',
        'schedule': crontab(hour=2, minute=0),
    },
    # Check alert escalations - every 2 hours
    'check-alert-escalation': {
        'task': 'surveillance.tasks.check_alert_escalation',
        'schedule': crontab(minute=0, hour='*/2'),
    },
    # Send adherence reminders - every hour
    'send-adherence-reminders': {
        'task': 'adherence.tasks.send_daily_reminders',
        'schedule': crontab(minute=0),
    },
    # Check refill reminders - daily at 9 AM
    'send-refill-reminders': {
        'task': 'adherence.tasks.send_refill_reminders',
        'schedule': crontab(hour=9, minute=0),
    },
    # Environmental data sync - daily at 6 AM
    'environmental-data-sync': {
        'task': 'surveillance.tasks.environmental_data_sync',
        'schedule': crontab(hour=6, minute=0),
    },
}

app.conf.timezone = 'Asia/Kolkata'
