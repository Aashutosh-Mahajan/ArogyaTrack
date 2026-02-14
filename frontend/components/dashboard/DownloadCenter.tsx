'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DownloadItem, DashboardKPIs } from '@/types';
import {
  FiDownload,
  FiFile,
  FiFileText,
  FiActivity,
  FiArchive,
  FiSearch,
  FiInbox,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

/* ── Constants ────────────────────────────────────────────── */

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  visit_attachment: { icon: FiFileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  lab_report: { icon: FiActivity, color: 'text-purple-600', bg: 'bg-purple-50' },
};

/* ── Skeleton ─────────────────────────────────────────────── */

function DownloadSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-xl border bg-white p-6">
        <div className="h-5 w-56 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-gray-100 rounded" />
                <div className="h-3 w-1/2 bg-gray-50 rounded" />
              </div>
              <div className="h-8 w-24 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Download helpers ─────────────────────────────────────── */

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Main Component ───────────────────────────────────────── */

export function DownloadCenter() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [downloading, setDownloading] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const { data: items, isLoading, isError } = useQuery<DownloadItem[]>({
    queryKey: ['dashboard-downloads'],
    queryFn: () => api.dashboard.getDownloads(),
    staleTime: 30_000,
  });

  const { data: kpis } = useQuery<DashboardKPIs>({
    queryKey: ['dashboard-kpis'],
    queryFn: () => api.dashboard.getKPIs(),
    staleTime: 60_000,
  });

  /* ── Handlers ──────────────────────────────────────────── */

  const handleDownload = async (item: DownloadItem) => {
    setDownloading(item.id);
    try {
      const blob = await api.dashboard.downloadFile(item.id, item.type);
      const filename = item.title.replace(/[^a-zA-Z0-9._-]/g, '_');
      triggerBlobDownload(blob, filename);
      toast.success('Download started');
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      const blob = await api.dashboard.downloadAll();
      triggerBlobDownload(blob, `health_records_${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success('ZIP download started');
    } catch {
      toast.error('Failed to generate ZIP');
    } finally {
      setDownloadingAll(false);
    }
  };

  /* ── Filter ────────────────────────────────────────────── */

  const filtered = (items ?? []).filter((item) => {
    const matchesSearch =
      search.length === 0 ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.type_label.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  /* ── Render ────────────────────────────────────────────── */

  if (isLoading) return <DownloadSkeleton />;

  if (isError) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <FiDownload className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-2 text-sm text-gray-500">Unable to load downloads.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header KPI ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
              <FiFile className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{items?.length ?? 0}</p>
              <p className="text-xs text-gray-500">Available Files</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <FiDownload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{kpis?.total_downloads ?? 0}</p>
              <p className="text-xs text-gray-500">Total Downloads</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <FiArchive className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <button
                onClick={handleDownloadAll}
                disabled={downloadingAll || (items?.length ?? 0) === 0}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingAll ? 'Creating ZIP…' : 'Download All Records'}
              </button>
              <p className="text-xs text-gray-500">ZIP Archive</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <FiDownload className="h-5 w-5 text-primary-600" />
              Your Files
            </h3>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search files…"
                  className="rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none w-52"
                />
              </div>
              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              >
                <option value="all">All Types</option>
                <option value="visit_attachment">Visit Attachments</option>
                <option value="lab_report">Lab Reports</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── File List ─────────────────────────────────────── */}
        <div className="divide-y">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FiInbox className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm font-medium text-gray-500">No files found</p>
              <p className="text-xs text-gray-400">
                {search || typeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Medical records and lab reports will appear here'}
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.visit_attachment;
              const TypeIcon = cfg.icon;
              const isDownloading = downloading === item.id;

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                    <TypeIcon className={`h-5 w-5 ${cfg.color}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                        {item.type_label}
                      </span>
                      <span>{item.visit_info}</span>
                      <span className="text-gray-300">•</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(item)}
                    disabled={isDownloading || !item.file_url}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <FiDownload className={`h-3.5 w-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                    {isDownloading ? 'Downloading…' : 'Download'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
