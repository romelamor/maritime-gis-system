from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework.routers import DefaultRouter

from . import views
from .views import (
    # === Auth / JWT ===
    RegisterView,
    MyTokenObtainPairView,       # may is_admin
    CustomTokenObtainPairView,
    UserLoginView,
    AdminLoginView,

    # === Crime & Suspect simple list/create ===
    CrimeReportListCreateView,
    SuspectListCreateView,

    # === Forgot password (luma + bago) ===
    SendResetCodeView,
    VerifyResetCodeView,
    ResetPasswordView,
    AdminForgotSendCodeView,
    UserForgotSendCodeView,
    UserForgotVerifyCodeView,
    UserForgotResetPasswordView,

    # === Analytics ===
    analytics_series_json,
    analytics_line_png,
    analytics_bar_png,
    analytics_heatmap_html,

    # === Profiles / regions ===
    RegionListAPIView,
    MeProfileView,
    MeView,                       # /api/auth/me/
    ChangePasswordView,

    # === 2FA (ADMIN) – EMAIL OTP ONLY ===
    AdminLogin2FA,                # forced 2FA login (step 1)
    Verify2FA,                   # OTP verify (step 2)

    UserLoginOTPInitView,
    UserLoginOTPVerifyView,
    create_admin,

    # === ViewSets for router ===
    PersonnelProfileViewSet,
    CrimeReportViewSet,
    SuspectViewSet,
    PublicRegistrationViewSet,
    AdminOfficerRegistrationViewSet,
    AdminUserAccountViewSet,
    analytics_breakdown_json,
    analytics_heatmap_html,
    AdminLoginOTPInitView,
    AdminLoginOTPVerifyView
)
from .views import VerifyAdminOTP

urlpatterns = [
    # ================== BASIC AUTH / JWT ==================
    path("login/", CustomTokenObtainPairView.as_view(), name="custom_login"),
    path("user/login/", UserLoginView.as_view(), name="user_login"),
    path("admin/login/", AdminLoginView.as_view(), name="admin_login"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("register/", RegisterView.as_view(), name="register"),

    # JWT login (generic)
    path("api/login/", MyTokenObtainPairView.as_view(), name="token_obtain_pair"),

    # ================== REGIONS / PERSONNEL ==================
    path("api/regions/", RegionListAPIView.as_view(), name="regions-list"),

    path("api/personnel/<int:pk>/archive/", views.archive_personnel, name="archive_personnel"),
    path("personnel/me/", MeProfileView.as_view(), name="personnel-me"),

    # ================== CRIMES / SUSPECTS (simple list/create) ==================
    path("api/crimes/", CrimeReportListCreateView.as_view(), name="crime-list"),
    path("api/suspects/", SuspectListCreateView.as_view(), name="suspect-list"),

    # ================== ADMIN FORGOT PASSWORD (OLD FLOW) ==================
    path("admin/forgot/send-code/", SendResetCodeView.as_view(), name="admin-send-code"),
    path("admin/forgot/verify-code/", VerifyResetCodeView.as_view(), name="admin-verify-code"),
    path("admin/forgot/reset-password/", ResetPasswordView.as_view(), name="admin-reset-password"),

    # ================== ADMIN FORGOT PASSWORD (NEW OTP MODEL) ==================
    path("admin/forgot/send-code-v2/", AdminForgotSendCodeView.as_view(), name="admin-forgot-send-code"),

    # ================== USER FORGOT PASSWORD ==================
    path("user/forgot/send-code/", UserForgotSendCodeView.as_view(), name="user-forgot-send"),
    path("user/forgot/verify-code/", UserForgotVerifyCodeView.as_view(), name="user-forgot-verify"),
    path("user/forgot/reset-password/", UserForgotResetPasswordView.as_view(), name="user-forgot-reset"),

    # ================== USER ACCOUNT ==================
    path("user/change-password/", ChangePasswordView.as_view(), name="user-change-password"),

    # ================== ANALYTICS (charts / heatmap) ==================
    path("analytics/series/", analytics_series_json),
    path("analytics/line.png", analytics_line_png),
    path("analytics/bar.png", analytics_bar_png),
    path("analytics/heatmap/", analytics_heatmap_html),
    path("api/analytics/series/", views.analytics_series_json),
    path("analytics/series/", analytics_series_json, name="analytics-series"),
    path("analytics/breakdown/", analytics_breakdown_json, name="analytics-breakdown"),

    # ======== ADMIN 2FA (EMAIL OTP, NO MORE GOOGLE AUTH) ========
    # Frontend: POST http://127.0.0.1:8000/api/auth/login-2fa/
    path("auth/login-2fa/", AdminLogin2FA.as_view(), name="admin-login-2fa"),
    path("auth/2fa/verify/", Verify2FA.as_view(), name="admin-verify-2fa"),

    path("user/login-otp/", UserLoginOTPInitView.as_view(), name="user-login-otp"),
    path("user/login-otp/verify/", UserLoginOTPVerifyView.as_view(), name="user-login-otp-verify"),

    # Current user info for frontend
    path("auth/me/", MeView.as_view(), name="auth-me"),

    path("utils/nominatim/search/", views.nominatim_search),
    path("utils/nominatim/reverse/", views.nominatim_reverse),
    path("create-admin/", create_admin),
    path("auth/2fa/verify/", VerifyAdminOTP.as_view()),
    path(
    "api/auth/admin/login-2fa/",
    AdminLoginOTPInitView.as_view(),),
    path(
    "api/auth/admin/2fa/verify/",
    AdminLoginOTPVerifyView.as_view(),)

]

# ================== ROUTER (ViewSets) ==================
router = DefaultRouter()
router.register(r"admin/users", AdminUserAccountViewSet, basename="admin-users")
router.register(r"personnel", PersonnelProfileViewSet, basename="personnel")
router.register(r"crimes",   CrimeReportViewSet, basename="crime")
router.register(r"suspects", SuspectViewSet,     basename="suspect")
router.register(r"registrations", PublicRegistrationViewSet, basename="public-registrations")
router.register(
    r"admin/verification/registrations",
    AdminOfficerRegistrationViewSet,
    basename="admin-officer-registrations",
)

urlpatterns += router.urls
