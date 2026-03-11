from django.urls import path

from .views import (
    AlertDetailView,
    ChangePasswordView,
    DashboardAlertsView,
    DashboardKPIView,
    DashboardSummaryView,
    DownloadAllView,
    DownloadFileView,
    DownloadListView,
    HealthTrendsView,
    LabMonitoringView,
    LogDownloadView,
    RecentRecordsView,
    SecuritySettingsView,
    Toggle2FAView,
)

urlpatterns = [
    path("summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("kpis/", DashboardKPIView.as_view(), name="dashboard-kpis"),
    path("recent-records/", RecentRecordsView.as_view(), name="dashboard-recent-records"),
    path("lab-monitoring/", LabMonitoringView.as_view(), name="dashboard-lab-monitoring"),
    path("health-trends/", HealthTrendsView.as_view(), name="dashboard-health-trends"),
    path("alerts/", DashboardAlertsView.as_view(), name="dashboard-alerts"),
    path("alerts/<uuid:alert_id>/", AlertDetailView.as_view(), name="dashboard-alert-detail"),
    # Security
    path("security/", SecuritySettingsView.as_view(), name="dashboard-security"),
    path("change-password/", ChangePasswordView.as_view(), name="dashboard-change-password"),
    path("toggle-2fa/", Toggle2FAView.as_view(), name="dashboard-toggle-2fa"),
    # Downloads
    path("downloads/", DownloadListView.as_view(), name="dashboard-downloads"),
    path("log-download/", LogDownloadView.as_view(), name="dashboard-log-download"),
    path("download/<int:file_id>/", DownloadFileView.as_view(), name="dashboard-download-file"),
    path("download-all/", DownloadAllView.as_view(), name="dashboard-download-all"),
]
