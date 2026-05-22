"""
Django settings for backend project.
"""

from pathlib import Path
import os
import dj_database_url
from datetime import timedelta
import importlib.util
from decouple import config

# ==========================
# PATHS
# ==========================
BASE_DIR = Path(__file__).resolve().parent.parent

# ==========================
# CORE SETTINGS
# ==========================
SECRET_KEY = config("SECRET_KEY", default="dev-only-change-me")
DEBUG = config("DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = ["*"]

X_FRAME_OPTIONS = "SAMEORIGIN"

# ==========================
# APPS
# ==========================
INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # 3rd party
    "rest_framework",
    "corsheaders",
    "django_filters",
    "rest_framework_simplejwt",  # JWT auth

    # Local
    "api",
]

# ==========================
# MIDDLEWARE
# ==========================
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

# ==========================
# TEMPLATES
# ==========================
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"

# ==========================
# DATABASE
# ==========================
DATABASES = {
    "default": dj_database_url.config(
        default=config("DATABASE_URL"),
        conn_max_age=600,
    )
}

# ==========================
# PASSWORD VALIDATION
# ==========================
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ==========================
# SIMPLE JWT
# ==========================
SIMPLE_JWT = {
    "AUTH_HEADER_TYPES": ("Bearer",),
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# ==========================
# INTERNATIONALIZATION
# ==========================
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Manila"
USE_I18N = True
USE_TZ = True

# ==========================
# STATIC & MEDIA
# ==========================
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ==========================
# DJANGO REST FRAMEWORK
# ==========================
REST_FRAMEWORK = {

    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ],

    # Throttle settings
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        'anon': '3/min',
        "user": "2000/day",
        "forgot": "6/hour",
        "user_forgot": "6/hour",
        "login": "6/hour",
    },
}

# ==========================
# CORS / CSRF
# ==========================
# VITE_ORIGIN = config("VITE_ORIGIN", default="http://localhost:5173")
# VITE_ORIGIN_ALT = config("VITE_ORIGIN_ALT", default="http://127.0.0.1:5173")

# CORS_ALLOWED_ORIGINS = [VITE_ORIGIN, VITE_ORIGIN_ALT]
# CSRF_TRUSTED_ORIGINS = [VITE_ORIGIN, VITE_ORIGIN_ALT]
CORS_ALLOW_ALL_ORIGINS = True

CSRF_TRUSTED_ORIGINS = [
     "https://maritime-gis-system.onrender.com",
]

# ==========================
# AUTH MODEL
# ==========================
AUTH_USER_MODEL = "api.Personnel"

# ==========================
# FRONTEND URLS
# ==========================
FRONTEND_BASE_URL = config(
    "FRONTEND_BASE_URL",
    default="https://maritime-gis-system.onrender.com"
)

FRONTEND_LOGIN_URL = config(
    "FRONTEND_LOGIN_URL",
    default=f"{FRONTEND_BASE_URL}/login"
)

# ==========================
# EMAIL (Gmail SMTP)
# ==========================
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

EMAIL_HOST = "smtp-relay.brevo.com"
DEFAULT_FROM_EMAIL = "maritimecrms@gmail.com"
EMAIL_PORT = 2525
EMAIL_USE_TLS = True
EMAIL_USE_SSL = False

EMAIL_HOST_USER = config("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD")

EMAIL_TIMEOUT = 60

# DEFAULT_FROM_EMAIL = EMAIL_HOST_USER
# EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
# EMAIL_HOST = "smtp.gmail.com"
# EMAIL_PORT =  465
# EMAIL_USE_SSL = True
# EMAIL_USE_TLS = False

# # IMPORTANT — Replace these
# # EMAIL_HOST_USER = "maritimecrms@gmail.com"
# # EMAIL_HOST_PASSWORD = "osqn smyw omnw fyfy"
# EMAIL_HOST_USER = config("EMAIL_HOST_USER")
# EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD")
# EMAIL_TIMEOUT = 10

DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

# ==========================
# TWILIO (optional)
# ==========================
TWILIO_ACCOUNT_SID = config("TWILIO_ACCOUNT_SID", default="")
TWILIO_AUTH_TOKEN = config("TWILIO_AUTH_TOKEN", default="")
TWILIO_FROM_NUMBER = config("TWILIO_FROM_NUMBER", default="")

# ==========================
# LOGGING
# ==========================
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO"},
        "django.request": {"handlers": ["console"], "level": "WARNING"},
    },
}
