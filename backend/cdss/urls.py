from django.urls import path

from .views import CDSSAnalyzeView

urlpatterns = [
    path("analyze/", CDSSAnalyzeView.as_view(), name="cdss-analyze"),
]
