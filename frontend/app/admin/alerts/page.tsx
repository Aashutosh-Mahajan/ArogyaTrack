'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { PaginatedResponse, Alert } from '@/types';
import { FiAlertTriangle, FiRefreshCw, FiCheck, FiCheckCircle, FiArrowUp } from 'react-icons/fi';

function AlertsPage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('active');
  const [severityFilter, setSeverityFilter] = useState('');

  const { data: alerts, refetch } = useQuery<PaginatedResponse<Alert>>({
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
    const map: Record<string, 'destructive' | 'warning' | 'secondary' | 'outline'> = {
      critical: 'destructive',
      high: 'warning',
      medium: 'secondary',
      low: 'outline',
    };
    return map[severity] || 'secondary';
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-red-100 text-red-800',
      acknowledged: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      false_positive: 'bg-gray-100 text-gray-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Alerts Management</h1>
            <p className="text-gray-600 mt-1">Multi-model alert system — review, acknowledge, and resolve alerts</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <FiRefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
                <option value="false_positive">False Positive</option>
              </select>
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm">
                <option value="">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <span className="text-sm text-gray-500 self-center ml-auto">
                {alerts?.count || 0} alerts found
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Alert List */}
        <div className="space-y-4">
          {alerts?.results && alerts.results.length > 0 ? (
            alerts.results.map((alert) => (
              <Card key={alert.id} className={alert.status === 'active' ? 'border-red-200' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getSeverityBadge(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{alert.alert_type}</Badge>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(alert.status)}`}>
                          {alert.status_display || alert.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          Confidence: {(alert.confidence * 100).toFixed(0)}%
                        </span>
                        <span className="text-xs text-gray-400">
                          Level {alert.escalation_level}
                        </span>
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 mb-1">{alert.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{alert.description}</p>
                      
                      {alert.recommended_actions && (
                        <p className="text-xs text-gray-500 mb-2">
                          <span className="font-medium">Actions:</span> {alert.recommended_actions}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {alert.affected_regions_data?.map((r) => (
                          <span key={r.id} className="bg-gray-100 px-2 py-0.5 rounded">{r.name}</span>
                        ))}
                        <span>• {new Date(alert.generated_at).toLocaleString()}</span>
                        {alert.acknowledged_by_email && (
                          <span>• Ack by: {alert.acknowledged_by_email}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      {alert.status === 'active' && (
                        <Button size="sm" variant="outline"
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          disabled={acknowledgeMutation.isPending}>
                          <FiCheck className="mr-1 h-3 w-3" /> Acknowledge
                        </Button>
                      )}
                      {(alert.status === 'active' || alert.status === 'acknowledged') && (
                        <>
                          <Button size="sm" variant="outline"
                            onClick={() => resolveMutation.mutate(alert.id)}
                            disabled={resolveMutation.isPending}>
                            <FiCheckCircle className="mr-1 h-3 w-3" /> Resolve
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => escalateMutation.mutate(alert.id)}
                            disabled={escalateMutation.isPending}>
                            <FiArrowUp className="mr-1 h-3 w-3" /> Escalate
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <FiAlertTriangle className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No alerts found matching the current filters.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(AlertsPage, ['admin', 'authority']);
