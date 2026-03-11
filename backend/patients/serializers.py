from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import HealthCard, HealthCardService, Profile, PatientProfile


class PatientProfileSerializer(serializers.ModelSerializer):
    """Serializer for PatientProfile (account-level patient data)."""
    
    class Meta:
        model = PatientProfile
        fields = [
            "aadhar_id_proof",
            "terms_accepted", "terms_accepted_at",
            "consent_store_data", "consent_store_data_at",
            "consent_doctor_access", "consent_doctor_access_at",
            "data_sharing_enabled",
            "last_consent_update",
            "created_at", "updated_at"
        ]
        read_only_fields = ["created_at", "updated_at", "last_consent_update"]


class ProfileSerializer(serializers.ModelSerializer):
    full_address = serializers.ReadOnlyField()
    calculated_age = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = [
            "id", "patient_id", "name", "age", "gender", "blood_group", "relationship", "region",
            "date_of_birth", "phone",
            "district", "state", "country", "address", "pincode",
            "full_address", "calculated_age",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "patient_id", "created_at", "updated_at", "full_address", "calculated_age"]
    
    def get_calculated_age(self, obj):
        """Return calculated age from date_of_birth if available."""
        return obj.calculate_age() if hasattr(obj, 'calculate_age') else obj.age

    def create(self, validated_data):
        user = self.context["request"].user
        profile = Profile.objects.create(user=user, **validated_data)
        media_root = settings.MEDIA_ROOT
        HealthCardService.create_health_card(profile, media_root=str(media_root))
        if not user.profiles.filter(id=user.active_profile_id).exists():
            user.active_profile = profile
            user.save(update_fields=["active_profile"])
        return profile


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
