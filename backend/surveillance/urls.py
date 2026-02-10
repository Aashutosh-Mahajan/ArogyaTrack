from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'regions', views.RegionViewSet,basename='region')
router.register(r'surveillance-data', views.SurveillanceDataViewSet, basename='surveillance-data')
router.register(r'clusters', views.ClusterViewSet, basename='cluster')
router.register(r'forecasts', views.ForecastViewSet, basename='forecast')
router.register(r'anomalies', views.AnomalyViewSet, basename='anomaly')
router.register(r'risk-scores', views.RiskScoreViewSet, basename='risk-score')
router.register(r'consents', views.ConsentViewSet, basename='consent')
router.register(r'alerts', views.AlertViewSet, basename='alert')
router.register(r'notifications', views.NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
    path('heat-map/', views.heat_map_data, name='heat-map'),
    path('disease-statistics/', views.disease_statistics, name='disease-statistics'),
    path('regional-comparison/', views.regional_comparison, name='regional-comparison'),
    path('dashboard-overview/', views.dashboard_overview, name='dashboard-overview'),
]
