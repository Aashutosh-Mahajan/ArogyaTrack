"""
patients/admin.py
─────────────────────────────────────────────────────
Production-grade admin panel for patient management
"""
from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone

from .models import HealthCard, Profile, PatientProfile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """
    Admin interface for patient profiles with extended fields.
    """
    list_display = (
        "patient_id",
        "name",
        "user",
        "relationship",
        "age",
        "blood_group",
        "district",
        "state",
        "created_at",
    )
    search_fields = (
        "patient_id",
        "name",
        "user__email",
        "district",
        "state",
        "phone",
    )
    list_filter = (
        "relationship",
        "blood_group",
        "gender",
        "state",
        "district",
    )
    readonly_fields = ("patient_id", "created_at", "updated_at")
    
    fieldsets = (
        ("Universal ID", {
            "fields": ("patient_id",)
        }),
        ("User Account", {
            "fields": ("user", "relationship")
        }),
        ("Personal Information", {
            "fields": (
                "name",
                "date_of_birth",
                "age",
                "gender",
                "blood_group",
            )
        }),
        ("Contact Information", {
            "fields": (
                "phone",
            )
        }),
        ("Address", {
            "fields": (
                "address",
                "district",
                "state",
                "country",
                "pincode",
                "region",
            )
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    """
    Admin interface for patient-level data (OneToOne with User).
    
    Features:
    - View consent history
    - Export consent logs
    - Document preview
    - Audit trail
    """
    list_display = (
        "user_email",
        "consent_status",
        "has_id_proof",
        "created_at",
    )
    search_fields = ("user__email",)
    list_filter = (
        "terms_accepted",
        "consent_store_data",
        "consent_doctor_access",
        "data_sharing_enabled",
        "created_at",
    )
    readonly_fields = (
        "user",
        "terms_accepted_at",
        "consent_store_data_at",
        "consent_doctor_access_at",
        "last_consent_update",
        "created_at",
        "updated_at",
        "id_proof_preview",
    )
    
    fieldsets = (
        ("User Account", {
            "fields": ("user",)
        }),
        ("Documents", {
            "fields": (
                "aadhar_id_proof",
                "id_proof_preview",
            )
        }),
        ("Terms & Conditions", {
            "fields": (
                "terms_accepted",
                "terms_accepted_at",
            )
        }),
        ("Medical Data Storage Consent", {
            "fields": (
                "consent_store_data",
                "consent_store_data_at",
            )
        }),
        ("Doctor Access Consent", {
            "fields": (
                "consent_doctor_access",
                "consent_doctor_access_at",
            )
        }),
        ("Privacy Settings", {
            "fields": (
                "data_sharing_enabled",
            )
        }),
        ("Audit Trail", {
            "fields": (
                "last_consent_update",
                "created_at",
                "updated_at",
            ),
            "classes": ("collapse",)
        }),
    )
    
    actions = ["export_consent_logs"]
    
    def user_email(self, obj):
        """Display user email."""
        return obj.user.email
    user_email.short_description = "Email"
    user_email.admin_order_field = "user__email"
    
    def consent_status(self, obj):
        """Display consent status with badge."""
        if obj.has_all_consents():
            return format_html(
                '<span style="background-color: #28A745; color: white; padding: 3px 10px; '
                'border-radius: 3px; font-weight: bold;">✓ All Consents</span>'
            )
        return format_html(
            '<span style="background-color: #DC3545; color: white; padding: 3px 10px; '
            'border-radius: 3px; font-weight: bold;">✗ Incomplete</span>'
        )
    consent_status.short_description = "Consent Status"
    
    def has_id_proof(self, obj):
        """Display ID proof upload status."""
        if obj.aadhar_id_proof:
            return format_html('<span style="color: green;">✓ Uploaded</span>')
        return format_html('<span style="color: red;">✗ Not uploaded</span>')
    has_id_proof.short_description = "ID Proof"
    
    def id_proof_preview(self, obj):
        """Generate clickable link to view ID proof document."""
        if obj.aadhar_id_proof:
            return format_html(
                '<a href="{}" target="_blank">📄 View ID Proof Document</a>',
                obj.aadhar_id_proof.url
            )
        return format_html('<span style="color: gray;">No document uploaded</span>')
    id_proof_preview.short_description = "ID Proof Preview"
    
    def export_consent_logs(self, request, queryset):
        """Export consent logs for selected patient profiles."""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="consent_logs.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'Email',
            'Terms Accepted',
            'Terms Accepted At',
            'Consent Store Data',
            'Consent Store Data At',
            'Consent Doctor Access',
            'Consent Doctor Access At',
            'Data Sharing Enabled',
            'Last Consent Update',
        ])
        
        for profile in queryset:
            writer.writerow([
                profile.user.email,
                profile.terms_accepted,
                profile.terms_accepted_at,
                profile.consent_store_data,
                profile.consent_store_data_at,
                profile.consent_doctor_access,
                profile.consent_doctor_access_at,
                profile.data_sharing_enabled,
                profile.last_consent_update,
            ])
        
        self.message_user(request, f"Exported {queryset.count()} consent log(s)")
        return response
    export_consent_logs.short_description = "📊 Export consent logs (CSV)"


@admin.register(HealthCard)
class HealthCardAdmin(admin.ModelAdmin):
    list_display = ("profile", "expires_at", "revoked_at", "created_at")
    search_fields = ("profile__name", "profile__user__email")
    list_filter = ("revoked_at",)
    readonly_fields = ("profile", "token", "qr_code_path", "expires_at", "created_at")
