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
    <div className="stat-card">
      <div className="flex justify-between items-start">
        <div className="icon-wrap">
          <Icon className="h-5 w-5" />
        </div>
        {trend && trend.direction !== 'flat' && (
          <div className={`trend ${trend.direction === 'up' ? 'trend-up' : 'trend-down'}`}>
            <TrendIcon className="h-3 w-3" />
            <span>{Math.abs(trend.change)}%</span>
          </div>
        )}
      </div>
      <div className="number">{value}</div>
      <div className="label">{title}</div>
    </div>
  );
}
