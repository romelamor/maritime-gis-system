from django.contrib.auth.models import AbstractUser, Permission, Group
from django.db import models, IntegrityError
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
import random
from datetime import date

class Personnel(AbstractUser):
    badge_number = models.CharField(max_length=6, unique=True, null=True, blank=True)
    id_image = models.ImageField(upload_to='ids/', null=True, blank=True)
    is_admin = models.BooleanField(default=False)

    # Override these fields to fix the conflict
    groups = models.ManyToManyField(
        Group,
        related_name='personnel_groups',
        blank=True
    )
    user_permissions = models.ManyToManyField(
        Permission,
        related_name='personnel_permissions',
        blank=True
    )

    def __str__(self):
        return self.username


OCCUPATION_CHOICES = [
    ("Housewife", "Housewife"),
    ("Employed", "Employed"),
    ("Self-Employed", "Self-Employed"),
    ("OFW", "OFW"),
]


class PersonnelProfile(models.Model):
    # LINK to the logged-in user
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="personnel_profile",
        null=True, blank=True,
    )
    # Basic
    id_image = models.ImageField(upload_to='ids/', null=True, blank=True)
    first_name = models.CharField(max_length=150)
    middle_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150)
    suffix = models.CharField(max_length=50, blank=True)
    officer_id = models.CharField(max_length=100, unique=True)  # badge number
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)

    # Academic / other
    department = models.CharField(max_length=150, blank=True)
    section = models.CharField(max_length=150, blank=True)
    sex = models.CharField(max_length=50, blank=True)
    gender = models.CharField(max_length=50, blank=True)
    height = models.CharField(max_length=50, blank=True)
    weight = models.CharField(max_length=50, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    birth_place = models.CharField(max_length=255, blank=True)
    officer_type = models.CharField(max_length=100, blank=True)
    regular_officer = models.CharField(max_length=100, blank=True)
    civil_status = models.CharField(max_length=50, blank=True)
    nationality = models.CharField(max_length=100, blank=True)
    religion = models.CharField(max_length=100, blank=True)

    # Special categories
    lifelong_learner = models.BooleanField(default=False)
    indigenous = models.BooleanField(default=False)

    # Addresses
    residential_address = models.TextField(blank=True)
    residential_region = models.CharField(max_length=100, blank=True)
    residential_province = models.CharField(max_length=100, blank=True)
    residential_municipality = models.CharField(max_length=100, blank=True)
    residential_barangay = models.CharField(max_length=100, blank=True)

    permanent_address = models.TextField(blank=True)
    permanent_region = models.CharField(max_length=100, blank=True)
    permanent_province = models.CharField(max_length=100, blank=True)
    permanent_municipality = models.CharField(max_length=100, blank=True)
    permanent_barangay = models.CharField(max_length=100, blank=True)

    # Profile image
    profile_image = models.ImageField(upload_to="profiles/", null=True, blank=True)

    # Father's background
    father_first_name = models.CharField(max_length=150, blank=True)
    father_middle_name = models.CharField(max_length=150, blank=True)
    father_last_name = models.CharField(max_length=150, blank=True)
    father_occupation = models.CharField(max_length=50, choices=OCCUPATION_CHOICES, blank=True)
    father_dob = models.DateField(null=True, blank=True)
    father_contact = models.CharField(max_length=50, blank=True)
    father_region = models.CharField(max_length=100, blank=True)
    father_province = models.CharField(max_length=100, blank=True)
    father_municipality = models.CharField(max_length=100, blank=True)
    father_barangay = models.CharField(max_length=100, blank=True)

    # Mother's background
    mother_first_name = models.CharField(max_length=150, blank=True)
    mother_middle_name = models.CharField(max_length=150, blank=True)
    mother_last_name = models.CharField(max_length=150, blank=True)
    mother_occupation = models.CharField(max_length=50, choices=OCCUPATION_CHOICES, blank=True)
    mother_dob = models.DateField(null=True, blank=True)
    mother_contact = models.CharField(max_length=50, blank=True)
    mother_region = models.CharField(max_length=100, blank=True)
    mother_province = models.CharField(max_length=100, blank=True)
    mother_municipality = models.CharField(max_length=100, blank=True)
    mother_barangay = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_archived = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.officer_id} - {self.first_name} {self.last_name}"


class Region(models.Model):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


# ========= Utilities =========
def generate_blotter_number(prefix="R4A"):
    """
    Example: R4A-20251013-101530-12345
    """
    now = timezone.now()
    stamp = now.strftime("%Y%m%d-%H%M%S")
    rand = f"{random.randint(0, 99999):05d}"
    return f"{prefix}-{stamp}-{rand}"


# ========= Choices =========
CRIME_TYPE_CHOICES = [
    # PIRACY
    ("Piracy", "Piracy (RPC Art. 122 / PD 532)"),
    ("Qualified Piracy", "Qualified Piracy (RPC Art. 123 / RA 7659)"),

    # SMUGGLING
    ("Smuggling", "Smuggling (RA 10863)"),

    # ILLEGAL FISHING
    ("Illegal Fishing", "Illegal Fishing (RA 8550 / RA 10654)"),
    ("Dynamite Fishing", "Dynamite Fishing (RA 8550)"),
    ("Cyanide Fishing", "Cyanide Fishing (RA 8550)"),
    ("Foreign Poaching", "Foreign Poaching (RA 8550)"),

    # ENVIRONMENTAL
    ("Marine Pollution", "Marine Pollution / Oil Spill (PD 979 / RA 9275)"),
    ("Illegal Dumping", "Illegal Waste Dumping (RA 9003)"),
    ("Wildlife Trafficking", "Marine Wildlife Trafficking (RA 9147)"),

    # DRUGS
    ("Drug Trafficking", "Drug Trafficking via Sea (RA 9165)"),

    # HUMAN TRAFFICKING
    ("Human Trafficking", "Human Trafficking (RA 9208 / RA 10364)"),

    # FIREARMS
    ("Illegal Firearms", "Illegal Possession of Firearms (RA 10591)"),

    # TERRITORIAL
    ("Unauthorized Entry", "Unauthorized Foreign Vessel Entry (RA 12064)"),

    # SAFETY
    ("Overloading", "Overloading Vessel (RA 9993)"),
    ("No Safety Equipment", "No Safety Equipment (RA 9993)"),
    ("Unregistered Vessel", "Unregistered Vessel (MARINA Laws)"),

    # VESSEL CRIMES
    ("Ship Hijacking", "Ship Hijacking / Vessel Seizure"),
    ("Vessel Theft", "Vessel Theft"),

    # VIOLENCE
    ("Kidnapping", "Kidnapping at Sea (RPC)"),
    ("Murder", "Murder / Homicide at Sea (RPC)"),

    # INCIDENTS (NON-CRIME BUT IMPORTANT)
    ("Missing Fisherman", "Missing Fisherman / SAR Incident"),
    ("Maritime Accident", "Maritime Accident / Collision"),

    # FALLBACK
    ("Others", "Others (Specify)"),
]


# ========= Upload paths =========
def victim_upload_to(instance, filename):
    return f"victims/{instance.pk or 'new'}/{filename}"


def suspect_upload_to(instance, filename):
    return f"suspects/{instance.pk or 'new'}/{filename}"


# ========= Models =========
class CrimeReport(models.Model):
    STATUS_CHOICES = [
        ("Ongoing", "Ongoing"),
        ("Solved", "Solved"),
        ("Unsolved", "Unsolved"),
    ]

    # ======== Case meta ========
    blotter_number = models.CharField(
        max_length=64,
        unique=True,
        blank=True,
        help_text="Unique blotter number (server-generated if blank).",
    )
    crime_type = models.CharField(max_length=100, blank=True, default="", choices=CRIME_TYPE_CHOICES)
    description = models.TextField(blank=True, default="")
    happened_at = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Ongoing")

    prepared_by = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name='prepared_reports'
    )

    desk_officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='encoded_reports'
    )

    reported_by = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )

    # ======== Reporting Person ========
    rp_birthdate = models.DateField(null=True, blank=True)
    rp_age = models.PositiveIntegerField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if self.rp_birthdate:
            today = date.today()
            self.rp_age = (
                today.year
                - self.rp_birthdate.year
                - (
                    (today.month, today.day)
                    < (self.rp_birthdate.month, self.rp_birthdate.day)
                )
            )
        super().save(*args, **kwargs)
    rp_first_name = models.CharField(max_length=120, blank=True, default="")
    rp_middle_name = models.CharField(max_length=120, blank=True, default="")
    rp_last_name = models.CharField(max_length=120, blank=True, default="")
    rp_citizenship = models.CharField(max_length=120, blank=True, default="")
    rp_sex = models.CharField(max_length=20, blank=True, default="")
    rp_age = models.CharField(max_length=10, blank=True, default="")
    rp_place_of_birth = models.CharField(max_length=255, blank=True, default="")
    rp_address = models.CharField(max_length=255, blank=True, default="")
    rp_occupation = models.CharField(max_length=120, blank=True, default="")
    rp_email = models.EmailField(blank=True, default="")

    # ======== Victim ========
    v_first_name = models.CharField(max_length=120, blank=True, default="")
    v_middle_name = models.CharField(max_length=120, blank=True, default="")
    v_last_name = models.CharField(max_length=120, blank=True, default="")
    v_age = models.CharField(max_length=10, blank=True, default="")

    v_sex = models.CharField(max_length=20, blank=True, default="")
    v_citizenship = models.CharField(max_length=120, blank=True, default="")
    v_birthdate = models.DateField(null=True, blank=True)
    v_place_of_birth = models.CharField(max_length=255, blank=True, default="")
    v_occupation = models.CharField(max_length=120, blank=True, default="")

    # Victim address (structured)
    v_address = models.CharField(max_length=255, blank=True, default="")
    v_region = models.CharField(max_length=120, blank=True, default="")
    v_province = models.CharField(max_length=120, blank=True, default="")
    v_city_municipality = models.CharField(max_length=120, blank=True, default="")
    v_city_mun_kind = models.CharField(max_length=30, blank=True, default="")
    v_barangay = models.CharField(max_length=120, blank=True, default="")
    v_region_code = models.CharField(max_length=20, blank=True, default="")
    v_province_code = models.CharField(max_length=20, blank=True, default="")
    v_city_mun_code = models.CharField(max_length=20, blank=True, default="")
    v_barangay_code = models.CharField(max_length=20, blank=True, default="")

    v_photo = models.ImageField(upload_to=victim_upload_to, null=True, blank=True)

    # ======== Incident location ========
    loc_address = models.CharField(max_length=255, blank=True, default="")
    loc_region = models.CharField(max_length=120, blank=True, default="")
    loc_province = models.CharField(max_length=120, blank=True, default="")
    loc_city_municipality = models.CharField(max_length=120, blank=True, default="")
    loc_city_mun_kind = models.CharField(max_length=30, blank=True, default="")
    loc_barangay = models.CharField(max_length=120, blank=True, default="")
    loc_region_code = models.CharField(max_length=20, blank=True, default="")
    loc_province_code = models.CharField(max_length=20, blank=True, default="")
    loc_city_mun_code = models.CharField(max_length=20, blank=True, default="")
    loc_barangay_code = models.CharField(max_length=20, blank=True, default="")

    latitude = models.CharField(max_length=50, blank=True, default="")
    longitude = models.CharField(max_length=50, blank=True, default="")
    loc_kind = models.CharField(max_length=20, blank=True, default="")  # marine|coastal|inland|unknown
    loc_waterbody = models.CharField(max_length=120, blank=True, default="")

    # ======== Admin meta ========
    is_archived = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["blotter_number"]),
            models.Index(fields=["is_archived", "created_at"]),
        ]

    @property
    def victim_full_name(self):
        return " ".join(filter(None, [self.v_first_name, self.v_middle_name, self.v_last_name]))

    def __str__(self):
        label = self.crime_type or "Incident"
        who = self.victim_full_name or "Unknown victim"
        bn = f" [{self.blotter_number}]" if self.blotter_number else ""
        return f"{label} - {who}{bn}"

    def _ensure_unique_blotter(self):
        if self.blotter_number:
            return
        candidate = generate_blotter_number("R4A")
        while CrimeReport.objects.filter(blotter_number=candidate).exists():
            candidate = generate_blotter_number("R4A")
        self.blotter_number = candidate

    def save(self, *args, **kwargs):
        if not self.blotter_number:
            self._ensure_unique_blotter()
        tries = 3
        for i in range(tries):
            try:
                return super().save(*args, **kwargs)
            except IntegrityError as e:
                if "blotter_number" in str(e).lower() and i < tries - 1:
                    self.blotter_number = ""
                    self._ensure_unique_blotter()
                    continue
                raise


class Suspect(models.Model):
    """Separate CRUD: many suspects per crime report."""
    crime_report = models.ForeignKey(CrimeReport, on_delete=models.CASCADE, related_name="suspects")

    # Suspect identity
    s_first_name = models.CharField(max_length=120, blank=True, default="")
    s_middle_name = models.CharField(max_length=120, blank=True, default="")
    s_last_name = models.CharField(max_length=120, blank=True, default="")
    s_age = models.CharField(max_length=10, blank=True, default="")
    s_crime_type = models.CharField(max_length=100, blank=True, default="")

    # Suspect address
    s_address = models.CharField(max_length=255, blank=True, default="")
    s_region = models.CharField(max_length=120, blank=True, default="")
    s_province = models.CharField(max_length=120, blank=True, default="")
    s_city_municipality = models.CharField(max_length=120, blank=True, default="")
    s_city_mun_kind = models.CharField(max_length=30, blank=True, default="")
    s_barangay = models.CharField(max_length=120, blank=True, default="")
    s_region_code = models.CharField(max_length=20, blank=True, default="")
    s_province_code = models.CharField(max_length=20, blank=True, default="")
    s_city_mun_code = models.CharField(max_length=20, blank=True, default="")
    s_barangay_code = models.CharField(max_length=20, blank=True, default="")

    s_photo = models.ImageField(upload_to=suspect_upload_to, null=True, blank=True)

    # Crime Location (optional for suspect form)
    loc_address = models.CharField(max_length=255, blank=True, default="")
    loc_region = models.CharField(max_length=120, blank=True, default="")
    loc_province = models.CharField(max_length=120, blank=True, default="")
    loc_city_municipality = models.CharField(max_length=120, blank=True, default="")
    loc_city_mun_kind = models.CharField(max_length=30, blank=True, default="")
    loc_barangay = models.CharField(max_length=120, blank=True, default="")
    loc_region_code = models.CharField(max_length=20, blank=True, default="")
    loc_province_code = models.CharField(max_length=20, blank=True, default="")
    loc_city_mun_code = models.CharField(max_length=20, blank=True, default="")
    loc_barangay_code = models.CharField(max_length=20, blank=True, default="")

    latitude = models.CharField(max_length=50, blank=True, default="")
    longitude = models.CharField(max_length=50, blank=True, default="")
    loc_kind = models.CharField(max_length=20, blank=True, default="")
    loc_waterbody = models.CharField(max_length=120, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def suspect_full_name(self):
        return " ".join(filter(None, [self.s_first_name, self.s_middle_name, self.s_last_name]))

    def __str__(self):
        return f"{self.suspect_full_name or 'Suspect'} in case [{self.crime_report.blotter_number or self.crime_report_id}]"


########################
User = get_user_model()


class AdminProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="admin_profile")
    reset_code_hash = models.CharField(max_length=128, blank=True, null=True)
    code_expiry = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"AdminProfile<{self.user.email or self.user.username}>"

    @property
    def has_active_code(self):
        return bool(self.reset_code_hash and self.code_expiry and timezone.now() < self.code_expiry)

    def clear_code(self):
        self.reset_code_hash = None
        self.code_expiry = None
        self.save(update_fields=["reset_code_hash", "code_expiry"])


class OfficerRegistration(models.Model):
    STATUS_PENDING = "pending"
    STATUS_REQUEST_INFO = "request_info"
    STATUS_REJECTED = "rejected"
    STATUS_APPROVED = "approved"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_REQUEST_INFO, "Request Info"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_APPROVED, "Approved"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="officer_registration"
    )

    email = models.EmailField()
    badge_no = models.CharField(max_length=64)
    first_name = models.CharField(max_length=128)
    middle_name = models.CharField(max_length=128, blank=True, default="")
    last_name = models.CharField(max_length=128)
    rank = models.CharField(max_length=64, blank=True, default="")
    station = models.CharField(max_length=128, blank=True, default="")
    address = models.TextField(blank=True, default="")
    valid_id = models.ImageField(upload_to="ids/", blank=True, null=True)

    submitted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(blank=True, null=True)

    verification_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    verified_at = models.DateTimeField(blank=True, null=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="verified_officers"
    )
    request_note = models.TextField(blank=True, default="")
    rejection_reason = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["badge_no"]),
            models.Index(fields=["verification_status"]),
        ]

    def save(self, *args, **kwargs):
        if not self.pk and not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=7)
        super().save(*args, **kwargs)

    @property
    def is_verified(self):
        return self.verification_status == self.STATUS_APPROVED

    def id_image_url(self, request=None):
        if self.valid_id and hasattr(self.valid_id, "url"):
            url = self.valid_id.url
            return request.build_absolute_uri(url) if request else url
        return ""


# ========= forgot password =========
class PasswordResetOTP(models.Model):
    email = models.EmailField(db_index=True)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    @classmethod
    def create_otp(cls, email, code_lifetime_minutes=10):
        import secrets
        code = f"{secrets.randbelow(10**6):06d}"  # 6-digit
        now = timezone.now()
        return cls.objects.create(
            email=email,
            code=code,
            expires_at=now + timedelta(minutes=code_lifetime_minutes),
        )

    def is_expired(self):
        return timezone.now() > self.expires_at


class EmailOTP(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="email_otps")
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    purpose = models.CharField(max_length=50, default="login")

    def is_valid(self):
        now = timezone.now()
        return (not self.is_used) and now <= self.expires_at

    def __str__(self):
        return f"EmailOTP<{self.user.username} - {self.purpose}>"
