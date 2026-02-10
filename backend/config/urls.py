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
]
