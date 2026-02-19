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
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { PaginatedResponse, Region, SurveillanceData, HeatMapData, EnvironmentalData } from '@/types';
import { FiMapPin, FiRefreshCw, FiFilter, FiActivity, FiCloud, FiDroplet } from 'react-icons/fi';

const DynamicMap = dynamic(
  () => import('@/components/maps/DynamicMap').then((mod) => mod.DynamicMap),
  { ssr: false, loading: () => <div className="h-[500px] bg-gray-100 animate-pulse rounded-xl" /> }
);

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

function SurveillancePage(): React.JSX.Element {
  const { t } = useLanguage();
  const [selectedDisease, setSelectedDisease] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: regions } = useQuery<PaginatedResponse<Region>>({
    queryKey: ['regions'],
    queryFn: () => api.surveillance.getRegions({ page_size: 100 }),
  });

  const { data: heatMapData, refetch: refetchMap, isLoading: isMapLoading } = useQuery<HeatMapData[]>({
    queryKey: ['heat-map', selectedDisease],
    queryFn: () => api.surveillance.getHeatMap({ disease_code: selectedDisease || undefined }),
  });

  const { data: surveillanceData, refetch: refetchData, isLoading: isDataLoading } = useQuery<PaginatedResponse<SurveillanceData>>({
    queryKey: ['surveillance-data', selectedDisease, selectedRegion, dateFrom, dateTo],
    queryFn: () => api.surveillance.getSurveillanceData({
      disease_code: selectedDisease || undefined,
      region_id: selectedRegion || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
  });

  const { data: envData, isLoading: isEnvLoading } = useQuery<PaginatedResponse<EnvironmentalData>>({
    queryKey: ['environmental-data', selectedRegion],
    queryFn: () => api.surveillance.getEnvironmentalData({
      region_id: selectedRegion || undefined,
      page_size: 10,
    }),
    enabled: !!selectedRegion,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('surveillance_data_title')}</h1>
            <p className="text-slate-600 mt-1">{t('surveillance_data_subtitle')}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => { refetchMap(); refetchData(); }}
            className="bg-white/80 backdrop-blur-sm border-slate-200 hover:bg-slate-50 shadow-sm"
          >
            <FiRefreshCw className="mr-2 h-4 w-4" /> {t('refresh_data')}
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
            <CardTitle className="flex items-center text-base text-slate-800">
              <FiFilter className="mr-2 text-indigo-500" /> {t('filters')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <select
                value={selectedDisease}
                onChange={(e) => setSelectedDisease(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
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
              </select>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">{t('all_regions')}</option>
                {regions?.results?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}, {r.district}</option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none uppercase text-slate-600"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none uppercase text-slate-600"
              />
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="flex items-center text-slate-800">
              <FiMapPin className="mr-2 text-blue-600" /> {t('disease_distribution_map')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isMapLoading ? (
              <div className="p-1"><LoadingSkeleton height="h-[500px]" /></div>
            ) : heatMapData && heatMapData.length > 0 ? (
              <div className="rounded-b-xl overflow-hidden">
                <DynamicMap data={heatMapData} />
              </div>
            ) : (
              <div className="h-[500px] flex items-center justify-center bg-slate-50 flex-col text-slate-400">
                <FiMapPin className="h-10 w-10 mb-3 opacity-30" />
                <p>{t('no_map_data')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-slate-800">{t('surveillance_records')} ({surveillanceData?.count || 0})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isDataLoading ? (
              <div className="p-6"><LoadingSkeleton rows={5} /></div>
            ) : surveillanceData?.results && surveillanceData.results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr className="border-b border-slate-100 text-left">
                      <th className="px-6 py-3 font-semibold">{t('date')}</th>
                      <th className="px-6 py-3 font-semibold">{t('regions')}</th>
                      <th className="px-6 py-3 font-semibold">{t('diagnosis')}</th>
                      <th className="px-6 py-3 font-semibold text-right">{t('cases')}</th>
                      <th className="px-6 py-3 font-semibold text-right">{t('cases_per_100k_col')}</th>
                      <th className="px-6 py-3 font-semibold text-right">{t('severity_col')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {surveillanceData.results.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{row.date}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">{row.region_name || row.region_details?.name}</td>
                        <td className="px-6 py-4 text-slate-600">{row.disease_name} <span className="text-slate-400 text-xs">({row.disease_code})</span></td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">{row.case_count}</td>
                        <td className="px-6 py-4 text-right font-mono text-slate-600">{row.cases_per_100k?.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <Badge variant="outline" className={
                            (row.average_severity || 0) > 0.7 ? 'border-rose-200 text-rose-700 bg-rose-50' :
                              (row.average_severity || 0) > 0.4 ? 'border-orange-200 text-orange-700 bg-orange-50' :
                                'border-emerald-200 text-emerald-700 bg-emerald-50'
                          }>
                            {row.average_severity?.toFixed(2)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-12 text-slate-400">{t('no_surveillance_data')}</p>
            )}
          </CardContent>
        </Card>

        {/* Environmental Data */}
        {selectedRegion && (
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="flex items-center text-slate-800">
                <FiCloud className="mr-2 text-teal-600" /> {t('environmental_data')}
              </CardTitle>
              <CardDescription>{t('environmental_data_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isEnvLoading ? (
                <div className="p-6"><LoadingSkeleton rows={3} /></div>
              ) : envData?.results && envData.results.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr className="border-b border-slate-100 text-left">
                        <th className="px-6 py-3 font-semibold">{t('date')}</th>
                        <th className="px-6 py-3 font-semibold text-right">{t('temp')}</th>
                        <th className="px-6 py-3 font-semibold text-right">{t('humidity')}</th>
                        <th className="px-6 py-3 font-semibold text-right">{t('rainfall')}</th>
                        <th className="px-6 py-3 font-semibold text-right">{t('aqi')}</th>
                        <th className="px-6 py-3 font-semibold text-right">{t('pm25')}</th>
                        <th className="px-6 py-3 font-semibold text-right">{t('pm10')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {envData.results.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">{row.date}</td>
                          <td className="px-6 py-4 text-right text-slate-700">{row.temperature ?? '-'}</td>
                          <td className="px-6 py-4 text-right text-slate-700">{row.humidity ?? '-'}</td>
                          <td className="px-6 py-4 text-right text-slate-700">{row.rainfall ?? '-'}</td>
                          <td className="px-6 py-4 text-right">
                            <span className={`font-bold ${(row.aqi || 0) > 100 ? 'text-rose-600' :
                                (row.aqi || 0) > 50 ? 'text-amber-600' : 'text-emerald-600'
                              }`}>
                              {row.aqi ?? '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-slate-600">{row.pm25 ?? '-'}</td>
                          <td className="px-6 py-4 text-right text-slate-600">{row.pm10 ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-12 text-slate-400">No environmental data for this region</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

export default withAuth(SurveillancePage, ['admin', 'authority']);
