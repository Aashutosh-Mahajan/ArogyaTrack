'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  TooltipProps,
  Area,
  AreaChart,
} from 'recharts';
import { api } from '@/lib/api';
import type { HealthTrendsResponse, HealthTrendSeries } from '@/types';
import { FiTrendingUp, FiActivity, FiBarChart2 } from 'react-icons/fi';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/* ── Period toggle ─────────────────────────────────────────────── */

type Period = 3 | 6 | 12;

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '1Y', value: 12 },
];

/* ── Chart colour mapping ─────────────────────────────────────── */

const CHART_CONFIG: Record<
  string,
  { color: string; secondaryColor?: string; gradientFrom: string; gradientTo: string }
> = {
  blood_pressure: {
    color: '#ef4444',      // red-500
    secondaryColor: '#f97316', // orange-500  (diastolic)
    gradientFrom: '#fee2e2',
    gradientTo: '#fff',
  },
  sugar: {
    color: '#8b5cf6',      // violet-500
    gradientFrom: '#ede9fe',
    gradientTo: '#fff',
  },
  weight: {
    color: '#0ea5e9',      // sky-500
    gradientFrom: '#e0f2fe',
    gradientTo: '#fff',
  },
  bmi: {
    color: '#10b981',      // emerald-500
    gradientFrom: '#d1fae5',
    gradientTo: '#fff',
  },
};

/* ── Custom tooltip ────────────────────────────────────────────── */

function CustomTooltip({
  active,
  payload,
  label,
  unit,
  metric,
}: TooltipProps<number, string> & { unit: string; metric: string }) {
  const { t, language } = useLanguage();
  if (!active || !payload || payload.length === 0) return null;

  const primary = payload.find((p) => p.dataKey === 'value');
  const secondary = payload.find((p) => p.dataKey === 'secondary_value');

  const locale = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-IN';

  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs">
      <p className="text-slate-400 font-bold uppercase tracking-wider mb-1.5">
        {new Date(label as string).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </p>
      {metric === 'blood_pressure' ? (
        <div className="space-y-1">
          <p className="text-rose-600 font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            {t('systolic')}: {primary?.value} <span className="text-slate-400 font-normal">{unit}</span>
          </p>
          {secondary?.value != null && (
            <p className="text-orange-500 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              {t('diastolic')}: {secondary.value} <span className="text-slate-400 font-normal">{unit}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="font-bold flex items-center gap-2" style={{ color: primary?.color }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primary?.color }}></span>
          {primary?.value} <span className="text-slate-400 font-normal">{unit}</span>
        </p>
      )}
    </div>
  );
}

/* ── Single metric chart card ──────────────────────────────────── */

function MetricChart({ series }: { series: HealthTrendSeries }) {
  const { t, language } = useLanguage();

  const cfg = CHART_CONFIG[series.metric] ?? {
    color: '#6b7280',
    gradientFrom: '#f3f4f6',
    gradientTo: '#fff',
  };

  const hasData = series.data.length > 0;
  const locale = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-IN';

  // Format x-axis tick
  const formatDate = useCallback((val: string) => {
    const d = new Date(val);
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  }, [locale]);

  return (
    <div
      className="group relative rounded-2xl border border-slate-100 bg-white p-5 transition-all hover:shadow-md hover:border-slate-200 overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-5 opacity-5 group-hover:opacity-10 transition-opacity">
        <FiActivity className="w-24 h-24 text-current" style={{ color: cfg.color }} />
      </div>

      <div className="relative z-10 flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full" style={{ backgroundColor: cfg.color }}></span>
            {series.label}
          </h3>
          <p className="text-xs text-slate-500 font-medium ml-3">{series.unit}</p>
        </div>
        {hasData && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
            {series.data.length} {t('reading_s')}
          </span>
        )}
      </div>

      {hasData ? (
        <div className="h-[200px] w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            {series.metric === 'blood_pressure' ? (
              <LineChart
                data={series.data}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={30}
                  dy={10}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  content={
                    <CustomTooltip unit={series.unit} metric={series.metric} />
                  }
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}
                  formatter={(value: string) =>
                    value === 'value' ? t('systolic') : t('diastolic')
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={cfg.color}
                  strokeWidth={3}
                  dot={{ r: 0, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: cfg.color }}
                  name="value"
                  animationDuration={1500}
                />
                <Line
                  type="monotone"
                  dataKey="secondary_value"
                  stroke={cfg.secondaryColor}
                  strokeWidth={3}
                  strokeDasharray="0"
                  dot={{ r: 0, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: cfg.secondaryColor }}
                  name="secondary_value"
                  animationDuration={1500}
                />
              </LineChart>
            ) : (
              <AreaChart
                data={series.data}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={`color-${series.metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={cfg.color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={30}
                  dy={10}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  content={
                    <CustomTooltip unit={series.unit} metric={series.metric} />
                  }
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={cfg.color}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill={`url(#color-${series.metric})`}
                  activeDot={{ r: 6, strokeWidth: 0, fill: cfg.color }}
                  animationDuration={1500}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[200px] text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          <FiBarChart2 className="w-8 h-8 text-slate-300 mb-2" />
          <p className="font-medium">{t('no_data_period')}</p>
        </div>
      )}
    </div>
  );
}

/* ── Loading skeleton ──────────────────────────────────────────── */

function TrendsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5"
        >
          <div className="h-5 w-32 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-16 bg-slate-100 rounded mb-6" />
          <div className="h-[200px] bg-slate-100 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────── */

export function HealthTrends() {
  const [period, setPeriod] = useState<Period>(6);
  const { t } = useLanguage();

  const {
    data: response,
    isLoading,
    isError,
  } = useQuery<HealthTrendsResponse>({
    queryKey: ['dashboard-health-trends', period],
    queryFn: () => api.dashboard.getHealthTrends({ months: period }),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  // Memoize the sorted order so charts are stable
  const orderedTrends = useMemo(() => {
    if (!response?.trends) return [];
    const order = ['blood_pressure', 'sugar', 'weight', 'bmi'];
    return [...response.trends].sort(
      (a, b) => order.indexOf(a.metric) - order.indexOf(b.metric),
    );
  }, [response]);

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 rounded-lg">
              <FiTrendingUp className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('trends_title')}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{t('trends_subtitle')}</p>
            </div>
          </div>

          {/* Period toggle */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${period === opt.value
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <TrendsSkeleton />
        ) : isError ? (
          <div className="text-center py-12 text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <FiTrendingUp className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-slate-700">{t('failed_load')}</p>
            <p className="text-sm mt-1 text-slate-400">{t('try_again')}</p>
          </div>
        ) : orderedTrends.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {orderedTrends.map((series) => (
              <MetricChart key={series.metric} series={series} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <FiBarChart2 className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-slate-700">{t('empty_trends')}</p>
            <p className="text-sm mt-1 text-slate-400">
              {t('empty_trends_desc')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
