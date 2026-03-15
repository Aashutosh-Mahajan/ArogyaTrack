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
    evaluate_and_generate_alerts, run_complete_ml_pipeline
)
from .services import MLModelInfoService
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
    Get heat map data for disease visualization.
    
    When disease_code is provided: returns per-region data for that disease.
    When disease_code is empty/missing: returns aggregated data for ALL diseases per region.
    Uses a 7-day window for robust data availability.
    """
    disease_code = request.query_params.get('disease_code')
    days = int(request.query_params.get('days', 7))
    today = timezone.now().date()
    start_date = today - timedelta(days=days)

    # Base queryset: last N days
    base_qs = SurveillanceData.objects.filter(
        date__gte=start_date,
        date__lte=today,
    ).select_related('region')

    if disease_code:
        # ── Single disease mode ──
        base_qs = base_qs.filter(disease_code=disease_code)
        disease_name = ''
        first = base_qs.first()
        if first:
            disease_name = first.disease_name

        # Aggregate per region
        region_agg = base_qs.values(
            'region__id', 'region__name', 'region__latitude',
            'region__longitude', 'region__population',
        ).annotate(
            total_cases=Sum('case_count'),
            avg_severity=Avg('average_severity'),
        )

        # Risk scores for this disease (latest per region)
        risk_scores = {}
        for rs in RiskScore.objects.filter(disease_code=disease_code).order_by('-calculation_date'):
            if rs.region_id not in risk_scores:
                risk_scores[rs.region_id] = rs.get_risk_level_display()

        heat_map = []
        for row in region_agg:
            pop = row['region__population'] or 1
            cases = row['total_cases'] or 0
            heat_map.append({
                'region_id': str(row['region__id']),
                'region_name': row['region__name'],
                'latitude': row['region__latitude'],
                'longitude': row['region__longitude'],
                'case_count': cases,
                'cases_per_100k': round((cases / pop) * 100_000, 2),
                'average_severity': round(row['avg_severity'] or 0, 2),
                'risk_level': risk_scores.get(row['region__id'], 'Low'),
            })

        serializer = HeatMapDataSerializer(heat_map, many=True)
        return Response({
            'disease_code': disease_code,
            'disease_name': disease_name,
            'date': today,
            'data': serializer.data,
        })
    else:
        # ── All diseases mode ── aggregate across all diseases per region
        region_agg = base_qs.values(
            'region__id', 'region__name', 'region__latitude',
            'region__longitude', 'region__population',
        ).annotate(
            total_cases=Sum('case_count'),
            avg_severity=Avg('average_severity'),
        )

        # Get the highest risk level per region (across all diseases)
        risk_level_map = {}
        for rs in RiskScore.objects.order_by('-calculation_date', '-risk_level'):
            if rs.region_id not in risk_level_map:
                risk_level_map[rs.region_id] = rs.get_risk_level_display()

        heat_map = []
        for row in region_agg:
            pop = row['region__population'] or 1
            cases = row['total_cases'] or 0
            heat_map.append({
                'region_id': str(row['region__id']),
                'region_name': row['region__name'],
                'latitude': row['region__latitude'],
                'longitude': row['region__longitude'],
                'case_count': cases,
                'cases_per_100k': round((cases / pop) * 100_000, 2),
                'average_severity': round(row['avg_severity'] or 0, 2),
                'risk_level': risk_level_map.get(row['region__id'], 'Low'),
            })

        serializer = HeatMapDataSerializer(heat_map, many=True)
        return Response({
            'disease_code': None,
            'disease_name': 'All Diseases',
            'date': today,
            'data': serializer.data,
        })


@api_view(['GET'])
@permission_classes([IsAuthority])
def forecast_chart_data(request):
    """
    Return aggregated forecast data for chart rendering.
    Aggregates across regions by prediction_date for a given horizon/disease.
    Query params:
      - horizon: 7|14|30 (default 7)
      - disease_code: optional (if omitted, aggregates all diseases)
    Returns: { horizon, disease, data: [{ date, forecast, lower, upper, confidence }] }
    """
    horizon = int(request.query_params.get('horizon', 7))
    disease_code = request.query_params.get('disease_code', '')
    today = timezone.now().date()

    qs = Forecast.objects.filter(horizon_days=horizon)

    # Use the latest forecast_date available
    latest_fc_date = qs.order_by('-forecast_date').values_list('forecast_date', flat=True).first()
    if latest_fc_date:
        qs = qs.filter(forecast_date=latest_fc_date)

    if disease_code:
        qs = qs.filter(disease_code=disease_code)

    # Aggregate by prediction_date across all regions
    agg = (
        qs.values('prediction_date')
        .annotate(
            avg_predicted=Avg('predicted_cases'),
            avg_lower=Avg('lower_bound'),
            avg_upper=Avg('upper_bound'),
            avg_confidence=Avg('confidence'),
            total_predicted=Sum('predicted_cases'),
            total_lower=Sum('lower_bound'),
            total_upper=Sum('upper_bound'),
            region_count=Count('region', distinct=True),
        )
        .order_by('prediction_date')
    )

    data = []
    for row in agg:
        data.append({
            'date': row['prediction_date'].strftime('%b %d'),
            'date_raw': str(row['prediction_date']),
            'forecast': round(row['avg_predicted'], 1),
            'lower_bound': round(row['avg_lower'], 1),
            'upper_bound': round(row['avg_upper'], 1),
            'confidence': round(row['avg_confidence'], 2),
            'total_predicted': round(row['total_predicted'], 0),
            'regions': row['region_count'],
        })

    return Response({
        'horizon': horizon,
        'disease_code': disease_code or 'all',
        'disease_name': 'All Diseases' if not disease_code else (
            Forecast.objects.filter(disease_code=disease_code).values_list('disease_name', flat=True).first() or disease_code
        ),
        'forecast_date': str(latest_fc_date) if latest_fc_date else None,
        'data': data,
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
    Get dashboard overview statistics.
    Uses date ranges for robustness — not just exact 'today'.
    """
    today = timezone.now().date()
    week_ago = today - timedelta(days=7)
    two_weeks_ago = today - timedelta(days=14)

    # Total cases — try today first, fall back to last 3 days
    total_cases_today = SurveillanceData.objects.filter(
        date=today
    ).aggregate(total=Sum('case_count'))['total'] or 0

    if total_cases_today == 0:
        # Fall back to latest available date within last 7 days
        latest_date = SurveillanceData.objects.filter(
            date__gte=week_ago
        ).order_by('-date').values_list('date', flat=True).first()
        if latest_date:
            total_cases_today = SurveillanceData.objects.filter(
                date=latest_date
            ).aggregate(total=Sum('case_count'))['total'] or 0

    # Active alerts
    active_alerts = Alert.objects.filter(status='active').count()
    critical_alerts = Alert.objects.filter(status='active', severity='critical').count()

    # High risk regions — use latest calculation_date available
    latest_risk_date = RiskScore.objects.order_by('-calculation_date').values_list(
        'calculation_date', flat=True
    ).first() or today
    high_risk_regions = RiskScore.objects.filter(
        calculation_date=latest_risk_date,
        risk_level__gte=2
    ).values('region__name').distinct().count()

    # Active clusters
    active_clusters = Cluster.objects.filter(is_active=True).count()

    # Top diseases (last 7 days)
    top_diseases = SurveillanceData.objects.filter(
        date__gte=week_ago
    ).values('disease_code', 'disease_name').annotate(
        total_cases=Sum('case_count')
    ).order_by('-total_cases')[:5]

    # Trending diseases (growth rate)
    trending = []
    for disease in top_diseases:
        prev_cases = SurveillanceData.objects.filter(
            disease_code=disease['disease_code'],
            date__gte=two_weeks_ago,
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
        'monitored_regions': Region.objects.count(),
        'unresolved_anomalies': Anomaly.objects.filter(is_resolved=False).count(),
        'top_diseases': trending
    })


@api_view(['GET'])
@permission_classes([IsAuthority])
def ml_model_info(request):
    """Get information about all deployed ML models."""
    return Response(MLModelInfoService.get_all_models_info())


@api_view(['GET'])
@permission_classes([IsAuthority])
def ml_pipeline_status(request):
    """Get ML pipeline health status."""
    return Response(MLModelInfoService.get_pipeline_status())


@api_view(['POST'])
@permission_classes([IsAuthority])
def run_ml_pipeline(request):
    """Trigger the complete ML pipeline for a disease."""
    disease_code = request.data.get('disease_code')
    if not disease_code:
        return Response(
            {'error': 'disease_code is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Try async (Celery) first; fall back to synchronous execution
    try:
        task = run_complete_ml_pipeline.delay(disease_code)
        return Response({
            'message': 'ML pipeline started (async)',
            'task_id': task.id,
            'disease_code': disease_code,
        })
    except Exception:
        # Redis/Celery unavailable – run synchronously
        try:
            result = run_complete_ml_pipeline(disease_code)
            return Response({
                'message': 'ML pipeline completed (sync)',
                'task_id': 'sync',
                'disease_code': disease_code,
                'result': result,
            })
        except Exception as exc:
            return Response(
                {'error': f'Pipeline failed: {str(exc)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


@api_view(['GET'])
@permission_classes([IsAuthority])
def daywise_comparison(request):
    """
    Day-wise case comparison for diseases across regions/cities/states.
    Compares today with the past 6 days and determines trend direction.

    Query params:
      - disease_code: optional, filter to a specific disease
      - state: optional, filter by state
      - district: optional, filter by district
      - region_id: optional, filter to a specific region
    
    Returns per-disease, per-region breakdown with 7 days of data
    and a computed trend label.
    """
    disease_code = request.query_params.get('disease_code')
    state = request.query_params.get('state')
    district = request.query_params.get('district')
    region_id = request.query_params.get('region_id')

    today = timezone.now().date()
    # Build list of 7 days: today + past 6 days
    dates = [today - timedelta(days=i) for i in range(7)]

    # Find the latest date with data if today has none
    latest_date = SurveillanceData.objects.filter(
        date__gte=today - timedelta(days=7),
        date__lte=today,
    ).order_by('-date').values_list('date', flat=True).first()

    if latest_date and latest_date != today:
        dates = [latest_date - timedelta(days=i) for i in range(7)]
        today = latest_date

    base_qs = SurveillanceData.objects.filter(
        date__in=dates
    ).select_related('region')

    if disease_code:
        base_qs = base_qs.filter(disease_code=disease_code)
    if region_id:
        base_qs = base_qs.filter(region_id=region_id)
    if state:
        base_qs = base_qs.filter(region__state__icontains=state)
    if district:
        base_qs = base_qs.filter(region__district__icontains=district)

    # Group by disease + region + date
    rows = base_qs.values(
        'disease_code', 'disease_name',
        'region__id', 'region__name', 'region__district', 'region__state',
        'date',
    ).annotate(
        cases=Sum('case_count'),
        severity=Avg('average_severity'),
    ).order_by('disease_code', 'region__name', '-date')

    # Organize into nested structure: disease -> region -> day_data[]
    from collections import defaultdict
    tree = defaultdict(lambda: defaultdict(dict))
    disease_names = {}
    region_meta = {}

    for row in rows:
        dc = row['disease_code']
        rid = str(row['region__id'])
        d = row['date']

        disease_names[dc] = row['disease_name']
        region_meta[rid] = {
            'region_id': rid,
            'region_name': row['region__name'],
            'district': row['region__district'],
            'state': row['region__state'],
        }
        tree[dc][rid][d] = {
            'cases': row['cases'] or 0,
            'severity': round(row['severity'] or 0, 2),
        }

    def _compute_trend(day_values):
        """
        Determine trend from a list of daily case counts (newest first).
        Uses linear direction + magnitude to label the trend.
        """
        if len(day_values) < 2:
            return 'stable'

        # day_values[0] = today, day_values[1] = yesterday, etc.
        recent_avg = sum(day_values[:3]) / min(len(day_values), 3)
        older_avg = sum(day_values[3:]) / max(len(day_values[3:]), 1) if len(day_values) > 3 else day_values[-1]

        if older_avg == 0 and recent_avg == 0:
            return 'stable'
        if older_avg == 0:
            return 'rapid_increase'

        pct_change = ((recent_avg - older_avg) / older_avg) * 100

        if pct_change > 25:
            return 'rapid_increase'
        elif pct_change > 5:
            return 'gradual_increase'
        elif pct_change < -25:
            return 'rapid_decrease'
        elif pct_change < -5:
            return 'gradual_decrease'
        else:
            return 'stable'

    # Build response
    comparisons = []
    for dc, regions_dict in tree.items():
        for rid, date_map in regions_dict.items():
            day_data = []
            day_values = []
            for d in dates:
                entry = date_map.get(d, {'cases': 0, 'severity': 0})
                day_data.append({
                    'date': str(d),
                    'cases': entry['cases'],
                    'severity': entry.get('severity', 0),
                })
                day_values.append(entry['cases'])

            trend = _compute_trend(day_values)
            total_cases = sum(day_values)
            peak_cases = max(day_values)
            min_cases = min(day_values)

            meta = region_meta.get(rid, {})
            comparisons.append({
                'disease_code': dc,
                'disease_name': disease_names.get(dc, dc),
                'region_id': rid,
                'region_name': meta.get('region_name', ''),
                'district': meta.get('district', ''),
                'state': meta.get('state', ''),
                'trend': trend,
                'total_cases_7d': total_cases,
                'peak_cases': peak_cases,
                'min_cases': min_cases,
                'today_cases': day_values[0] if day_values else 0,
                'day_data': day_data,
            })

    # Sort by today's cases desc
    comparisons.sort(key=lambda x: x['today_cases'], reverse=True)

    # Aggregate disease-level summaries
    disease_summaries = []
    disease_groups = defaultdict(list)
    for c in comparisons:
        disease_groups[c['disease_code']].append(c)

    for dc, items in disease_groups.items():
        all_day_values = []
        for d in dates:
            total = sum(
                next((dd['cases'] for dd in item['day_data'] if dd['date'] == str(d)), 0)
                for item in items
            )
            all_day_values.append(total)

        disease_summaries.append({
            'disease_code': dc,
            'disease_name': disease_names.get(dc, dc),
            'trend': _compute_trend(all_day_values),
            'total_cases_7d': sum(all_day_values),
            'today_cases': all_day_values[0] if all_day_values else 0,
            'regions_affected': len(items),
            'day_totals': [
                {'date': str(dates[i]), 'cases': all_day_values[i]}
                for i in range(len(dates))
            ],
        })

    disease_summaries.sort(key=lambda x: x['today_cases'], reverse=True)

    # Get distinct states for filter dropdown
    available_states = list(
        Region.objects.values_list('state', flat=True).distinct().order_by('state')
    )

    return Response({
        'reference_date': str(today),
        'dates': [str(d) for d in dates],
        'available_states': available_states,
        'disease_summaries': disease_summaries,
        'comparisons': comparisons,
    })


class EnvironmentalDataViewSet(viewsets.ReadOnlyModelViewSet):
    """Environmental data viewset."""
    queryset = EnvironmentalData.objects.all()
    serializer_class = EnvironmentalDataSerializer
    permission_classes = [IsAuthority]

    def get_queryset(self):
        queryset = EnvironmentalData.objects.select_related('region')

        region_id = self.request.query_params.get('region_id')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')

        if region_id:
            queryset = queryset.filter(region_id=region_id)
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)

        return queryset.order_by('-date')
