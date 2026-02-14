'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { LabTest } from '@/types';
import {
  FiArrowUp,
  FiArrowDown,
  FiDownload,
  FiActivity,
  FiMinus,
} from 'react-icons/fi';

/* ── Status helpers ────────────────────────────────────────────── */

const STATUS_CONFIG = {
  high: {
    label: 'High',
    badge: 'bg-red-100 text-red-700 ring-red-200',
    valueBg: 'text-red-600',
  },
  low: {
    label: 'Low',
    badge: 'bg-amber-100 text-amber-700 ring-amber-200',
    valueBg: 'text-amber-600',
  },
  normal: {
    label: 'Normal',
    badge: 'bg-green-100 text-green-700 ring-green-200',
    valueBg: 'text-gray-900',
  },
} as const;

function TrendArrow({ trend, status }: { trend: 'up' | 'down' | null; status: string }) {
  if (!trend) return <FiMinus className="h-4 w-4 text-gray-400" />;

  // For "high" status, up arrow is bad (red), down is good (green)
  // For "low" status, down arrow is bad (red), up is good (green)
  // For "normal" status, both are neutral (gray)
  let color = 'text-gray-500';
  if (status === 'high') {
    color = trend === 'up' ? 'text-red-500' : 'text-green-500';
  } else if (status === 'low') {
    color = trend === 'down' ? 'text-red-500' : 'text-green-500';
  } else {
    color = trend === 'up' ? 'text-amber-500' : 'text-green-500';
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

  const handleDownload = () => {
    if (test.report_url) {
      window.open(test.report_url, '_blank');
    }
  };

  return (
    <div className="group flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all bg-white">
      {/* Test name + date */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{test.test_name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
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
        <span className="text-sm text-gray-500 ml-1">{test.unit}</span>
      </div>

      {/* Normal range */}
      <div className="hidden sm:block text-center shrink-0 w-28">
        <p className="text-xs text-gray-400 uppercase tracking-wider">Range</p>
        <p className="text-sm text-gray-600 font-medium">
          {test.normal_min} – {test.normal_max}
        </p>
      </div>

      {/* Status badge */}
      <div className="shrink-0">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${cfg.badge}`}
        >
          {cfg.label}
        </span>
      </div>

      {/* Trend arrow */}
      <div className="shrink-0 flex flex-col items-center w-10">
        <TrendArrow trend={test.trend} status={test.status} />
        {test.previous_value !== null && (
          <span className="text-[10px] text-gray-400 mt-0.5">
            {test.previous_value}
          </span>
        )}
      </div>

      {/* Download PDF */}
      <div className="shrink-0">
        <button
          onClick={handleDownload}
          disabled={!test.report_url}
          title={test.report_url ? 'Download Report' : 'No report available'}
          className={`p-2 rounded-lg transition ${
            test.report_url
              ? 'text-primary-600 hover:bg-primary-50 hover:text-primary-700'
              : 'text-gray-300 cursor-not-allowed'
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
          className="animate-pulse flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white"
        >
          <div className="flex-1">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded mt-2" />
          </div>
          <div className="h-6 w-16 bg-gray-200 rounded" />
          <div className="hidden sm:block h-5 w-24 bg-gray-100 rounded" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
          <div className="h-4 w-4 bg-gray-100 rounded" />
          <div className="h-8 w-8 bg-gray-100 rounded-lg" />
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

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50">
            <FiActivity className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Lab &amp; Test Monitoring
            </h2>
            <p className="text-sm text-gray-500">
              Latest results with normal ranges
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
            High
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            Low
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
            Normal
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <LabSkeleton />
        ) : isError ? (
          <div className="text-center py-10 text-gray-500">
            <FiActivity className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Failed to load lab results</p>
            <p className="text-sm mt-1">Please try again later.</p>
          </div>
        ) : labs && labs.length > 0 ? (
          <>
            {/* Column headers (desktop) */}
            <div className="hidden sm:flex items-center gap-4 px-4 pb-2 text-xs text-gray-400 uppercase tracking-wider font-medium">
              <div className="flex-1">Test</div>
              <div className="text-right shrink-0 w-24">Value</div>
              <div className="text-center shrink-0 w-28">Range</div>
              <div className="shrink-0 w-16 text-center">Status</div>
              <div className="shrink-0 w-10 text-center">Trend</div>
              <div className="shrink-0 w-10" />
            </div>
            <div className="space-y-2">
              {labs.map((test) => (
                <LabTestRow key={test.id} test={test} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-10 text-gray-500">
            <FiActivity className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No lab results yet</p>
            <p className="text-sm mt-1">
              Your lab test results will appear here once available.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
