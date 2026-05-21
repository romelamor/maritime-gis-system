"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.conf import settings
from django.conf.urls.static import static
from api.views import MeView,PublicOfficerRegistrationViewSet, AdminOfficerRegistrationViewSet,MyProfileView, AdminPersonnelProfileList  # simple checker
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from api.views import (
    AdminPersonnelProfileArchiveView,
    AdminPersonnelProfileDestroyView,
)

router = DefaultRouter()
# Public create
router.register(r"registrations", PublicOfficerRegistrationViewSet, basename="public-registrations")
# Admin verification (you already had this one)
router.register(r"admin/verification/registrations", AdminOfficerRegistrationViewSet, basename="admin-officer-registrations")
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path("auth/me/", MeView.as_view()),
    # ⬇️ USER endpoint
    path("api/me/profile/", MyProfileView.as_view(), name="my-profile"),

    # ⬇️ ADMIN (read-only list)
    path("api/admin/personnel-profiles/", AdminPersonnelProfileList.as_view(), name="admin-personnel-profiles"),
    path("api/admin/personnel-profiles/<int:pk>/archive/", AdminPersonnelProfileArchiveView.as_view(), name="admin-personnel-profile-archive"),
    path("api/admin/personnel-profiles/<int:pk>/", AdminPersonnelProfileDestroyView.as_view(), name="admin-personnel-profile-destroy"),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)