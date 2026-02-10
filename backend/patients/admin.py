from django.contrib import admin

from .models import EmergencyContact, HealthCard, Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "relationship", "blood_group", "created_at")
    search_fields = ("name", "user__email")
    list_filter = ("relationship", "blood_group")


@admin.register(HealthCard)
class HealthCardAdmin(admin.ModelAdmin):
    list_display = ("profile", "expires_at", "revoked_at", "created_at")
    search_fields = ("profile__name", "profile__user__email")
    list_filter = ("revoked_at",)


@admin.register(EmergencyContact)
class EmergencyContactAdmin(admin.ModelAdmin):
    list_display = ("name", "relationship", "profile", "created_at")
    search_fields = ("name", "profile__name", "profile__user__email")
