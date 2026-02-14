'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DashboardKPIs, KPITrend } from '@/types';
import { KPICard } from '@/components/dashboard/KPICard';
import {
  FiActivity,
  FiFileText,
  FiClipboard,
  FiHeart,
  FiAlertTriangle,
  FiDownload,
} from 'react-icons/fi';

/**
 * Inverts trend colour semantics: "up" becomes red, "down" becomes green.
 * Used for KPIs where an increase is negative (alerts, pending labs).
 */
function invertTrend(trend: KPITrend): KPITrend {
  return {
    ...trend,
    direction:
      trend.direction === 'up'
        ? 'down'
        : trend.direction === 'down'
          ? 'up'
          : 'flat',
  };
}

export function KPIGrid() {
  const { data: kpis, isLoading } = useQuery<DashboardKPIs>({
    queryKey: ['dashboard-kpis'],
    queryFn: () => api.dashboard.getKPIs(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // auto-refresh every 5 min
  });

  /* ─── Loading skeleton ──────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse bg-white rounded-xl border border-gray-100 p-5"
          >
            <div className="h-10 w-10 bg-gray-200 rounded-xl mb-3" />
            <div className="h-7 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-24 bg-gray-100 rounded mb-2" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  const cards = [
    {
      title: 'Medical Records',
      value: kpis.total_medical_records,
      icon: FiActivity,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: kpis.monthly_trends.medical_records,
    },
    {
      title: 'Active Prescriptions',
      value: kpis.active_prescriptions,
      icon: FiFileText,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      trend: kpis.monthly_trends.prescriptions,
    },
    {
      title: 'Pending Lab Reports',
      value: kpis.pending_lab_reports,
      icon: FiClipboard,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      // "up" is bad for pending reports → invert
      trend: invertTrend(kpis.monthly_trends.lab_reports),
    },
    {
      title: 'Adherence Rate',
      value: `${Math.round(kpis.adherence_percentage)}%`,
      icon: FiHeart,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      trend: kpis.monthly_trends.adherence,
    },
    {
      title: 'Health Alerts',
      value: kpis.alerts_count,
      icon: FiAlertTriangle,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      // "up" is bad for alerts → invert
      trend: invertTrend(kpis.monthly_trends.alerts),
    },
    {
      title: 'Report Downloads',
      value: kpis.total_downloads,
      icon: FiDownload,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      trend: kpis.monthly_trends.downloads,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, i) => (
        <KPICard
          key={i}
          title={card.title}
          value={card.value}
          icon={card.icon}
          iconBg={card.iconBg}
          iconColor={card.iconColor}
          trend={card.trend}
          lastUpdated={kpis.last_updated}
        />
      ))}
    </div>
  );
}
