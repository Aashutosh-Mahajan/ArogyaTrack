from django.urls import path

from .views import (
    DispenseMedicineView,
    DispensingHistoryView,
    PharmacyDashboardStatsView,
    PharmacyDetailView,
    PharmacyListView,
    PharmacyScanPatientView,
    ScanPrescriptionView,
    PharmacyInventoryView,
    UpdateStockView,
)

urlpatterns = [
    path("scan-prescription/", ScanPrescriptionView.as_view(), name="scan-prescription"),
    path("scan-patient/", PharmacyScanPatientView.as_view(), name="scan-patient"),
    path("dispense-medicine/", DispenseMedicineView.as_view(), name="dispense-medicine"),
    path("dispensing-history/", DispensingHistoryView.as_view(), name="dispensing-history"),
    path("inventory/", PharmacyInventoryView.as_view(), name="inventory"),
    path("update-stock/", UpdateStockView.as_view(), name="update-stock"),
    path("my-pharmacy/", PharmacyDetailView.as_view(), name="pharmacy-detail"),
    path("dashboard-stats/", PharmacyDashboardStatsView.as_view(), name="dashboard-stats"),
    path("list/", PharmacyListView.as_view(), name="pharmacy-list"),
]
