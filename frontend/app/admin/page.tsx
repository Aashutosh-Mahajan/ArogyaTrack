'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  DiseaseStats 
} from '@/types';
import { 
  FiAlertTriangle, 
  FiTrendingUp, 
  FiUsers, 
  FiActivity,
  FiMapPin,
  FiBarChart2,
  FiRefreshCw
} from 'react-icons/fi';
import { LineChartComponent, BarChartComponent, ForecastChart } from '@/components/charts/Charts';

// Dashboard response type
interface AdminDashboardData {
  total_cases: number;
  monitored_regions: number;
  active_outbreaks?: number;
  total_alerts?: number;
}

// Dynamic import to avoid SSR issues with Leaflet
const DynamicMap = dynamic(
  () => import('@/components/maps/DynamicMap').then((mod) => mod.DynamicMap),
  { ssr: false, loading: () => <div className="h-[600px] bg-gray-100 animate-pulse rounded-lg" /> }
);

function AdminDashboard(): React.JSX.Element {
  const [selectedDisease, setSelectedDisease] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [mapZoom, setMapZoom] = useState(5);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);

  const { data: dashboard, refetch: refetchDashboard } = useQuery<AdminDashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.surveillance.getDashboard(),
  });

  const { data: heatMapData, refetch: refetchHeatMap } = useQuery<HeatMapData[]>({
    queryKey: ['heat-map', selectedDisease, selectedRegion],
    queryFn: () => api.surveillance.getHeatMap({ 
      disease_code: selectedDisease || undefined,
      region_id: selectedRegion || undefined,
    }),
  });

  const { data: diseaseStats } = useQuery<PaginatedResponse<DiseaseStats>>({
    queryKey: ['disease-stats'],
    queryFn: () => api.surveillance.getDiseaseStats(),
  });

  const { data: alerts } = useQuery<PaginatedResponse<Alert>>({
    queryKey: ['alerts'],
    queryFn: () => api.surveillance.getAlerts({ is_active: true }),
  });

  const { data: clusters } = useQuery<PaginatedResponse<Cluster>>({
    queryKey: ['clusters'],
    queryFn: () => api.surveillance.getClusters({ is_active: true }),
  });

  const { data: forecasts } = useQuery<PaginatedResponse<Forecast>>({
    queryKey: ['forecasts'],
    queryFn: () => api.surveillance.getForecasts(),
  });

  const stats = [
    {
      title: 'Total Cases',
      value: dashboard?.total_cases?.toLocaleString() || '0',
      icon: FiUsers,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      trend: '+12%',
    },
    {
      title: 'Active Alerts',
      value: alerts?.count || 0,
      icon: FiAlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      trend: '+5',
    },
    {
      title: 'Active Clusters',
      value: clusters?.count || 0,
      icon: FiMapPin,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      trend: '+3',
    },
    {
      title: 'Monitored Regions',
      value: dashboard?.monitored_regions || '0',
      icon: FiActivity,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      trend: 'Stable',
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
              Real-time disease monitoring and analytics
            </p>
          </div>
          <Button 
            onClick={() => {
              refetchDashboard();
              refetchHeatMap();
            }}
            variant="outline"
          >
            <FiRefreshCw className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card key={index} className="card-hover">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold mt-2">
                      {stat.value}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {stat.trend}
                    </p>
                  </div>
                  <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Alerts */}
        {alerts?.results && alerts.results.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-900 flex items-center">
                <FiAlertTriangle className="mr-2" />
                Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.results.slice(0, 3).map((alert: any) => (
                  <div 
                    key={alert.id}
                    className="flex items-start justify-between p-4 bg-white rounded-lg border border-red-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="destructive">{alert.severity.toUpperCase()}</Badge>
                        <Badge variant="outline">{alert.alert_type}</Badge>
                      </div>
                      <p className="font-semibold text-gray-900">{alert.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {alert.region.name} • {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
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
                  <option value="A09">Dengue</option>
                  <option value="A15">Tuberculosis</option>
                  <option value="A00">Cholera</option>
                  <option value="B01">Chickenpox</option>
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
            {heatMapData && heatMapData.length > 0 ? (
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

        {/* Charts Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Disease Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FiTrendingUp className="mr-2" />
                Disease Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {diseaseStats?.results && diseaseStats.results.length > 0 ? (
                <BarChartComponent
                  data={diseaseStats.results.map((d) => ({
                    name: d.disease_name?.substring(0, 15) || 'Unknown',
                    cases: d.total_cases,
                  }))}
                  dataKey="cases"
                  xAxisKey="name"
                  color="#0ea5e9"
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No trend data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Forecast Visualization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FiBarChart2 className="mr-2" />
                7-Day Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              {forecasts?.results && forecasts.results.length > 0 ? (
                <ForecastChart
                  data={forecasts.results.slice(0, 7).map((f) => ({
                    date: new Date(f.forecast_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    forecast: f.predicted_cases,
                    lowerBound: f.lower_bound,
                    upperBound: f.upper_bound,
                    actual: 0, // actual_cases is not in the Forecast type
                  }))}
                />
              ) : (
                <div className="h-[350px] flex items-center justify-center text-gray-500">
                  No forecast data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Regional Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Regional Comparison</CardTitle>
            <CardDescription>
              Cases per 100k population across major regions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {heatMapData && heatMapData.length > 0 ? (
              <div className="space-y-3">
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
                        <span className="text-lg font-bold text-gray-400">
                          #{index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{region.region_name}</p>
                          <p className="text-sm text-gray-600">
                            {region.case_count} cases
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            {region.cases_per_100k.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">per 100k</p>
                        </div>
                        <Badge 
                          variant={
                            region.severity === 'critical' ? 'destructive' :
                            region.severity === 'high' ? 'warning' : 'secondary'
                          }
                        >
                          {region.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">
                No regional data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(AdminDashboard, ['admin', 'authority']);
