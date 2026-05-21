# utils.py
import random
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from django.core.mail import send_mail
import logging

import pyotp
import base64
import qrcode
from io import BytesIO


logger = logging.getLogger(__name__)


def generate_totp_secret():
    return pyotp.random_base32()

def generate_otpauth_uri(secret, username, issuer="PNP-Maritime-CRMS"):
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=issuer)

def generate_qr_code_base64(otpauth_url):
    img = qrcode.make(otpauth_url)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{qr_base64}"


# ===========================
# GENERIC EMAIL SENDER (Gmail SMTP)
# ===========================
def email(subject, message, to_email):
    """
    Basic email sender using Django's send_mail().
    Used for approve/reject notifications.
    """
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            fail_silently=False,
        )
        logger.info("Email successfully sent to %s", to_email)

    except Exception as e:
        logger.exception("Email send failed: %s", e)


# ===========================
# SAFE EMAIL (Fail gracefully)
# ===========================
def safe_email(subject, message, to_email):
    """
    Same as email() but does NOT raise errors.
    Prevents 500 errors during live operations.
    """
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            fail_silently=True,
        )
        logger.info("Safe email sent to %s", to_email)

    except Exception as e:
        logger.error("Safe email failed: %s", e)


# ===========================
# OTP GENERATION
# ===========================
def generate_otp():
    """Generate a 6-digit OTP string."""
    return f"{random.randint(0, 999999):06d}"


def otp_expiry():
    """Sets OTP expiry time (default: 5 minutes)."""
    ttl = getattr(settings, "PASSWORD_RESET_OTP_TTL_MINUTES", 5)
    return timezone.now() + timedelta(minutes=ttl)


# ===========================
# OTP EMAIL SENDER (FORGOT PASSWORD)
# ===========================
def send_reset_email(to_email, username, code):
    """
    Sends the OTP code for Forgot Password using Gmail SMTP.
    """
    subject = "Your Password Reset Code"
    message = (
        f"Hello {username},\n\n"
        f"Your OTP code is: {code}\n"
        f"This code will expire shortly.\n\n"
        f"— PNP Maritime CRMS"
    )

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            fail_silently=False,
        )
        logger.info("Reset OTP sent to %s", to_email)
        return True

    except Exception as e:
        logger.exception("Failed to send OTP reset email: %s", e)
        return False
