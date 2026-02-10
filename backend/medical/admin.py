from django.contrib import admin

from .models import Allergy, ChronicCondition, Diagnosis, MedicalRecord


class DiagnosisInline(admin.TabularInline):
    model = Diagnosis
    extra = 0


@admin.register(MedicalRecord)
class MedicalRecordAdmin(admin.ModelAdmin):
    list_display = ("patient", "doctor", "created_at")
    search_fields = ("patient__name", "doctor__email")
    inlines = [DiagnosisInline]


@admin.register(Allergy)
class AllergyAdmin(admin.ModelAdmin):
    list_display = ("profile", "allergen", "severity", "created_at")
    search_fields = ("profile__name", "allergen")


@admin.register(ChronicCondition)
class ChronicConditionAdmin(admin.ModelAdmin):
    list_display = ("profile", "icd_10_code", "is_active", "created_at")
    search_fields = ("profile__name", "icd_10_code")
