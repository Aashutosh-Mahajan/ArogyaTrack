from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import EmergencyContact, HealthCard, HealthCardService, Profile


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["id", "name", "age", "gender", "blood_group", "relationship", "region", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        user = self.context["request"].user
        profile = Profile.objects.create(user=user, **validated_data)
        media_root = settings.MEDIA_ROOT
        HealthCardService.create_health_card(profile, media_root=str(media_root))
        if not user.profiles.filter(id=user.active_profile_id).exists():
            user.active_profile = profile
            user.save(update_fields=["active_profile"])
        return profile


class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = ["id", "name", "phone", "relationship", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        profile = self.context["profile"]
        return EmergencyContact.objects.create(profile=profile, **validated_data)


class HealthCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthCard
        fields = ["token", "qr_code_path", "expires_at", "revoked_at"]


class SwitchProfileSerializer(serializers.Serializer):
    profile_id = serializers.UUIDField()

    def validate(self, attrs):
        user = self.context["request"].user
        profile_id = attrs.get("profile_id")
        try:
            profile = user.profiles.get(id=profile_id)
        except Profile.DoesNotExist:
            raise serializers.ValidationError({"profile_id": "Profile not found for user"})
        attrs["profile"] = profile
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        profile = self.validated_data["profile"]
        user.active_profile = profile
        user.save(update_fields=["active_profile"])
        return profile


class RevokeHealthCardSerializer(serializers.Serializer):
    def save(self, **kwargs):
        profile = self.context["profile"]
        card = HealthCardService.revoke(profile)
        return card
