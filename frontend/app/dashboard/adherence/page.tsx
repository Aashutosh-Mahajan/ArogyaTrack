'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { PaginatedResponse, AdherenceTracker, DoseSchedule } from '@/types';
import {
  FiHeart, FiCheckCircle, FiXCircle, FiClock,
  FiTrendingUp, FiAlertTriangle, FiCalendar,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function adherenceColor(pct: number) {
  if (pct >= 85) return 'text-green-600';
  if (pct >= 70) return 'text-amber-600';
  return 'text-red-600';
}

function adherenceBadge(pct: number): 'success' | 'warning' | 'destructive' {
  if (pct >= 85) return 'success';
  if (pct >= 70) return 'warning';
  return 'destructive';
}

function AdherencePage(): React.JSX.Element {
  const qc = useQueryClient();

  const { data: trackersData, isLoading } = useQuery<PaginatedResponse<AdherenceTracker>>({
    queryKey: ['adherence-trackers'],
    queryFn: () => api.adherence.getTrackers({ limit: 20 }),
  });

  const { data: upcomingDoses } = useQuery<DoseSchedule[]>({
    queryKey: ['upcoming-doses'],
    queryFn: () => api.adherence.getUpcomingDoses(),
  });

  const { data: missedDoses } = useQuery<DoseSchedule[]>({
    queryKey: ['missed-doses'],
    queryFn: () => api.adherence.getMissedDoses(),
  });

  const markTaken = useMutation({
    mutationFn: (data: { dose_schedule_id: string }) => api.adherence.markDoseTaken(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adherence-trackers'] });
      qc.invalidateQueries({ queryKey: ['upcoming-doses'] });
      qc.invalidateQueries({ queryKey: ['missed-doses'] });
      toast.success('Dose marked as taken');
    },
    onError: () => toast.error('Failed to record dose'),
  });

  const trackers = trackersData?.results || [];
  const upcoming = upcomingDoses || [];
  const missed = missedDoses || [];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Medication Adherence</h1>
            <p className="mt-1 text-sm text-gray-500">Track your medication schedule and adherence.</p>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medication Adherence</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track your medication schedule and adherence history.
          </p>
        </div>

        {/* Upcoming & Missed Doses */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Upcoming Doses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FiClock className="h-4 w-4 text-blue-500" />
                Upcoming Doses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No upcoming doses in the next 24 hours.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {upcoming.slice(0, 10).map((dose) => (
                    <div key={dose.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{(dose as any).medicine_name || (typeof dose.medicine === 'string' ? dose.medicine : '')}</p>
                        <p className="text-xs text-gray-500">{formatTime(dose.scheduled_time)}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => markTaken.mutate({ dose_schedule_id: dose.id })}
                        disabled={markTaken.isPending}
                      >
                        <FiCheckCircle className="h-3 w-3 mr-1" /> Take
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Missed Doses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FiAlertTriangle className="h-4 w-4 text-red-500" />
                Missed Doses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {missed.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  <FiCheckCircle className="inline h-4 w-4 text-green-500 mr-1" />
                  No missed doses — great job!
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {missed.slice(0, 10).map((dose) => (
                    <div key={dose.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{(dose as any).medicine_name || (typeof dose.medicine === 'string' ? dose.medicine : '')}</p>
                        <p className="text-xs text-gray-500">{formatDate(dose.scheduled_time)} at {formatTime(dose.scheduled_time)}</p>
                      </div>
                      <Badge variant="destructive">Missed</Badge>
                    </div>
                  ))}
                  {missed.length > 10 && (
                    <p className="text-xs text-gray-500 text-center pt-1">
                      +{missed.length - 10} more missed doses
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Trackers */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Adherence Trackers</h2>
          {trackers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <FiHeart className="mx-auto h-10 w-10 mb-3 text-gray-400" />
                <p className="text-lg font-medium">No adherence trackers</p>
                <p className="text-sm mt-1">Trackers are created automatically for your prescriptions.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {trackers.map((t) => {
                const pct = t.adherence_percentage ?? (t.expected_doses > 0 ? Math.round((t.actual_doses / t.expected_doses) * 100) : 0);
                return (
                  <Card key={t.id}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${t.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <FiHeart className={`h-5 w-5 ${t.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {t.is_active ? 'Active Tracker' : 'Past Tracker'}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <FiCalendar className="h-3 w-3" />
                              {formatDate(t.start_date)} – {formatDate(t.end_date)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${adherenceColor(pct)}`}>{pct}%</p>
                          <Badge variant={adherenceBadge(pct)}>
                            {pct >= 85 ? 'Good' : pct >= 70 ? 'Fair' : 'Low'}
                          </Badge>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                        <div
                          className={`h-2.5 rounded-full transition-all ${pct >= 85 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <FiCheckCircle className="h-3 w-3 text-green-500" />
                          {t.actual_doses} taken
                        </span>
                        <span className="flex items-center gap-1">
                          <FiXCircle className="h-3 w-3 text-red-400" />
                          {t.expected_doses - t.actual_doses} missed
                        </span>
                        <span className="flex items-center gap-1">
                          <FiTrendingUp className="h-3 w-3" />
                          {t.expected_doses} expected
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(AdherencePage, ['patient']);
