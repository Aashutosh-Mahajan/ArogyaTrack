"""Post-save signals that feed the near real-time inference pipeline.

When a Diagnosis or DispensingRecord is created, we record the event
into PendingInferenceQueue so the 5-minute middleman task can pick it up.
Only patients with surveillance consent are included.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="medical.Diagnosis")
def diagnosis_to_inference_queue(sender, instance, created, **kwargs):
    if not created:
        return

    from surveillance.models import Consent, PendingInferenceQueue, Region

    try:
        patient = instance.record.patient
    except Exception:
        return

    if not Consent.objects.filter(
        profile=patient,
        consent_type="surveillance",
        is_granted=True,
    ).exists():
        return

    region_name = getattr(patient, "region", None)
    if not region_name:
        return

    try:
        region = Region.objects.get(name=region_name)
    except Region.DoesNotExist:
        return

    PendingInferenceQueue.objects.create(
        region=region,
        disease_code=instance.icd_10_code,
        severity=instance.severity,
    )
    logger.debug("Queued Diagnosis %s for real-time inference", instance.pk)


@receiver(post_save, sender="pharmacy.DispensingRecord")
def dispensing_to_inference_queue(sender, instance, created, **kwargs):
    if not created:
        return

    from surveillance.models import Consent, PendingInferenceQueue, Region

    try:
        prescription = instance.prescription
        medical_record = prescription.medical_record
        if medical_record is None:
            return
        patient = medical_record.patient
    except Exception:
        return

    if not Consent.objects.filter(
        profile=patient,
        consent_type="surveillance",
        is_granted=True,
    ).exists():
        return

    region_name = getattr(patient, "region", None)
    if not region_name:
        return

    try:
        region = Region.objects.get(name=region_name)
    except Region.DoesNotExist:
        return

    for diagnosis in medical_record.diagnoses.all():
        PendingInferenceQueue.objects.create(
            region=region,
            disease_code=diagnosis.icd_10_code,
            severity=diagnosis.severity,
        )
    logger.debug("Queued DispensingRecord %s for real-time inference", instance.pk)
