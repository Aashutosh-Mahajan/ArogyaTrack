'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import {
  FiUsers,
  FiAlertTriangle,
  FiClipboard,
  FiRefreshCw,
  FiArrowRight,
  FiActivity,
  FiAlertCircle,
  FiFileText,
  FiCamera,
} from 'react-icons/fi';
import Link from 'next/link';

/* ── Types ─────────────────────────────────────────── */

interface DashboardSummary {
  total_patients: number;
  high_risk_count: number;
  pending_labs: number;
  recent_updates: number;
}

interface HighRiskPatient {
  patient_id: string;
  name: string;
  age: number;
  condition: string;
  risk_level: string;
  latest_bp: string | null;
  latest_sugar: number | null;
}

interface ActivityItem {
  type: string;
  icon: string;
  title: string;
  description: string;
  timestamp: string;
  severity: string;
}

/* ── KPI Skeleton ──────────────────────────────────── */

function KPISkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-8 w-16 bg-gray-200 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Risk Badge ────────────────────────────────────── */

const riskColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

/* ── Severity dot ──────────────────────────────────── */

const severityDot: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

/* ── Page ──────────────────────────────────────────── */

function DoctorDashboardPage() {
  /* ── queries ─── */
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['doctor-dashboard-summary'],
    queryFn: async () => {
      const res = await api.medical.getDashboardSummary();
      return res as DashboardSummary;
    },
    staleTime: 30_000,
  });

  const { data: highRiskData } = useQuery({
    queryKey: ['doctor-high-risk'],
    queryFn: async () => {
      const res = await api.medical.getHighRiskPatients();
      return res as { count: number; results: HighRiskPatient[] };
    },
    staleTime: 60_000,
  });

  const { data: activityData } = useQuery({
    queryKey: ['doctor-recent-activity'],
    queryFn: async () => {
      const res = await api.medical.getRecentActivity();
      return res as { count: number; results: ActivityItem[] };
    },
    staleTime: 30_000,
  });

  const topHighRisk = highRiskData?.results?.slice(0, 5) ?? [];
  const activities = activityData?.results ?? [];

  /* ── KPI cards config ─── */
  const kpiCards = [
    {
      label: 'Total Assigned Patients',
      value: summary?.total_patients ?? 0,
      icon: FiUsers,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'High-Risk Patients',
      value: summary?.high_risk_count ?? 0,
      icon: FiAlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Pending Lab Reviews',
      value: summary?.pending_labs ?? 0,
      icon: FiClipboard,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Recent Updates',
      value: summary?.recent_updates ?? 0,
      icon: FiRefreshCw,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];

  /* ── Activity icon ─── */
  const activityIcon = (item: ActivityItem) => {
    switch (item.type) {
      case 'abnormal_lab':
        return <FiAlertCircle className="h-4 w-4 text-orange-500" />;
      case 'critical_visit':
        return <FiAlertTriangle className="h-4 w-4 text-red-500" />;
      case 'follow_up':
        return <FiRefreshCw className="h-4 w-4 text-yellow-600" />;
      default:
        return <FiFileText className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Today&apos;s snapshot &amp; surveillance overview
            </p>
          </div>
          <Link href="/doctor/scan-qr">
            <Button size="lg" className="gap-2">
              <FiCamera className="h-4 w-4" />
              Scan Patient QR
            </Button>
          </Link>
        </div>

        {/* ─── A. TODAY SNAPSHOT ─── */}
        {loadingSummary ? (
          <KPISkeleton />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card key={kpi.label} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                        <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                      </div>
                      <div className={`${kpi.bg} ${kpi.color} p-3 rounded-xl`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ─── B. HIGH-RISK PATIENTS PREVIEW (top 5) ─── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FiAlertTriangle className="text-orange-500 h-5 w-5" />
                High-Risk Patients
              </CardTitle>
              <Link
                href="/doctor/high-risk"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                View All <FiArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {topHighRisk.length === 0 ? (
              <p className="text-gray-500 text-center py-6">
                No high-risk patients detected.
              </p>
            ) : (
              <div className="divide-y">
                {topHighRisk.map((patient) => {
                  const badge = riskColors[patient.risk_level] ?? riskColors.low;
                  return (
                    <div
                      key={patient.patient_id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {patient.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {patient.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {patient.age} yrs · {patient.condition}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        {patient.latest_bp && (
                          <span className="text-xs text-gray-500 hidden sm:inline">
                            BP {patient.latest_bp}
                          </span>
                        )}
                        {patient.latest_sugar && (
                          <span className="text-xs text-gray-500 hidden sm:inline">
                            Sugar {patient.latest_sugar}
                          </span>
                        )}
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${badge}`}
                        >
                          {patient.risk_level}
                        </span>
                        <Link href={`/doctor/patients/${patient.patient_id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── C. RECENT ACTIVITY FEED ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiActivity className="text-blue-500 h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-gray-500 text-center py-6">
                No recent activity.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y pr-1">
                {activities.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="mt-0.5 flex-shrink-0">{activityIcon(item)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          severityDot[item.severity] ?? 'bg-gray-400'
                        }`}
                      />
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(DoctorDashboardPage, ['doctor']);
