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
  FiClock,
  FiCheckCircle
} from 'react-icons/fi';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';

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

/* ── Risk Badge ────────────────────────────────────── */

const riskColors: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-green-50 text-green-700 border-green-200',
};

const severityDot: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

/* ── Page ──────────────────────────────────────────── */

function DoctorDashboardPage() {
  const { t } = useLanguage();

  /* ── queries ─── */
  const { data: summary, isLoading: loadingSummary, refetch: refetchSummary, isFetching: isFetchingSummary } = useQuery({
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
      label: t('total_assigned_patients'),
      value: summary?.total_patients ?? 0,
      icon: FiUsers,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100'
    },
    {
      label: t('high_risk_patients'),
      value: summary?.high_risk_count ?? 0,
      icon: FiAlertTriangle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-100'
    },
    {
      label: t('pending_lab_reviews'),
      value: summary?.pending_labs ?? 0,
      icon: FiClipboard,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100'
    },
    {
      label: t('recent_updates'),
      value: summary?.recent_updates ?? 0,
      icon: FiClock,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100'
    },
  ];

  /* ── Activity icon ─── */
  const activityIcon = (item: ActivityItem) => {
    switch (item.type) {
      case 'abnormal_lab':
        return <div className="p-2 rounded-full bg-orange-50 border border-orange-100"><FiAlertCircle className="h-4 w-4 text-orange-600" /></div>;
      case 'critical_visit':
        return <div className="p-2 rounded-full bg-red-50 border border-red-100"><FiAlertTriangle className="h-4 w-4 text-red-600" /></div>;
      case 'follow_up':
        return <div className="p-2 rounded-full bg-yellow-50 border border-yellow-100"><FiRefreshCw className="h-4 w-4 text-yellow-600" /></div>;
      default:
        return <div className="p-2 rounded-full bg-blue-50 border border-blue-100"><FiFileText className="h-4 w-4 text-blue-600" /></div>;
    }
  };

  if (loadingSummary) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-64 bg-slate-200 rounded-lg mb-4"></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-100 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-slate-100 rounded-xl"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('doctor_dashboard_title')}</h1>
            <p className="text-slate-500 mt-1">
              {t('doctor_dashboard_subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => refetchSummary()}
              disabled={isFetchingSummary}
              className="bg-white/50 border-slate-200 hover:bg-slate-100"
            >
              <FiRefreshCw className={`h-4 w-4 mr-2 ${isFetchingSummary ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
            <Link href="/doctor/scan-qr">
              <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg hover:shadow-xl transition-all rounded-full px-6">
                <FiCamera className="h-4 w-4 mr-2" />
                {t('scan_patient_qr')}
              </Button>
            </Link>
          </div>
        </div>

        {/* ─── A. TODAY SNAPSHOT ─── */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="group relative overflow-hidden bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
                <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500 ${kpi.color}`}>
                  <Icon className="w-16 h-16" />
                </div>
                <div className="relative z-10">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${kpi.bg} ${kpi.color} ${kpi.border} border`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900 mb-1">{kpi.value}</p>
                  <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── B. HIGH-RISK PATIENTS PREVIEW (top 5) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 border-0 shadow-lg overflow-hidden bg-white/80 backdrop-blur-md">
            
            <CardHeader className="border-b border-slate-100/50 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <FiAlertTriangle className="w-5 h-5 text-orange-600" />
                  </div>
                  <CardTitle className="text-lg text-slate-800">{t('high_risk_patients')}</CardTitle>
                </div>
                <Link
                  href="/doctor/high-risk"
                  className="text-sm font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 hover:gap-2 transition-all"
                >
                  {t('view_all')} <FiArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {topHighRisk.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="bg-slate-50 p-4 rounded-full inline-block mb-3">
                    <FiCheckCircle className="h-8 w-8 text-emerald-400" />
                  </div>
                  <p>{t('no_high_risk_patients')}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {topHighRisk.map((patient) => {
                    const badge = riskColors[patient.risk_level] ?? riskColors.low;
                    return (
                      <div
                        key={patient.patient_id}
                        className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-bold text-lg shadow-inner">
                              {patient.name.charAt(0)}
                            </div>
                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${patient.risk_level === 'critical' ? 'bg-red-500' : 'bg-orange-500'}`}>
                              <FiAlertTriangle className="w-2.5 h-2.5 text-white" />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate group-hover:text-teal-700 transition-colors">
                              {patient.name}
                            </p>
                            <p className="text-sm text-slate-500">
                              {patient.age} yrs · <span className="font-medium text-slate-700">{patient.condition}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 ml-3">
                          {patient.latest_bp && (
                            <div className="hidden sm:flex flex-col items-end">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">BP</span>
                              <span className="text-sm font-semibold text-slate-700">{patient.latest_bp}</span>
                            </div>
                          )}
                          {patient.latest_sugar && (
                            <div className="hidden sm:flex flex-col items-end">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sugar</span>
                              <span className="text-sm font-semibold text-slate-700">{patient.latest_sugar}</span>
                            </div>
                          )}
                          <div className="flex flex-col items-end gap-2">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border tracking-wider ${badge}`}
                            >
                              {patient.risk_level}
                            </span>
                            <Link href={`/doctor/patients/${patient.patient_id}`}>
                              <Button variant="ghost" size="sm" className="h-7 text-xs hover:bg-teal-50 hover:text-teal-700">
                                {t('view')}
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── C. RECENT ACTIVITY FEED ─── */}
          <Card className="border-0 shadow-lg overflow-hidden bg-white/80 backdrop-blur-md h-fit">
            
            <CardHeader className="border-b border-slate-100/50 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FiActivity className="w-5 h-5 text-blue-600" />
                </div>
                <CardTitle className="text-lg text-slate-800">{t('recent_activity')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {activities.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>{t('no_recent_activity')}</p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100">
                  {activities.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                      <div className="mt-1 flex-shrink-0">{activityIcon(item)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium mt-2 flex items-center gap-1.5">
                          <FiClock className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex items-center flex-shrink-0">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ring-2 ring-white shadow-sm ${severityDot[item.severity] ?? 'bg-slate-300'
                            }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default withAuth(DoctorDashboardPage, ['doctor']);
