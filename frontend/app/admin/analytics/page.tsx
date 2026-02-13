'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { PaginatedResponse, DiseaseStats, RiskScore, Anomaly, AdminDashboardData } from '@/types';
import { FiTrendingUp, FiRefreshCw, FiShield, FiZap } from 'react-icons/fi';
import { BarChartComponent, LineChartComponent } from '@/components/charts/Charts';

const RISK_LEVEL_LABELS: Record<number, string> = { 0: 'Low', 1: 'Medium', 2: 'High', 3: 'Critical' };
const RISK_LEVEL_COLORS: Record<number, string> = {
  0: 'bg-green-100 text-green-800',
  1: 'bg-yellow-100 text-yellow-800',
  2: 'bg-orange-100 text-orange-800',
  3: 'bg-red-100 text-red-800',
};

function AnalyticsPage(): React.JSX.Element {
  const [selectedDisease, setSelectedDisease] = useState('');

  const { data: dashboard } = useQuery<AdminDashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.surveillance.getDashboard(),
  });

  const { data: diseaseStats } = useQuery<DiseaseStats[]>({
    queryKey: ['disease-stats'],
    queryFn: () => api.surveillance.getDiseaseStats(),
  });

  const { data: riskScores } = useQuery<PaginatedResponse<RiskScore>>({
    queryKey: ['risk-scores', selectedDisease],
    queryFn: () => api.surveillance.getRiskScores({
      disease_code: selectedDisease || undefined,
      ordering: '-risk_level',
      page_size: 20,
    }),
  });

  const { data: anomalies } = useQuery<PaginatedResponse<Anomaly>>({
    queryKey: ['anomalies-analytics', selectedDisease],
    queryFn: () => api.surveillance.getAnomalies({
      disease_code: selectedDisease || undefined,
      page_size: 20,
    }),
  });

  const { data: mlModels } = useQuery({
    queryKey: ['ml-models'],
    queryFn: () => api.surveillance.getMLModels(),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 mt-1">ML-powered disease analytics and insights</p>
          </div>
          <select value={selectedDisease} onChange={(e) => setSelectedDisease(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm">
            <option value="">All Diseases</option>
            <option value="A09">Dengue</option>
            <option value="A15">Tuberculosis</option>
            <option value="A00">Cholera</option>
            <option value="B01">Chickenpox</option>
          </select>
        </div>

        {/* ML Models Info */}
        {mlModels && (
          <Card>
            <CardHeader>
              <CardTitle>Deployed ML Models</CardTitle>
              <CardDescription>Model details and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(Array.isArray(mlModels) ? mlModels : []).map((model: any, idx: number) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">{model.name}</p>
                      <Badge variant={model.loaded ? 'secondary' : 'destructive'}>
                        {model.loaded ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{model.type}</p>
                    {model.metrics && (
                      <div className="text-xs space-y-1">
                        {Object.entries(model.metrics).map(([key, val]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-500">{key}:</span>
                            <span className="font-mono">{typeof val === 'number' ? (val as number).toFixed(4) : String(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Disease Statistics Chart */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FiTrendingUp className="mr-2" /> Disease Case Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {diseaseStats && diseaseStats.length > 0 ? (
                <BarChartComponent
                  data={diseaseStats.map((d) => ({
                    name: d.disease_name?.substring(0, 15) || 'Unknown',
                    cases: d.total_cases,
                  }))}
                  dataKey="cases"
                  xAxisKey="name"
                  color="#6366f1"
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FiTrendingUp className="mr-2" /> Trending Diseases
              </CardTitle>
              <CardDescription>Week-over-week growth rates</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.top_diseases && dashboard.top_diseases.length > 0 ? (
                <BarChartComponent
                  data={dashboard.top_diseases.map((d) => ({
                    name: d.disease_name?.substring(0, 12) || 'Unknown',
                    growth: d.growth_rate,
                  }))}
                  dataKey="growth"
                  xAxisKey="name"
                  color="#ef4444"
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No trending data
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Risk Scores Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FiShield className="mr-2" /> Regional Risk Assessment
            </CardTitle>
            <CardDescription>XGBoost outbreak classifier results ({riskScores?.count || 0} records)</CardDescription>
          </CardHeader>
          <CardContent>
            {riskScores?.results && riskScores.results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium">Region</th>
                      <th className="pb-3 font-medium">Disease</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium text-right">Probability</th>
                      <th className="pb-3 font-medium text-right">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskScores.results.map((s) => (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="py-3">{s.region_details?.name || 'Unknown'}</td>
                        <td className="py-3">{s.disease_name}</td>
                        <td className="py-3">{s.calculation_date}</td>
                        <td className="py-3 text-right font-mono">{(s.risk_probability * 100).toFixed(1)}%</td>
                        <td className="py-3 text-right">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${RISK_LEVEL_COLORS[s.risk_level] || 'bg-gray-100'}`}>
                            {RISK_LEVEL_LABELS[s.risk_level] || s.risk_level_display}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">No risk scores available</p>
            )}
          </CardContent>
        </Card>

        {/* Anomalies Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FiZap className="mr-2" /> Anomaly Detection Results
            </CardTitle>
            <CardDescription>Isolation Forest anomaly detection ({anomalies?.count || 0} records)</CardDescription>
          </CardHeader>
          <CardContent>
            {anomalies?.results && anomalies.results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium">Region</th>
                      <th className="pb-3 font-medium">Disease</th>
                      <th className="pb-3 font-medium">Detected</th>
                      <th className="pb-3 font-medium text-right">Actual</th>
                      <th className="pb-3 font-medium text-right">Expected</th>
                      <th className="pb-3 font-medium text-right">Deviation</th>
                      <th className="pb-3 font-medium text-right">Score</th>
                      <th className="pb-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalies.results.map((a) => (
                      <tr key={a.id} className="border-b hover:bg-gray-50">
                        <td className="py-3">{a.region_details?.name || 'Unknown'}</td>
                        <td className="py-3">{a.disease_name}</td>
                        <td className="py-3">{a.detection_date}</td>
                        <td className="py-3 text-right font-medium">{a.actual_cases}</td>
                        <td className="py-3 text-right">{a.expected_cases.toFixed(0)}</td>
                        <td className="py-3 text-right font-medium text-red-600">+{a.deviation_percentage.toFixed(1)}%</td>
                        <td className="py-3 text-right font-mono">{a.anomaly_score.toFixed(3)}</td>
                        <td className="py-3 text-right">
                          <Badge variant={a.is_resolved ? 'secondary' : 'destructive'}>
                            {a.is_resolved ? 'Resolved' : 'Active'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">No anomalies detected</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(AnalyticsPage, ['admin', 'authority']);
