from django.urls import path

from .views import CDSSAnalyzeView, CDSSStatusView

urlpatterns = [
    path("analyze/", CDSSAnalyzeView.as_view(), name="cdss-analyze"),
    path("status/", CDSSStatusView.as_view(), name="cdss-status"),
]
