from django.contrib import admin
from .models import AdherenceTracker, DoseSchedule, AdherenceReminder


@admin.register(AdherenceTracker)
class AdherenceTrackerAdmin(admin.ModelAdmin):
    list_display = ['id', 'patient', 'prescription', 'adherence_percentage', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['patient__name', 'prescription__id']
    readonly_fields = ['id', 'adherence_percentage', 'created_at', 'updated_at']


@admin.register(DoseSchedule)
class DoseScheduleAdmin(admin.ModelAdmin):
    list_display = ['id', 'tracker', 'medicine', 'scheduled_time', 'is_taken', 'taken_at']
    list_filter = ['is_taken', 'reminder_sent', 'scheduled_time']
    search_fields = ['medicine__name', 'tracker__patient__name']
    readonly_fields = ['id', 'created_at']


@admin.register(AdherenceReminder)
class AdherenceReminderAdmin(admin.ModelAdmin):
    list_display = ['id', 'tracker', 'channel', 'status', 'sent_at', 'acknowledged_at']
    list_filter = ['channel', 'status', 'sent_at']
    search_fields = ['tracker__patient__name']
    readonly_fields = ['id', 'created_at']
