'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DashboardKPIs } from '@/types';
import { KPICard } from '@/components/dashboard/KPICard';
import {
  FiActivity,
  FiFileText,
  FiDownload,
} from 'react-icons/fi';
import { useLanguage } from '@/components/providers/LanguageProvider';

export function KPIGrid() {
  const { t } = useLanguage();
  const { data: kpis, isLoading } = useQuery<DashboardKPIs>({
    queryKey: ['dashboard-kpis'],
    queryFn: () => api.dashboard.getKPIs(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
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
      title: t('kpi_medical_records'),
      value: kpis.total_medical_records,
      icon: FiActivity,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: kpis.monthly_trends.medical_records,
    },
    {
      title: t('kpi_active_prescriptions'),
      value: kpis.active_prescriptions,
      icon: FiFileText,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      trend: kpis.monthly_trends.prescriptions,
      href: '/dashboard/prescriptions',
    },
    {
      title: t('kpi_downloads'),
      value: kpis.total_downloads,
      icon: FiDownload,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      trend: kpis.monthly_trends.downloads,
      href: '/dashboard/downloads',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          href={'href' in card ? card.href : undefined}
        />
      ))}
    </div>
  );
}
