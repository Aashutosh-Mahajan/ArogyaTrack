'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { LabTest } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FiArrowUp,
  FiArrowDown,
  FiDownload,
  FiActivity,
  FiMinus,
  FiFileText,
} from 'react-icons/fi';
import { useLanguage } from '@/components/providers/LanguageProvider';

/* ── Status helpers ────────────────────────────────────────────── */

const STATUS_CONFIG = {
  high: {
    label: 'High',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    valueBg: 'text-rose-600',
  },
  low: {
    label: 'Low',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    valueBg: 'text-amber-600',
  },
  normal: {
    label: 'Normal',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    valueBg: 'text-slate-900',
  },
} as const;

function TrendArrow({ trend, status }: { trend: 'up' | 'down' | null; status: string }) {
  if (!trend) return <FiMinus className="h-4 w-4 text-slate-300" />;

  let color = 'text-slate-500';
  if (status === 'high') {
    color = trend === 'up' ? 'text-rose-500' : 'text-emerald-500';
  } else if (status === 'low') {
    color = trend === 'down' ? 'text-rose-500' : 'text-emerald-500';
  } else {
    color = trend === 'up' ? 'text-amber-500' : 'text-emerald-500'; // Context dependent
  }

  return trend === 'up' ? (
    <FiArrowUp className={`h-4 w-4 ${color}`} />
  ) : (
    <FiArrowDown className={`h-4 w-4 ${color}`} />
  );
}

/* ── Single lab row ────────────────────────────────────────────── */

function LabTestRow({ test }: { test: LabTest }) {
  const cfg = STATUS_CONFIG[test.status];
  const { t } = useLanguage();

  const handleDownload = () => {
    if (test.report_url) {
      window.open(test.report_url, '_blank');
    }
  };

  return (
    <div className="group flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-slate-50/50 transition-all bg-white">
      {/* Test name + date */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 truncate">{test.test_name}</p>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          {new Date(test.tested_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Value + unit */}
      <div className="text-right shrink-0">
        <span className={`text-lg font-bold ${cfg.valueBg}`}>
          {test.value}
        </span>
        <span className="text-sm text-slate-500 ml-1 font-medium">{test.unit}</span>
      </div>

      {/* Normal range */}
      <div className="hidden sm:block text-center shrink-0 w-28">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Range</p>
        <p className="text-xs text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded-full mt-0.5 inline-block">
          {test.normal_min} – {test.normal_max}
        </p>
      </div>

      {/* Status badge */}
      <div className="shrink-0">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${cfg.badge}`}
        >
          {cfg.label}
        </span>
      </div>

      {/* Trend arrow */}
      <div className="shrink-0 flex flex-col items-center w-8">
        <TrendArrow trend={test.trend} status={test.status} />
      </div>

      {/* Download PDF */}
      <div className="shrink-0">
        <button
          onClick={handleDownload}
          disabled={!test.report_url}
          title={test.report_url ? t('download') : t('no_report_available')}
          className={`p-2 rounded-lg transition ${test.report_url
            ? 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700'
            : 'text-slate-300 cursor-not-allowed'
            }`}
        >
          <FiDownload className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Loading skeleton ──────────────────────────────────────────── */

function LabSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-white"
        >
          <div className="flex-1">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-20 bg-slate-100 rounded mt-2" />
          </div>
          <div className="h-6 w-16 bg-slate-200 rounded" />
          <div className="hidden sm:block h-5 w-24 bg-slate-100 rounded" />
          <div className="h-6 w-16 bg-slate-200 rounded-full" />
          <div className="h-4 w-4 bg-slate-100 rounded" />
          <div className="h-8 w-8 bg-slate-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────── */

export function LabMonitoring() {
  const {
    data: labs,
    isLoading,
    isError,
  } = useQuery<LabTest[]>({
    queryKey: ['dashboard-lab-monitoring'],
    queryFn: () => api.dashboard.getLabMonitoring(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const { t } = useLanguage();

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400"></div>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <FiActivity className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('lab_title')}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Latest results & trends</p>
            </div>
          </div>

          {/* Legend - Desktop */}
          <div className="hidden md:flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-200"></span>
              High
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-200"></span>
              Low
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></span>
              Normal
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <LabSkeleton />
        ) : isError ? (
          <div className="text-center py-12 text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <FiActivity className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-slate-700">{t('failed_load')}</p>
            <p className="text-sm mt-1 text-slate-400">{t('try_again')}</p>
          </div>
        ) : labs && labs.length > 0 ? (
          <>
            {/* Column headers (desktop) */}
            <div className="hidden sm:flex items-center gap-4 px-4 pb-1 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              <div className="flex-1">Test Name</div>
              <div className="text-right shrink-0 w-24">Result</div>
              <div className="text-center shrink-0 w-28">Ref Range</div>
              <div className="shrink-0 w-16 text-center">Status</div>
              <div className="shrink-0 w-8 text-center">Trend</div>
              <div className="shrink-0 w-8" />
            </div>

            <div className="space-y-3">
              {labs.map((test) => (
                <LabTestRow key={test.id} test={test} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <div className="bg-white p-3 rounded-full shadow-sm inline-block mb-3">
              <FiFileText className="h-6 w-6 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-700">No lab results yet</p>
            <p className="text-sm mt-1 text-slate-400">
              Your test reports will appear here automatically.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
