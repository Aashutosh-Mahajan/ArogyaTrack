"""
accounts/admin.py
─────────────────────────────────────────────────────
Production-grade admin panel for user and doctor management
"""
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone

from .models import DoctorProfile, OTP, Session, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "role", "verification_status", "is_active", "date_joined")
    list_filter = ("role", "verification_status", "is_active", "is_staff")
    search_fields = ("email",)
    ordering = ("-date_joined",)
    readonly_fields = ("date_joined", "updated_at")


@admin.register(DoctorProfile)
class DoctorProfileAdmin(admin.ModelAdmin):
    """
    Production-grade admin interface for doctor verification.
    
    Features:
    - Document preview links
    - Bulk approve/reject actions
    - Comprehensive filtering
    - Readonly fields for audit trail
    """
    list_display = (
        "doctor_name",
        "medical_license",
        "specialization",
        "experience_years",
        "approval_status_badge",
        "documents_uploaded",
        "created_at",
    )
    list_filter = (
        "approval_status",
        "specialization",
        "degree",
        "created_at",
    )
    search_fields = (
        "user__email",
        "first_name",
        "last_name",
        "medical_license",
        "specialization",
    )
    ordering = ("-created_at",)
    readonly_fields = (
        "user",
        "created_at",
        "updated_at",
        "approved_by",
        "approved_at",
        "document_preview_links",
    )
    
    fieldsets = (
        ("User Account", {
            "fields": ("user",)
        }),
        ("Personal Information", {
            "fields": (
                "first_name",
                "last_name",
                "date_of_birth",
                "phone",
            )
        }),
        ("Professional Credentials", {
            "fields": (
                "medical_license",
                "degree",
                "degree_other",
                "specialization",
                "experience_years",
            )
        }),
        ("Professional Details", {
            "fields": (
                "clinic_name",
                "clinic_address",
                "consultation_fee",
            ),
            "classes": ("collapse",)
        }),
        ("Documents", {
            "fields": (
                "document_preview_links",
                "license_certificate",
                "degree_certificate",
                "government_id",
            )
        }),
        ("Verification Status", {
            "fields": (
                "approval_status",
                "rejection_reason",
                "approved_by",
                "approved_at",
            )
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )
    
    actions = ["approve_selected_doctors", "reject_selected_doctors"]
    
    def doctor_name(self, obj):
        """Display full name with Dr. prefix."""
        return obj.full_name
    doctor_name.short_description = "Doctor Name"
    
    def approval_status_badge(self, obj):
        """Display approval status with color badge."""
        colors = {
            "pending": "#FFA500",  # Orange
            "approved": "#28A745",  # Green
            "rejected": "#DC3545",  # Red
        }
        color = colors.get(obj.approval_status, "#6C757D")
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px; font-weight: bold;">{}</span>',
            color,
            obj.get_approval_status_display()
        )
    approval_status_badge.short_description = "Status"
    
    def documents_uploaded(self, obj):
        """Display document upload status."""
        if obj.has_all_documents():
            return format_html(
                '<span style="color: green;">✓ All uploaded</span>'
            )
        return format_html(
            '<span style="color: red;">✗ Incomplete</span>'
        )
    documents_uploaded.short_description = "Documents"
    
    def document_preview_links(self, obj):
        """Generate clickable links to view uploaded documents."""
        links = []
        
        if obj.license_certificate:
            links.append(
                format_html(
                    '<a href="{}" target="_blank">📄 View License Certificate</a>',
                    obj.license_certificate.url
                )
            )
        
        if obj.degree_certificate:
            links.append(
                format_html(
                    '<a href="{}" target="_blank">📄 View Degree Certificate</a>',
                    obj.degree_certificate.url
                )
            )
        
        if obj.government_id:
            links.append(
                format_html(
                    '<a href="{}" target="_blank">📄 View Government ID</a>',
                    obj.government_id.url
                )
            )
        
        if not links:
            return format_html('<span style="color: red;">No documents uploaded</span>')
        
        return format_html("<br>".join(links))
    document_preview_links.short_description = "Document Links"
    
    def approve_selected_doctors(self, request, queryset):
        """Bulk approve selected doctors."""
        approved_count = 0
        for doctor in queryset.filter(approval_status=DoctorProfile.ApprovalStatus.PENDING):
            doctor.approve(request.user)
            approved_count += 1
        
        self.message_user(
            request,
            f"{approved_count} doctor(s) have been approved successfully."
        )
    approve_selected_doctors.short_description = "✓ Approve selected doctors"
    
    def reject_selected_doctors(self, request, queryset):
        """Bulk reject selected doctors."""
        rejected_count = 0
        for doctor in queryset.filter(approval_status=DoctorProfile.ApprovalStatus.PENDING):
            doctor.reject(request.user, reason="Rejected by admin via bulk action")
            rejected_count += 1
        
        self.message_user(
            request,
            f"{rejected_count} doctor(s) have been rejected.",
            level="warning"
        )
    reject_selected_doctors.short_description = "✗ Reject selected doctors"


@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "attempts", "is_valid", "created_at")
    list_filter = ("is_valid",)
    search_fields = ("user__email",)
    readonly_fields = ("user", "code_hash", "expires_at", "attempts", "created_at")


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "expires_at", "device_info")
    search_fields = ("user__email",)
    readonly_fields = ("user", "refresh_token_hash", "created_at", "expires_at")
