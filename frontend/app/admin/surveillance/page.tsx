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
import type { PaginatedResponse, Region, SurveillanceData, HeatMapData, EnvironmentalData } from '@/types';
import { FiMapPin, FiRefreshCw, FiFilter } from 'react-icons/fi';
import { BarChartComponent } from '@/components/charts/Charts';

const DynamicMap = dynamic(
  () => import('@/components/maps/DynamicMap').then((mod) => mod.DynamicMap),
  { ssr: false, loading: () => <div className="h-[500px] bg-gray-100 animate-pulse rounded-lg" /> }
);

function SurveillancePage(): React.JSX.Element {
  const [selectedDisease, setSelectedDisease] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: regions } = useQuery<PaginatedResponse<Region>>({
    queryKey: ['regions'],
    queryFn: () => api.surveillance.getRegions({ page_size: 100 }),
  });

  const { data: heatMapData, refetch: refetchMap } = useQuery<HeatMapData[]>({
    queryKey: ['heat-map', selectedDisease],
    queryFn: () => api.surveillance.getHeatMap({ disease_code: selectedDisease || undefined }),
  });

  const { data: surveillanceData, refetch: refetchData } = useQuery<PaginatedResponse<SurveillanceData>>({
    queryKey: ['surveillance-data', selectedDisease, selectedRegion, dateFrom, dateTo],
    queryFn: () => api.surveillance.getSurveillanceData({
      disease_code: selectedDisease || undefined,
      region_id: selectedRegion || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
  });

  const { data: envData } = useQuery<PaginatedResponse<EnvironmentalData>>({
    queryKey: ['environmental-data', selectedRegion],
    queryFn: () => api.surveillance.getEnvironmentalData({
      region_id: selectedRegion || undefined,
      page_size: 10,
    }),
    enabled: !!selectedRegion,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Surveillance Data</h1>
            <p className="text-gray-600 mt-1">Monitor disease data across regions</p>
          </div>
          <Button variant="outline" onClick={() => { refetchMap(); refetchData(); }}>
            <FiRefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <FiFilter className="mr-2" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <option value="I10">Hypertension</option>
              </select>
              <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm">
                <option value="">All Regions</option>
                {regions?.results?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}, {r.district}</option>
                ))}
              </select>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm" placeholder="From" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm" placeholder="To" />
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FiMapPin className="mr-2" /> Disease Distribution Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            {heatMapData && heatMapData.length > 0 ? (
              <DynamicMap data={heatMapData} />
            ) : (
              <div className="h-[500px] flex items-center justify-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">No map data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Surveillance Records ({surveillanceData?.count || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {surveillanceData?.results && surveillanceData.results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Region</th>
                      <th className="pb-3 font-medium">Disease</th>
                      <th className="pb-3 font-medium text-right">Cases</th>
                      <th className="pb-3 font-medium text-right">Per 100k</th>
                      <th className="pb-3 font-medium text-right">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveillanceData.results.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        <td className="py-3">{row.date}</td>
                        <td className="py-3">{row.region_name || row.region_details?.name}</td>
                        <td className="py-3">{row.disease_name} ({row.disease_code})</td>
                        <td className="py-3 text-right font-medium">{row.case_count}</td>
                        <td className="py-3 text-right">{row.cases_per_100k?.toFixed(2)}</td>
                        <td className="py-3 text-right">{row.average_severity?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">No surveillance data available</p>
            )}
          </CardContent>
        </Card>

        {/* Environmental Data */}
        {selectedRegion && envData?.results && envData.results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Environmental Data</CardTitle>
              <CardDescription>Recent environmental readings for selected region</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium text-right">Temp (°C)</th>
                      <th className="pb-3 font-medium text-right">Humidity (%)</th>
                      <th className="pb-3 font-medium text-right">Rainfall (mm)</th>
                      <th className="pb-3 font-medium text-right">AQI</th>
                      <th className="pb-3 font-medium text-right">PM2.5</th>
                      <th className="pb-3 font-medium text-right">PM10</th>
                    </tr>
                  </thead>
                  <tbody>
                    {envData.results.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        <td className="py-3">{row.date}</td>
                        <td className="py-3 text-right">{row.temperature ?? '-'}</td>
                        <td className="py-3 text-right">{row.humidity ?? '-'}</td>
                        <td className="py-3 text-right">{row.rainfall ?? '-'}</td>
                        <td className="py-3 text-right">{row.aqi ?? '-'}</td>
                        <td className="py-3 text-right">{row.pm25 ?? '-'}</td>
                        <td className="py-3 text-right">{row.pm10 ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

export default withAuth(SurveillancePage, ['admin', 'authority']);
