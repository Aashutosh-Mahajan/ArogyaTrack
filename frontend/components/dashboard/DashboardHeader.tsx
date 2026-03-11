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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 to-teal-800 text-white shadow-xl p-6 sm:p-10">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-60 h-60 bg-emerald-500/20 rounded-full blur-3xl"></div>

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">

        {/* Left: greeting */}
        <div className="text-center md:text-left space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-teal-100 mb-2">
            <FiShield className="w-3.5 h-3.5" />
            National Health ID: {summary.health_id?.slice(0, 12) || 'XXXX-XXXX'}
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">
            {t('welcome_back')}, {displayName}
          </h1>
          <p className="text-teal-100/80 max-w-md">
            Your health surveillance metrics are being monitored in real-time.
            System status is <span className="text-white font-semibold">Nominal</span>.
          </p>
        </div>

        {/* Right: Health Score Ring */}
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-center">
            <div className="relative w-40 h-40 flex items-center justify-center">
              {/* Ring SVG */}
              <svg className="transform -rotate-90 w-40 h-40" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-teal-900/50"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="text-emerald-400 transition-all duration-1000 ease-out"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-bold">{healthScore}</span>
              </div>
            </div>
            <span className="text-xs uppercase tracking-wider text-teal-200 mt-1">Health Score</span>
          </div>

          <div className="hidden sm:flex flex-col gap-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-teal-500/20">
                <FiActivity className="w-5 h-5 text-teal-200" />
              </div>
              <div>
                <p className="text-xs text-teal-200">Risk Level</p>
                <p className="font-semibold text-white">{summary.calculated_risk_level}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-teal-500/20">
                <FiHeart className="w-5 h-5 text-teal-200" />
              </div>
              <div>
                <p className="text-xs text-teal-200">Adherence</p>
                <p className="font-semibold text-white">{Math.round(summary.adherence_percentage)}%</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
