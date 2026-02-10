from django.contrib import admin

from .models import OTP, Session, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "role", "verification_status", "is_active", "date_joined")
    list_filter = ("role", "verification_status", "is_active", "is_staff")
    search_fields = ("email",)
    ordering = ("-date_joined",)


@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "attempts", "is_valid", "created_at")
    list_filter = ("is_valid",)
    search_fields = ("user__email",)


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "expires_at", "device_info")
    search_fields = ("user__email",)
