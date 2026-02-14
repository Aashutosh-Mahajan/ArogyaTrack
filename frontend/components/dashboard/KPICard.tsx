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
  // Decide trend colour — positive is green except for alerts & pending labs where up = bad
  const negativeTrendKeys = false; // parent will decide color via props
  let trendColor = 'text-gray-500';
  let TrendIcon = FiMinus;

  if (trend) {
    if (trend.direction === 'up') {
      trendColor = 'text-green-600';
      TrendIcon = FiTrendingUp;
    } else if (trend.direction === 'down') {
      trendColor = 'text-red-600';
      TrendIcon = FiTrendingDown;
    }
  }

  return (
    <Card className="group relative overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-200">
      <CardContent className="p-5">
        {/* Top row: icon + trend */}
        <div className="flex items-start justify-between mb-3">
          <div className={`${iconBg} ${iconColor} p-2.5 rounded-xl transition-transform group-hover:scale-110`}>
            <Icon className="h-5 w-5" />
          </div>

          {trend && trend.direction !== 'flat' && (
            <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              <span>{Math.abs(trend.change)}</span>
            </div>
          )}
        </div>

        {/* Main number */}
        <p className="text-2xl font-bold text-gray-900 tracking-tight">
          {value}
        </p>

        {/* Subtitle */}
        <p className="text-sm text-gray-500 mt-1">{title}</p>

        {/* Trend label */}
        {trend && (
          <p className={`text-xs mt-2 ${trendColor} font-medium`}>
            {trendLabel(trend)}
          </p>
        )}

        {/* Last updated */}
        {lastUpdated && (
          <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-wider">
            Updated{' '}
            {new Date(lastUpdated).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
