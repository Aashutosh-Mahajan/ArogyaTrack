from django.urls import path
from . import views

urlpatterns = [
    path('my-trackers/', views.my_trackers, name='my_trackers'),
    path('tracker/<uuid:tracker_id>/', views.get_adherence_tracker, name='get_adherence_tracker'),
    path('patient/<uuid:patient_id>/trackers/', views.get_patient_trackers, name='get_patient_trackers'),
    path('upcoming-doses/', views.get_upcoming_doses, name='get_upcoming_doses'),
    path('missed-doses/', views.get_missed_doses, name='get_missed_doses'),
    path('record-dose/', views.record_dose_taken, name='record_dose_taken'),
    path('tracker/<uuid:tracker_id>/metrics/', views.get_adherence_metrics, name='get_adherence_metrics'),
    path('tracker/<uuid:tracker_id>/refill-check/', views.check_refill_needed, name='check_refill_needed'),
]
