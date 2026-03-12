'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { withAuth } from '@/components/auth/withAuth';
import { api } from '@/lib/api';
import type { LabTest } from '@/types';
import toast from 'react-hot-toast';
import {
  FiActivity,
  FiTrendingUp,
  FiTrendingDown,
  FiSearch,
  FiDownload,
  FiInbox,
  FiRefreshCw,
} from 'react-icons/fi';

function getStatusConfig(status: string) {
  switch (status) {
    case 'high':
      return { label: 'High', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    case 'low':
      return { label: 'Low', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    default:
      return { label: 'Normal', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
  }
}

function generateLabPDF(test: LabTest) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('Pop-up blocked. Please allow pop-ups.');
    return;
  }

  const testedDate = new Date(test.tested_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const statusLabel = test.status === 'high' ? 'High' : test.status === 'low' ? 'Low' : 'Normal';
  const statusColor = test.status === 'high' ? '#991b1b' : test.status === 'low' ? '#92400e' : '#166534';
  const statusBg = test.status === 'high' ? '#fee2e2' : test.status === 'low' ? '#fef3c7' : '#dcfce7';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Lab Report \u2013 ${test.test_name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1a1a1a; font-size: 14px; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { font-size: 20px; color: #1e40af; }
          .header p { color: #6b7280; margin-top: 4px; font-size: 13px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          .label { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
          .value { font-size: 14px; color: #111827; }
          .result-box { padding: 20px; border-radius: 12px; background: #f9fafb; border: 1px solid #e5e7eb; margin-bottom: 20px; text-align: center; }
          .result-value { font-size: 36px; font-weight: 800; color: #111827; }
          .result-unit { font-size: 14px; color: #6b7280; margin-top: 4px; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: ${statusBg}; color: ${statusColor}; }
          .range { margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 8px; font-size: 13px; color: #166534; }
          .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Lab Test Report</h1>
          <p>${testedDate}</p>
        </div>
        <div class="grid">
          <div><div class="label">Test Name</div><div class="value">${test.test_name}</div></div>
          <div><div class="label">Status</div><div class="value"><span class="status">${statusLabel}</span></div></div>
          <div><div class="label">Date</div><div class="value">${testedDate}</div></div>
          ${test.previous_value !== null ? `<div><div class="label">Previous Value</div><div class="value">${test.previous_value} ${test.unit}</div></div>` : ''}
        </div>
        <div class="result-box">
          <div class="result-value">${test.value}</div>
          <div class="result-unit">${test.unit}</div>
        </div>
        <div class="range">Normal Range: ${test.normal_min} \u2013 ${test.normal_max} ${test.unit}</div>
        <div class="footer">Generated from Health Surveillance Platform</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);

  return true;
}

function LabReportsPage(): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: labs, isLoading, isError, refetch, isFetching } = useQuery<LabTest[]>({
    queryKey: ['dashboard-lab-monitoring'],
    queryFn: () => api.dashboard.getLabMonitoring(),
    staleTime: 30_000,
  });

  const handleDownloadPDF = (test: LabTest) => {
    const success = generateLabPDF(test);
    if (success) {
      api.dashboard.logDownload({
        file_type: 'lab_report',
        file_id: test.id,
        file_name: `${test.test_name}_${test.tested_at}.pdf`,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      }).catch(() => {});
    }
  };

  const filtered = (labs ?? []).filter((test) => {
    const matchesSearch = search.length === 0 ||
      test.test_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || test.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lab Reports</h1>
        </div>
        <div className="rounded-xl border bg-white p-8 text-center">
          <FiActivity className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">Unable to load lab reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lab Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            View your lab test results and download reports as PDF.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{labs?.length ?? 0}</p>
          <p className="text-xs text-gray-500">Total Tests</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-emerald-600">{labs?.filter(l => l.status === 'normal').length ?? 0}</p>
          <p className="text-xs text-gray-500">Normal Results</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-red-600">{labs?.filter(l => l.status !== 'normal').length ?? 0}</p>
          <p className="text-xs text-gray-500">Abnormal Results</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <FiActivity className="h-5 w-5 text-primary-600" />
              Your Lab Results
            </h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tests..."
                  className="rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none w-52"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="divide-y">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FiInbox className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm font-medium text-gray-500">No lab reports found</p>
              <p className="text-xs text-gray-400">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Lab results will appear here after your tests'}
              </p>
            </div>
          ) : (
            filtered.map((test) => {
              const st = getStatusConfig(test.status);
              return (
                <div
                  key={test.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${st.bg}`}>
                    <FiActivity className={`h-5 w-5 ${st.text}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{test.test_name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${st.bg} ${st.text} border ${st.border}`}>
                        {st.label}
                      </span>
                      <span className="font-semibold">{test.value} {test.unit}</span>
                      <span className="text-gray-300">|</span>
                      <span>Normal: {test.normal_min}–{test.normal_max}</span>
                      <span className="text-gray-300">|</span>
                      <span>{new Date(test.tested_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {test.trend && (
                      <span className={`flex items-center gap-0.5 text-xs font-medium ${test.trend === 'up' ? 'text-red-500' : 'text-green-500'}`}>
                        {test.trend === 'up' ? <FiTrendingUp className="h-3.5 w-3.5" /> : <FiTrendingDown className="h-3.5 w-3.5" />}
                      </span>
                    )}
                    <button
                      onClick={() => handleDownloadPDF(test)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                    >
                      <FiDownload className="h-3.5 w-3.5" />
                      PDF
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default withAuth(LabReportsPage);
