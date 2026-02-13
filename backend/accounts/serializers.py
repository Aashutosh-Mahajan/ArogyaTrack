from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model, authenticate
from django.utils import timezone
from rest_framework import serializers

from .models import DoctorProfile, SessionService, OTPService

User = get_user_model()


def _assign_group(user, role_name: str) -> None:
    """Add user to the Django Group matching their role. Idempotent."""
    from django.contrib.auth.models import Group

    group, _ = Group.objects.get_or_create(name=role_name)
    user.groups.add(group)


class SendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def create_user_if_needed(self, email: str) -> Any:
        user, _ = User.objects.get_or_create(email=email)
        return user

    def save(self, **kwargs):
        email = self.validated_data["email"].lower()
        user = self.create_user_if_needed(email)
        OTPService.issue_otp(user, purpose="login")
        return {"email": email}


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)
    device_info = serializers.JSONField(required=False)
    user_agent = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        email = attrs.get("email").lower()
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({"email": "User not found"})
        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        otp = self.validated_data["otp"]
        device_info = self.validated_data.get("device_info") or {}
        user_agent = self.validated_data.get("user_agent") or ""

        is_valid = OTPService.verify_otp(user, otp)
        if not is_valid:
            raise serializers.ValidationError({"otp": "Invalid or expired OTP"})

        # Mark verified
        user.verification_status = user.VerificationStatus.VERIFIED
        user.save(update_fields=["verification_status", "updated_at"])

        # Issue tokens
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        SessionService.create_session(
            user=user,
            refresh_token=str(refresh),
            device_info={"device_info": device_info, "user_agent": user_agent},
            days=int(refresh.lifetime.total_seconds() // 86400) or 30,
        )

        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "verification_status": user.verification_status,
            },
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "expires_in": int(refresh.access_token.lifetime.total_seconds()),
            "refresh_expires_in": int(refresh.lifetime.total_seconds()),
        }


class DoctorRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    medical_license = serializers.CharField(max_length=50)
    specialization = serializers.CharField(max_length=100)
    phone = serializers.CharField(max_length=20)

    def validate_email(self, value):
        value = value.lower()
        existing = User.objects.filter(email=value).first()
        if existing:
            if existing.verification_status == User.VerificationStatus.VERIFIED:
                raise serializers.ValidationError("Email already registered")
            # Remove unverified user so they can re-register
            existing.delete()
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        email = validated_data['email']
        first_name = validated_data['first_name']
        last_name = validated_data['last_name']
        medical_license = validated_data['medical_license']
        specialization = validated_data['specialization']
        phone = validated_data.get('phone', '')

        user = User.objects.create(
            email=email,
            role=User.Role.DOCTOR,
            verification_status=User.VerificationStatus.PENDING,
        )
        user.set_password(password)
        user.save()

        # Assign to Doctor group
        _assign_group(user, 'Doctor')

        # Create DoctorProfile with pending approval
        DoctorProfile.objects.create(
            user=user,
            first_name=first_name,
            last_name=last_name,
            medical_license=medical_license,
            specialization=specialization,
            phone=phone,
            approval_status=DoctorProfile.ApprovalStatus.PENDING,
        )

        # Send OTP for email verification
        OTPService.issue_otp(user)

        return user


class PatientRegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    date_of_birth = serializers.DateField()
    gender = serializers.ChoiceField(choices=['male', 'female', 'other'])
    blood_group = serializers.ChoiceField(choices=['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    phone = serializers.CharField(max_length=20)
    address = serializers.CharField()

    def validate_email(self, value):
        value = value.lower()
        existing = User.objects.filter(email=value).first()
        if existing:
            if existing.verification_status == User.VerificationStatus.VERIFIED:
                raise serializers.ValidationError("Email already registered")
            # Remove unverified user so they can re-register
            existing.delete()
        return value

    def create(self, validated_data):
        from patients.models import Profile
        from datetime import date
        
        password = validated_data.pop('password')
        email = validated_data['email']
        first_name = validated_data.pop('first_name')
        last_name = validated_data.pop('last_name')
        date_of_birth = validated_data.pop('date_of_birth')
        gender = validated_data.pop('gender')
        blood_group = validated_data.pop('blood_group')
        
        user = User.objects.create(
            email=email,
            role=User.Role.PATIENT,
            verification_status=User.VerificationStatus.PENDING
        )
        user.set_password(password)
        user.save()
        
        # Calculate age from date_of_birth
        today = date.today()
        age = today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))
        
        # Create patient profile
        profile = Profile.objects.create(
            user=user,
            name=f"{first_name} {last_name}",
            age=age,
            gender=gender,
            blood_group=blood_group,
            relationship=Profile.Relationship.SELF
        )
        user.active_profile = profile
        user.save(update_fields=['active_profile'])

        # Assign to Patient group
        _assign_group(user, 'Patient')

        # Send OTP for email verification
        OTPService.issue_otp(user)

        return user


class PasswordLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    device_info = serializers.JSONField(required=False)
    user_agent = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        email = attrs.get('email').lower()
        password = attrs.get('password')
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid credentials")
        
        if not user.check_password(password):
            raise serializers.ValidationError("Invalid credentials")
        
        if user.verification_status != User.VerificationStatus.VERIFIED:
            raise serializers.ValidationError("Please verify your email first")
        
        if not user.is_active:
            raise serializers.ValidationError("Account is inactive")
        
        attrs['user'] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data['user']
        device_info = self.validated_data.get('device_info') or {}
        user_agent = self.validated_data.get('user_agent') or ""

        # Issue tokens
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        SessionService.create_session(
            user=user,
            refresh_token=str(refresh),
            device_info={"device_info": device_info, "user_agent": user_agent},
            days=int(refresh.lifetime.total_seconds() // 86400) or 30,
        )

        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "verification_status": user.verification_status,
            },
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "expires_in": int(refresh.access_token.lifetime.total_seconds()),
            "refresh_expires_in": int(refresh.lifetime.total_seconds()),
        }


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self, **kwargs):
        email = self.validated_data['email'].lower()
        try:
            user = User.objects.get(email=email)
            # Send OTP for password reset
            OTPService.issue_otp(user, purpose="password_reset")
        except User.DoesNotExist:
            # Don't reveal if email exists or not
            pass
        return {"detail": "If the email exists, an OTP has been sent"}


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate(self, attrs):
        email = attrs.get('email').lower()
        otp = attrs.get('otp')
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid request")
        
        is_valid = OTPService.verify_otp(user, otp)
        if not is_valid:
            raise serializers.ValidationError({"otp": "Invalid or expired OTP"})
        
        attrs['user'] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data['user']
        new_password = self.validated_data['new_password']
        
        user.set_password(new_password)
        user.save(update_fields=['password'])
        
        return {"detail": "Password reset successful"}


class EmailVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)

    def validate(self, attrs):
        email = attrs.get('email').lower()
        otp = attrs.get('otp')
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")
        
        is_valid = OTPService.verify_otp(user, otp)
        if not is_valid:
            raise serializers.ValidationError({"otp": "Invalid or expired OTP"})
        
        attrs['user'] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data['user']
        user.verification_status = User.VerificationStatus.VERIFIED
        user.save(update_fields=['verification_status'])
        
        return {"detail": "Email verified successfully"}


# ─── Admin serializers ──────────────────────────────────────────────


class DoctorProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = DoctorProfile
        fields = [
            "id", "email", "first_name", "last_name",
            "medical_license", "specialization", "phone",
            "approval_status", "approved_by", "approved_at",
            "created_at", "updated_at",
        ]
        read_only_fields = fields


class DoctorApprovalSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])

    def update(self, doctor_profile, validated_data):
        from django.utils import timezone as tz
        action = validated_data["action"]
        admin_user = self.context["request"].user
        if action == "approve":
            doctor_profile.approval_status = DoctorProfile.ApprovalStatus.APPROVED
        else:
            doctor_profile.approval_status = DoctorProfile.ApprovalStatus.REJECTED
        doctor_profile.approved_by = admin_user
        doctor_profile.approved_at = tz.now()
        doctor_profile.save(update_fields=[
            "approval_status", "approved_by", "approved_at", "updated_at",
        ])
        return doctor_profile


class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "email", "role", "verification_status",
            "is_active", "is_staff", "date_joined",
        ]
        read_only_fields = fields
