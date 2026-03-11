'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { DashboardSummary } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  FiShield,
  FiAlertTriangle,
  FiClock,
  FiActivity,
  FiHeart,
  FiTrendingUp,
} from 'react-icons/fi';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { motion } from 'framer-motion';

function riskColor(level: string) {
  switch (level) {
    case 'High':
      return { badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', ring: 'stroke-red-500' };
    case 'Medium':
      return { badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500', ring: 'stroke-orange-500' };
    default:
      return { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', ring: 'stroke-emerald-500' };
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

  const { user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="animate-pulse h-48 bg-white/50 rounded-3xl border border-white/40 shadow-sm" />
    );
  }

  if (!summary) return null;

  const risk = riskColor(summary.calculated_risk_level);
  const healthScore = 100 - (summary.calculated_risk_score * 10); // Example calculation
  const startAngle = 0;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  const displayName = user?.first_name || summary.patient_name?.split(' ')[0] || 'User';

  return (
    <div className="flex justify-between items-center mb-[24px]">
      <div className="section-header !mb-0">
        <div className="bar" />
        <h2 className="text-xl">{t('welcome_back')}, {displayName}</h2>
      </div>
      <div className="hidden sm:flex text-sm font-semibold text-[#D1D5DB] bg-[#0B0F19] border border-[rgba(16,185,129,0.2)] px-4 py-2 rounded-lg items-center gap-2">
        <FiShield className="w-4 h-4 text-[#10B981]" />
        National Health ID: {summary.health_id?.slice(0, 12) || 'XXXX-XXXX'}
      </div>
    </div>
  );
}
