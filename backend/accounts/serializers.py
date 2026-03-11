from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model, authenticate
from django.utils import timezone
from rest_framework import serializers

from .models import DoctorProfile, SessionService, OTPService
from .audit import AuditService

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
                "first_name": user.get_first_name(),
                "last_name": user.get_last_name(),
                "verification_status": user.verification_status,
            },
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "expires_in": int(refresh.access_token.lifetime.total_seconds()),
            "refresh_expires_in": int(refresh.lifetime.total_seconds()),
        }


class DoctorRegistrationSerializer(serializers.Serializer):
    """Production-grade doctor registration with document verification."""
    
    # Personal Information
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    date_of_birth = serializers.DateField()
    phone = serializers.CharField(max_length=20)
    
    # Professional Information
    medical_license = serializers.CharField(max_length=50)
    degree = serializers.ChoiceField(
        choices=['MBBS', 'MD', 'MS', 'DNB', 'BDS', 'BAMS', 'BHMS', 'BUMS', 'Other'],
        default='MBBS'
    )
    degree_other = serializers.CharField(max_length=100, required=False, allow_blank=True)
    specialization = serializers.CharField(max_length=100)
    experience_years = serializers.IntegerField(min_value=0, max_value=60)
    
    # Professional Details (Optional)
    clinic_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    clinic_address = serializers.CharField(required=False, allow_blank=True)
    consultation_fee = serializers.DecimalField(
        max_digits=8,
        decimal_places=2,
        required=False,
        allow_null=True
    )
    
    # Documents (Required for approval)
    license_certificate = serializers.FileField()
    degree_certificate = serializers.FileField()
    government_id = serializers.FileField()
    
    # Terms
    terms_accepted = serializers.BooleanField()

    def validate_email(self, value):
        value = value.lower()
        existing = User.objects.filter(email=value).first()
        if existing:
            if existing.verification_status == User.VerificationStatus.VERIFIED:
                raise serializers.ValidationError("Email already registered")
            existing.delete()
        return value
    
    def validate_password(self, value):
        """Validate password strength."""
        from patients.validators import validate_strong_password
        try:
            validate_strong_password(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_phone(self, value):
        """Validate phone number format."""
        from patients.validators import validate_phone_number
        try:
            validate_phone_number(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_date_of_birth(self, value):
        """Validate doctor age (minimum 23 years)."""
        from accounts.validators import validate_doctor_age
        try:
            validate_doctor_age(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_medical_license(self, value):
        """Validate medical license format and uniqueness."""
        from accounts.validators import validate_medical_registration
        try:
            validate_medical_registration(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        
        # Check uniqueness
        if DoctorProfile.objects.filter(medical_license=value.upper()).exists():
            raise serializers.ValidationError("This medical license number is already registered")
        
        return value.upper()
    
    def validate_license_certificate(self, value):
        """Validate license certificate file."""
        from accounts.validators import validate_medical_certificate
        try:
            validate_medical_certificate(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_degree_certificate(self, value):
        """Validate degree certificate file."""
        from accounts.validators import validate_medical_certificate
        try:
            validate_medical_certificate(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_government_id(self, value):
        """Validate government ID file."""
        from accounts.validators import validate_medical_certificate
        try:
            validate_medical_certificate(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate(self, attrs):
        """Cross-field validation."""
        # Validate terms accepted
        if not attrs.get('terms_accepted'):
            raise serializers.ValidationError({"terms_accepted": "You must accept the terms and conditions"})
        
        # Validate experience vs age
        dob = attrs.get('date_of_birth')
        experience = attrs.get('experience_years', 0)
        if dob and experience:
            from datetime import date
            today = date.today()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            max_experience = age - 23  # Assuming min age for practice is 23
            
            if experience > max_experience:
                raise serializers.ValidationError({
                    "experience_years": f"Experience ({experience} years) exceeds possible years based on age ({max_experience} years)"
                })
        
        # If degree is 'Other', degree_other must be provided
        if attrs.get('degree') == 'Other' and not attrs.get('degree_other'):
            raise serializers.ValidationError({"degree_other": "Please specify your degree"})
        
        return attrs

    def create(self, validated_data):
        """Create doctor user and profile with pending approval status."""
        from django.db import transaction
        
        password = validated_data.pop('password')
        email = validated_data['email']
        first_name = validated_data['first_name']
        last_name = validated_data['last_name']
        date_of_birth = validated_data['date_of_birth']
        phone = validated_data['phone']
        
        # Professional data
        medical_license = validated_data['medical_license']
        degree = validated_data['degree']
        degree_other = validated_data.get('degree_other', '')
        specialization = validated_data['specialization']
        experience_years = validated_data['experience_years']
        
        # Optional fields
        clinic_name = validated_data.get('clinic_name', '')
        clinic_address = validated_data.get('clinic_address', '')
        consultation_fee = validated_data.get('consultation_fee')
        
        # Documents
        license_cert = validated_data['license_certificate']
        degree_cert = validated_data['degree_certificate']
        govt_id = validated_data['government_id']
        
        with transaction.atomic():
            # Create User
            user = User.objects.create(
                email=email,
                role=User.Role.DOCTOR,
                verification_status=User.VerificationStatus.PENDING,
            )
            user.set_password(password)
            user.save()

            # Assign to Doctor group
            _assign_group(user, 'Doctor')

            # Create DoctorProfile with PENDING approval
            doctor_profile = DoctorProfile.objects.create(
                user=user,
                first_name=first_name,
                last_name=last_name,
                date_of_birth=date_of_birth,
                phone=phone,
                medical_license=medical_license,
                degree=degree,
                degree_other=degree_other,
                specialization=specialization,
                experience_years=experience_years,
                clinic_name=clinic_name,
                clinic_address=clinic_address,
                consultation_fee=consultation_fee,
                license_certificate=license_cert,
                degree_certificate=degree_cert,
                government_id=govt_id,
                approval_status=DoctorProfile.ApprovalStatus.PENDING,
            )
            
            # Log doctor registration in audit
            AuditService.log_event(
                event_type="user_registration",
                action="doctor_registration",
                user=user,
                details={
                    "medical_license": medical_license,
                    "specialization": specialization,
                    "status": "pending_approval"
                }
            )
            
            # Send OTP for email verification (non-blocking)
            try:
                OTPService.issue_otp(user)
            except Exception:
                import logging
                logging.getLogger(__name__).warning(f"Failed to send OTP email to {user.email}")
            
            # TODO: Send notification email to admin for approval
            # send_admin_notification_email(doctor_profile)
        
        return user


class PatientRegistrationSerializer(serializers.Serializer):
    """Production-grade patient registration with comprehensive fields."""
    
    # Personal Information
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    date_of_birth = serializers.DateField()
    gender = serializers.ChoiceField(choices=['male', 'female', 'other'])
    phone = serializers.CharField(max_length=20)
    
    # Medical Information
    blood_group = serializers.ChoiceField(choices=['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    
    # Geographic Information
    address = serializers.CharField()
    district = serializers.CharField(max_length=120)
    state = serializers.CharField(max_length=120)
    country = serializers.CharField(max_length=120, default='India')
    pincode = serializers.CharField(max_length=10, required=False, allow_blank=True)
    
    # Documents & Consent
    aadhar_id_proof = serializers.FileField(required=False, allow_null=True)
    terms_accepted = serializers.BooleanField()
    consent_store_data = serializers.BooleanField()
    consent_doctor_access = serializers.BooleanField()
    abha_verified = serializers.BooleanField(required=False, default=False)  # NEW: ABHA FEATURE

    def validate_email(self, value):
        value = value.lower()
        existing = User.objects.filter(email=value).first()
        if existing:
            if existing.verification_status == User.VerificationStatus.VERIFIED:
                raise serializers.ValidationError("Email already registered")
            # Remove unverified user so they can re-register
            existing.delete()
        return value
    
    def validate_password(self, value):
        """Validate password strength."""
        from patients.validators import validate_strong_password
        try:
            validate_strong_password(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_phone(self, value):
        """Validate phone number format."""
        from patients.validators import validate_phone_number
        try:
            validate_phone_number(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_date_of_birth(self, value):
        """Validate patient age."""
        from patients.validators import validate_patient_age
        try:
            validate_patient_age(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate(self, attrs):
        """Cross-field validation."""
        # Validate all consents are accepted
        if not attrs.get('terms_accepted'):
            raise serializers.ValidationError({"terms_accepted": "You must accept the terms and conditions"})
        if not attrs.get('consent_store_data'):
            raise serializers.ValidationError({"consent_store_data": "Consent to store medical data is required"})
        if not attrs.get('consent_doctor_access'):
            raise serializers.ValidationError({"consent_doctor_access": "Consent for doctor access is required"})
        
        return attrs

    def create(self, validated_data):
        """Create user with profile and patient profile in atomic transaction."""
        from patients.models import Profile, PatientProfile
        from datetime import date
        from django.db import transaction
        
        # Extract data
        password = validated_data.pop('password')
        email = validated_data['email']
        first_name = validated_data.pop('first_name')
        last_name = validated_data.pop('last_name')
        date_of_birth = validated_data.pop('date_of_birth')
        gender = validated_data.pop('gender')
        blood_group = validated_data.pop('blood_group')
        phone = validated_data.pop('phone')
        
        # Geographic
        address = validated_data.pop('address', '')
        district = validated_data.pop('district', '')
        state = validated_data.pop('state', '')
        country = validated_data.pop('country', 'India')
        pincode = validated_data.pop('pincode', '')
        
        # Consent
        terms_accepted = validated_data.pop('terms_accepted')
        consent_store_data = validated_data.pop('consent_store_data')
        consent_doctor_access = validated_data.pop('consent_doctor_access')
        aadhar_id_proof = validated_data.pop('aadhar_id_proof', None)
        abha_verified = validated_data.pop('abha_verified', False)  # NEW: ABHA FEATURE
        
        with transaction.atomic():
            # Create User
            user = User.objects.create(
                email=email,
                role=User.Role.PATIENT,
                verification_status=User.VerificationStatus.VERIFIED if abha_verified else User.VerificationStatus.PENDING  # NEW: ABHA FEATURE
            )
            user.set_password(password)
            user.save()
            
            # Calculate age
            today = date.today()
            age = today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))
            
            # Create Patient Profile (main profile)
            profile = Profile.objects.create(
                user=user,
                name=f"{first_name} {last_name}",
                age=age,
                date_of_birth=date_of_birth,
                gender=gender,
                blood_group=blood_group,
                phone=phone,
                address=address,
                district=district,
                state=state,
                country=country,
                pincode=pincode,
                relationship=Profile.Relationship.SELF
            )
            user.active_profile = profile
            user.save(update_fields=['active_profile'])
            
            # Create PatientProfile with consents
            now = timezone.now()
            patient_profile = PatientProfile.objects.create(
                user=user,
                aadhar_id_proof=aadhar_id_proof,
                terms_accepted=terms_accepted,
                terms_accepted_at=now if terms_accepted else None,
                consent_store_data=consent_store_data,
                consent_store_data_at=now if consent_store_data else None,
                consent_doctor_access=consent_doctor_access,
                consent_doctor_access_at=now if consent_doctor_access else None,
                last_consent_update=now
            )
            
            # Assign to Patient group
            _assign_group(user, 'Patient')
            
            # Generate Health Card (ID card with QR code)
            try:
                from patients.models import HealthCardService
                from django.conf import settings as django_settings
                HealthCardService.create_health_card(
                    profile=profile,
                    media_root=str(django_settings.MEDIA_ROOT)
                )
            except Exception:
                import logging
                logging.getLogger(__name__).warning(f"Failed to generate health card for {user.email}")
            
            # Send OTP for email verification (non-blocking)
            try:
                OTPService.issue_otp(user)
            except Exception:
                # Don't fail registration if OTP email fails
                import logging
                logging.getLogger(__name__).warning(f"Failed to send OTP email to {user.email}")
        
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
                "first_name": user.get_first_name(),
                "last_name": user.get_last_name(),
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

class PharmacistRegistrationSerializer(serializers.Serializer):
    """Production-grade pharmacist registration."""
    
    # Personal Information
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=100) # Optional, strictly speaking, as User doesn't have names, but useful for profile
    last_name = serializers.CharField(max_length=100) # Optional
    
    # Professional Information
    license_number = serializers.CharField(max_length=50)
    degree = serializers.CharField(max_length=100)
    pharmacy_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    
    # Documents
    license_certificate = serializers.FileField()
    
    # Terms
    terms_accepted = serializers.BooleanField()

    def validate_email(self, value):
        value = value.lower()
        existing = User.objects.filter(email=value).first()
        if existing:
            if existing.verification_status == User.VerificationStatus.VERIFIED:
                raise serializers.ValidationError("Email already registered")
            existing.delete()
        return value
    
    def validate_password(self, value):
        """Validate password strength."""
        from patients.validators import validate_strong_password
        try:
            validate_strong_password(value)
        except Exception as e:
            raise serializers.ValidationError(str(e))
        return value
    
    def validate_license_number(self, value):
        """Check uniqueness."""
        from accounts.models import PharmacistProfile
        if PharmacistProfile.objects.filter(license_number=value).exists():
            raise serializers.ValidationError("This license number is already registered")
        return value

    def validate(self, attrs):
        if not attrs.get('terms_accepted'):
            raise serializers.ValidationError({"terms_accepted": "You must accept the terms and conditions"})
        return attrs

    def create(self, validated_data):
        from django.db import transaction
        from accounts.models import PharmacistProfile
        
        password = validated_data.pop('password')
        email = validated_data['email']
        
        # Profile data
        license_number = validated_data['license_number']
        degree = validated_data['degree']
        pharmacy_name = validated_data.get('pharmacy_name', '')
        license_cert = validated_data['license_certificate']
        
        with transaction.atomic():
            # Create User
            user = User.objects.create(
                email=email,
                role=User.Role.PHARMACIST,
                verification_status=User.VerificationStatus.PENDING,
            )
            user.set_password(password)
            user.save()

            # Assign to Pharmacist group
            _assign_group(user, 'Pharmacist')

            # Create PharmacistProfile
            profile = PharmacistProfile.objects.create(
                user=user,
                first_name=validated_data['first_name'],
                last_name=validated_data['last_name'],
                license_number=license_number,
                degree=degree,
                pharmacy_name=pharmacy_name,
                license_certificate=license_cert,
                approval_status=PharmacistProfile.ApprovalStatus.PENDING,
            )
            
            # Log registration
            AuditService.log_event(
                event_type="user_registration",
                action="pharmacist_registration",
                user=user,
                details={
                    "license_number": license_number,
                    "status": "pending_approval"
                }
            )
            
            # Send OTP
            try:
                OTPService.issue_otp(user)
            except Exception:
                import logging
                logging.getLogger(__name__).warning(f"Failed to send OTP email to {user.email}")
        
        return user
