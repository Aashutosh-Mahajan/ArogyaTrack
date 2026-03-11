'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RecentRecord } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RecordDetailModal } from '@/components/dashboard/RecordDetailModal';
import toast from 'react-hot-toast';
import {
  FiActivity,
  FiChevronDown,
  FiChevronUp,
  FiEye,
  FiDownload,
  FiCalendar,
  FiUser,
  FiClipboard,
  FiFileText,
  FiAlertCircle,
  FiPaperclip,
  FiRefreshCw,
  FiFile,
} from 'react-icons/fi';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';

/* ─── Single record card ───────────────────────────────────────── */
function RecordCard({ record }: { record: RecentRecord }) {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const statusConfig = {
    completed: {
      label: t('status_completed'),
      badgeClass: 'badge-completed',
    },
    follow_up: {
      label: t('status_follow_up'),
      badgeClass: 'badge-followup',
    },
    critical: {
      label: t('status_critical'),
      badgeClass: 'badge-alert',
    },
  } as const;

  const st = statusConfig[record.status];
  const locale = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-IN';

  const visitDate = new Date(record.visit_date).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const handleDownloadReport = async (attachmentId: number, fileName: string, isView: boolean = false) => {
    setDownloadingId(attachmentId);
    try {
      const disposition = isView ? 'inline' : 'attachment';
      const blob = await api.medical.downloadReport(attachmentId, disposition);

      if (isView) {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      } else {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('Report downloaded successfully');

        // Log the download and refresh KPIs
        api.dashboard.logDownload({
          file_type: 'visit_attachment',
          file_id: attachmentId,
          file_name: fileName,
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-downloads'] });
        }).catch(() => {});
      }
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Failed to download report.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <div className="record-item group">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
          {/* Left icon */}
          <div className="record-icon hidden sm:flex">
            <FiActivity className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 w-full">
            {/* Top line */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="record-title">
                  {record.diagnosis_summary}
                </p>
                <div className="record-meta mt-2">
                  <span className="inline-flex items-center gap-1.5">
                    <FiUser className="h-3.5 w-3.5" />
                    Dr. {record.doctor_name}
                  </span>
                  <span className="text-[#3D5B50] hidden sm:inline">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <FiCalendar className="h-3.5 w-3.5" />
                    {visitDate}
                  </span>
                </div>
              </div>

              {/* Status badge */}
              <span className={`badge ${st.badgeClass} shrink-0 hidden sm:inline-flex`}>
                {st.label}
              </span>
            </div>

            {/* Summary pills */}
            <div className="record-tags mt-3">
              {record.tests_performed && (
                <span className="tag">
                  <FiClipboard className="h-3.5 w-3.5 text-[#10B981]" />
                  {record.tests_performed.split('\n')[0].slice(0, 30)}...
                </span>
              )}
              {record.prescriptions_count > 0 && (
                <span className="tag">
                  <FiFileText className="h-3.5 w-3.5 text-[#10B981]" />
                  {record.prescriptions_count} {t('prescription')}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-row items-center justify-between sm:justify-end gap-2 shrink-0 md:ml-2 w-full sm:w-auto mt-2 sm:mt-0">
            <span className={`badge ${st.badgeClass} sm:hidden`}>
              {st.label}
            </span>
            <div className="flex flex-row items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                onClick={() => setModalOpen(true)}
                title={t('view')}
              >
                <FiEye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                onClick={() => setExpanded((prev) => !prev)}
                title={expanded ? t('collapse') : t('expand')}
              >
                {expanded ? (
                  <FiChevronUp className="h-4 w-4" />
                ) : (
                  <FiChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Expanded section */}
        {expanded && (
          <div className="px-5 pb-5 pt-0 mt-1 border-t border-[rgba(16,185,129,0.1)] bg-white/5 space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Diagnosis */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                  {t('diagnosis')}
                </p>
                <p className="text-sm text-white leading-relaxed font-medium">
                  {record.diagnosis_summary || 'N/A'}
                </p>
              </div>

              {/* Tests */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1.5">
                  {t('tests_performed')}
                </p>
                <p className="text-sm text-white leading-relaxed font-medium">
                  {record.tests_performed || t('none')}
                </p>
              </div>

              {/* Prescription */}
              {record.prescription_text && (
                <div className="sm:col-span-2">
                  <div className="bg-[#0B0F19] border border-[rgba(16,185,129,0.1)] rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2 flex items-center gap-2">
                      <FiFileText className="w-3 h-3" />
                      {t('prescription')}
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-[#D1D5DB] leading-relaxed">
                      {record.prescription_text.split(',').map((item: string, i: number) => {
                        const trimmed = item.trim().replace(/\.+$/, '');
                        return trimmed ? <li key={i}>{trimmed}</li> : null;
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* 📂 Reports Section */}
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                  {t('reports')}
                </p>
                {record.attachments.length > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0B0F19] border border-white/10 text-[#10B981]">
                    {record.attachments.length}
                  </span>
                )}
              </div>

              {record.attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {record.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="group flex items-center gap-3 p-3 rounded-xl border border-[rgba(16,185,129,0.1)] bg-[#0B0F19] hover:border-[rgba(16,185,129,0.3)] transition-all"
                    >
                      <div className="h-10 w-10 rounded-lg bg-[rgba(16,185,129,0.1)] text-[#10B981] flex items-center justify-center flex-shrink-0">
                        <FiFile className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {att.file_name}
                        </p>
                        <p className="text-[10px] text-[#9CA3AF] mt-0.5 lowercase">
                          {att.file_type.split('/')[1] || 'file'} • {new Date(att.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadReport(att.id, att.file_name, true)}
                          disabled={downloadingId === att.id}
                          className="h-8 w-8 text-[#10B981] hover:bg-white/5"
                          title={t('view')}
                        >
                          <FiEye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadReport(att.id, att.file_name, false)}
                          disabled={downloadingId === att.id}
                          className="h-8 w-8 text-[#9CA3AF] hover:bg-white/5"
                          title={t('download')}
                        >
                          <FiDownload className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 bg-[#0B0F19]/50 rounded-xl border border-dashed border-white/10">
                  <p className="text-xs text-[#9CA3AF] italic">{t('no_reports')}</p>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto gap-2 text-xs font-medium bg-[#0B0F19] border border-[rgba(16,185,129,0.2)] text-[#10B981] hover:bg-[rgba(16,185,129,0.1)]"
              onClick={() => setModalOpen(true)}
            >
              <FiDownload className="h-3.5 w-3.5" />
              {t('download_pdf')}
            </Button>
          </div>
        )}
      </div>

      <RecordDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        record={record}
      />
    </>
  );
}

/* ─── Main component ───────────────────────────────────────────── */
export function RecentRecords() {
  const { t } = useLanguage();
  const { data: records, isLoading, refetch, isFetching } = useQuery<RecentRecord[]>({
    queryKey: ['dashboard-recent-records'],
    queryFn: () => api.dashboard.getRecentRecords({ limit: 10 }),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  return (
    <div className="content-card">
      <div className="section-header flex justify-between w-full">
        <div className="flex items-center gap-2">
          <div className="bar" />
          <h2>{t('recent_records_title')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="hover:bg-white/5 text-[#9CA3AF] hover:text-white"
            title={t('refresh')}
          >
            <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Link href="/dashboard/medical-records">
            <button className="text-[11px] font-semibold text-[#10B981] bg-[rgba(16,185,129,0.1)] hover:bg-[rgba(16,185,129,0.15)] px-3 py-1.5 rounded-lg transition-colors hidden sm:block">
              {t('view_all')}
            </button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-[12px]">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-[rgba(16,185,129,0.1)] p-5 bg-[#0B0F19]"
              >
                <div className="flex gap-4">
                  <div className="hidden sm:block h-12 w-12 bg-white/5 rounded-xl" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-1/3 bg-white/10 rounded" />
                    <div className="h-3 w-1/2 bg-white/5 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : records && records.length > 0 ? (
          records.map((record) => <RecordCard key={record.id} record={record} />)
        ) : (
          <div className="text-center py-16 bg-[#0B0F19]/50 rounded-2xl border border-dashed border-[rgba(16,185,129,0.2)]">
            <div className="bg-white/5 p-4 rounded-full shadow-sm inline-block mb-4">
              <FiFileText className="h-8 w-8 text-[#9CA3AF]" />
            </div>
            <p className="font-semibold text-white">{t('empty_records')}</p>
            <p className="text-sm text-[#9CA3AF] mt-1 max-w-xs mx-auto">
              {t('empty_records_desc')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
