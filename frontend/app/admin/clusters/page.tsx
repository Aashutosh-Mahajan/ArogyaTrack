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
import type { PaginatedResponse, Cluster } from '@/types';
import { FiMapPin, FiRefreshCw } from 'react-icons/fi';

function ClustersPage(): React.JSX.Element {
  const [activeOnly, setActiveOnly] = useState(true);
  const [selectedDisease, setSelectedDisease] = useState('');

  const { data: clusters, refetch } = useQuery<PaginatedResponse<Cluster>>({
    queryKey: ['clusters-page', activeOnly, selectedDisease],
    queryFn: () => api.surveillance.getClusters({
      is_active: activeOnly || undefined,
      disease_code: selectedDisease || undefined,
      page_size: 20,
    }),
  });

  const getSeverityColor = (sev: string) => {
    const map: Record<string, 'destructive' | 'warning' | 'secondary' | 'outline'> = {
      critical: 'destructive',
      high: 'warning',
      medium: 'secondary',
      low: 'outline',
    };
    return map[sev] || 'secondary';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Disease Clusters</h1>
            <p className="text-gray-600 mt-1">DBSCAN geo-clustering analysis results</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <FiRefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
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
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="rounded" />
                Active only
              </label>
              <span className="text-sm text-gray-500 ml-auto self-center">
                {clusters?.count || 0} clusters found
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Clusters Grid */}
        {clusters?.results && clusters.results.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clusters.results.map((cluster) => (
              <Card key={cluster.id} className={cluster.severity === 'critical' ? 'border-red-200' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{cluster.disease_name}</CardTitle>
                    <Badge variant={getSeverityColor(cluster.severity)}>
                      {cluster.severity}
                    </Badge>
                  </div>
                  <CardDescription>{cluster.disease_code} • Detected {cluster.detection_date}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Cases</span>
                      <span className="font-semibold">{cluster.total_cases.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Population</span>
                      <span className="font-medium">{cluster.total_population?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Radius</span>
                      <span className="font-medium">{cluster.radius_km.toFixed(1)} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Centroid</span>
                      <span className="font-mono text-xs">
                        {cluster.centroid_lat.toFixed(4)}, {cluster.centroid_lon.toFixed(4)}
                      </span>
                    </div>
                    {cluster.growth_rate !== null && cluster.growth_rate !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Growth Rate</span>
                        <span className={`font-medium ${cluster.growth_rate > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {cluster.growth_rate > 0 ? '+' : ''}{cluster.growth_rate.toFixed(1)}%
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <Badge variant={cluster.is_active ? 'destructive' : 'secondary'}>
                        {cluster.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {cluster.affected_region_names && cluster.affected_region_names.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500 mb-1">Affected Regions:</p>
                        <div className="flex flex-wrap gap-1">
                          {cluster.affected_region_names.map((name, i) => (
                            <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <FiMapPin className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No clusters found matching the current filters.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

export default withAuth(ClustersPage, ['admin', 'authority']);
