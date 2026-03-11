'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { PaginatedResponse, Forecast, Region } from '@/types';
import { FiActivity, FiRefreshCw, FiZap } from 'react-icons/fi';
import { ForecastChart, LineChartComponent } from '@/components/charts/Charts';

function ForecastsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [selectedDisease, setSelectedDisease] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [pipelineDisease, setPipelineDisease] = useState('A90');

  const { data: regions } = useQuery<PaginatedResponse<Region>>({
    queryKey: ['regions'],
    queryFn: () => api.surveillance.getRegions({ page_size: 100 }),
  });

  const { data: forecasts, refetch } = useQuery<PaginatedResponse<Forecast>>({
    queryKey: ['forecasts-page', selectedDisease, selectedRegion],
    queryFn: () => api.surveillance.getForecasts({
      disease_code: selectedDisease || undefined,
      region_id: selectedRegion || undefined,
      page_size: 30,
    }),
  });

  const runPipelineMutation = useMutation({
    mutationFn: (diseaseCode: string) => api.surveillance.runMLPipeline(diseaseCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecasts-page'] });
      queryClient.invalidateQueries({ queryKey: ['ml-pipeline-status'] });
    },
  });

  // Group forecasts by region for chart
  const chartData = forecasts?.results
    ?.sort((a, b) => a.prediction_date.localeCompare(b.prediction_date))
    .slice(0, 14)
    .map((f) => ({
      date: new Date(f.prediction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      forecast: Math.round(f.predicted_cases),
      lower_bound: Math.round(f.lower_bound),
      upper_bound: Math.round(f.upper_bound),
      actual: 0,
    })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Forecasts</h1>
            <p className="text-gray-600 mt-1">Prophet time-series forecasting with environmental regressors</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={pipelineDisease} onChange={(e) => setPipelineDisease(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm">
              <option value="A90">Dengue (A90)</option>
              <option value="U07.1">COVID-19 (U07.1)</option>
              <option value="B50.0">Malaria (B50.0)</option>
              <option value="J18.9">Pneumonia (J18.9)</option>
              <option value="J10.1">Influenza (J10.1)</option>
              <option value="A09">Gastroenteritis (A09)</option>
            </select>
            <Button size="sm"
              onClick={() => runPipelineMutation.mutate(pipelineDisease)}
              disabled={runPipelineMutation.isPending}>
              {runPipelineMutation.isPending ? (
                <FiRefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FiZap className="mr-2 h-4 w-4" />
              )}
              Generate Forecasts
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <select value={selectedDisease} onChange={(e) => setSelectedDisease(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm">
                <option value="">All Diseases</option>
                <option value="A90">Dengue Fever</option>
                <option value="U07.1">COVID-19</option>
                <option value="B50.0">Malaria</option>
                <option value="J18.9">Pneumonia</option>
                <option value="J10.1">Influenza</option>
                <option value="A09">Gastroenteritis</option>
                <option value="B05">Measles</option>
              </select>
              <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm">
                <option value="">All Regions</option>
                {regions?.results?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}, {r.district}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
                <FiRefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Forecast Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FiActivity className="mr-2" /> Forecast Visualization
            </CardTitle>
            <CardDescription>
              Predicted case counts with confidence intervals
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ForecastChart data={chartData} />
            ) : (
              <div className="h-[350px] flex items-center justify-center text-gray-500">
                No forecast data available — run the ML pipeline to generate forecasts
              </div>
            )}
          </CardContent>
        </Card>

        {/* Forecasts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Forecast Details ({forecasts?.count || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {forecasts?.results && forecasts.results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium">Region</th>
                      <th className="pb-3 font-medium">Disease</th>
                      <th className="pb-3 font-medium">Generated</th>
                      <th className="pb-3 font-medium">Prediction Date</th>
                      <th className="pb-3 font-medium text-right">Predicted</th>
                      <th className="pb-3 font-medium text-right">Lower</th>
                      <th className="pb-3 font-medium text-right">Upper</th>
                      <th className="pb-3 font-medium text-right">Confidence</th>
                      <th className="pb-3 font-medium text-right">Horizon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecasts.results.map((f) => (
                      <tr key={f.id} className="border-b hover:bg-gray-50">
                        <td className="py-3">{f.region_details?.name || 'National'}</td>
                        <td className="py-3">{f.disease_name}</td>
                        <td className="py-3">{f.forecast_date}</td>
                        <td className="py-3">{f.prediction_date}</td>
                        <td className="py-3 text-right font-semibold">{Math.round(f.predicted_cases).toLocaleString()}</td>
                        <td className="py-3 text-right text-gray-500">{Math.round(f.lower_bound).toLocaleString()}</td>
                        <td className="py-3 text-right text-gray-500">{Math.round(f.upper_bound).toLocaleString()}</td>
                        <td className="py-3 text-right font-mono">{(f.confidence * 100).toFixed(0)}%</td>
                        <td className="py-3 text-right">
                          <Badge variant="outline">{f.horizon_days}d</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">
                No forecast data available. Run the ML pipeline to generate forecasts.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(ForecastsPage, ['admin', 'authority']);
