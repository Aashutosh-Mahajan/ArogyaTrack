'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { PaginatedResponse, DiseaseStats, RiskScore, Anomaly, AdminDashboardData } from '@/types';
import { FiTrendingUp, FiShield, FiZap, FiActivity, FiCpu, FiLayers } from 'react-icons/fi';
import { BarChartComponent } from '@/components/charts/Charts';

const RISK_LEVEL_COLORS: Record<number, string> = {
  0: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  1: 'bg-amber-100 text-amber-800 border-amber-200',
  2: 'bg-orange-100 text-orange-800 border-orange-200',
  3: 'bg-rose-100 text-rose-800 border-rose-200',
};

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
        <FiActivity className="h-6 w-6 text-gray-400 animate-spin" />
      </div>
    </div>
  );
}

function AnalyticsPage(): React.JSX.Element {
  const { t } = useLanguage();
  const [selectedDisease, setSelectedDisease] = useState('');

  const { data: dashboard, isLoading: isDashboardLoading } = useQuery<AdminDashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.surveillance.getDashboard(),
  });

  const { data: diseaseStats, isLoading: isDiseaseStatsLoading } = useQuery<DiseaseStats[]>({
    queryKey: ['disease-stats'],
    queryFn: () => api.surveillance.getDiseaseStats(),
  });

  const { data: riskScores, isLoading: isRiskScoresLoading } = useQuery<PaginatedResponse<RiskScore>>({
    queryKey: ['risk-scores', selectedDisease],
    queryFn: () => api.surveillance.getRiskScores({
      disease_code: selectedDisease || undefined,
      ordering: '-risk_level',
      page_size: 20,
    }),
  });

  const { data: anomalies, isLoading: isAnomaliesLoading } = useQuery<PaginatedResponse<Anomaly>>({
    queryKey: ['anomalies-analytics', selectedDisease],
    queryFn: () => api.surveillance.getAnomalies({
      disease_code: selectedDisease || undefined,
      page_size: 20,
    }),
  });

  const { data: mlModels, isLoading: isMlModelsLoading } = useQuery({
    queryKey: ['ml-models'],
    queryFn: () => api.surveillance.getMLModels(),
  });

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('analytics_title')}</h1>
            <p className="text-slate-600 mt-1">{t('analytics_subtitle')}</p>
          </div>
          <select
            value={selectedDisease}
            onChange={(e) => setSelectedDisease(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
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
        </div>

        {/* ML Models Info */}
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="flex items-center text-slate-800">
              <FiCpu className="mr-2 text-indigo-600" />
              {t('deployed_ml_models')}
            </CardTitle>
            <CardDescription>{t('model_details_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {isMlModelsLoading ? (
              <LoadingSkeleton height="h-[200px]" />
            ) : mlModels ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(Array.isArray(mlModels) ? mlModels : []).map((model: any, idx: number) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm text-slate-800">{model.name}</p>
                      <Badge variant={model.loaded ? 'secondary' : 'destructive'} className={model.loaded ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : ''}>
                        {model.loaded ? t('active') : t('inactive')}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mb-2 font-mono bg-slate-100 inline-block px-1.5 py-0.5 rounded">{model.version}</p>
                    {model.n_features && (
                      <p className="text-xs text-indigo-600 mb-2 font-medium flex items-center">
                        <FiLayers className="mr-1" />
                        {model.n_features} {t('features')}
                      </p>
                    )}
                    {model.corrector_available !== undefined && (
                      <p className="text-xs mb-1 text-slate-600">
                        {t('gb_corrector')}: <span className={model.corrector_available ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{model.corrector_available ? 'Yes' : 'No'}</span>
                        {model.scoring_method && <span className="text-slate-400 ml-1">({model.scoring_method})</span>}
                      </p>
                    )}
                    {model.xgb_available !== undefined && (
                      <p className="text-xs mb-1 text-slate-600">
                        {t('xgboost_component')}: <span className={model.xgb_available ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>{model.xgb_available ? 'Yes' : 'No'}</span>
                      </p>
                    )}
                    {model.risk_tiers && (
                      <div className="text-xs mb-2 space-y-1 mt-3 pt-2 border-t border-slate-200">
                        <p className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider mb-1">{t('risk_tiers')}</p>
                        {Object.entries(model.risk_tiers).map(([tier, range]: [string, any]) => (
                          <div key={tier} className="flex justify-between items-center">
                            <span className="capitalize text-slate-600 font-medium">{tier}:</span>
                            <span className="font-mono text-slate-500 bg-slate-100 px-1 rounded text-[10px]">{Array.isArray(range) ? range.join(', ') : range}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">No ML models found</div>
            )}
          </CardContent>
        </Card>

        {/* Disease Statistics Chart */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="flex items-center text-slate-800">
                <FiTrendingUp className="mr-2 text-indigo-500" /> {t('disease_case_distribution')}
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
                  }))}
                  dataKey="cases"
                  xAxisKey="name"
                  color="#6366f1"
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  {t('no_disease_data')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="flex items-center text-slate-800">
                <FiActivity className="mr-2 text-rose-500" /> {t('trending_diseases')}
              </CardTitle>
              <CardDescription>{t('trending_growth_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {isDashboardLoading ? (
                <LoadingSkeleton height="h-[300px]" />
              ) : dashboard?.top_diseases && dashboard.top_diseases.length > 0 ? (
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
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  {t('no_trending_data')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Risk Scores Table */}
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="flex items-center text-slate-800">
              <FiShield className="mr-2 text-emerald-600" /> {t('regional_risk_assessment')}
            </CardTitle>
            <CardDescription>{t('risk_score_desc')} ({riskScores?.count || 0} records)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isRiskScoresLoading ? (
              <div className="p-6"><LoadingSkeleton rows={5} /></div>
            ) : riskScores?.results && riskScores.results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr className="text-left border-b border-slate-100">
                      <th className="px-6 py-3 font-semibold">{t('regions')}</th>
                      <th className="px-6 py-3 font-semibold">{t('diagnosis')}</th>
                      <th className="px-6 py-3 font-semibold">{t('date')}</th>
                      <th className="px-6 py-3 font-semibold text-right">{t('probability')}</th>
                      <th className="px-6 py-3 font-semibold text-right">{t('risk')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {riskScores.results.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{s.region_details?.name || 'Unknown'}</td>
                        <td className="px-6 py-4 text-slate-600">{s.disease_name}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">{s.calculation_date}</td>
                        <td className="px-6 py-4 text-right font-mono text-slate-700">{(s.risk_probability * 100).toFixed(1)}%</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${RISK_LEVEL_COLORS[s.risk_level] || 'bg-gray-100 border-gray-200'}`}>
                            {getRiskLabel(s.risk_level)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-12 text-slate-400">{t('no_risk_scores')}</p>
            )}
          </CardContent>
        </Card>

        {/* Anomalies Table */}
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="flex items-center text-slate-800">
              <FiZap className="mr-2 text-amber-500" /> {t('anomaly_detection_results')}
            </CardTitle>
            <CardDescription>{t('anomaly_detection_desc')} ({anomalies?.count || 0} records)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isAnomaliesLoading ? (
              <div className="p-6"><LoadingSkeleton rows={5} /></div>
            ) : anomalies?.results && anomalies.results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr className="text-left border-b border-slate-100">
                      <th className="px-6 py-3 font-semibold">{t('regions')}</th>
                      <th className="px-6 py-3 font-semibold">{t('diagnosis')}</th>
                      <th className="px-6 py-3 font-semibold">{t('detected')}</th>
                      <th className="px-6 py-3 font-semibold text-right">{t('actual')}</th>
                      <th className="px-6 py-3 font-semibold text-right">{t('expected')}</th>
                      <th className="px-6 py-3 font-semibold text-right">{t('deviation')}</th>
                      <th className="px-6 py-3 font-semibold text-right">{t('score')}</th>
                      <th className="px-6 py-3 font-semibold text-right">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {anomalies.results.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{a.region_details?.name || 'Unknown'}</td>
                        <td className="px-6 py-4 text-slate-600">{a.disease_name}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">{new Date(a.detection_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">{a.actual_cases}</td>
                        <td className="px-6 py-4 text-right text-slate-500 font-mono">{a.expected_cases.toFixed(0)}</td>
                        <td className="px-6 py-4 text-right font-bold text-rose-600">+{a.deviation_percentage.toFixed(1)}%</td>
                        <td className="px-6 py-4 text-right font-mono text-xs text-slate-400">{a.anomaly_score.toFixed(3)}</td>
                        <td className="px-6 py-4 text-right">
                          <Badge variant={a.is_resolved ? 'secondary' : 'destructive'} className={a.is_resolved ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-800'}>
                            {a.is_resolved ? t('resolved') : t('active')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-12 text-slate-400">{t('no_anomalies')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(AnalyticsPage, ['admin', 'authority']);
