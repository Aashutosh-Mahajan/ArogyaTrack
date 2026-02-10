from django.urls import path

from .views import DispenseMedicineView, DispensingHistoryView, PharmacyDetailView, ScanPrescriptionView

urlpatterns = [
    path("scan-prescription/", ScanPrescriptionView.as_view(), name="scan-prescription"),
    path("dispense-medicine/", DispenseMedicineView.as_view(), name="dispense-medicine"),
    path("dispensing-history/", DispensingHistoryView.as_view(), name="dispensing-history"),
    path("my-pharmacy/", PharmacyDetailView.as_view(), name="pharmacy-detail"),
]
