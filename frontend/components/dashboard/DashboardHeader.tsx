'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DashboardSummary } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  FiShield,
  FiAlertTriangle,
  FiClock,
  FiActivity,
  FiHeart,
} from 'react-icons/fi';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSelector } from './LanguageSelector';

function riskColor(level: string) {
  switch (level) {
    case 'High':
      return { badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', ring: 'ring-red-500/20' };
    case 'Medium':
      return { badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500', ring: 'ring-orange-500/20' };
    default:
      return { badge: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500', ring: 'ring-green-500/20' };
  }
}

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
}

export function DashboardHeader({ title, subtitle }: DashboardHeaderProps) {
  const { t } = useLanguage();

  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.dashboard.getSummary(),
    staleTime: 60_000,
  });

  function formatLastLogin(dt: string | null): string {
    if (!dt) return t('first_login');
    const d = new Date(dt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t('just_now');
    if (diffMin < 60) return `${diffMin}m ${t('ago')}`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ${t('ago')}`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ${t('ago')}`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-8 w-64 bg-gray-200 rounded mb-3" />
          <div className="h-4 w-48 bg-gray-100 rounded mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const risk = riskColor(summary.calculated_risk_level);

  // Helper to safely translate risk level if it matches our keys, otherwise keep original
  const translatedRiskLevel = (['high', 'medium', 'low'] as const).includes(summary.calculated_risk_level.toLowerCase() as any)
    ? t(summary.calculated_risk_level.toLowerCase() as any)
    : summary.calculated_risk_level;

  const snapshots = [
    {
      label: t('risk_score'),
      value: summary.calculated_risk_score,
      icon: FiShield,
      color: risk.dot === 'bg-red-500' ? 'text-red-600' : risk.dot === 'bg-orange-500' ? 'text-orange-600' : 'text-green-600',
      bg: risk.dot === 'bg-red-500' ? 'bg-red-50' : risk.dot === 'bg-orange-500' ? 'bg-orange-50' : 'bg-green-50',
    },
    {
      label: t('active_alerts'),
      value: summary.total_alerts,
      icon: FiAlertTriangle,
      color: summary.total_alerts > 0 ? 'text-amber-600' : 'text-gray-500',
      bg: summary.total_alerts > 0 ? 'bg-amber-50' : 'bg-gray-50',
    },
    {
      label: t('adherence'),
      value: `${Math.round(summary.adherence_percentage)}%`,
      icon: FiHeart,
      color: summary.adherence_percentage >= 80 ? 'text-green-600' : summary.adherence_percentage >= 50 ? 'text-orange-600' : 'text-red-600',
      bg: summary.adherence_percentage >= 80 ? 'bg-green-50' : summary.adherence_percentage >= 50 ? 'bg-orange-50' : 'bg-red-50',
    },
    {
      label: t('last_login'),
      value: formatLastLogin(summary.last_login),
      icon: FiClock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      {/* Top gradient bar */}
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

      <CardContent className="p-6">
        {/* Welcome Row */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {title || `${t('welcome_back')}, ${summary.patient_name}!`}
            </h1>
            {subtitle && (
              <p className="text-gray-600 mt-1">{subtitle}</p>
            )}
            {!title && (
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <FiClock className="h-3.5 w-3.5" />
                  {summary.last_login
                    ? `${t('last_login')}: ${new Date(summary.last_login).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}`
                    : t('welcome_back')}
                </span>

                {/* Risk Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${risk.badge}`}
                >
                  <span className={`h-2 w-2 rounded-full ${risk.dot} animate-pulse`} />
                  {translatedRiskLevel} {t('risk')}
                </span>
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            <LanguageSelector />
          </div>
        </div>


        {/* Health Snapshot Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {snapshots.map((item, i) => (
            <div
              key={i}
              className={`${item.bg} rounded-xl p-4 transition-transform hover:scale-[1.02]`}
            >
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {item.label}
                </span>
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${item.color}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </CardContent >
    </Card >
  );
}
