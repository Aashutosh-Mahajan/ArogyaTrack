from django.contrib import admin

from .models import DrugInteraction, Medicine, Prescription, PrescriptionMedicine


@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = ["name", "generic_name", "drug_class", "is_active"]
    list_filter = ["drug_class", "therapeutic_category", "is_active"]
    search_fields = ["name", "generic_name"]


@admin.register(DrugInteraction)
class DrugInteractionAdmin(admin.ModelAdmin):
    list_display = ["medicine_a", "medicine_b", "severity"]
    list_filter = ["severity"]
    search_fields = ["medicine_a__name", "medicine_b__name"]


class PrescriptionMedicineInline(admin.TabularInline):
    model = PrescriptionMedicine
    extra = 1


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ["id", "patient", "doctor", "status", "created_at"]
    list_filter = ["status", "created_at"]
    search_fields = ["patient__name", "doctor__email"]
    inlines = [PrescriptionMedicineInline]
