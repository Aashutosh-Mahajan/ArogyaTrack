"""Queue diagnoses once; dispensing reuses the diagnosis identity, not a new case."""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone


def queue_diagnosis(diagnosis):
    from .models import Consent, PendingInferenceQueue, Region
    patient=diagnosis.record.patient
    if not Consent.objects.filter(profile=patient,consent_type="surveillance",is_granted=True).exists():
        return
    region=Region.objects.filter(name=patient.region).first()
    if region is None:
        return
    PendingInferenceQueue.objects.update_or_create(diagnosis=diagnosis,defaults={
        "region":region,"disease_code":diagnosis.icd_10_code,"severity":diagnosis.severity,
        "occurrence_date":timezone.localtime(diagnosis.created_at,timezone.get_fixed_timezone(330)).date()})


@receiver(post_save,sender="medical.Diagnosis")
def diagnosis_to_inference_queue(sender,instance,**kwargs):
    queue_diagnosis(instance)


@receiver(post_save,sender="pharmacy.DispensingRecord")
def dispensing_to_inference_queue(sender,instance,created,**kwargs):
    if created and instance.prescription.medical_record_id:
        for diagnosis in instance.prescription.medical_record.diagnoses.all():
            queue_diagnosis(diagnosis)


@receiver(post_save,sender='surveillance.Consent')
def consent_change_reaggregates(sender,instance,**kwargs):
    if instance.consent_type!='surveillance':
        return
    from .models import Region,PendingInferenceQueue
    from medical.models import Diagnosis
    region=Region.objects.filter(name=instance.profile.region).first()
    if region is None:
        return
    for diagnosis in Diagnosis.objects.filter(record__patient=instance.profile):
        PendingInferenceQueue.objects.update_or_create(diagnosis=diagnosis,defaults={
            'region':region,'disease_code':diagnosis.icd_10_code,'severity':diagnosis.severity,
            'occurrence_date':timezone.localtime(diagnosis.created_at,timezone.get_fixed_timezone(330)).date()})


@receiver(post_delete,sender='medical.Diagnosis')
def diagnosis_delete_reaggregates(sender,instance,**kwargs):
    from .models import Region,PendingInferenceQueue
    try:
        name=instance.record.patient.region
    except Exception:
        return
    region=Region.objects.filter(name=name).first()
    if region:
        PendingInferenceQueue.objects.create(region=region,disease_code=instance.icd_10_code,
            occurrence_date=timezone.localtime(instance.created_at,timezone.get_fixed_timezone(330)).date())
