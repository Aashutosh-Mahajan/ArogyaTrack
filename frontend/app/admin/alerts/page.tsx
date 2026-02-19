'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { PaginatedResponse, Alert } from '@/types';
import { FiAlertTriangle, FiRefreshCw, FiCheck, FiCheckCircle, FiArrowUp, FiFilter, FiActivity, FiMapPin, FiMail } from 'react-icons/fi';

function LoadingSkeleton({ height = 'h-[200px]', rows }: { height?: string; rows?: number }) {
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

function AlertsPage(): React.JSX.Element {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('active');
  const [severityFilter, setSeverityFilter] = useState('');

  const { data: alerts, refetch, isLoading: isAlertsLoading } = useQuery<PaginatedResponse<Alert>>({
    queryKey: ['alerts-page', statusFilter, severityFilter],
    queryFn: () => api.surveillance.getAlerts({
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      page_size: 20,
    }),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => api.surveillance.acknowledgeAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-page'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.surveillance.resolveAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-page'] });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: (id: string) => api.surveillance.escalateAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-page'] });
    },
  });

  const getSeverityBadge = (severity: string) => {
    const map: Record<string, string> = {
      critical: 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200',
      medium: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
      low: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200',
    };
    return map[severity] || 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-rose-50 text-rose-700 border-rose-100',
      acknowledged: 'bg-amber-50 text-amber-700 border-amber-100',
      resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      false_positive: 'bg-slate-50 text-slate-600 border-slate-100',
    };
    return map[status] || 'bg-gray-50 text-gray-600 border-gray-100';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('alerts_management_title')}</h1>
            <p className="text-slate-600 mt-1">{t('alerts_management_desc')}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="bg-white/80 backdrop-blur-sm border-slate-200 hover:bg-slate-50 shadow-sm"
          >
            <FiRefreshCw className="mr-2 h-4 w-4" /> {t('refresh_data')}
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-md overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-rose-400 to-orange-400" />
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
            <CardTitle className="flex items-center text-base text-slate-800">
              <FiFilter className="mr-2 text-rose-500" /> {t('filters')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-rose-500 outline-none"
              >
                <option value="">{t('all_status')}</option>
                <option value="active">{t('active')}</option>
                <option value="acknowledged">{t('acknowledged')}</option>
                <option value="resolved">{t('resolved')}</option>
                <option value="false_positive">{t('false_positive')}</option>
              </select>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-rose-500 outline-none"
              >
                <option value="">{t('all_severity')}</option>
                <option value="critical">{t('critical')}</option>
                <option value="high">{t('high')}</option>
                <option value="medium">{t('medium')}</option>
                <option value="low">{t('low')}</option>
              </select>
              <div className="sm:ml-auto flex items-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <FiAlertTriangle className="mr-2 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">
                  {alerts?.count || 0} {t('alerts_found')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alert List */}
        <div className="space-y-4">
          {isAlertsLoading ? (
            <LoadingSkeleton rows={5} />
          ) : alerts?.results && alerts.results.length > 0 ? (
            alerts.results.map((alert) => (
              <Card key={alert.id} className={`border-0 shadow-md transition-shadow hover:shadow-lg ${alert.status === 'active' ? 'bg-rose-50/30' : 'bg-white'}`}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`${getSeverityBadge(alert.severity)} uppercase tracking-wider font-bold`}>
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline" className="bg-white text-slate-600 border-slate-200">{alert.alert_type}</Badge>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${getStatusColor(alert.status)}`}>
                          {alert.status_display || alert.status}
                        </span>
                        <span className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                          {t('confidence')}: {(alert.confidence * 100).toFixed(0)}%
                        </span>
                        <span className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                          {t('level')} {alert.escalation_level}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-slate-800 leading-tight">{alert.title}</h3>
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{alert.description}</p>
                      </div>

                      {alert.recommended_actions && (
                        <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-xs">
                          <p className="font-semibold text-blue-800 mb-1">{t('actions')}:</p>
                          <p className="text-blue-700">{alert.recommended_actions}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        {alert.affected_regions_data?.map((r) => (
                          <span key={r.id} className="flex items-center bg-white px-2 py-1 rounded border border-slate-200 shadow-sm text-slate-500">
                            <FiMapPin className="mr-1" /> {r.name}
                          </span>
                        ))}
                        <span className="flex items-center">
                          <FiActivity className="mr-1" /> {new Date(alert.generated_at).toLocaleString()}
                        </span>
                        {alert.acknowledged_by_email && (
                          <span className="flex items-center text-emerald-600 font-medium">
                            <FiCheckCircle className="mr-1" /> {t('ack_by')}: {alert.acknowledged_by_email}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col gap-2 pt-2 md:pt-0">
                      {alert.status === 'active' && (
                        <Button size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          disabled={acknowledgeMutation.isPending}>
                          <FiCheck className="mr-1.5 h-3.5 w-3.5" /> {t('acknowledge')}
                        </Button>
                      )}
                      {(alert.status === 'active' || alert.status === 'acknowledged') && (
                        <>
                          <Button size="sm" variant="outline"
                            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            onClick={() => resolveMutation.mutate(alert.id)}
                            disabled={resolveMutation.isPending}>
                            <FiCheckCircle className="mr-1.5 h-3.5 w-3.5" /> {t('resolve')}
                          </Button>
                          <Button size="sm" variant="outline"
                            className="text-rose-600 border-rose-200 hover:bg-rose-50"
                            onClick={() => escalateMutation.mutate(alert.id)}
                            disabled={escalateMutation.isPending}>
                            <FiArrowUp className="mr-1.5 h-3.5 w-3.5" /> {t('escalate')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-0 shadow-sm bg-slate-50/50">
              <CardContent className="py-16 text-center text-slate-400 flex flex-col items-center">
                <FiAlertTriangle className="h-12 w-12 mb-4 opacity-20" />
                <p>{t('no_alerts_found')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(AlertsPage, ['admin', 'authority']);
