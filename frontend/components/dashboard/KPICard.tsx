'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { KPITrend } from '@/types';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';
import type { IconType } from 'react-icons';

interface KPICardProps {
  /** Card title / subtitle */
  title: string;
  /** Main KPI number (or formatted string) */
  value: string | number;
  /** react-icons icon component */
  icon: IconType;
  /** Icon background color class (e.g. "bg-blue-50") */
  iconBg: string;
  /** Icon color class (e.g. "text-blue-600") */
  iconColor: string;
  /** Optional trend data to render arrow + delta */
  trend?: KPITrend;
  /** ISO timestamp for last-updated footer */
  lastUpdated?: string;
}

function trendLabel(trend: KPITrend): string {
  const abs = Math.abs(trend.change);
  if (trend.direction === 'flat') return 'No change';
  const arrow = trend.direction === 'up' ? '+' : '-';
  return `${arrow}${abs} vs prev 30d`;
}

export function KPICard({
  title,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  lastUpdated,
}: KPICardProps) {
  let trendColor = 'text-gray-500';
  let TrendIcon = FiMinus;
  let TrendBg = 'bg-gray-100';

  if (trend) {
    if (trend.direction === 'up') {
      trendColor = 'text-green-600';
      TrendBg = 'bg-green-100';
      TrendIcon = FiTrendingUp;
    } else if (trend.direction === 'down') {
      trendColor = 'text-red-600';
      TrendBg = 'bg-red-100';
      TrendIcon = FiTrendingDown;
    }
  }

  return (
    <Card className="group relative overflow-hidden backdrop-blur-md bg-white/60 border border-white/40 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={`${iconBg} ${iconColor} p-3 rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="h-5 w-5" />
          </div>

          {trend && trend.direction !== 'flat' && (
            <div className={`flex items-center gap-1 text-[10px] font-bold ${trendColor} ${TrendBg} px-2 py-1 rounded-full uppercase tracking-wide`}>
              <TrendIcon className="h-3 w-3" />
              <span>{Math.abs(trend.change)}%</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-3xl font-display font-bold text-slate-800 tracking-tight">
            {value}
          </p>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        </div>

        {trend && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className={`text-xs ${trendColor} font-medium flex items-center gap-1`}>
              <span className="opacity-70">vs last month</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
