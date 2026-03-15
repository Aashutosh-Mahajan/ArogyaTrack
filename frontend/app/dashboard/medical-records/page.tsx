'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { PaginatedResponse, MedicalRecord, Allergy, ChronicCondition } from '@/types';
import {
  FiActivity,
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiDownload,
  FiFileText,
  FiRefreshCw,
  FiAlertCircle,
  FiClock,
  FiPaperclip,
  FiEye,
} from 'react-icons/fi';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/components/providers/LanguageProvider';
import toast from 'react-hot-toast';

function MedicalRecordsPage(): React.JSX.Element {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [expandedRecords, setExpandedRecords] = useState<Set<number>>(new Set());
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleReportAction = async (attachmentId: number, fileName: string, isView: boolean) => {
    setDownloadingId(attachmentId);
    try {
      const disposition = isView ? 'inline' : 'attachment';
      const blob = await api.medical.downloadReport(attachmentId, disposition);
      const url = window.URL.createObjectURL(blob);
      if (isView) {
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('Report downloaded successfully');
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
      if (error.response?.status === 401) toast.error('Session expired. Please login again.');
      else if (error.response?.status === 403) toast.error('You do not have permission to access this file.');
      else if (error.response?.status === 404) toast.error('File not found.');
      else toast.error('Failed to download report.');
    } finally {
      setDownloadingId(null);
    }
  };

  const { data: records, isLoading: isLoadingRecords, refetch, isFetching } = useQuery<PaginatedResponse<MedicalRecord>>({
    queryKey: ['medical-records-all'],
    queryFn: () => api.medical.getRecords(),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const { data: allergies, isLoading: isLoadingAllergies } = useQuery<Allergy[]>({
    queryKey: ['allergies'],
    queryFn: () => api.medical.getAllergies(),
  });

  const { data: chronicConditions, isLoading: isLoadingConditions } = useQuery<ChronicCondition[]>({
    queryKey: ['chronic-conditions'],
    queryFn: () => api.medical.getChronicConditions(),
  });

  const isLoading = isLoadingRecords || isLoadingAllergies || isLoadingConditions;

  const toggleRecord = (recordId: number) => {
    setExpandedRecords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const formatDoctorName = (name: string) => {
    if (!name) return '';
    return name.replace(/^Dr\.\s*Dr\.\s*/i, 'Dr. ').trim();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-slate-200 rounded"></div>
          <div className="h-10 w-24 bg-slate-200 rounded"></div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-48 bg-slate-100 rounded-xl"></div>
          <div className="h-48 bg-slate-100 rounded-xl"></div>
        </div>
        <div className="h-96 bg-slate-100 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {t('medical_records_page_title')}
          </h1>
          <p className="text-slate-500 mt-1">
            {t('medical_records_page_subtitle')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 bg-white/50 border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {/* Top Cards: Allergies & Chronic Conditions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Allergies Card */}
        <Card className="border-0 shadow-lg overflow-hidden bg-white/80 backdrop-blur-md">

          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 rounded-lg">
                <FiAlertCircle className="w-5 h-5 text-rose-600" />
              </div>
              <CardTitle className="text-xl font-bold">{t('allergies_title')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {allergies && allergies.length > 0 ? (
              <div className="space-y-3">
                {allergies.map((allergy) => (
                  <div
                    key={allergy.id}
                    className="flex items-center justify-between p-3 bg-rose-50/50 border border-rose-100 rounded-xl hover:shadow-sm transition-all"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{allergy.allergen}</p>
                      <p className="text-xs text-rose-600 font-medium mt-0.5">{allergy.reaction_type}</p>
                      {allergy.added_by_name && (
                        <p className="text-[10px] text-slate-400 mt-1">Added by {allergy.added_by_name}</p>
                      )}
                    </div>
                    <Badge className={`
                                            ${String(allergy.severity).toLowerCase() === 'severe' || allergy.severity === 3
                        ? 'bg-[#dc2626] text-white hover:bg-[#b91c1c]'
                        : String(allergy.severity).toLowerCase() === 'moderate' || allergy.severity === 2
                          ? 'bg-[#d97706] text-white hover:bg-[#b45309]'
                          : 'bg-[#1F6F6A] text-white hover:bg-[#185E59]'}
                                            border-0 uppercase text-[10px] tracking-wider font-bold
                                        `}>
                      {typeof allergy.severity === 'number'
                        ? (allergy.severity === 3 ? t('high') : allergy.severity === 2 ? t('medium') : t('low'))
                        : allergy.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p>{t('no_allergies')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chronic Conditions Card */}
        <Card className="border-0 shadow-lg overflow-hidden bg-white/80 backdrop-blur-md">

          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 rounded-lg">
                <FiClock className="w-5 h-5 text-teal-600" />
              </div>
              <CardTitle className="text-xl font-bold">{t('chronic_conditions')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {chronicConditions && chronicConditions.length > 0 ? (
              <div className="space-y-3">
                {chronicConditions.map((condition) => (
                  <div
                    key={condition.id}
                    className="flex items-center justify-between p-3 bg-teal-50/50 border border-teal-100 rounded-xl hover:shadow-sm transition-all"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{condition.disease_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t('last_recorded')}: {formatDate(condition.created_at)}
                      </p>
                      {condition.added_by_name && (
                        <p className="text-[10px] text-slate-400 mt-1">Added by {condition.added_by_name}</p>
                      )}
                    </div>
                    <Badge className={`
                                            ${condition.is_active
                        ? 'bg-[#1F6F6A] text-white hover:bg-[#185E59]'
                        : 'bg-slate-400 text-white hover:bg-slate-500'}
                                            border-0 uppercase text-[10px] tracking-wider font-bold
                                        `}>
                      {condition.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p>{t('no_active_conditions')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Consultation History */}
      <Card className="border-0 shadow-lg overflow-hidden bg-white/80 backdrop-blur-md">

        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <FiActivity className="w-5 h-5 text-indigo-600" />
            </div>
            <CardTitle className="text-lg">{t('consultation_history')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {records?.results && records.results.length > 0 ? (
            <div className="space-y-4">
              {records.results.map((record) => {
                const isExpanded = expandedRecords.has(record.id);
                return (
                  <div
                    key={record.id}
                    className="group border border-slate-100 rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 bg-white"
                  >
                    {/* Collapsed Header View */}
                    <div
                      className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                      onClick={() => toggleRecord(record.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="hidden sm:flex flex-col items-center justify-center h-12 w-12 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs shrink-0 border border-indigo-100">
                            <span className="text-lg">{new Date(record.visit_date).getDate()}</span>
                            <span className="uppercase">{new Date(record.visit_date).toLocaleDateString('en-US', { month: 'short' })}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <h3 className="font-bold text-slate-800 text-lg">
                                {formatDoctorName(record.doctor_name)}
                              </h3>
                              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 pointer-events-none">
                                {record.department}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 font-medium line-clamp-1">
                              {record.diagnosis}
                            </p>
                            <div className="flex sm:hidden items-center gap-2 mt-2 text-xs text-slate-400">
                              <FiCalendar className="w-3 h-3" />
                              {formatDate(record.visit_date)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className={`
                                                        p-2 rounded-full transition-transform duration-300
                                                        ${isExpanded ? 'bg-indigo-50 text-indigo-600 rotate-180' : 'text-slate-400 group-hover:bg-slate-100'}
                                                    `}>
                            <FiChevronDown className="h-5 w-5" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail View */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-6 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('diagnosis')}</p>
                            <p className="text-slate-800 font-medium">{record.diagnosis}</p>
                          </div>

                          {record.tests_performed && (
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('tests_performed')}</p>
                              <p className="text-slate-800 whitespace-pre-line leading-relaxed">
                                {record.tests_performed}
                              </p>
                            </div>
                          )}
                        </div>

                        {record.prescription && (
                          <div className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100">
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <FiFileText className="w-3 h-3" />
                              {t('prescription')}
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-slate-800 leading-relaxed font-medium">
                              {record.prescription.split(',').map((item: string, i: number) => {
                                const trimmed = item.trim().replace(/\.+$/, '');
                                return trimmed ? <li key={i}>{trimmed}</li> : null;
                              })}
                            </ul>
                          </div>
                        )}

                        {record.doctor_notes && (
                          <div className="bg-amber-50/30 p-4 rounded-xl border border-amber-100">
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <FiFileText className="w-3 h-3" />
                              {t('doctor_notes')}
                            </p>
                            <p className="text-slate-700 whitespace-pre-line leading-relaxed italic">
                              &ldquo;{record.doctor_notes}&rdquo;
                            </p>
                          </div>
                        )}

                        {/* Reports Section - always visible */}
                        <div>
                          <p className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <FiPaperclip className="w-4 h-4 text-indigo-500" />
                            Reports
                            {record.report_attachments && record.report_attachments.length > 0 && (
                              <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 px-2 h-5 min-w-[1.25rem]">
                                {record.report_attachments.length}
                              </Badge>
                            )}
                          </p>
                          {record.report_attachments && record.report_attachments.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {record.report_attachments.map((attachment) => (
                                <div
                                  key={attachment.id}
                                  className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all"
                                >
                                  <div className="p-2 bg-indigo-50 rounded-lg flex-shrink-0">
                                    <FiFileText className="h-4 w-4 text-indigo-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-700 truncate">
                                      {attachment.file_name}
                                    </p>
                                    <p className="text-[10px] text-slate-400 uppercase font-medium mt-0.5">
                                      {attachment.file_type || 'PDF'} · {formatDate(attachment.uploaded_at)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleReportAction(attachment.id, attachment.file_name, true)}
                                      disabled={downloadingId === attachment.id}
                                      className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50"
                                      title="Open in new tab"
                                    >
                                      {downloadingId === attachment.id ? (
                                        <FiRefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <FiEye className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleReportAction(attachment.id, attachment.file_name, false)}
                                      disabled={downloadingId === attachment.id}
                                      className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-50"
                                      title="Download"
                                    >
                                      <FiDownload className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400 italic py-2">No reports uploaded for this visit</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <div className="bg-white p-4 rounded-full shadow-sm inline-block mb-4">
                <FiActivity className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="font-semibold text-slate-900 text-lg mb-1">{t('empty_records')}</h3>
              <p className="text-slate-400">{t('empty_records_desc')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(MedicalRecordsPage, ['patient']);
