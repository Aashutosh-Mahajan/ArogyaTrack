'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useLanguage } from '@/components/providers/LanguageProvider';
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
          <div key={i} className="flex items-center justify-between p-3 bg-gray-100/50 rounded-lg">
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
    <div className={`${height} bg-gray-100/50 animate-pulse rounded-lg flex items-center justify-center`}>
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

const RISK_LEVEL_COLORS: Record<number, string> = {
  0: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  1: 'bg-amber-100 text-amber-800 border-amber-200',
  2: 'bg-orange-100 text-orange-800 border-orange-200',
  3: 'bg-rose-100 text-rose-800 border-rose-200',
};

function AdminDashboard(): React.JSX.Element {
  const { t } = useLanguage();
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
      title: t('cases_today'),
      value: dashboard?.total_cases_today?.toLocaleString() || '0',
      icon: FiUsers,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: t('active_alerts_count'),
      value: dashboard?.active_alerts || 0,
      icon: FiAlertTriangle,
      color: 'text-rose-600',
      bgColor: 'bg-rose-100',
      extra: dashboard?.critical_alerts ? `${dashboard.critical_alerts} ${t('critical').toLowerCase()}` : undefined,
    },
    {
      title: t('active_clusters'),
      value: dashboard?.active_clusters || 0,
      icon: FiMapPin,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: t('monitored_regions'),
      value: dashboard?.monitored_regions || 0,
      icon: FiActivity,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      title: t('high_risk_regions'),
      value: dashboard?.high_risk_regions || 0,
      icon: FiShield,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: t('unresolved_anomalies'),
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

  const getRiskLabel = (level: number) => {
    switch (level) {
      case 0: return t('low_risk');
      case 1: return t('medium_risk');
      case 2: return t('high_risk');
      case 3: return t('critical');
      default: return t('low_risk');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('admin_dashboard_title')}</h1>
            <p className="text-slate-600 mt-1">
              {t('admin_dashboard_subtitle')}
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
            className="bg-white/80 backdrop-blur-sm border-slate-200 hover:bg-slate-50 shadow-sm"
          >
            <FiRefreshCw className="mr-2 h-4 w-4" />
            {t('refresh_data')}
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {isDashboardLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm bg-white/60">
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
              <Card key={index} className="border-0 shadow-lg shadow-slate-100 bg-white/80 backdrop-blur-md hover:shadow-xl transition-shadow duration-300">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold mt-1 text-slate-800">
                        {stat.value}
                      </p>
                      {'extra' in stat && stat.extra && (
                        <p className="text-xs text-rose-600 mt-1 font-medium bg-rose-50 inline-block px-1.5 py-0.5 rounded">{stat.extra}</p>
                      )}
                    </div>
                    <div className={`${stat.bgColor} ${stat.color} p-2.5 rounded-xl shadow-inner`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* ML Pipeline Status */}
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600" />
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center text-xl text-slate-800">
                  <FiCpu className="mr-2 text-indigo-600" />
                  {t('ml_pipeline_control')}
                </CardTitle>
                <CardDescription className="text-slate-500">
                  {t('ml_pipeline_desc')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={pipelineDisease}
                  onChange={(e) => setPipelineDisease(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
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
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"
                >
                  {runPipelineMutation.isPending ? (
                    <FiRefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FiZap className="mr-2 h-4 w-4" />
                  )}
                  {t('run_pipeline')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {isPipelineLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-lg animate-pulse">
                    <div className="w-3 h-3 rounded-full bg-slate-300" />
                    <div className="space-y-1 flex-1">
                      <div className="h-4 bg-slate-200 rounded w-24" />
                      <div className="h-3 bg-slate-200 rounded w-16" />
                    </div>
                  </div>
                ))
              ) : pipelineStatus?.models ? (
                Object.entries(pipelineStatus.models).map(([name, info]) => (
                  <div key={name} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className={`w-3 h-3 rounded-full shadow-sm ${info.loaded ? 'bg-emerald-500 shadow-emerald-200' : 'bg-rose-500 shadow-rose-200'}`} />
                    <div>
                      <p className="text-sm font-semibold text-slate-700 capitalize">{name.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-slate-500">{info.loaded ? 'Active' : info.error || 'Inactive'}</p>
                    </div>
                  </div>
                ))) : (
                <div className="col-span-4 text-center py-4 text-slate-500 text-sm">
                  {t('pipeline_loading')}
                </div>
              )}
            </div>
            {pipelineStatus && (
              <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-center">
                  <p className="font-bold text-lg text-blue-700">{pipelineStatus.surveillance_records_week ?? '—'}</p>
                  <p className="text-blue-600 font-medium">{t('records_7d')}</p>
                </div>
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center">
                  <p className="font-bold text-lg text-emerald-700">{pipelineStatus.forecasts_generated_today ?? '—'}</p>
                  <p className="text-emerald-600 font-medium">{t('forecasts_today')}</p>
                </div>
                <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-center">
                  <p className="font-bold text-lg text-amber-700">{pipelineStatus.recent_anomalies ?? '—'}</p>
                  <p className="text-amber-600 font-medium">{t('anomalies_7d')}</p>
                </div>
                <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl text-center">
                  <p className="font-bold text-lg text-purple-700">{pipelineStatus.risk_scores_today ?? '—'}</p>
                  <p className="text-purple-600 font-medium">{t('risk_scores_today')}</p>
                </div>
                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl text-center">
                  <p className="font-bold text-lg text-slate-700">{pipelineStatus.regions_count ?? '—'}</p>
                  <p className="text-slate-600 font-medium">{t('regions')}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Alerts */}
        {alerts?.results && alerts.results.length > 0 && (
          <Card className="border-0 shadow-lg bg-rose-50/30 backdrop-blur-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-rose-500 to-red-500" />
            <CardHeader>
              <CardTitle className="text-rose-900 flex items-center text-xl">
                <FiAlertTriangle className="mr-2" />
                {t('active_alerts_title')} ({alerts.count})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.results.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-col sm:flex-row sm:items-start justify-between p-4 bg-white rounded-xl border border-rose-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1 mb-3 sm:mb-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="destructive" className="uppercase font-bold tracking-wider text-[10px]">{alert.severity.toUpperCase()}</Badge>
                        <Badge variant="outline" className="border-rose-200 text-rose-700 bg-rose-50">{alert.alert_type}</Badge>
                        {alert.confidence && (
                          <span className="text-xs text-slate-500">
                            {(alert.confidence * 100).toFixed(0)}% {t('confidence')}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900">{alert.title}</p>
                      <p className="text-sm text-slate-600 mt-1">{alert.description}</p>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {alert.affected_regions_data?.map((r) => (
                          <span key={r.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium border border-slate-200">{r.name}</span>
                        ))}
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <FiActivity className="h-3 w-3" />
                          {new Date(alert.generated_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                      disabled={acknowledgeAlertMutation.isPending}
                    >
                      {t('acknowledge')}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Disease Heat Map */}
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center text-xl text-slate-800">
                  <FiMapPin className="mr-2 text-blue-600" />
                  {t('disease_heat_map')}
                </CardTitle>
                <CardDescription>
                  {t('disease_heat_map_desc')}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedDisease}
                  onChange={(e) => setSelectedDisease(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">{t('all_diseases')}</option>
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
                    {t('reset_view')}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isHeatMapLoading ? (
              <LoadingSkeleton height="h-[600px]" />
            ) : heatMapData && heatMapData.length > 0 ? (
              <div className="rounded-b-xl overflow-hidden">
                <DynamicMap
                  data={heatMapData}
                  center={mapCenter}
                  zoom={mapZoom}
                />
              </div>
            ) : (
              <div className="h-[600px] flex items-center justify-center bg-slate-50">
                <p className="text-slate-400 flex flex-col items-center">
                  <FiMapPin className="h-8 w-8 mb-2 opacity-50" />
                  {t('no_heat_map_data')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts + Risk Scores Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Disease Trends */}
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="flex items-center text-lg text-slate-800">
                <FiTrendingUp className="mr-2 text-sky-500" />
                {t('disease_statistics')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
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
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  {t('no_disease_data')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Forecast */}
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center text-lg text-slate-800">
                    <FiBarChart2 className="mr-2 text-violet-500" />
                    {t('case_forecasts')}
                  </CardTitle>
                  <CardDescription>
                    {forecastHorizon}-{t('forecast_days')}
                    {forecasts?.count ? ` (${forecasts.count} ${t('predictions')})` : ''}
                  </CardDescription>
                </div>
                <select
                  value={forecastHorizon}
                  onChange={(e) => setForecastHorizon(Number(e.target.value))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500 outline-none"
                >
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {isForecastChartLoading ? (
                <LoadingSkeleton height="h-[350px]" />
              ) : forecastChartData?.data && forecastChartData.data.length > 0 ? (
                <>
                  <ForecastChart data={forecastChartData.data} />
                  <div className="flex items-center justify-between mt-4 text-xs font-medium text-slate-500 bg-slate-50 p-2 rounded-lg">
                    <span>
                      {forecastChartData.disease_name} &bull; {forecastChartData.data.length} days
                    </span>
                    <span>
                      {t('avg_confidence')}: {(forecastChartData.data.reduce((s: number, d: any) => s + d.confidence, 0) / forecastChartData.data.length * 100).toFixed(0)}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-slate-400">
                  {t('no_forecast_data')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Anomalies + Risk Scores */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Anomalies */}
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="flex items-center text-lg text-slate-800">
                <FiZap className="mr-2 text-amber-500" />
                {t('recent_anomalies')}
              </CardTitle>
              <CardDescription>{t('anomaly_detection_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {isAnomaliesLoading ? (
                <LoadingSkeleton rows={4} />
              ) : anomalies?.results && anomalies.results.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {anomalies.results.slice(0, 8).map((anomaly) => (
                    <div key={anomaly.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 hover:border-amber-200 transition-colors shadow-sm">
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{anomaly.disease_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {anomaly.region_details?.name || 'Unknown Region'} • {new Date(anomaly.detection_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={`border-rose-200 text-rose-700 bg-rose-50 font-bold`}>
                          +{anomaly.deviation_percentage.toFixed(1)}%
                        </Badge>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {anomaly.actual_cases} {t('actual')} / {anomaly.expected_cases.toFixed(0)} {t('expected')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-400 flex-col">
                  <FiZap className="h-8 w-8 mb-2 opacity-30" />
                  {t('no_anomalies')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Scores */}
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="flex items-center text-lg text-slate-800">
                <FiShield className="mr-2 text-indigo-500" />
                {t('regional_risk_scores')}
              </CardTitle>
              <CardDescription>{t('risk_score_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {isRiskScoresLoading ? (
                <LoadingSkeleton rows={4} />
              ) : riskScores?.results && riskScores.results.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {riskScores.results.slice(0, 8).map((score) => (
                    <div key={score.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 hover:border-indigo-200 transition-colors shadow-sm">
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{score.region_details?.name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {score.disease_name} • {new Date(score.calculation_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium text-slate-600">
                          {(score.risk_probability * 100).toFixed(1)}%
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${RISK_LEVEL_COLORS[score.risk_level] || 'bg-gray-100 border-gray-200'}`}>
                          {getRiskLabel(score.risk_level)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-400 flex-col">
                  <FiShield className="h-8 w-8 mb-2 opacity-30" />
                  {t('no_risk_scores')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Diseases + Regional Comparison */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Top Trending Diseases */}
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-pink-500 to-rose-500" />
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-slate-800">{t('trending_diseases')}</CardTitle>
              <CardDescription>{t('trending_growth_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {dashboard?.top_diseases && dashboard.top_diseases.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.top_diseases.map((disease, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold text-sm">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-800">{disease.disease_name}</p>
                          <p className="text-xs text-slate-400 font-mono">{disease.disease_code}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-800">{disease.total_cases.toLocaleString()}</p>
                        <p className={`text-xs font-bold ${disease.growth_rate > 0 ? 'text-rose-600' : disease.growth_rate < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {disease.growth_rate > 0 ? '↑' : ''}{disease.growth_rate}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-12 text-slate-400">{t('no_trending_data')}</p>
              )}
            </CardContent>
          </Card>

          {/* Regional Comparison */}
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-slate-800">{t('regional_comparison')}</CardTitle>
              <CardDescription>{t('regional_comparison_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {heatMapData && heatMapData.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {heatMapData
                    .sort((a, b) => b.cases_per_100k - a.cases_per_100k)
                    .slice(0, 10)
                    .map((region, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                        onClick={() => handleRegionClick(region)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 text-slate-400 font-bold text-xs ring-1 ring-slate-200">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-800">{region.region_name}</p>
                            <p className="text-xs text-slate-500">{region.case_count} cases</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right hidden sm:block">
                            <p className="font-bold text-sm text-slate-800">{region.cases_per_100k.toFixed(2)}</p>
                            <p className="text-[10px] text-slate-400 uppercase">{t('per_100k')}</p>
                          </div>
                          <Badge
                            variant={
                              region.risk_level.toLowerCase() === 'critical' ? 'destructive' :
                                region.risk_level.toLowerCase() === 'high' ? 'warning' : 'secondary'
                            }
                            className={
                              region.risk_level.toLowerCase() === 'critical' ? 'bg-rose-100 text-rose-800 hover:bg-rose-200' :
                                region.risk_level.toLowerCase() === 'high' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' :
                                  'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }
                          >
                            {region.risk_level}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-center py-12 text-slate-400">{t('no_regional_data')}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Clusters */}
        {clusters?.results && clusters.results.length > 0 && (
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-orange-400 to-amber-400" />
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="flex items-center text-slate-800">
                <FiMapPin className="mr-2 text-orange-500" />
                {t('active_clusters_title')} ({clusters.count})
              </CardTitle>
              <CardDescription>{t('cluster_detection_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clusters.results.slice(0, 6).map((cluster) => (
                  <div key={cluster.id} className="p-4 bg-orange-50/30 rounded-xl border border-orange-100 hover:border-orange-200 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm text-slate-800">{cluster.disease_name}</p>
                      <Badge className={
                        cluster.severity === 'critical' ? 'bg-rose-500 hover:bg-rose-600' :
                          cluster.severity === 'high' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-slate-500 hover:bg-slate-600'
                      }>
                        {cluster.severity}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1.5 mt-3">
                      <div className="flex justify-between border-b border-orange-100 pb-1">
                        <span>Cases</span>
                        <span className="font-bold text-slate-800">{cluster.total_cases}</span>
                      </div>
                      <div className="flex justify-between border-b border-orange-100 pb-1">
                        <span>{t('radius')}</span>
                        <span className="font-bold text-slate-800">{cluster.radius_km.toFixed(1)} km</span>
                      </div>
                      <div className="flex justify-between border-b border-orange-100 pb-1">
                        <span>{t('population')}</span>
                        <span className="font-bold text-slate-800">{cluster.total_population?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span>{t('detected')}</span>
                        <span className="font-bold text-slate-800">{new Date(cluster.detection_date).toLocaleDateString()}</span>
                      </div>

                      {cluster.affected_region_names && cluster.affected_region_names.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-orange-100">
                          <div className="flex flex-wrap gap-1">
                            {cluster.affected_region_names.slice(0, 3).map((r, i) => (
                              <span key={i} className="bg-white/80 px-1.5 py-0.5 rounded text-[10px] border border-orange-100 text-orange-800 truncate max-w-full">
                                {r}
                              </span>
                            ))}
                            {cluster.affected_region_names.length > 3 && (
                              <span className="bg-white/80 px-1.5 py-0.5 rounded text-[10px] border border-orange-100 text-orange-800">
                                +{cluster.affected_region_names.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
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
