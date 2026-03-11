from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/patients/", include("patients.urls")),
    path("api/doctors/", include("medical.urls")),
    path("api/prescriptions/", include("prescriptions.urls")),
    path("api/pharmacy/", include("pharmacy.urls")),
    path("api/adherence/", include("adherence.urls")),
    path("api/surveillance/", include("surveillance.urls")),
    path("api/dashboard/", include("dashboard.urls")),
    path("api/cdss/", include("cdss.urls")),
    # Web interface for medical records
    path("medical/", include("medical.web_urls")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
