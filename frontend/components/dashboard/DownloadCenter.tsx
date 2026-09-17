'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  medical_record: { icon: FiFileText, color: 'text-primary', bg: 'bg-primary/8' },
  visit_attachment: { icon: FiFileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  lab_report: { icon: FiActivity, color: 'text-purple-600', bg: 'bg-purple-50' },
};

/* ── Skeleton ─────────────────────────────────────────────── */

function DownloadSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-xl border bg-card p-6">
        <div className="h-5 w-56 bg-muted rounded mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-background rounded" />
              </div>
              <div className="h-8 w-24 bg-muted rounded-lg" />
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
  const queryClient = useQueryClient();

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

  const generateVisitPDF = (item: DownloadItem) => {
    const rd = item.record_data;
    if (!rd) return;

    const visitDate = rd.visit_date
      ? new Date(rd.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    const statusLabels: Record<string, string> = {
      completed: 'Completed',
      follow_up: 'Follow-up Required',
      critical: 'Critical',
    };
    const statusLabel = statusLabels[rd.status] || rd.status;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Visit Record \u2013 ${visitDate}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1c1712; font-size: 14px; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
            .header h1 { font-size: 20px; color: #1e40af; }
            .header p { color: #7a756b; margin-top: 4px; font-size: 13px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
            .label { font-size: 11px; font-weight: 600; color: #7a756b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
            .value { font-size: 14px; color: #1c1712; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 12px; font-weight: 700; color: #7a756b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e3ddd0; padding-bottom: 4px; margin-bottom: 8px; }
            .section-body { font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
            .status { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
            .completed { background: #dcfce7; color: #166534; }
            .follow_up { background: #ffedd5; color: #9a3412; }
            .critical { background: #fee2e2; color: #991b1b; }
            .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #7a756b; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Medical Visit Record</h1>
            <p>${visitDate}${rd.visit_time ? ` at ${rd.visit_time}` : ''}</p>
          </div>
          <div class="grid">
            <div><div class="label">Doctor</div><div class="value">Dr. ${rd.doctor_name}</div></div>
            <div><div class="label">Department</div><div class="value">${rd.department}</div></div>
            <div><div class="label">Status</div><div class="value"><span class="status ${rd.status}">${statusLabel}</span></div></div>
          </div>
          <div class="section"><div class="section-title">Diagnosis</div><div class="section-body">${rd.diagnosis_summary || 'N/A'}</div></div>
          <div class="section"><div class="section-title">Tests Performed</div><div class="section-body">${rd.tests_performed || 'None recorded'}</div></div>
          <div class="section"><div class="section-title">Prescription</div><div class="section-body">${rd.prescription_text ? rd.prescription_text.split(',').map((s: string) => s.trim()).filter(Boolean).join('<br/>') : 'None'}</div></div>
          ${rd.doctor_notes ? `<div class="section"><div class="section-title">Doctor Notes</div><div class="section-body">${rd.doctor_notes}</div></div>` : ''}
          <div class="footer">Generated from Health Surveillance Platform</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);

    // Log the download
    api.dashboard.logDownload({
      file_type: 'medical_record',
      file_id: rd.id,
      file_name: `Visit_Record_${visitDate}.pdf`,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    }).catch(() => {});
  };

  const handleDownload = async (item: DownloadItem) => {
    if (item.type === 'medical_record') {
      generateVisitPDF(item);
      return;
    }

    setDownloading(item.id);
    try {
      const blob = await api.dashboard.downloadFile(item.id, item.type);
      const filename = item.title.replace(/[^a-zA-Z0-9._-]/g, '_');
      triggerBlobDownload(blob, filename);
      toast.success('Download started');
      // The backend already logged this download; refresh KPI count
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
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
      <div className="rounded-xl border bg-card p-8 text-center">
        <FiDownload className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">Unable to load downloads.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header KPI ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
              <FiFile className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{items?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Available Files</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <FiDownload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{kpis?.total_downloads ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Downloads</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
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
              <p className="text-xs text-muted-foreground">ZIP Archive</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <FiDownload className="h-5 w-5 text-primary-600" />
              Your Files
            </h3>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search files…"
                  className="rounded-lg border border-border pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none w-52"
                />
              </div>
              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              >
                <option value="all">All Types</option>
                <option value="medical_record">Medical Records</option>
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
              <FiInbox className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">No files found</p>
              <p className="text-xs text-muted-foreground">
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
                  className="flex items-center gap-4 px-6 py-4 hover:bg-background transition-colors"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                    <TypeIcon className={`h-5 w-5 ${cfg.color}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {item.type_label}
                      </span>
                      <span>{item.visit_info}</span>
                      <span className="text-muted-foreground/40">•</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(item)}
                    disabled={isDownloading}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 shadow-sm transition-colors hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed"
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
