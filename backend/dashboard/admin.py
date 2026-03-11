from django.contrib import admin

from .models import DashboardAlert, DownloadLog


@admin.register(DashboardAlert)
class DashboardAlertAdmin(admin.ModelAdmin):
    list_display = ("patient", "alert_type", "severity", "title", "is_read", "is_dismissed", "created_at")
    list_filter = ("alert_type", "severity", "is_read", "is_dismissed")
    search_fields = ("patient__email", "title", "message")
    ordering = ("-created_at",)
    readonly_fields = ("id", "created_at", "read_at", "dismissed_at")


@admin.register(DownloadLog)
class DownloadLogAdmin(admin.ModelAdmin):
    list_display = ("user", "file_type", "file_name", "ip_address", "downloaded_at")
    list_filter = ("file_type",)
    search_fields = ("user__email", "file_name")
    ordering = ("-downloaded_at",)
    readonly_fields = ("downloaded_at",)
