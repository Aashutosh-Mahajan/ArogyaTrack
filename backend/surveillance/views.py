from datetime import datetime, timedelta
from django.db.models import Count, Avg, Sum, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Region, SurveillanceData, Cluster, Forecast, Anomaly,
    RiskScore, EnvironmentalData, Consent, Alert, Notification
)
from .serializers import (
    RegionSerializer, SurveillanceDataSerializer, ClusterSerializer,
    ForecastSerializer, AnomalySerializer, RiskScoreSerializer,
    EnvironmentalDataSerializer, ConsentSerializer, ConsentActionSerializer,
    AlertSerializer, AlertActionSerializer, NotificationSerializer,
    HeatMapDataSerializer, DiseaseStatisticsSerializer, RegionalComparisonSerializer
)
from .tasks import (
    run_clustering_analysis, generate_forecasts_for_region,
    detect_anomalies_for_region, calculate_risk_scores_for_region,
    evaluate_and_generate_alerts
)
from accounts.models import User


class IsAuthority(IsAuthenticated):
    """Permission for authorities and admins only"""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.role in ['authority', 'admin']


class RegionViewSet(viewsets.ReadOnlyModelViewSet):
    """Region management viewset"""
    queryset = Region.objects.all()
    serializer_class = RegionSerializer
    permission_classes = [IsAuthority]
    
    def get_queryset(self):
        queryset = Region.objects.all()
        
        state = self.request.query_params.get('state')
        district = self.request.query_params.get('district')
        
        if state:
            queryset = queryset.filter(state__icontains=state)
        if district:
            queryset = queryset.filter(district__icontains=district)
        
        return queryset


class SurveillanceDataViewSet(viewsets.ReadOnlyModelViewSet):
    """Surveillance data viewset"""
    queryset = SurveillanceData.objects.all()
    serializer_class = SurveillanceDataSerializer
    permission_classes = [IsAuthority]
    
    def get_queryset(self):
        queryset = SurveillanceData.objects.select_related('region')
        
        # Filters
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        disease_code = self.request.query_params.get('disease_code')
        region_id = self.request.query_params.get('region_id')
        
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        if disease_code:
            queryset = queryset.filter(disease_code=disease_code)
        if region_id:
            queryset = queryset.filter(region_id=region_id)
        
        return queryset.order_by('-date', 'region')
    
    @action(detail=False, methods=['get'])
    def disease_trends(self, request):
        """Get disease trends over time"""
        disease_code = request.query_params.get('disease_code')
        region_id = request.query_params.get('region_id')
        days = int(request.query_params.get('days', 30))
        
        if not disease_code:
            return Response({'error': 'disease_code is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        start_date = timezone.now().date() - timedelta(days=days)
        
        queryset = SurveillanceData.objects.filter(
            disease_code=disease_code,
            date__gte=start_date
        )
        
        if region_id:
            queryset = queryset.filter(region_id=region_id)
        
        # Group by date
        trends = queryset.values('date').annotate(
            total_cases=Sum('case_count'),
            avg_severity=Avg('average_severity'),
            regions_affected=Count('region', distinct=True)
        ).order_by('date')
        
        return Response(trends)


class ClusterViewSet(viewsets.ReadOnlyModelViewSet):
    """Disease cluster viewset"""
    queryset = Cluster.objects.all()
    serializer_class = ClusterSerializer
    permission_classes = [IsAuthority]
    
    def get_queryset(self):
        queryset = Cluster.objects.prefetch_related('regions__region')
        
        disease_code = self.request.query_params.get('disease_code')
        date = self.request.query_params.get('date')
        is_active = self.request.query_params.get('is_active')
        severity = self.request.query_params.get('severity')
        
        if disease_code:
            queryset = queryset.filter(disease_code=disease_code)
        if date:
            queryset = queryset.filter(detection_date=date)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        if severity:
            queryset = queryset.filter(severity=severity)
        
        return queryset.order_by('-detection_date', '-severity')
    
    @action(detail=False, methods=['post'])
    def run_clustering(self, request):
        """Trigger clustering analysis"""
        disease_code = request.data.get('disease_code')
        
        if not disease_code:
            return Response({'error': 'disease_code is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Run async task
        task = run_clustering_analysis.delay(disease_code)
        
        return Response({
            'message': 'Clustering analysis started',
            'task_id': task.id,
            'disease_code': disease_code
        })


class ForecastViewSet(viewsets.ReadOnlyModelViewSet):
    """Disease forecast viewset"""
    queryset = Forecast.objects.all()
    serializer_class = ForecastSerializer
    permission_classes = [IsAuthority]
    
    def get_queryset(self):
        queryset = Forecast.objects.select_related('region')
        
        disease_code = self.request.query_params.get('disease_code')
        region_id = self.request.query_params.get('region_id')
        prediction_date = self.request.query_params.get('prediction_date')
        horizon = self.request.query_params.get('horizon')
        
        if disease_code:
            queryset = queryset.filter(disease_code=disease_code)
        if region_id:
            queryset = queryset.filter(region_id=region_id)
        if prediction_date:
            queryset = queryset.filter(prediction_date=prediction_date)
        if horizon:
            queryset = queryset.filter(horizon_days=int(horizon))
        
        return queryset.order_by('-forecast_date', 'prediction_date')
    
    @action(detail=False, methods=['post'])
    def generate_forecast(self, request):
        """Trigger forecast generation"""
        region_id = request.data.get('region_id')
        disease_code = request.data.get('disease_code')
        horizon_days = int(request.data.get('horizon_days', 7))
        
        if not region_id or not disease_code:
            return Response(
                {'error': 'region_id and disease_code are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Run async task
        task = generate_forecasts_for_region.delay(region_id, disease_code, horizon_days)
        
        return Response({
            'message': 'Forecast generation started',
            'task_id': task.id,
            'region_id': region_id,
            'disease_code': disease_code
        })


class AnomalyViewSet(viewsets.ReadOnlyModelViewSet):
    """Anomaly detection viewset"""
    queryset = Anomaly.objects.all()
    serializer_class = AnomalySerializer
    permission_classes = [IsAuthority]
    
    def get_queryset(self):
        queryset = Anomaly.objects.select_related('region')
        
        disease_code = self.request.query_params.get('disease_code')
        region_id = self.request.query_params.get('region_id')
        is_resolved = self.request.query_params.get('is_resolved')
        
        if disease_code:
            queryset = queryset.filter(disease_code=disease_code)
        if region_id:
            queryset = queryset.filter(region_id=region_id)
        if is_resolved is not None:
            queryset = queryset.filter(is_resolved=is_resolved.lower() == 'true')
        
        return queryset.order_by('-detection_date', '-anomaly_score')
    
    @action(detail=True, methods=['post'])
    def mark_resolved(self, request, pk=None):
        """Mark anomaly as resolved"""
        anomaly = self.get_object()
        anomaly.is_resolved = True
        anomaly.save()
        
        return Response({'message': 'Anomaly marked as resolved'})


class RiskScoreViewSet(viewsets.ReadOnlyModelViewSet):
    """Risk score viewset"""
    queryset = RiskScore.objects.all()
    serializer_class = RiskScoreSerializer
    permission_classes = [IsAuthority]
    
    def get_queryset(self):
        queryset = RiskScore.objects.select_related('region')
        
        disease_code = self.request.query_params.get('disease_code')
        region_id = self.request.query_params.get('region_id')
        risk_level = self.request.query_params.get('risk_level')
        
        if disease_code:
            queryset = queryset.filter(disease_code=disease_code)
        if region_id:
            queryset = queryset.filter(region_id=region_id)
        if risk_level is not None:
            queryset = queryset.filter(risk_level=int(risk_level))
        
        return queryset.order_by('-calculation_date', '-risk_level')


class ConsentViewSet(viewsets.ModelViewSet):
    """Patient consent viewset"""
    queryset = Consent.objects.all()
    serializer_class = ConsentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Patients can only see their own consents
        if self.request.user.role == 'patient':
            profile_ids = self.request.user.profiles.values_list('id', flat=True)
            return Consent.objects.filter(profile_id__in=profile_ids)
        
        # Authorities can see all
        return Consent.objects.all()
    
    @action(detail=True, methods=['post'])
    def grant(self, request, pk=None):
        """Grant consent"""
        consent = self.get_object()
        signature_data = request.data.get('signature_data', '')
        
        consent.grant(signature_data)
        
        return Response({
            'message': 'Consent granted',
            'consent': ConsentSerializer(consent).data
        })
    
    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke consent"""
        consent = self.get_object()
        
        consent.revoke()
        
        return Response({
            'message': 'Consent revoked',
            'consent': ConsentSerializer(consent).data
        })


class AlertViewSet(viewsets.ModelViewSet):
    """Alert management viewset"""
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer
    permission_classes = [IsAuthority]
    
    def get_queryset(self):
        queryset = Alert.objects.prefetch_related('affected_regions')
        
        disease_code = self.request.query_params.get('disease_code')
        severity = self.request.query_params.get('severity')
        status_param = self.request.query_params.get('status')
        
        if disease_code:
            queryset = queryset.filter(disease_code=disease_code)
        if severity:
            queryset = queryset.filter(severity=severity)
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        return queryset.order_by('-generated_at')
    
    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge alert"""
        alert = self.get_object()
        alert.acknowledge(request.user)
        
        return Response({
            'message': 'Alert acknowledged',
            'alert': AlertSerializer(alert).data
        })
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Resolve alert"""
        alert = self.get_object()
        alert.resolve(request.user)
        
        return Response({
            'message': 'Alert resolved',
            'alert': AlertSerializer(alert).data
        })
    
    @action(detail=True, methods=['post'])
    def escalate(self, request, pk=None):
        """Escalate alert"""
        alert = self.get_object()
        alert.escalate()
        
        return Response({
            'message': 'Alert escalated',
            'alert': AlertSerializer(alert).data
        })
    
    @action(detail=False, methods=['post'])
    def evaluate_alerts(self, request):
        """Trigger alert evaluation"""
        disease_code = request.data.get('disease_code')
        
        if not disease_code:
            return Response({'error': 'disease_code is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Run async task
        task = evaluate_and_generate_alerts.delay(disease_code)
        
        return Response({
            'message': 'Alert evaluation started',
            'task_id': task.id,
            'disease_code': disease_code
        })


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """Notification viewset"""
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Users can only see their own notifications
        return Notification.objects.filter(recipient=self.request.user).order_by('-created_at')


@api_view(['GET'])
@permission_classes([IsAuthority])
def heat_map_data(request):
    """
    Get heat map data for disease visualization
    """
    disease_code = request.query_params.get('disease_code')
    date = request.query_params.get('date')
    
    if not disease_code:
        return Response({'error': 'disease_code is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    if not date:
        date = timezone.now().date()
    else:
        date = datetime.strptime(date, '%Y-%m-%d').date()
    
    # Get surveillance data
    data = SurveillanceData.objects.filter(
        disease_code=disease_code,
        date=date
    ).select_related('region')
    
    # Get risk scores
    risk_scores = {
        rs.region_id: rs.get_risk_level_display()
        for rs in RiskScore.objects.filter(
            disease_code=disease_code,
            calculation_date=date
        )
    }
    
    # Build heat map data
    heat_map = []
    for record in data:
        heat_map.append({
            'region_id': str(record.region.id),
            'region_name': record.region.name,
            'latitude': record.region.latitude,
            'longitude': record.region.longitude,
            'case_count': record.case_count,
            'cases_per_100k': record.cases_per_100k,
            'average_severity': record.average_severity,
            'risk_level': risk_scores.get(record.region_id, 'Low')
        })
    
    serializer = HeatMapDataSerializer(heat_map, many=True)
    
    return Response({
        'disease_code': disease_code,
        'disease_name': data.first().disease_name if data.exists() else '',
        'date': date,
        'data': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthority])
def disease_statistics(request):
    """
    Get disease-wise statistics
    """
    days = int(request.query_params.get('days', 7))
    start_date = timezone.now().date() - timedelta(days=days)
    
    # Get aggregated statistics per disease
    stats = SurveillanceData.objects.filter(
        date__gte=start_date
    ).values('disease_code', 'disease_name').annotate(
        total_cases=Sum('case_count'),
        affected_regions=Count('region', distinct=True),
        average_severity=Avg('average_severity')
    ).order_by('-total_cases')
    
    # Calculate growth rates
    for stat in stats:
        # Get previous period data
        prev_period_start = start_date - timedelta(days=days)
        prev_cases = SurveillanceData.objects.filter(
            disease_code=stat['disease_code'],
            date__gte=prev_period_start,
            date__lt=start_date
        ).aggregate(total=Sum('case_count'))['total'] or 0
        
        current_cases = stat['total_cases']
        
        if prev_cases > 0:
            stat['growth_rate'] = ((current_cases - prev_cases) / prev_cases) * 100
        else:
            stat['growth_rate'] = 100.0 if current_cases > 0 else 0.0
    
    serializer = DiseaseStatisticsSerializer(stats, many=True)
    
    return Response({
        'period_days': days,
        'start_date': start_date,
        'statistics': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthority])
def regional_comparison(request):
    """
    Get regional comparison data
    """
    state = request.query_params.get('state')
    days = int(request.query_params.get('days', 7))
    start_date = timezone.now().date() - timedelta(days=days)
    
    regions = Region.objects.all()
    if state:
        regions = regions.filter(state__icontains=state)
    
    comparison = []
    
    for region in regions:
        # Get total cases
        surveillance_data = SurveillanceData.objects.filter(
            region=region,
            date__gte=start_date
        )
        
        total_cases = surveillance_data.aggregate(total=Sum('case_count'))['total'] or 0
        active_diseases = surveillance_data.values('disease_code').distinct().count()
        
        # Get latest risk score
        latest_risk = RiskScore.objects.filter(
            region=region
        ).order_by('-calculation_date').first()
        
        risk_level = latest_risk.get_risk_level_display() if latest_risk else 'Low'
        cases_per_100k = (total_cases / region.population) * 100000 if region.population > 0 else 0
        
        comparison.append({
            'region_name': region.name,
            'total_cases': total_cases,
            'active_diseases': active_diseases,
            'risk_level': risk_level,
            'population': region.population,
            'cases_per_100k': round(cases_per_100k, 2)
        })
    
    # Sort by cases per 100k
    comparison.sort(key=lambda x: x['cases_per_100k'], reverse=True)
    
    serializer = RegionalComparisonSerializer(comparison, many=True)
    
    return Response({
        'period_days': days,
        'regions_compared': len(comparison),
        'comparison': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthority])
def dashboard_overview(request):
    """
    Get dashboard overview statistics
    """
    today = timezone.now().date()
    yesterday = today - timedelta(days=1)
    week_ago = today - timedelta(days=7)
    
    # Total cases today
    today_data = SurveillanceData.objects.filter(date=today)
    total_cases_today = today_data.aggregate(total=Sum('case_count'))['total'] or 0
    
    # Active alerts
    active_alerts = Alert.objects.filter(status='active').count()
    critical_alerts = Alert.objects.filter(status='active', severity='critical').count()
    
    # High risk regions
    high_risk_regions = RiskScore.objects.filter(
        calculation_date=today,
        risk_level__gte=2
    ).values('region__name').distinct().count()
    
    # Active clusters
    active_clusters = Cluster.objects.filter(is_active=True).count()
    
    # Top diseases
    top_diseases = SurveillanceData.objects.filter(
        date__gte=week_ago
    ).values('disease_code', 'disease_name').annotate(
        total_cases=Sum('case_count')
    ).order_by('-total_cases')[:5]
    
    # Trending diseases (growth rate)
    trending = []
    for disease in top_diseases:
        prev_week = week_ago - timedelta(days=7)
        prev_cases = SurveillanceData.objects.filter(
            disease_code=disease['disease_code'],
            date__gte=prev_week,
            date__lt=week_ago
        ).aggregate(total=Sum('case_count'))['total'] or 0
        
        current_cases = disease['total_cases']
        growth_rate = ((current_cases - prev_cases) / prev_cases * 100) if prev_cases > 0 else 0
        
        trending.append({
            'disease_code': disease['disease_code'],
            'disease_name': disease['disease_name'],
            'total_cases': disease['total_cases'],
            'growth_rate': round(growth_rate, 2)
        })
    
    return Response({
        'date': today,
        'total_cases_today': total_cases_today,
        'active_alerts': active_alerts,
        'critical_alerts': critical_alerts,
        'high_risk_regions': high_risk_regions,
        'active_clusters': active_clusters,
        'top_diseases': trending
    })
