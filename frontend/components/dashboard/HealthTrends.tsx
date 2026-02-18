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
} from 'recharts';
import { api } from '@/lib/api';
import type { HealthTrendsResponse, HealthTrendSeries } from '@/types';
import { FiTrendingUp } from 'react-icons/fi';
import { useLanguage } from '@/components/providers/LanguageProvider';

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
  { color: string; secondaryColor?: string; gradient: string }
> = {
  blood_pressure: {
    color: '#ef4444',      // red-500
    secondaryColor: '#f97316', // orange-500  (diastolic)
    gradient: 'from-red-50 to-red-100/50',
  },
  sugar: {
    color: '#8b5cf6',      // violet-500
    gradient: 'from-violet-50 to-violet-100/50',
  },
  weight: {
    color: '#0ea5e9',      // sky-500
    gradient: 'from-sky-50 to-sky-100/50',
  },
  bmi: {
    color: '#10b981',      // emerald-500
    gradient: 'from-emerald-50 to-emerald-100/50',
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
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="text-gray-500 font-medium mb-1">
        {new Date(label as string).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </p>
      {metric === 'blood_pressure' ? (
        <>
          <p className="text-red-600 font-semibold">
            {t('systolic')}: {primary?.value} {unit}
          </p>
          {secondary?.value != null && (
            <p className="text-orange-500 font-semibold">
              {t('diastolic')}: {secondary.value} {unit}
            </p>
          )}
        </>
      ) : (
        <p className="font-semibold" style={{ color: primary?.color }}>
          {primary?.value} {unit}
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
    gradient: 'from-gray-50 to-gray-100/50',
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
      className={`rounded-2xl border border-gray-100 bg-gradient-to-br ${cfg.gradient} p-5 transition hover:shadow-sm`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {series.label}
          </h3>
          <p className="text-xs text-gray-500">{series.unit}</p>
        </div>
        {hasData && (
          <span className="text-xs text-gray-400">
            {series.data.length} {t('reading_s')}
          </span>
        )}
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart
            data={series.data}
            margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={
                <CustomTooltip unit={series.unit} metric={series.metric} />
              }
            />
            {series.metric === 'blood_pressure' && (
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) =>
                  value === 'value' ? t('systolic') : t('diastolic')
                }
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={cfg.color}
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
              activeDot={{ r: 5, strokeWidth: 2 }}
              name="value"
            />
            {series.metric === 'blood_pressure' && (
              <Line
                type="monotone"
                dataKey="secondary_value"
                stroke={cfg.secondaryColor}
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 2 }}
                name="secondary_value"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
          {t('no_data_period')}
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
          className="animate-pulse rounded-2xl border border-gray-100 bg-gray-50 p-5"
        >
          <div className="h-4 w-28 bg-gray-200 rounded mb-1" />
          <div className="h-3 w-16 bg-gray-100 rounded mb-4" />
          <div className="h-[200px] bg-gray-100 rounded-xl" />
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-teal-50">
            <FiTrendingUp className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t('trends_title')}
            </h2>
            <p className="text-sm text-gray-500">
              {t('trends_subtitle')}
            </p>
          </div>
        </div>

        {/* Period toggle */}
        <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${period === opt.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart grid */}
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <TrendsSkeleton />
        ) : isError ? (
          <div className="text-center py-10 text-gray-500">
            <FiTrendingUp className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">{t('failed_load')}</p>
            <p className="text-sm mt-1">{t('try_again')}</p>
          </div>
        ) : orderedTrends.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {orderedTrends.map((series) => (
              <MetricChart key={series.metric} series={series} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            <FiTrendingUp className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">{t('empty_trends')}</p>
            <p className="text-sm mt-1">
              {t('empty_trends_desc')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
