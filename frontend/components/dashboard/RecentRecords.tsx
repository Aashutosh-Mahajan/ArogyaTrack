'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

  const statusConfig = {
    completed: {
      label: t('status_completed'),
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
    },
    follow_up: {
      label: t('status_follow_up'),
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
    },
    critical: {
      label: t('status_critical'),
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      dot: 'bg-rose-500',
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
      <div
        className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg ${record.status === 'critical'
            ? 'border-rose-100 bg-rose-50/20'
            : 'border-slate-100 bg-white hover:border-slate-200'
          }`}
      >
        {/* Main row */}
        <div className="p-5 flex items-start gap-5">
          {/* Left icon */}
          <div className={`hidden sm:flex rounded-2xl p-3 shrink-0 transition-colors ${record.status === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-blue-50 text-blue-600'
            }`}>
            <FiActivity className="h-6 w-6" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Top line */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-base font-bold text-slate-800 truncate">
                  {record.diagnosis_summary}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <FiUser className="h-3.5 w-3.5" />
                    Dr. {record.doctor_name}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <FiCalendar className="h-3.5 w-3.5" />
                    {visitDate}
                  </span>
                </div>
              </div>

              {/* Status badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border shrink-0 ${st.bg} ${st.text} ${st.border}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot} animate-pulse`} />
                {st.label}
              </span>
            </div>

            {/* Summary pills */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {record.tests_performed && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                  <FiClipboard className="h-3.5 w-3.5 text-slate-400" />
                  {record.tests_performed.split('\n')[0].slice(0, 30)}...
                </span>
              )}
              {record.prescriptions_count > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                  <FiFileText className="h-3.5 w-3.5 text-slate-400" />
                  {record.prescriptions_count} {t('prescription')}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0 ml-2">
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

        {/* Expanded section */}
        {expanded && (
          <div className="px-5 pb-5 pt-0 mt-1 border-t border-slate-50 bg-slate-50/30 space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Diagnosis */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {t('diagnosis')}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  {record.diagnosis_summary || 'N/A'}
                </p>
              </div>

              {/* Tests */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {t('tests_performed')}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  {record.tests_performed || t('none')}
                </p>
              </div>

              {/* Prescription */}
              {record.prescription_text && (
                <div className="sm:col-span-2">
                  <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                      <FiFileText className="w-3 h-3" />
                      {t('prescription')}
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 leading-relaxed">
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
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('reports')}
                </p>
                {record.attachments.length > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                    {record.attachments.length}
                  </span>
                )}
              </div>

              {record.attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {record.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="group flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm transition-all"
                    >
                      <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <FiFile className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">
                          {att.file_name}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 lowercase">
                          {att.file_type.split('/')[1] || 'file'} • {new Date(att.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadReport(att.id, att.file_name, true)}
                          disabled={downloadingId === att.id}
                          className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                          title={t('view')}
                        >
                          <FiEye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadReport(att.id, att.file_name, false)}
                          disabled={downloadingId === att.id}
                          className="h-8 w-8 text-slate-500 hover:bg-slate-100"
                          title={t('download')}
                        >
                          <FiDownload className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400 italic">{t('no_reports')}</p>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto gap-2 text-xs font-medium"
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
    <Card className="border-0 shadow-lg overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-400"></div>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FiActivity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('recent_records_title')}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Latest medical history and checkups</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 w-8 text-slate-400 hover:text-blue-600"
              title={t('refresh')}
            >
              <FiRefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Link href="/dashboard/medical-records">
              <Button variant="outline" size="sm" className="hidden sm:flex text-xs h-8">
                {t('view_all')}
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-slate-100 p-5 bg-white"
              >
                <div className="flex gap-4">
                  <div className="hidden sm:block h-12 w-12 bg-slate-100 rounded-xl" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-1/3 bg-slate-200 rounded" />
                    <div className="h-3 w-1/2 bg-slate-100 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : records && records.length > 0 ? (
          records.map((record) => <RecordCard key={record.id} record={record} />)
        ) : (
          <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <div className="bg-white p-4 rounded-full shadow-sm inline-block mb-4">
              <FiFileText className="h-8 w-8 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-600">{t('empty_records')}</p>
            <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
              {t('empty_records_desc')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
