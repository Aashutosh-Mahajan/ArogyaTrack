from django.contrib import admin

from .models import Allergy, ChronicCondition, Diagnosis, HealthMetric, LabTestResult, MedicalRecord, PatientVisitRecord, VisitReportAttachment


class DiagnosisInline(admin.TabularInline):
    model = Diagnosis
    extra = 0


class VisitReportAttachmentInline(admin.TabularInline):
    model = VisitReportAttachment
    extra = 0
    fields = ("file", "file_name", "file_type", "uploaded_at")
    readonly_fields = ("uploaded_at",)


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


@admin.register(PatientVisitRecord)
class PatientVisitRecordAdmin(admin.ModelAdmin):
    list_display = ("patient", "doctor_name", "department", "visit_date", "created_at")
    list_filter = ("department", "visit_date")
    search_fields = ("patient__email", "doctor_name", "diagnosis", "department")
    date_hierarchy = "visit_date"
    ordering = ("-visit_date",)
    inlines = [VisitReportAttachmentInline]


@admin.register(VisitReportAttachment)
class VisitReportAttachmentAdmin(admin.ModelAdmin):
    list_display = ("visit_record", "file_name", "file_type", "uploaded_at")
    list_filter = ("file_type", "uploaded_at")
    search_fields = ("file_name", "visit_record__doctor_name", "visit_record__patient__email")
    ordering = ("-uploaded_at",)


@admin.register(LabTestResult)
class LabTestResultAdmin(admin.ModelAdmin):
    list_display = ("patient", "test_name", "value", "unit", "normal_min", "normal_max", "status", "tested_at")
    list_filter = ("test_name", "tested_at")
    search_fields = ("patient__email", "test_name")
    date_hierarchy = "tested_at"
    ordering = ("-tested_at",)


@admin.register(HealthMetric)
class HealthMetricAdmin(admin.ModelAdmin):
    list_display = ("patient", "metric_type", "value", "secondary_value", "unit", "recorded_at")
    list_filter = ("metric_type", "recorded_at")
    search_fields = ("patient__email",)
    date_hierarchy = "recorded_at"
    ordering = ("-recorded_at",)

