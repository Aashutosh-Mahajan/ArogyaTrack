'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { 
  HeatMapData, 
  PaginatedResponse, 
  Alert, 
  Cluster, 
  Forecast, 
  DiseaseStats,
  Anomaly,
  RiskScore,
  AdminDashboardData,
  MLPipelineStatus,
} from '@/types';
import { 
  FiAlertTriangle, 
  FiTrendingUp, 
  FiUsers, 
  FiActivity,
  FiMapPin,
  FiBarChart2,
  FiRefreshCw,
  FiCpu,
  FiShield,
  FiZap,
} from 'react-icons/fi';
import { LineChartComponent, BarChartComponent, ForecastChart } from '@/components/charts/Charts';

// Reusable loading skeleton
function LoadingSkeleton({ height = 'h-[300px]', rows }: { height?: string; rows?: number }) {
  if (rows) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
            <div className="h-6 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`${height} bg-gray-100 animate-pulse rounded-lg flex items-center justify-center`}>
      <div className="flex flex-col items-center gap-2">
        <FiRefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    </div>
  );
}

// Dynamic import to avoid SSR issues with Leaflet
const DynamicMap = dynamic(
  () => import('@/components/maps/DynamicMap').then((mod) => mod.DynamicMap),
  { ssr: false, loading: () => <div className="h-[600px] bg-gray-100 animate-pulse rounded-lg" /> }
);

const RISK_LEVEL_LABELS: Record<number, string> = {
  0: 'Low',
  1: 'Medium',
  2: 'High',
  3: 'Critical',
};

const RISK_LEVEL_COLORS: Record<number, string> = {
  0: 'bg-green-100 text-green-800',
  1: 'bg-yellow-100 text-yellow-800',
  2: 'bg-orange-100 text-orange-800',
  3: 'bg-red-100 text-red-800',
};

function AdminDashboard(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [selectedDisease, setSelectedDisease] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [mapZoom, setMapZoom] = useState(5);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);
  const [pipelineDisease, setPipelineDisease] = useState('A90');
  const [forecastHorizon, setForecastHorizon] = useState(7);

  // Queries
  const { data: dashboard, refetch: refetchDashboard, isLoading: isDashboardLoading } = useQuery<AdminDashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.surveillance.getDashboard(),
  });

  const { data: heatMapData, refetch: refetchHeatMap, isLoading: isHeatMapLoading } = useQuery<HeatMapData[]>({
    queryKey: ['heat-map', selectedDisease, selectedRegion],
    queryFn: () => api.surveillance.getHeatMap({ 
      disease_code: selectedDisease || undefined,
      region_id: selectedRegion || undefined,
    }),
  });

  const { data: diseaseStats, isLoading: isDiseaseStatsLoading } = useQuery<DiseaseStats[]>({
    queryKey: ['disease-stats'],
    queryFn: () => api.surveillance.getDiseaseStats(),
  });

  const { data: alerts, isLoading: isAlertsLoading } = useQuery<PaginatedResponse<Alert>>({
    queryKey: ['alerts'],
    queryFn: () => api.surveillance.getAlerts({ status: 'active' }),
  });

  const { data: clusters, isLoading: isClustersLoading } = useQuery<PaginatedResponse<Cluster>>({
    queryKey: ['clusters'],
    queryFn: () => api.surveillance.getClusters({ is_active: true }),
  });

  const { data: forecasts, isLoading: isForecastsLoading } = useQuery<PaginatedResponse<Forecast>>({
    queryKey: ['forecasts', forecastHorizon],
    queryFn: () => api.surveillance.getForecasts({ horizon: forecastHorizon }),
  });

  const { data: forecastChartData, isLoading: isForecastChartLoading } = useQuery<any>({
    queryKey: ['forecast-chart', forecastHorizon, selectedDisease],
    queryFn: () => api.surveillance.getForecastChartData({
      horizon: forecastHorizon,
      disease_code: selectedDisease || undefined,
    }),
  });

  const { data: anomalies, isLoading: isAnomaliesLoading } = useQuery<PaginatedResponse<Anomaly>>({
    queryKey: ['anomalies'],
    queryFn: () => api.surveillance.getAnomalies({ is_resolved: false }),
  });

  const { data: riskScores, isLoading: isRiskScoresLoading } = useQuery<PaginatedResponse<RiskScore>>({
    queryKey: ['risk-scores'],
    queryFn: () => api.surveillance.getRiskScores({ ordering: '-risk_level' }),
  });

  const { data: pipelineStatus, isLoading: isPipelineLoading } = useQuery<MLPipelineStatus>({
    queryKey: ['ml-pipeline-status'],
    queryFn: () => api.surveillance.getMLPipelineStatus(),
    refetchInterval: 30000,
  });

  // Mutations
  const runPipelineMutation = useMutation({
    mutationFn: (diseaseCode: string) => api.surveillance.runMLPipeline(diseaseCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ml-pipeline-status'] });
    },
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: (id: string) => api.surveillance.acknowledgeAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });

  const stats = [
    {
      title: 'Cases Today',
      value: dashboard?.total_cases_today?.toLocaleString() || '0',
      icon: FiUsers,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Active Alerts',
      value: dashboard?.active_alerts || 0,
      icon: FiAlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      extra: dashboard?.critical_alerts ? `${dashboard.critical_alerts} critical` : undefined,
    },
    {
      title: 'Active Clusters',
      value: dashboard?.active_clusters || 0,
      icon: FiMapPin,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Monitored Regions',
      value: dashboard?.monitored_regions || 0,
      icon: FiActivity,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'High Risk Regions',
      value: dashboard?.high_risk_regions || 0,
      icon: FiShield,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Unresolved Anomalies',
      value: anomalies?.count || 0,
      icon: FiZap,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
  ];

  const handleRegionClick = (region: HeatMapData) => {
    setMapCenter([region.latitude, region.longitude]);
    setMapZoom(10);
    setSelectedRegion(region.region_id.toString());
  };

  const resetMap = () => {
    setMapCenter([20.5937, 78.9629]);
    setMapZoom(5);
    setSelectedRegion('');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Surveillance Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Real-time disease monitoring and ML analytics
            </p>
          </div>
          <Button 
            onClick={() => {
              refetchDashboard();
              refetchHeatMap();
              queryClient.invalidateQueries({ queryKey: ['alerts'] });
              queryClient.invalidateQueries({ queryKey: ['clusters'] });
              queryClient.invalidateQueries({ queryKey: ['anomalies'] });
              queryClient.invalidateQueries({ queryKey: ['risk-scores'] });
            }}
            variant="outline"
          >
            <FiRefreshCw className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {isDashboardLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="card-hover">
                <CardContent className="p-4 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="h-3 bg-gray-200 rounded w-20" />
                      <div className="h-7 bg-gray-200 rounded w-16" />
                    </div>
                    <div className="h-9 w-9 bg-gray-200 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            stats.map((stat, index) => (
            <Card key={index} className="card-hover">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {stat.value}
                    </p>
                    {'extra' in stat && stat.extra && (
                      <p className="text-xs text-red-600 mt-0.5">{stat.extra}</p>
                    )}
                  </div>
                  <div className={`${stat.bgColor} ${stat.color} p-2 rounded-lg`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
          )}
        </div>

        {/* ML Pipeline Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <FiCpu className="mr-2" />
                  ML Pipeline Control
                </CardTitle>
                <CardDescription>
                  Monitor and trigger ML model pipeline runs
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={pipelineDisease}
                  onChange={(e) => setPipelineDisease(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="A90">Dengue (A90)</option>
                  <option value="U07.1">COVID-19 (U07.1)</option>
                  <option value="B50.0">Malaria (B50.0)</option>
                  <option value="J18.9">Pneumonia (J18.9)</option>
                  <option value="J10.1">Influenza (J10.1)</option>
                  <option value="A09">Gastroenteritis (A09)</option>
                  <option value="B05">Measles (B05)</option>
                  <option value="I10">Hypertension (I10)</option>
                </select>
                <Button
                  onClick={() => runPipelineMutation.mutate(pipelineDisease)}
                  disabled={runPipelineMutation.isPending}
                  size="sm"
                >
                  {runPipelineMutation.isPending ? (
                    <FiRefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FiZap className="mr-2 h-4 w-4" />
                  )}
                  Run Pipeline
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {isPipelineLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg animate-pulse">
                    <div className="w-3 h-3 rounded-full bg-gray-300" />
                    <div className="space-y-1 flex-1">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                      <div className="h-3 bg-gray-200 rounded w-16" />
                    </div>
                  </div>
                ))
              ) : pipelineStatus?.models ? (
                Object.entries(pipelineStatus.models).map(([name, info]) => (
                <div key={name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${info.loaded ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-sm font-medium capitalize">{name.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">{info.loaded ? 'Loaded' : info.error || 'Not loaded'}</p>
                  </div>
                </div>
              ))) : (
                <div className="col-span-4 text-center py-4 text-gray-500 text-sm">
                  Pipeline status unavailable — check backend connection
                </div>
              )}
            </div>
            {pipelineStatus && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs text-gray-600">
                <div className="p-2 bg-blue-50 rounded text-center">
                  <p className="font-semibold text-blue-700">{pipelineStatus.surveillance_records_week ?? '—'}</p>
                  <p>Records (7d)</p>
                </div>
                <div className="p-2 bg-green-50 rounded text-center">
                  <p className="font-semibold text-green-700">{pipelineStatus.forecasts_generated_today ?? '—'}</p>
                  <p>Forecasts today</p>
                </div>
                <div className="p-2 bg-orange-50 rounded text-center">
                  <p className="font-semibold text-orange-700">{pipelineStatus.recent_anomalies ?? '—'}</p>
                  <p>Anomalies (7d)</p>
                </div>
                <div className="p-2 bg-purple-50 rounded text-center">
                  <p className="font-semibold text-purple-700">{pipelineStatus.risk_scores_today ?? '—'}</p>
                  <p>Risk scores today</p>
                </div>
                <div className="p-2 bg-gray-50 rounded text-center">
                  <p className="font-semibold text-gray-700">{pipelineStatus.regions_count ?? '—'}</p>
                  <p>Regions</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Alerts */}
        {alerts?.results && alerts.results.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-900 flex items-center">
                <FiAlertTriangle className="mr-2" />
                Active Alerts ({alerts.count})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.results.slice(0, 5).map((alert) => (
                  <div 
                    key={alert.id}
                    className="flex items-start justify-between p-4 bg-white rounded-lg border border-red-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="destructive">{alert.severity.toUpperCase()}</Badge>
                        <Badge variant="outline">{alert.alert_type}</Badge>
                        {alert.confidence && (
                          <span className="text-xs text-gray-500">
                            {(alert.confidence * 100).toFixed(0)}% confidence
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900">{alert.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {alert.affected_regions_data?.map((r) => (
                          <span key={r.id} className="text-xs bg-gray-100 px-2 py-0.5 rounded">{r.name}</span>
                        ))}
                        <span className="text-xs text-gray-500">
                          {new Date(alert.generated_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                      disabled={acknowledgeAlertMutation.isPending}
                    >
                      Acknowledge
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Disease Heat Map */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <FiMapPin className="mr-2" />
                  Disease Heat Map
                </CardTitle>
                <CardDescription>
                  Interactive map showing disease distribution across regions
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedDisease}
                  onChange={(e) => setSelectedDisease(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">All Diseases</option>
                  <option value="A90">Dengue Fever</option>
                  <option value="U07.1">COVID-19</option>
                  <option value="B50.0">Malaria</option>
                  <option value="J18.9">Pneumonia</option>
                  <option value="J10.1">Influenza</option>
                  <option value="A09">Gastroenteritis</option>
                  <option value="B05">Measles</option>
                  <option value="I10">Hypertension</option>
                  <option value="E11">Type 2 Diabetes</option>
                </select>
                {(selectedRegion || selectedDisease) && (
                  <Button size="sm" variant="outline" onClick={resetMap}>
                    Reset View
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isHeatMapLoading ? (
              <LoadingSkeleton height="h-[600px]" />
            ) : heatMapData && heatMapData.length > 0 ? (
              <DynamicMap 
                data={heatMapData} 
                center={mapCenter}
                zoom={mapZoom}
              />
            ) : (
              <div className="h-[600px] flex items-center justify-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">No heat map data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts + Risk Scores Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Disease Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FiTrendingUp className="mr-2" />
                Disease Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isDiseaseStatsLoading ? (
                <LoadingSkeleton height="h-[300px]" />
              ) : diseaseStats && diseaseStats.length > 0 ? (
                <BarChartComponent
                  data={diseaseStats.map((d) => ({
                    name: d.disease_name?.substring(0, 15) || 'Unknown',
                    cases: d.total_cases,
                    severity: d.average_severity,
                  }))}
                  dataKey="cases"
                  xAxisKey="name"
                  color="#0ea5e9"
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No disease data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Forecast */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <FiBarChart2 className="mr-2" />
                    Case Forecasts
                  </CardTitle>
                  <CardDescription>
                    {forecastHorizon}-day forecast
                    {forecasts?.count ? ` (${forecasts.count} predictions)` : ''}
                  </CardDescription>
                </div>
                <select
                  value={forecastHorizon}
                  onChange={(e) => setForecastHorizon(Number(e.target.value))}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {isForecastChartLoading ? (
                <LoadingSkeleton height="h-[350px]" />
              ) : forecastChartData?.data && forecastChartData.data.length > 0 ? (
                <>
                  <ForecastChart data={forecastChartData.data} />
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>
                      {forecastChartData.disease_name} &bull; {forecastChartData.data.length} days
                    </span>
                    <span>
                      Avg confidence: {(forecastChartData.data.reduce((s: number, d: any) => s + d.confidence, 0) / forecastChartData.data.length * 100).toFixed(0)}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-gray-500">
                  No forecast data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Anomalies + Risk Scores */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Anomalies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FiZap className="mr-2" />
                Recent Anomalies
              </CardTitle>
              <CardDescription>Detected by Isolation Forest v5.0 ensemble + GB corrector</CardDescription>
            </CardHeader>
            <CardContent>
              {isAnomaliesLoading ? (
                <LoadingSkeleton rows={4} />
              ) : anomalies?.results && anomalies.results.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {anomalies.results.slice(0, 8).map((anomaly) => (
                    <div key={anomaly.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div>
                        <p className="font-medium text-sm">{anomaly.disease_name}</p>
                        <p className="text-xs text-gray-600">
                          {anomaly.region_details?.name || 'Unknown Region'} • {anomaly.detection_date}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">
                          +{anomaly.deviation_percentage.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">
                          {anomaly.actual_cases} actual / {anomaly.expected_cases.toFixed(0)} expected
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-500">
                  No anomalies detected
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Scores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FiShield className="mr-2" />
                Regional Risk Scores
              </CardTitle>
              <CardDescription>Computed by XGBoost v4.0 outbreak classifier (56 features)</CardDescription>
            </CardHeader>
            <CardContent>
              {isRiskScoresLoading ? (
                <LoadingSkeleton rows={4} />
              ) : riskScores?.results && riskScores.results.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {riskScores.results.slice(0, 8).map((score) => (
                    <div key={score.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div>
                        <p className="font-medium text-sm">{score.region_details?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-600">
                          {score.disease_name} • {score.calculation_date}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">
                          {(score.risk_probability * 100).toFixed(1)}%
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${RISK_LEVEL_COLORS[score.risk_level] || 'bg-gray-100'}`}>
                          {RISK_LEVEL_LABELS[score.risk_level] || score.risk_level_display}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-500">
                  No risk scores available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Diseases + Regional Comparison */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Top Trending Diseases */}
          <Card>
            <CardHeader>
              <CardTitle>Trending Diseases</CardTitle>
              <CardDescription>Week-over-week growth by disease</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.top_diseases && dashboard.top_diseases.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.top_diseases.map((disease, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                        <div>
                          <p className="font-medium text-sm">{disease.disease_name}</p>
                          <p className="text-xs text-gray-500">{disease.disease_code}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{disease.total_cases.toLocaleString()}</p>
                        <p className={`text-xs font-medium ${disease.growth_rate > 0 ? 'text-red-600' : disease.growth_rate < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                          {disease.growth_rate > 0 ? '+' : ''}{disease.growth_rate}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-gray-500">No trending data</p>
              )}
            </CardContent>
          </Card>

          {/* Regional Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Regional Comparison</CardTitle>
              <CardDescription>Cases per 100k population by region</CardDescription>
            </CardHeader>
            <CardContent>
              {heatMapData && heatMapData.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {heatMapData
                    .sort((a, b) => b.cases_per_100k - a.cases_per_100k)
                    .slice(0, 10)
                    .map((region, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition cursor-pointer"
                        onClick={() => handleRegionClick(region)}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                          <div>
                            <p className="font-medium text-sm">{region.region_name}</p>
                            <p className="text-xs text-gray-600">{region.case_count} cases</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <p className="font-bold text-sm">{region.cases_per_100k.toFixed(2)}</p>
                            <p className="text-xs text-gray-500">per 100k</p>
                          </div>
                          <Badge 
                            variant={
                              region.risk_level === 'critical' || region.risk_level === 'Critical' ? 'destructive' :
                              region.risk_level === 'high' || region.risk_level === 'High' ? 'warning' : 'secondary'
                            }
                          >
                            {region.risk_level}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-center py-8 text-gray-500">No regional data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Clusters */}
        {clusters?.results && clusters.results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FiMapPin className="mr-2" />
                Active Clusters ({clusters.count})
              </CardTitle>
              <CardDescription>Detected by DBSCAN v5.0 geo-clustering (13 features)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clusters.results.slice(0, 6).map((cluster) => (
                  <div key={cluster.id} className="p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">{cluster.disease_name}</p>
                      <Badge variant={
                        cluster.severity === 'critical' ? 'destructive' :
                        cluster.severity === 'high' ? 'warning' : 'secondary'
                      }>
                        {cluster.severity}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>Cases: <span className="font-medium">{cluster.total_cases}</span></p>
                      <p>Radius: <span className="font-medium">{cluster.radius_km.toFixed(1)} km</span></p>
                      <p>Population: <span className="font-medium">{cluster.total_population?.toLocaleString()}</span></p>
                      <p>Detected: <span className="font-medium">{cluster.detection_date}</span></p>
                      {cluster.affected_region_names && cluster.affected_region_names.length > 0 && (
                        <p>Regions: <span className="font-medium">{cluster.affected_region_names.join(', ')}</span></p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

export default withAuth(AdminDashboard, ['admin', 'authority']);
