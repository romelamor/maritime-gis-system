# app_name/serializers.py
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    Personnel, PersonnelProfile, Region, CrimeReport, Suspect
)
from .models import OfficerRegistration
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password

# -----------------------------
# Auth / Users
# -----------------------------
User = get_user_model()

class AdminCreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "badge_number", "is_active"]
        extra_kwargs = {
            "email": {"required": True},
            "username": {"required": True},
        }

    def validate_badge_number(self, v):
        if v in (None, "",):
            return v
        v = str(v).strip()
        if len(v) != 6 or not v.isdigit():
            raise serializers.ValidationError("badge_number must be exactly 6 digits.")
        return v

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        # ensure user portal account
        user.is_staff = False
        user.is_superuser = False
        user.is_admin = False  # your custom flag
        user.set_password(password)
        user.save()
        return user

class UserRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Personnel
        fields = ["username", "email", "password", "badge_number", "id_image"]
        extra_kwargs = {"password": {"write_only": True}}

    def validate_username(self, value):
        if Personnel.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def create(self, validated_data):
        return Personnel.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email"),
            password=validated_data["password"],
            badge_number=validated_data.get("badge_number"),
            id_image=validated_data.get("id_image"),
        )

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["is_admin"] = user.is_admin
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["username"] = self.user.username
        data["is_admin"] = self.user.is_admin
        return data

class UserTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if self.user.is_admin:
            raise serializers.ValidationError("Admin accounts are not allowed to login here.")
        data["is_admin"] = self.user.is_admin
        return data

class AdminTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_admin:
            raise serializers.ValidationError("Only admin accounts can login here.")
        data["is_admin"] = self.user.is_admin
        return data

# -----------------------------
# Profiles / Reference
# -----------------------------
class PersonnelProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonnelProfile
        fields = "__all__"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        for key in ["profile_image"]:
            if data.get(key) and request and not str(data[key]).startswith("http"):
                data[key] = request.build_absolute_uri(data[key])
        return data
    
    # Para tanggapin ang partial updates + images via multipart
    def update(self, instance, validated_data):
        return super().update(instance, validated_data)

class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ["code", "name"]

# -----------------------------
# Crime Report (Victim-kept)
# -----------------------------
class CrimeReportMiniSerializer(serializers.ModelSerializer):
    victim_full_name = serializers.CharField(read_only=True)

    class Meta:
        model = CrimeReport
        fields = ["id", "crime_type", "happened_at", "victim_full_name"]

class CrimeReportSerializer(serializers.ModelSerializer):
    """
    Covers all CrimeReport fields, including:
      - Reporting Person: rp_first_name, rp_middle_name, rp_last_name, rp_citizenship,
                          rp_sex, rp_age, rp_place_of_birth, rp_address, rp_occupation, rp_email
      - Victim extras:    v_sex, v_citizenship, v_birthdate, v_place_of_birth, v_occupation
    """
    v_photo_url = serializers.SerializerMethodField(read_only=True)
    suspects = serializers.SerializerMethodField(read_only=True)
    prepared_by_name = serializers.SerializerMethodField()
    
    desk_officer_name = serializers.SerializerMethodField()

    class Meta:
        model = CrimeReport
        fields = "__all__"
        # keep these read-only; allow status/is_archived to be writable
        read_only_fields = ["created_at", "updated_at", "v_photo_url", "suspects","desk_officer","prepared_by"]

    def get_v_photo_url(self, obj):
        request = self.context.get("request")
        if obj.v_photo and hasattr(obj.v_photo, "url"):
            return request.build_absolute_uri(obj.v_photo.url) if request else obj.v_photo.url
        return ""

    def get_suspects(self, obj):
        return [
            {
                "id": s.id,
                "name": " ".join(filter(None, [s.s_first_name, s.s_middle_name, s.s_last_name])),
                "s_crime_type": s.s_crime_type,
            }
            for s in obj.suspects.all()
        ]
    def get_prepared_by_name(self, obj):
        if obj.prepared_by:
            return f"{obj.prepared_by.first_name} {obj.prepared_by.last_name}".strip()
        return None

    def get_desk_officer_name(self, obj):
        if obj.desk_officer:
            return obj.desk_officer.username
        return None

# -----------------------------
# Suspects (separate CRUD)
# -----------------------------
class SuspectSerializer(serializers.ModelSerializer):
    s_photo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Suspect
        fields = [
            "id", "crime_report",
            "s_first_name", "s_middle_name", "s_last_name", "s_age", "s_crime_type",
            "s_address", "s_region", "s_province", "s_city_municipality", "s_city_mun_kind",
            "s_barangay", "s_region_code", "s_province_code", "s_city_mun_code", "s_barangay_code",
            "s_photo", "s_photo_url",
            "loc_address", "loc_region", "loc_province", "loc_city_municipality", "loc_city_mun_kind",
            "loc_barangay", "loc_region_code", "loc_province_code", "loc_city_mun_code", "loc_barangay_code",
            "latitude", "longitude", "loc_kind", "loc_waterbody",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_s_photo_url(self, obj):
        request = self.context.get("request")
        if obj.s_photo and hasattr(obj.s_photo, "url"):
            return request.build_absolute_uri(obj.s_photo.url) if request else obj.s_photo.url
        return ""
    

#############################################

class SendCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()

class VerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(regex=r"^\d{6}$")

class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(regex=r"^\d{6}$")
    new_password = serializers.CharField(min_length=8)

class ForgotSendCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()

class AdminOfficerRegistrationSerializer(serializers.ModelSerializer):
    is_verified = serializers.SerializerMethodField()
    id_image_url = serializers.SerializerMethodField()

    class Meta:
        model = OfficerRegistration
        fields = [
            "id", "email", "badge_no",
            "first_name", "middle_name", "last_name",
            "rank", "station", "address",
            "submitted_at", "expires_at",
            "verification_status", "is_verified",
            "id_image_url",
        ]

    def get_is_verified(self, obj):
        return obj.is_verified

    def get_id_image_url(self, obj):
        request = self.context.get("request")
        return obj.id_image_url(request=request)

class PublicCreateRegistrationSerializer(serializers.ModelSerializer):
    # account fields
    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = OfficerRegistration
        fields = [
            # account
            "username", "password",
            # registration
            "email", "badge_no", "first_name", "middle_name", "last_name",
            "rank", "station", "address", "valid_id",
        ]

    def validate_username(self, v):
        if Personnel.objects.filter(username__iexact=v).exists():
            raise serializers.ValidationError("This username is already taken.")
        return v

    def validate_email(self, v):
        # optional: i-ensure unique across users para iisa lang ang email
        if Personnel.objects.filter(email__iexact=v).exists():
            raise serializers.ValidationError("This email is already used by an account.")
        return v

    def validate(self, attrs):
        if not attrs.get("valid_id"):
            raise serializers.ValidationError({"valid_id": "Valid ID image is required."})
        return attrs

    def create(self, validated):
        from django.utils import timezone
        from datetime import timedelta

        username = validated.pop("username")
        raw_password = validated.pop("password")
        email = validated.get("email")

        # 1) Create the user but INACTIVE and not admin
        user = Personnel.objects.create_user(
            username=username,
            email=email,
            password=raw_password,
            is_active=False,        # 🔒 bawal mag-login hangga't di approved
            is_admin=False,         # regular officer
        )

        # 2) Create the registration row linked to that user
        reg = OfficerRegistration.objects.create(
            user=user,
            expires_at=timezone.now() + timedelta(days=7),
            verification_status=OfficerRegistration.STATUS_PENDING,
            **validated,
        )
        return reg

class PublicOfficerRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = OfficerRegistration
        fields = [
            "id", "email", "first_name", "middle_name", "last_name",
            "badge_no", "rank", "station", "id_image",
            "submitted_at", "expires_at", "verification_status"
        ]
        read_only_fields = ["id", "submitted_at", "expires_at", "verification_status"]

    def validate(self, attrs):
        # sample validations (adjust to your rules)
        if not attrs.get("id_image"):
            raise serializers.ValidationError({"id_image": "Valid ID image is required."})
        return attrs

    def create(self, validated):
        # 7-day review window by default
        validated["expires_at"] = timezone.now() + timedelta(days=7)
        validated["verification_status"] = OfficerRegistration.STATUS_PENDING
        return super().create(validated)

class MyProfileSerializer(serializers.ModelSerializer):
    """
    User-facing serializer for:
      GET/PATCH /api/me/profile/
    Keep fields minimal—add more if you need them on the UI.
    """
    class Meta:
        model = PersonnelProfile
        fields = [
            # identity
            "officer_id", "first_name", "middle_name", "last_name", "suffix",
            "email", "phone",
            # org
            "department", "section",
            # address (residential)
            "residential_address", "residential_barangay",
            "residential_municipality", "residential_province", "residential_region",
            # media
            "id_image", "profile_image",
            # meta
            "is_archived", "created_at", "updated_at",
        ]
        read_only_fields = ("is_archived", "created_at", "updated_at")

class AdminPersonnelProfileSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for:
      GET /api/admin/personnel-profiles/
    """
    class Meta:
        model = PersonnelProfile
        fields = [
            "id",
            "officer_id", "first_name", "middle_name", "last_name",
            "email", "phone", "department", "section",
            "residential_address", "residential_barangay",
            "residential_municipality", "residential_province", "residential_region",
            "is_archived", "created_at", "updated_at",
        ]
        read_only_fields = (
            "id", "officer_id", "first_name", "middle_name", "last_name",
            "email", "phone", "department", "section",
            "residential_address", "residential_barangay",
            "residential_municipality", "residential_province", "residential_region",
            "is_archived", "created_at", "updated_at",
        )

#########################change pass########################
class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = self.context["request"].user
        curr = attrs.get("current_password")
        new = attrs.get("new_password")

        if not curr or not new:
            raise serializers.ValidationError("Both current_password and new_password are required.")

        if not check_password(curr, user.password):
            raise serializers.ValidationError({"current_password": ["Current password is incorrect."]})

        if curr == new:
            raise serializers.ValidationError({"new_password": ["New password must be different from current password."]})

        # Optional: add your own password rules here
        if len(new) < 8:
            raise serializers.ValidationError({"new_password": ["Password must be at least 8 characters."]})

        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        new = self.validated_data["new_password"]
        user.set_password(new)
        user.save()
        return user


class UserSendCodeSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)

    def validate(self, attrs):
        if not (attrs.get("email") or attrs.get("username")):
            raise serializers.ValidationError("Provide email or username.")
        return attrs

class UserVerifyCodeSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)
    code = serializers.RegexField(r"^\d{6}$")

    def validate(self, attrs):
        if not (attrs.get("email") or attrs.get("username")):
            raise serializers.ValidationError("Provide email or username.")
        return attrs

class UserResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)
    code = serializers.RegexField(r"^\d{6}$")
    new_password = serializers.CharField(min_length=8, max_length=128)

    def validate(self, attrs):
        if not (attrs.get("email") or attrs.get("username")):
            raise serializers.ValidationError("Provide email or username.")
        return attrs