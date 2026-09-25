from django.urls import path

from .views import (
    DispenseMedicineView,
    DispensingHistoryView,
    InvoiceDetailView,
    InvoiceListCreateView,
    PharmacyDashboardStatsView,
    PrescriptionBillingView,
    PharmacyDetailView,
    PharmacyListView,
    PharmacyScanPatientView,
    ScanPrescriptionView,
    PharmacyInventoryView,
    PharmacyInventoryItemView,
    UpdateStockView,
)

urlpatterns = [
    path("scan-prescription/", ScanPrescriptionView.as_view(), name="scan-prescription"),
    path("scan-patient/", PharmacyScanPatientView.as_view(), name="scan-patient"),
    path("dispense-medicine/", DispenseMedicineView.as_view(), name="dispense-medicine"),
    path("dispensing-history/", DispensingHistoryView.as_view(), name="dispensing-history"),
    path("inventory/", PharmacyInventoryView.as_view(), name="inventory"),
    path("inventory/<uuid:item_id>/", PharmacyInventoryItemView.as_view(), name="inventory-item"),
    path("update-stock/", UpdateStockView.as_view(), name="update-stock"),
    path("my-pharmacy/", PharmacyDetailView.as_view(), name="pharmacy-detail"),
    path("dashboard-stats/", PharmacyDashboardStatsView.as_view(), name="dashboard-stats"),
    path("list/", PharmacyListView.as_view(), name="pharmacy-list"),
    path("billing/<uuid:prescription_id>/", PrescriptionBillingView.as_view(), name="prescription-billing"),
    path("invoices/", InvoiceListCreateView.as_view(), name="invoices"),
    path("invoices/<uuid:invoice_id>/", InvoiceDetailView.as_view(), name="invoice-detail"),
]
