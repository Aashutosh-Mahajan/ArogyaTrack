from django.contrib import admin

from .models import DispensingRecord, Pharmacy


@admin.register(Pharmacy)
class PharmacyAdmin(admin.ModelAdmin):
    list_display = ["name", "license_number", "phone", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name", "license_number"]


@admin.register(DispensingRecord)
class DispensingRecordAdmin(admin.ModelAdmin):
    list_display = ["prescription", "prescription_medicine", "pharmacy", "status", "dispensed_at"]
    list_filter = ["status", "dispensed_at"]
    search_fields = ["prescription__id", "pharmacy__name"]
